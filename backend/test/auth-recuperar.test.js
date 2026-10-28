import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { ApiError } from '../src/errors.js';
import { invalidRecoveryLink } from '../src/services/supabase-auth.js';
import { postJson, startApi } from './helpers.js';

// US-04: POST /api/auth/recuperar-contrasena y /restablecer-contrasena
// (CA6, CA7, CA19-CA21, CA23-CA26). El doble de Supabase Auth registra los
// envíos y los cambios de contraseña; los enlaces válidos solo sirven una vez.
let envios;
let cambios;
let enlaces;
let fallo;
const fakeAuth = {
  async requestPasswordReset(email) {
    if (fallo) throw fallo;
    envios.push(email);
  },
  async resetPassword(tokenHash, password) {
    if (fallo) throw fallo;
    if (!enlaces.delete(tokenHash)) throw invalidRecoveryLink();
    cambios.push({ tokenHash, password });
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth }); });
after(() => api.close());
beforeEach(() => {
  envios = [];
  cambios = [];
  enlaces = new Set(['hash-valido']);
  fallo = null;
});

const recuperar = (body) => postJson(`${api.baseUrl}/api/auth/recuperar-contrasena`, body);
const restablecer = (body) => postJson(`${api.baseUrl}/api/auth/restablecer-contrasena`, body);
const datosInvalidos = (details) => ({ error: { code: 'DATOS_INVALIDOS', message: 'Revisa los datos del formulario.', details } });

test('US-04 CA19/CA21/CA25: pedir el enlace responde 204 sin cuerpo y normaliza el email', async () => {
  const response = await recuperar({ email: '  Piscina@ClubNatacio.CAT ' });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(envios, ['piscina@clubnatacio.cat']);
});

test('US-04 CA23: la respuesta es idéntica para un email registrado, uno no registrado y uno sin confirmar', async () => {
  const respuestas = [];
  for (const email of ['piscina@clubnatacio.cat', 'nadie@ejemplo.com', 'sin-confirmar@ejemplo.com']) {
    const response = await recuperar({ email });
    const cabeceras = Object.fromEntries([...response.headers].filter(([nombre]) => !['date', 'etag'].includes(nombre)));
    respuestas.push({ status: response.status, cuerpo: await response.text(), cabeceras });
  }
  assert.deepEqual(respuestas[1], respuestas[0]);
  assert.deepEqual(respuestas[2], respuestas[0]);
});

test('US-04 CA6: el email es obligatorio, con la regla y los mensajes de US-01', async () => {
  const largo = `${'a'.repeat(242)}@example.com`;
  assert.equal(largo.length, 254);
  assert.equal((await recuperar({ email: largo })).status, 204);

  for (const [body, mensaje] of [
    [{}, 'El email es obligatorio.'],
    [{ email: '   ' }, 'El email es obligatorio.'],
    [{ email: 42 }, 'El email es obligatorio.'],
    [{ email: 'centro@ejemplo' }, 'El email no es válido.'],
    [{ email: `a${largo}` }, 'El email no es válido.'],
  ]) {
    const response = await recuperar(body);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), datosInvalidos({ email: mensaje }));
  }
  assert.deepEqual(envios, [largo]);
});

test('US-04 CA19: 429 DEMASIADOS_INTENTOS, 503 AUTH_NO_DISPONIBLE y JSON_INVALIDO al pedir el enlace', async () => {
  fallo = new ApiError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
  assert.equal((await recuperar({ email: 'centro@example.com' })).status, 429);

  const sinAuth = await startApi({});
  try {
    const response = await postJson(`${sinAuth.baseUrl}/api/auth/recuperar-contrasena`, { email: 'centro@example.com' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'AUTH_NO_DISPONIBLE');
  } finally {
    await sinAuth.close();
  }

  const roto = await fetch(`${api.baseUrl}/api/auth/recuperar-contrasena`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email": ',
  });
  assert.equal(roto.status, 400);
  assert.equal((await roto.json()).error.code, 'JSON_INVALIDO');
});

test('US-04 CA20/CA21: con un enlace válido la contraseña cambia y responde 204 sin sesión', async () => {
  const response = await restablecer({ token_hash: 'hash-valido', password: 'Natacio2026!' });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(cambios, [{ tokenHash: 'hash-valido', password: 'Natacio2026!' }]);
});

