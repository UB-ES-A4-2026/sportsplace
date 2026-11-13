import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado } from '../src/repositories/anuncios.js';
import {
  anuncioPropio, conversacionNoEncontrada, conversacionYaExiste, demasiadosMensajes,
} from '../src/repositories/conversaciones.js';
import { postJson, startApi } from './helpers.js';

// US-28 (T28-2): rutas de conversaciones y mensajes con un doble del
// repositorio. Las reglas de la base de datos se prueban en
// conversaciones-repositorio.test.js y, contra PostgreSQL, en los E2E de T28-4.
const usuarios = {
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

const ANUNCIO = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const CONVERSACION = '0f4e5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b';
const MENSAJE = { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', texto: 'Hola', es_mio: true, tipo: 'texto', creado_en: '2026-11-13T12:00:00.000Z' };
const CONVERSACION_OBJ = { id: CONVERSACION, soy: 'comprador', puede_escribir: true };

let llamadas;
let respuesta;
const fakeConversaciones = {};
for (const metodo of ['deAnuncio', 'crear', 'obtener', 'enviar']) {
  fakeConversaciones[metodo] = async (...argumentos) => {
    llamadas.push([metodo, ...argumentos]);
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  };
}

let api;
let sinRepositorio;
before(async () => {
  api = await startApi({ auth: fakeAuth, conversaciones: fakeConversaciones });
  sinRepositorio = await startApi({ auth: fakeAuth });
});
after(async () => {
  await api.close();
  await sinRepositorio.close();
});
beforeEach(() => {
  llamadas = [];
  respuesta = undefined;
});

const conToken = (token = 'token-b') => (token ? { Authorization: `Bearer ${token}` } : {});
const get = (ruta, token, base = api.baseUrl) => fetch(`${base}${ruta}`, { headers: conToken(token) });
const post = (ruta, cuerpo, token, base = api.baseUrl) => postJson(`${base}${ruta}`, cuerpo, conToken(token));

async function esperarError(res, status, code) {
  assert.equal(res.status, status);
  const { error } = await res.json();
  assert.equal(error.code, code);
  return error;
}

test('todas las rutas exigen sesión (401) y email confirmado (403) antes de mirar nada', async () => {
  const rutas = [
    () => post('/api/conversaciones', {}, null),
    () => get(`/api/conversaciones/${CONVERSACION}`, null),
    () => post(`/api/conversaciones/${CONVERSACION}/mensajes`, { texto: 'Hola' }, null),
    () => get(`/api/anuncios/${ANUNCIO}/conversacion`, null),
  ];
  for (const ruta of rutas) await esperarError(await ruta(), 401, 'NO_AUTENTICADO');
  await esperarError(await post('/api/conversaciones', {}, 'token-sin-confirmar'), 403, 'EMAIL_NO_CONFIRMADO');
  await esperarError(await get(`/api/conversaciones/${CONVERSACION}`, 'token-sin-confirmar'), 403, 'EMAIL_NO_CONFIRMADO');
  assert.deepEqual(llamadas, []);
});

test('CA19: GET /api/anuncios/:id/conversacion devuelve la conversación o null', async () => {
  respuesta = { id: CONVERSACION };
  let res = await get(`/api/anuncios/${ANUNCIO}/conversacion`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { conversacion: { id: CONVERSACION } });
  assert.deepEqual(llamadas, [['deAnuncio', 'usuario-b', ANUNCIO]]);

  respuesta = null;
  res = await get(`/api/anuncios/${ANUNCIO}/conversacion`);
  assert.deepEqual(await res.json(), { conversacion: null });

  // Inexistente o retirado (lo decide el repositorio) y un id que no es UUID: 404.
  respuesta = anuncioNoEncontrado();
  await esperarError(await get(`/api/anuncios/${ANUNCIO}/conversacion`), 404, 'NO_ENCONTRADO');
  llamadas = [];
  await esperarError(await get('/api/anuncios/no-es-un-uuid/conversacion'), 404, 'NO_ENCONTRADO');
  assert.deepEqual(llamadas, []);
  await esperarError(await post(`/api/anuncios/${ANUNCIO}/conversacion`, {}), 405, 'METODO_NO_PERMITIDO');
});

test('CA20: POST /api/conversaciones responde 201 con la conversación, el mensaje y Location', async () => {
  respuesta = { conversacion: CONVERSACION_OBJ, mensaje: MENSAJE };
  const res = await post('/api/conversaciones', { anuncio_id: ANUNCIO, texto: '  Hola  ' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('location'), `/api/conversaciones/${CONVERSACION}`);
  assert.deepEqual(await res.json(), respuesta);
  assert.deepEqual(llamadas, [['crear', 'usuario-b', { anuncioId: ANUNCIO, texto: 'Hola' }]]);
});

test('CA8, CA9 y CA21: los datos no válidos responden 400 sin llegar a la base de datos', async () => {
  let error = await esperarError(await post('/api/conversaciones', { anuncio_id: ANUNCIO, texto: '   ' }), 400, 'DATOS_INVALIDOS');
  assert.deepEqual(error.details, { texto: 'Escribe un mensaje.' });
  error = await esperarError(await post('/api/conversaciones', { anuncio_id: 'x', texto: 'Hola' }), 400, 'DATOS_INVALIDOS');
  assert.deepEqual(error.details, { anuncio_id: 'El anuncio no es válido.' });
  error = await esperarError(await post(`/api/conversaciones/${CONVERSACION}/mensajes`, { texto: 'x'.repeat(2001) }), 400, 'DATOS_INVALIDOS');
  assert.deepEqual(error.details, { texto: 'El mensaje no puede superar los 2000 caracteres.' });
  assert.deepEqual(llamadas, []);
});

test('CA21, CA32 y CA36: los errores del repositorio llegan con su código y sus detalles', async () => {
  respuesta = anuncioPropio();
  let error = await esperarError(await post('/api/conversaciones', { anuncio_id: ANUNCIO, texto: 'Hola' }), 409, 'ANUNCIO_PROPIO');
  assert.equal(error.message, 'No puedes escribirte sobre tu propio anuncio.');

  respuesta = conversacionYaExiste(CONVERSACION);
  error = await esperarError(await post('/api/conversaciones', { anuncio_id: ANUNCIO, texto: 'Hola' }), 409, 'CONVERSACION_YA_EXISTE');
  assert.deepEqual(error.details, { conversacion_id: CONVERSACION });

  // CA26.
  respuesta = demasiadosMensajes();
  error = await esperarError(await post(`/api/conversaciones/${CONVERSACION}/mensajes`, { texto: 'Hola' }), 429, 'DEMASIADOS_INTENTOS');
  assert.equal(error.message, 'Has enviado demasiados mensajes seguidos. Espera un minuto.');
});

test('CA22: GET /api/conversaciones/:id pasa el cursor y devuelve la página', async () => {
  respuesta = { conversacion: CONVERSACION_OBJ, mensajes: [MENSAJE], hay_anteriores: false };
  let res = await get(`/api/conversaciones/${CONVERSACION.toUpperCase()}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), respuesta);
  res = await get(`/api/conversaciones/${CONVERSACION}?antes=${MENSAJE.id}`);
  assert.equal(res.status, 200);
  res = await get(`/api/conversaciones/${CONVERSACION}?despues=${MENSAJE.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(llamadas, [
    ['obtener', 'usuario-b', CONVERSACION, {}],
    ['obtener', 'usuario-b', CONVERSACION, { antes: MENSAJE.id }],
    ['obtener', 'usuario-b', CONVERSACION, { despues: MENSAJE.id }],
  ]);

  llamadas = [];
  const error = await esperarError(await get(`/api/conversaciones/${CONVERSACION}?antes=1&despues=2`), 400, 'DATOS_INVALIDOS');
  assert.ok(error.details.antes);
  assert.deepEqual(llamadas, []);
});

test('CA25: POST /api/conversaciones/:id/mensajes responde 201 { mensaje }', async () => {
  respuesta = MENSAJE;
  const res = await post(`/api/conversaciones/${CONVERSACION}/mensajes`, { texto: 'Línea 1\nLínea 2 ' });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { mensaje: MENSAJE });
  assert.deepEqual(llamadas, [['enviar', 'usuario-b', CONVERSACION, { texto: 'Línea 1\nLínea 2' }]]);
});

test('CA31: una conversación ajena o un id que no es UUID responden 404', async () => {
  respuesta = conversacionNoEncontrada();
  await esperarError(await get(`/api/conversaciones/${CONVERSACION}`), 404, 'NO_ENCONTRADO');
  await esperarError(await post(`/api/conversaciones/${CONVERSACION}/mensajes`, { texto: 'Hola' }), 404, 'NO_ENCONTRADO');
  llamadas = [];
  await esperarError(await get('/api/conversaciones/no-es-un-uuid'), 404, 'NO_ENCONTRADO');
  await esperarError(await post('/api/conversaciones/no-es-un-uuid/mensajes', { texto: '' }), 404, 'NO_ENCONTRADO');
  assert.deepEqual(llamadas, []);
});

test('CA30: los mensajes no se editan ni se borran; otros métodos responden 405', async () => {
  const metodo = (ruta, method) => fetch(`${api.baseUrl}${ruta}`, { method, headers: conToken() });
  await esperarError(await metodo('/api/conversaciones', 'GET'), 405, 'METODO_NO_PERMITIDO');
  await esperarError(await metodo(`/api/conversaciones/${CONVERSACION}`, 'DELETE'), 405, 'METODO_NO_PERMITIDO');
  await esperarError(await metodo(`/api/conversaciones/${CONVERSACION}/mensajes`, 'PATCH'), 405, 'METODO_NO_PERMITIDO');
  await esperarError(await metodo(`/api/conversaciones/${CONVERSACION}/mensajes`, 'DELETE'), 405, 'METODO_NO_PERMITIDO');
  assert.deepEqual(llamadas, []);
});

test('sin PostgreSQL configurado, 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  await esperarError(
    await post('/api/conversaciones', { anuncio_id: ANUNCIO, texto: 'Hola' }, 'token-b', sinRepositorio.baseUrl),
    503,
    'BASE_DATOS_NO_DISPONIBLE',
  );
  await esperarError(await get(`/api/anuncios/${ANUNCIO}/conversacion`, 'token-b', sinRepositorio.baseUrl), 503, 'BASE_DATOS_NO_DISPONIBLE');
});
