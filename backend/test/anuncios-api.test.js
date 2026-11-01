import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado } from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { postJson, startApi } from './helpers.js';

// US-12: POST /api/anuncios y GET /api/anuncios/:id (CA15-CA24).
// Los dobles simulan Supabase Auth (tokens) y la tabla anuncios con su propiedad.
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let filas;
let creaciones;
let caida;
const fakeAnuncios = {
  async crear(usuarioId, datos) {
    if (caida) throw databaseUnavailable();
    creaciones.push(datos);
    const ahora = '2026-11-03T10:15:00.000Z';
    const anuncio = {
      id: randomUUID(), centro_id: centroDe[usuarioId], ...datos,
      modalidad: 'donacion', precio_unitario_centimos: null, estado: 'activo', fotos: [],
      publicado_en: ahora, creado_en: ahora, actualizado_en: ahora,
    };
    filas.push(anuncio);
    return anuncio;
  },
  async obtener(usuarioId, id) {
    if (caida) throw databaseUnavailable();
    const anuncio = filas.find((fila) => fila.id === id && fila.centro_id === centroDe[usuarioId] && fila.estado !== 'retirado');
    if (!anuncio) throw anuncioNoEncontrado();
    return anuncio;
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => {
  filas = [];
  creaciones = [];
  caida = false;
});

const valido = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
};
const conToken = (token) => ({ Authorization: `Bearer ${token}` });
const publicar = (cuerpo, token = 'token-a') => postJson(`${api.baseUrl}/api/anuncios`, cuerpo, conToken(token));
const ver = (id, token = 'token-a') => fetch(`${api.baseUrl}/api/anuncios/${id}`, { headers: conToken(token) });

test('US-12 CA15/CA16/E2E-1: publicar con datos correctos responde 201 con el anuncio y su Location', async () => {
  const response = await publicar(valido);

  assert.equal(response.status, 201);
  const { anuncio } = await response.json();
  assert.equal(response.headers.get('location'), `/api/anuncios/${anuncio.id}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(anuncio.estado, 'activo');
  assert.equal(anuncio.centro_id, 'centro-a');
  assert.equal(anuncio.titulo, 'Balones de fútbol talla 5');
  assert.equal(anuncio.unidades_disponibles, 12);
  assert.deepEqual(creaciones, [valido]);
});

test('US-12 CA17: con campos incorrectos responde 400 con todos los errores y no crea nada', async () => {
  const response = await publicar({ ...valido, titulo: 'Bola', unidades_disponibles: 10000 });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: {
        titulo: 'El título debe tener entre 5 y 80 caracteres.',
        unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
      },
    },
  });
  assert.deepEqual(creaciones, []);
});

test('US-12 CA18: un cuerpo que no es JSON da JSON_INVALIDO; `[]` da los seis campos obligatorios', async () => {
  const roto = await fetch(`${api.baseUrl}/api/anuncios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...conToken('token-a') },
    body: '{"titulo": ',
  });
  assert.equal(roto.status, 400);
  assert.equal((await roto.json()).error.code, 'JSON_INVALIDO');

  const lista = await publicar([]);
  assert.equal(lista.status, 400);
  assert.deepEqual(Object.keys((await lista.json()).error.details), [
    'titulo', 'descripcion', 'categoria', 'deporte', 'unidades_disponibles', 'estado_material',
  ]);
  assert.deepEqual(creaciones, []);
});

test('US-12: unidades escritas como 3.0 en el JSON se rechazan', async () => {
  const response = await fetch(`${api.baseUrl}/api/anuncios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...conToken('token-a') },
    body: JSON.stringify(valido).replace('"unidades_disponibles":12', '"unidades_disponibles":3.0'),
  });

  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).error.details, {
    unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
  });
});

test('US-12 CA19: sin token, con un token no válido o sin confirmar el email no se publica', async () => {
  const sinToken = await postJson(`${api.baseUrl}/api/anuncios`, valido);
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const caducado = await publicar(valido, 'token-caducado');
  assert.equal(caducado.status, 401);
  assert.equal((await caducado.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await publicar(valido, 'token-sin-confirmar');
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');
  assert.deepEqual(creaciones, []);
});

test('US-12 CA19: con la base de datos caída responde 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  caida = true;
  const response = await publicar(valido);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');

  const sinBase = await startApi({ auth: fakeAuth });
  try {
    const sinConfigurar = await postJson(`${sinBase.baseUrl}/api/anuncios`, valido, conToken('token-a'));
    assert.equal(sinConfigurar.status, 503);
    assert.equal((await sinConfigurar.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  } finally {
    await sinBase.close();
  }
});

test('US-12 CA21: estado, centro_id, id y publicado_en del cuerpo se ignoran', async () => {
  const response = await publicar({
    ...valido, estado: 'entregado', centro_id: 'centro-b', id: randomUUID(), publicado_en: '2020-01-01',
  });

  assert.equal(response.status, 201);
  const { anuncio } = await response.json();
  assert.equal(anuncio.estado, 'activo');
  assert.equal(anuncio.centro_id, 'centro-a');
  assert.deepEqual(creaciones, [valido]);
});

test('US-12 CA20: el centro ve la ficha de su anuncio', async () => {
  const { anuncio } = await (await publicar(valido)).json();

  const response = await ver(anuncio.id);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { anuncio });
});

test('US-12 CA24/E2E-5: el anuncio de otro centro da el mismo 404 que uno inexistente', async () => {
  const { anuncio } = await (await publicar(valido, 'token-a')).json();

  const deOtro = await ver(anuncio.id, 'token-b');
  const inexistente = await ver(randomUUID(), 'token-b');
  const noEsUuid = await ver('no-es-un-uuid', 'token-b');

  const esperado = { error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' } };
  for (const response of [deOtro, inexistente, noEsUuid]) {
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), esperado);
  }
});

test('US-12 «Propiedad»: un anuncio retirado no se puede ver', async () => {
  const { anuncio } = await (await publicar(valido)).json();
  filas.find((fila) => fila.id === anuncio.id).estado = 'retirado';

  assert.equal((await ver(anuncio.id)).status, 404);
});

test('US-12: la ficha también exige sesión y email confirmado', async () => {
  const id = randomUUID();
  assert.equal((await fetch(`${api.baseUrl}/api/anuncios/${id}`)).status, 401);
  assert.equal((await ver(id, 'token-sin-confirmar')).status, 403);
});

test('US-12: métodos no admitidos responden 405', async () => {
  const lista = await fetch(`${api.baseUrl}/api/anuncios`, { method: 'PUT', headers: conToken('token-a') });
  assert.equal(lista.status, 405);
  assert.equal(lista.headers.get('allow'), 'POST');

  const ficha = await fetch(`${api.baseUrl}/api/anuncios/${randomUUID()}`, { method: 'POST', headers: conToken('token-a') });
  assert.equal(ficha.status, 405);
  assert.equal(ficha.headers.get('allow'), 'GET, DELETE');
});