test('US-04 CA2: las dos rutas son públicas; con una sesión de otra cuenta funcionan igual', async () => {
  const response = await postJson(
    `${api.baseUrl}/api/auth/restablecer-contrasena`,
    { token_hash: 'hash-valido', password: 'Natacio2026!' },
    { Authorization: 'Bearer token-de-otra-cuenta' },
  );
  assert.equal(response.status, 204);
});

test('US-04 CA12: el mismo enlace solo sirve una vez (la segunda vez, 400 ENLACE_INVALIDO)', async () => {
  assert.equal((await restablecer({ token_hash: 'hash-valido', password: 'Natacio2026!' })).status, 204);

  const segunda = await restablecer({ token_hash: 'hash-valido', password: 'Otra2026!!' });
  assert.equal(segunda.status, 400);
  assert.deepEqual(await segunda.json(), {
    error: { code: 'ENLACE_INVALIDO', message: 'El enlace para cambiar la contraseña no es válido o ha caducado.' },
  });
  assert.equal(cambios.length, 1);
});

test('US-04 CA7: contraseña de 8 caracteres y de 72 bytes se acepta; 7, 73 bytes y vacía no', async () => {
  const setentaYDos = 'ñ'.repeat(36);
  assert.equal(Buffer.byteLength(setentaYDos), 72);
  for (const password of ['abcdefg1', setentaYDos, '        ']) {
    enlaces.add('hash-valido');
    assert.equal((await restablecer({ token_hash: 'hash-valido', password })).status, 204, JSON.stringify(password));
  }
  // No se recortan los espacios de la contraseña.
  assert.equal(cambios.at(-1).password, '        ');

  for (const [password, mensaje] of [
    ['abcdef1', 'La contraseña debe tener al menos 8 caracteres.'],
    [`${setentaYDos}a`, 'La contraseña es demasiado larga.'],
    ['', 'La contraseña es obligatoria.'],
    [undefined, 'La contraseña es obligatoria.'],
    [12345678, 'La contraseña es obligatoria.'],
  ]) {
    const response = await restablecer({ token_hash: 'hash-valido', password });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), datosInvalidos({ password: mensaje }));
  }
});

test('US-04 CA20: sin token_hash, «Falta el token del enlace.»; los dos errores salen a la vez', async () => {
  const response = await restablecer({ password: 'abc' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), datosInvalidos({
    token_hash: 'Falta el token del enlace.',
    password: 'La contraseña debe tener al menos 8 caracteres.',
  }));

  for (const tokenHash of ['', '   ', 42]) {
    const sinToken = await restablecer({ token_hash: tokenHash, password: 'Natacio2026!' });
    assert.deepEqual(await sinToken.json(), datosInvalidos({ token_hash: 'Falta el token del enlace.' }));
  }
  assert.deepEqual(cambios, []);
});

test('US-04 CA20: 429 y 503 de Supabase al restablecer', async () => {
  fallo = new ApiError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
  assert.equal((await restablecer({ token_hash: 'hash-valido', password: 'Natacio2026!' })).status, 429);

  fallo = new ApiError(503, 'AUTH_NO_DISPONIBLE', 'El servicio de autenticación no está disponible. Inténtalo más tarde.');
  const caida = await restablecer({ token_hash: 'hash-valido', password: 'Natacio2026!' });
  assert.equal(caida.status, 503);
  assert.equal((await caida.json()).error.code, 'AUTH_NO_DISPONIBLE');
});

test('US-04 CA24: el token_hash no aparece en los logs del servidor, tampoco cuando el enlace falla', async () => {
  const escrito = [];
  const originales = { error: console.error, log: console.log, warn: console.warn, info: console.info };
  for (const nivel of Object.keys(originales)) console[nivel] = (...args) => escrito.push(args.map(String).join(' '));
  try {
    enlaces.add('hash-secreto-123');
    assert.equal((await restablecer({ token_hash: 'hash-secreto-123', password: 'Natacio2026!' })).status, 204);
    assert.equal((await restablecer({ token_hash: 'hash-secreto-123', password: 'Natacio2026!' })).status, 400);
    assert.equal((await restablecer({ token_hash: 'hash-secreto-123', password: 'abc' })).status, 400);
  } finally {
    Object.assign(console, originales);
  }
  assert.ok(!escrito.some((linea) => linea.includes('hash-secreto-123')), escrito.join('\n'));
});

test('US-04: las dos rutas solo admiten POST', async () => {
  for (const ruta of ['recuperar-contrasena', 'restablecer-contrasena']) {
    const response = await fetch(`${api.baseUrl}/api/auth/${ruta}`);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  }
});
