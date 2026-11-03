import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado } from '../src/repositories/anuncios.js';
import { ACCIONES, transicionNoPermitida } from '../src/services/transiciones-anuncio.js';
import { startApi } from './helpers.js';

// US-17 (T17-1): rutas reservar, quitar-reserva y entregar, y la tabla completa
// «Estados del anuncio y transiciones» de E03 a través de la API. El doble de
// la tabla aplica la misma regla que el UPDATE ... WHERE estado IN (...) y el
// filtro estado <> 'retirado' del repositorio.
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let filas;
const fakeAnuncios = {
  async transicionar(usuarioId, id, { desde, hacia }) {
    const anuncio = filas.find((fila) => fila.id === id && fila.centro_id === centroDe[usuarioId] && fila.estado !== 'retirado');
    if (!anuncio) throw anuncioNoEncontrado();
    if (!desde.includes(anuncio.estado)) throw transicionNoPermitida(anuncio.estado);
    anuncio.estado = hacia;
    anuncio.entregado_en = hacia === 'entregado' ? '2026-11-04T09:00:00.000Z' : null;
    return { ...anuncio };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => { filas = []; });

function anuncioDe(estado, centro = 'centro-a') {
  const anuncio = {
    id: randomUUID(), centro_id: centro, titulo: 'Balones de fútbol talla 5', estado,
    unidades_disponibles: 12, modalidad: 'venta', precio_unitario_centimos: 850, fotos: [], entregado_en: null,
  };
  filas.push(anuncio);
  return anuncio;
}

// Cada acción de la API: método y ruta.
const RUTAS = {
  pausar: ['POST', 'pausar'],
  reactivar: ['POST', 'reactivar'],
  reservar: ['POST', 'reservar'],
  'quitar-reserva': ['POST', 'quitar-reserva'],
  entregar: ['POST', 'entregar'],
  retirar: ['DELETE', ''],
};

function accion(nombre, id, token = 'token-a', metodo) {
  const [method, ruta] = RUTAS[nombre];
  return fetch(`${api.baseUrl}/api/anuncios/${id}${ruta ? `/${ruta}` : ''}`, {
    method: metodo ?? method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// «Estados del anuncio y transiciones» (E03): estado de llegada si la acción
// está permitida, 409 si no y 404 si el anuncio está retirado.
// `borrador` llega con US-20 y su paso a `activo` («publicar») con US-90.
const TABLA = {
  borrador: { pausar: 409, reactivar: 409, reservar: 409, 'quitar-reserva': 409, entregar: 409, retirar: 'retirado' },
  activo: { pausar: 'pausado', reactivar: 409, reservar: 'reservado', 'quitar-reserva': 409, entregar: 'entregado', retirar: 'retirado' },
  pausado: { pausar: 409, reactivar: 'activo', reservar: 409, 'quitar-reserva': 409, entregar: 409, retirar: 'retirado' },
  reservado: { pausar: 409, reactivar: 409, reservar: 409, 'quitar-reserva': 'activo', entregar: 'entregado', retirar: 'retirado' },
  entregado: { pausar: 409, reactivar: 409, reservar: 409, 'quitar-reserva': 409, entregar: 409, retirar: 409 },
  retirado: { pausar: 404, reactivar: 404, reservar: 404, 'quitar-reserva': 404, entregar: 404, retirar: 404 },
};

test('US-17 CA7 «Base común»: ACCIONES coincide con la tabla de transiciones', () => {
  assert.deepEqual(Object.keys(ACCIONES).sort(), Object.keys(RUTAS).sort());
  for (const [nombre, { desde, hacia }] of Object.entries(ACCIONES)) {
    const permitidos = Object.keys(TABLA).filter((estado) => typeof TABLA[estado][nombre] === 'string');
    assert.deepEqual([...desde].sort(), permitidos.sort(), `desde de ${nombre}`);
    for (const estado of permitidos) assert.equal(TABLA[estado][nombre], hacia, `${nombre} desde ${estado}`);
  }
});

for (const [estado, fila] of Object.entries(TABLA)) {
  test(`US-17 tabla de transiciones: desde «${estado}», las 6 acciones de estado`, async () => {
    for (const [nombre, esperado] of Object.entries(fila)) {
      const anuncio = anuncioDe(estado);
      const response = await accion(nombre, anuncio.id);
      const contexto = `${nombre} desde ${estado}`;

      if (typeof esperado === 'string') {
        assert.equal(response.status, nombre === 'retirar' ? 204 : 200, contexto);
        if (nombre !== 'retirar') assert.equal((await response.json()).anuncio.estado, esperado, contexto);
        assert.equal(anuncio.estado, esperado, contexto);
      } else {
        assert.equal(response.status, esperado, contexto);
        const { error } = await response.json();
        if (esperado === 409) {
          assert.equal(error.code, 'TRANSICION_NO_PERMITIDA', contexto);
          assert.deepEqual(error.details, { estado_actual: estado }, contexto);
        } else {
          assert.equal(error.code, 'NO_ENCONTRADO', contexto);
        }
        assert.equal(anuncio.estado, estado, `${contexto}: el estado no cambia`);
      }
    }
  });
}

test('US-17 CA7/E2E-1: reservar, quitar la reserva y entregar responden 200 { anuncio }', async () => {
  const anuncio = anuncioDe('activo');

  const reservado = await accion('reservar', anuncio.id);
  assert.equal(reservado.status, 200);
  assert.equal((await reservado.json()).anuncio.estado, 'reservado');

  const activo = await accion('quitar-reserva', anuncio.id);
  assert.equal((await activo.json()).anuncio.estado, 'activo');

  const entregado = await (await accion('entregar', anuncio.id)).json();
  assert.equal(entregado.anuncio.estado, 'entregado');
  assert.ok(entregado.anuncio.entregado_en);
});

test('US-17 CA5: un cambio de estado no toca unidades, precio ni fotos', async () => {
  const anuncio = anuncioDe('activo');
  const { anuncio: devuelto } = await (await accion('entregar', anuncio.id)).json();
  assert.equal(devuelto.unidades_disponibles, 12);
  assert.equal(devuelto.precio_unitario_centimos, 850);
  assert.deepEqual(devuelto.fotos, []);
});

test('US-17 CA9/E2E-4: entregar o reservar desde pausado da 409 con estado_actual pausado', async () => {
  for (const nombre of ['entregar', 'reservar']) {
    const anuncio = anuncioDe('pausado');
    const response = await accion(nombre, anuncio.id);
    assert.equal(response.status, 409);
    assert.deepEqual((await response.json()).error.details, { estado_actual: 'pausado' });
  }
});

test('US-17 CA10: entregar dos veces, la segunda da 409', async () => {
  const anuncio = anuncioDe('reservado');
  assert.equal((await accion('entregar', anuncio.id)).status, 200);
  const segunda = await accion('entregar', anuncio.id);
  assert.equal(segunda.status, 409);
  assert.deepEqual((await segunda.json()).error.details, { estado_actual: 'entregado' });
});

test('US-17 CA8: 401, 403 y 404 (otro centro, inexistente, id no UUID) como en US-16', async () => {
  const deA = anuncioDe('activo');
  for (const nombre of ['reservar', 'quitar-reserva', 'entregar']) {
    assert.equal((await accion(nombre, deA.id, null)).status, 401);
    assert.equal((await accion(nombre, deA.id, 'token-sin-confirmar')).status, 403);
    for (const id of [deA.id, randomUUID(), 'no-es-un-uuid']) {
      assert.equal((await accion(nombre, id, 'token-b')).status, 404, `${nombre} ${id}`);
    }
  }
  assert.equal(deA.estado, 'activo');
});

test('US-17: GET en las tres rutas nuevas responde 405 con Allow: POST', async () => {
  const anuncio = anuncioDe('activo');
  for (const nombre of ['reservar', 'quitar-reserva', 'entregar']) {
    const response = await accion(nombre, anuncio.id, 'token-a', 'GET');
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  }
  assert.equal(anuncio.estado, 'activo');
});
