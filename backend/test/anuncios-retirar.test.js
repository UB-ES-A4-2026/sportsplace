import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado, createAnunciosRepository } from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { ACCIONES, transicionNoPermitida } from '../src/services/transiciones-anuncio.js';
import { startApi } from './helpers.js';

// US-70: DELETE /api/anuncios/:id (CA7-CA12) con el servicio de transiciones.
// Los dobles simulan Supabase Auth y la tabla anuncios con la misma regla que
// el UPDATE ... WHERE estado IN (...) y el filtro estado <> 'retirado'.
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let filas;
let caida;
const visible = (usuarioId, id) => filas.find(
  (fila) => fila.id === id && fila.centro_id === centroDe[usuarioId] && fila.estado !== 'retirado',
);
const fakeAnuncios = {
  async obtener(usuarioId, id) {
    const anuncio = visible(usuarioId, id);
    if (!anuncio) throw anuncioNoEncontrado();
    return { ...anuncio };
  },
  async transicionar(usuarioId, id, { desde, hacia }) {
    if (caida) throw databaseUnavailable();
    const anuncio = visible(usuarioId, id);
    if (!anuncio) throw anuncioNoEncontrado();
    if (!desde.includes(anuncio.estado)) throw transicionNoPermitida(anuncio.estado);
    anuncio.estado = hacia;
    if (hacia === 'retirado') anuncio.retirado_en = '2026-11-04T09:00:00.000Z';
    return { ...anuncio };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => {
  filas = [];
  caida = false;
});

function anuncioDe(centro, estado) {
  const anuncio = { id: randomUUID(), centro_id: centro, titulo: 'Conos de entrenamiento', estado, retirado_en: null };
  filas.push(anuncio);
  return anuncio;
}

const conToken = (token) => (token ? { Authorization: `Bearer ${token}` } : {});
const retirar = (id, token = 'token-a') => fetch(`${api.baseUrl}/api/anuncios/${id}`, { method: 'DELETE', headers: conToken(token) });
const ver = (id, token = 'token-a') => fetch(`${api.baseUrl}/api/anuncios/${id}`, { headers: conToken(token) });
const NO_ENCONTRADO = { error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' } };

test('US-70 «Base común»: se retira desde borrador, activo, pausado y reservado', () => {
  assert.deepEqual(ACCIONES.retirar, { desde: ['borrador', 'activo', 'pausado', 'reservado'], hacia: 'retirado' });
});

test('US-70 CA7/CA10/E2E-1: retirar responde 204 sin cuerpo y la fila se conserva como retirada', async () => {
  for (const estado of ['activo', 'pausado', 'reservado']) {
    const anuncio = anuncioDe('centro-a', estado);
    const response = await retirar(anuncio.id);

    assert.equal(response.status, 204, `desde ${estado}`);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(anuncio.estado, 'retirado');
    assert.ok(anuncio.retirado_en);
  }
  assert.equal(filas.length, 3);
});

test('US-70 CA5/CA11/E2E-1: después, la ficha y las transiciones dan 404 también al propietario', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  assert.equal((await retirar(id)).status, 204);

  const ficha = await ver(id);
  assert.equal(ficha.status, 404);
  assert.deepEqual(await ficha.json(), NO_ENCONTRADO);

  const pausar = await fetch(`${api.baseUrl}/api/anuncios/${id}/pausar`, { method: 'POST', headers: conToken('token-a') });
  assert.equal(pausar.status, 404);
});

test('US-70 CA12/E2E-4: un segundo DELETE seguido responde 404', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  assert.equal((await retirar(id)).status, 204);

  const segundo = await retirar(id);
  assert.equal(segundo.status, 404);
  assert.deepEqual(await segundo.json(), NO_ENCONTRADO);
});

test('US-70 CA8/E2E-3: un anuncio entregado no se puede retirar (409 con estado_actual)', async () => {
  const anuncio = anuncioDe('centro-a', 'entregado');
  const response = await retirar(anuncio.id);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'TRANSICION_NO_PERMITIDA',
      message: 'Esta acción no está disponible en el estado actual del anuncio.',
      details: { estado_actual: 'entregado' },
    },
  });
  assert.equal(anuncio.estado, 'entregado');
});

test('US-70 CA8/E2E-4: otro centro, inexistente o id no UUID dan 404 y el anuncio sigue activo', async () => {
  const deA = anuncioDe('centro-a', 'activo');
  for (const id of [deA.id, randomUUID(), 'no-es-un-uuid']) {
    const response = await retirar(id, 'token-b');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), NO_ENCONTRADO);
  }
  assert.equal(deA.estado, 'activo');
});

test('US-70 CA9: sin sesión 401 y sin confirmar el email 403, sin retirar nada', async () => {
  const anuncio = anuncioDe('centro-a', 'activo');

  const sinToken = await retirar(anuncio.id, null);
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await retirar(anuncio.id, 'token-sin-confirmar');
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');
  assert.equal(anuncio.estado, 'activo');
});

test('US-70: con la base de datos caída responde 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  const { id } = anuncioDe('centro-a', 'activo');
  caida = true;
  const response = await retirar(id);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-70: /:id admite GET y DELETE; el resto responde 405 con Allow', async () => {
  const response = await fetch(`${api.baseUrl}/api/anuncios/${randomUUID()}`, { method: 'PUT', headers: conToken('token-a') });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, DELETE');
});

test('US-70 CA7: el repositorio retira con un UPDATE (no DELETE) que pone retirado_en', async () => {
  const log = [];
  const database = {
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      return { rows: [{ id: values[1], estado: 'retirado' }] };
    },
  };
  const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
  await createAnunciosRepository(database).transicionar('u1', id, ACCIONES.retirar);

  assert.match(log[0].sql, /^UPDATE public\.anuncios /);
  assert.doesNotMatch(log[0].sql, /DELETE/);
  assert.match(log[0].sql, /retirado_en = CASE WHEN \$3::text = 'retirado' THEN now\(\) END/);
  assert.deepEqual(log[0].values, ['u1', id, 'retirado', ['borrador', 'activo', 'pausado', 'reservado']]);
});
