import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado } from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { startApi } from './helpers.js';

const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const usuarios = {
  confirmado: { id: 'comprador', email_confirmado: true },
  propietario: { id: 'propietario', email_confirmado: true },
  pendiente: { id: 'pendiente', email_confirmado: false },
};
const auth = { getUser: async (token) => usuarios[token] ?? null };
const detalle = {
  id,
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Primera línea.\n<script>alert(1)</script>',
  categoria: 'balones',
  deporte: 'futbol',
  estado_material: 'buen_estado',
  unidades_disponibles: 12,
  modalidad: 'venta',
  precio_unitario_centimos: 1250,
  estado: 'activo',
  publicado_en: '2026-11-08T10:00:00.000Z',
  fotos: [{ url: 'https://storage.test/principal.jpg', orden: 2, es_principal: true }],
  centro: { id: 'centro-a', nombre: 'CE Montjuïc', localidad: 'Barcelona' },
  distancia_km: 12.4,
  es_favorito: false,
  es_propio: false,
};
let consultas;
let resultado;
let fallo;
let api;
before(async () => {
  api = await startApi({
    auth,
    anuncios: {
      async obtenerCatalogo(usuarioId, anuncioId) {
        consultas.push({ usuarioId, anuncioId });
        if (fallo) throw fallo;
        return { ...resultado, es_propio: usuarioId === 'propietario' };
      },
      async obtener(usuarioId, anuncioId) {
        if (usuarioId !== 'propietario' || anuncioId !== id) throw anuncioNoEncontrado();
        return { ...detalle, centro_id: 'centro-a', estado: 'pausado' };
      },
    },
  });
});
after(() => api.close());
beforeEach(() => {
  consultas = [];
  resultado = detalle;
  fallo = null;
});
const ver = (anuncioId = id, token = 'confirmado') => fetch(`${api.baseUrl}/api/catalogo/${anuncioId}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

test('US-24 CA12/CA15: detalle privado en el contrato de catálogo, sin envoltorio y sin caché', async () => {
  const response = await ver();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), detalle);
  assert.deepEqual(consultas, [{ usuarioId: 'comprador', anuncioId: id }]);
});

test('US-24 CA4/CA12: el anuncio reservado sigue siendo visible con su estado', async () => {
  resultado = { ...detalle, estado: 'reservado', modalidad: 'donacion', precio_unitario_centimos: null };
  const response = await ver();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), resultado);
});

test('US-24 CA13: un UUID inválido devuelve 404 sin consultar el repositorio', async () => {
  for (const invalido of ['1234', 'no-es-un-uuid', `${id}x`]) {
    const response = await ver(invalido);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' } });
  }
  assert.deepEqual(consultas, []);
});

test('US-24 CA13: el anuncio no visible responde con el mismo 404 genérico', async () => {
  fallo = anuncioNoEncontrado();
  const response = await ver();
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' } });
});

test('US-24 CA14: el anuncio propio permite que la web elija la ficha de propietario', async () => {
  const response = await ver(id, 'propietario');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).es_propio, true);
});

test('US-24 CA16: sin sesión, token inválido o email sin confirmar no se consulta el anuncio', async () => {
  for (const [token, status, code] of [
    [null, 401, 'NO_AUTENTICADO'],
    ['caducado', 401, 'NO_AUTENTICADO'],
    ['pendiente', 403, 'EMAIL_NO_CONFIRMADO'],
  ]) {
    const response = await ver(id, token);
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  }
  assert.deepEqual(consultas, []);
});

test('US-24 CA11: un fallo de PostgreSQL conserva el error 503 de la API', async () => {
  fallo = databaseUnavailable();
  const response = await ver();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-24: solo admite GET; otros métodos devuelven 405 y Allow', async () => {
  const response = await fetch(`${api.baseUrl}/api/catalogo/${id}`, {
    method: 'DELETE', headers: { Authorization: 'Bearer confirmado' },
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal((await response.json()).error.code, 'METODO_NO_PERMITIDO');
  assert.deepEqual(consultas, []);
});

test('Regresión E03: /api/anuncios/:id conserva el envoltorio y la ficha privada de anuncios pausados', async () => {
  const response = await fetch(`${api.baseUrl}/api/anuncios/${id}`, {
    headers: { Authorization: 'Bearer propietario' },
  });
  assert.equal(response.status, 200);
  const cuerpo = await response.json();
  assert.equal(cuerpo.anuncio.estado, 'pausado');
  assert.equal(cuerpo.anuncio.centro_id, 'centro-a');
  const ajeno = await fetch(`${api.baseUrl}/api/anuncios/${id}`, {
    headers: { Authorization: 'Bearer confirmado' },
  });
  assert.equal(ajeno.status, 404);
  assert.deepEqual(consultas, []);
});
