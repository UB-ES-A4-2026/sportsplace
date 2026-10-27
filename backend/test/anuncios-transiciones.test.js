import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado } from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { ACCIONES, transicionNoPermitida } from '../src/services/transiciones-anuncio.js';
import { startApi } from './helpers.js';

// US-16: POST /api/anuncios/:id/pausar y /reactivar (CA3, CA5-CA9) y el
// servicio común de transiciones. Los dobles simulan Supabase Auth y la tabla
// anuncios con la misma regla que el UPDATE ... WHERE estado IN (...).
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let filas;
let caida;
let llamadas;
const fakeAnuncios = {
  async transicionar(usuarioId, id, { desde, hacia }) {
    llamadas.push({ usuarioId, id, desde, hacia });
    if (caida) throw databaseUnavailable();
    const anuncio = filas.find((fila) => fila.id === id && fila.centro_id === centroDe[usuarioId] && fila.estado !== 'retirado');
    if (!anuncio) throw anuncioNoEncontrado();
    if (!desde.includes(anuncio.estado)) throw transicionNoPermitida(anuncio.estado);
    anuncio.estado = hacia;
    anuncio.actualizado_en = '2026-11-04T09:00:00.000Z';
    return { ...anuncio };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => {
  filas = [];
  caida = false;
  llamadas = [];
});

function anuncioDe(centro, estado) {
  const anuncio = {
    id: randomUUID(),
    centro_id: centro,
    titulo: 'Balones de fútbol talla 5',
    descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
    categoria: 'balones',
    deporte: 'futbol',
    unidades_disponibles: 12,
    estado_material: 'buen_estado',
    modalidad: 'donacion',
    precio_unitario_centimos: null,
    estado,
    fotos: [],
    publicado_en: '2026-11-03T10:15:00.000Z',
    creado_en: '2026-11-03T10:15:00.000Z',
    actualizado_en: '2026-11-03T10:15:00.000Z',
  };
  filas.push(anuncio);
  return anuncio;
}

const accion = (id, nombre, { token = 'token-a', method = 'POST' } = {}) => fetch(
  `${api.baseUrl}/api/anuncios/${id}/${nombre}`,
  { method, headers: token ? { Authorization: `Bearer ${token}` } : {} },
);

const NO_PERMITIDA = 'Esta acción no está disponible en el estado actual del anuncio.';

test('US-16 «Base común»: pausar va de activo a pausado y reactivar de pausado a activo', () => {
  assert.deepEqual(ACCIONES.pausar, { desde: ['activo'], hacia: 'pausado' });
  assert.deepEqual(ACCIONES.reactivar, { desde: ['pausado'], hacia: 'activo' });
  assert.ok(Object.isFrozen(ACCIONES) && Object.isFrozen(ACCIONES.pausar.desde));
});

test('US-16 CA6/CA3/E2E-1: pausar un anuncio activo responde 200 con el anuncio pausado', async () => {
  const { id } = anuncioDe('centro-a', 'activo');

  const response = await accion(id, 'pausar');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { anuncio } = await response.json();
  assert.equal(anuncio.id, id);
  assert.equal(anuncio.estado, 'pausado');
  assert.deepEqual(llamadas, [{ usuarioId: 'usuario-a', id, desde: ['activo'], hacia: 'pausado' }]);
});

test('US-16 CA7/E2E-1: reactivar un anuncio pausado responde 200 con el anuncio activo', async () => {
  const { id } = anuncioDe('centro-a', 'pausado');

  const response = await accion(id, 'reactivar');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).anuncio.estado, 'activo');
});

test('US-16 CA5: la respuesta solo cambia el estado y actualizado_en', async () => {
  const original = { ...anuncioDe('centro-a', 'activo') };

  const { anuncio } = await (await accion(original.id, 'pausar')).json();
  assert.deepEqual(anuncio, { ...original, estado: 'pausado', actualizado_en: '2026-11-04T09:00:00.000Z' });
});

test('US-16 CA8: pausar un anuncio ya pausado da 409 (no es idempotente)', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  assert.equal((await accion(id, 'pausar')).status, 200);

  const segunda = await accion(id, 'pausar');
  assert.equal(segunda.status, 409);
  assert.deepEqual(await segunda.json(), {
    error: { code: 'TRANSICION_NO_PERMITIDA', message: NO_PERMITIDA, details: { estado_actual: 'pausado' } },
  });
});

test('US-16 CA8/E2E-3: desde cualquier otro estado responde 409 con estado_actual', async () => {
  const casos = [
    ['pausar', 'reservado'], ['pausar', 'entregado'],
    ['reactivar', 'activo'], ['reactivar', 'reservado'], ['reactivar', 'entregado'],
  ];
  for (const [nombre, estado] of casos) {
    const anuncio = anuncioDe('centro-a', estado);
    const response = await accion(anuncio.id, nombre);
    assert.equal(response.status, 409, `${nombre} desde ${estado}`);
    assert.deepEqual((await response.json()).error.details, { estado_actual: estado });
    assert.equal(anuncio.estado, estado);
  }
});

test('US-16 CA9/E2E-5: otro centro, inexistente, retirado o id no UUID dan el mismo 404', async () => {
  const deA = anuncioDe('centro-a', 'activo');
  const retirado = anuncioDe('centro-b', 'retirado');
  const esperado = { error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' } };

  for (const id of [deA.id, randomUUID(), retirado.id, 'no-es-un-uuid']) {
    const response = await accion(id, 'pausar', { token: 'token-b' });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), esperado);
  }
  assert.equal(deA.estado, 'activo');
});

test('US-16 CA9: sin sesión 401 y sin confirmar el email 403, sin tocar el anuncio', async () => {
  const { id } = anuncioDe('centro-a', 'activo');

  const sinToken = await accion(id, 'pausar', { token: null });
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await accion(id, 'reactivar', { token: 'token-sin-confirmar' });
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');
  assert.deepEqual(llamadas, []);
});

test('US-16 CA9: GET (y cualquier método distinto de POST) responde 405 con Allow: POST', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  for (const [nombre, method] of [['pausar', 'GET'], ['reactivar', 'GET'], ['pausar', 'PUT'], ['reactivar', 'DELETE']]) {
    const response = await accion(id, nombre, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.equal((await response.json()).error.code, 'METODO_NO_PERMITIDO');
  }
  assert.deepEqual(llamadas, []);
});

test('US-16 CA6: un cuerpo en la petición se ignora', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  const response = await fetch(`${api.baseUrl}/api/anuncios/${id}/pausar`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-a', 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'entregado', hacia: 'entregado' }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).anuncio.estado, 'pausado');
});

test('US-16: con la base de datos caída o sin configurar responde 503', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  caida = true;
  const response = await accion(id, 'pausar');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');

  const sinBase = await startApi({ auth: fakeAuth });
  try {
    const sinConfigurar = await fetch(`${sinBase.baseUrl}/api/anuncios/${id}/pausar`, {
      method: 'POST', headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(sinConfigurar.status, 503);
  } finally {
    await sinBase.close();
  }
});

test('US-16: las rutas de US-12 siguen igual (GET /:id no acepta POST)', async () => {
  const response = await fetch(`${api.baseUrl}/api/anuncios/${randomUUID()}`, {
    method: 'POST', headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});
