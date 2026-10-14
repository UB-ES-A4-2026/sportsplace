import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { ApiError } from '../src/errors.js';
import { postJson, startApi } from './helpers.js';

// US-66: pedir un enlace de confirmación nuevo si el mío ha caducado.
// El doble de Supabase Auth registra a qué emails se reenvía el enlace.
let reenvios;
let fallo;
const fakeAuth = {
  async resendConfirmation(email) {
    if (fallo) throw fallo;
    reenvios.push(email);
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth }); });
after(() => api.close());
beforeEach(() => {
  reenvios = [];
  fallo = null;
});

const reenviar = (body) => postJson(`${api.baseUrl}/api/auth/reenviar-confirmacion`, body);

test('US-66: si mi enlace ha caducado puedo pedir uno nuevo con mi email', async () => {
  const response = await reenviar({ email: ' Centro@Example.com ' });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(reenvios, ['centro@example.com']);
});

test('US-66: el email es obligatorio y debe tener un formato válido', async () => {
  for (const [body, mensaje] of [
    [{}, 'El email es obligatorio.'],
    [{ email: '   ' }, 'El email es obligatorio.'],
    [{ email: 42 }, 'El email es obligatorio.'],
    [{ email: 'no-es-un-email' }, 'El email no es válido.'],
  ]) {
    const response = await reenviar(body);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: 'DATOS_INVALIDOS', message: 'Revisa los datos del formulario.', details: { email: mensaje } },
    });
  }
  assert.deepEqual(reenvios, []);
});

test('US-66: si pido demasiados enlaces seguidos me avisa de que espere', async () => {
  fallo = new ApiError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
  const response = await reenviar({ email: 'centro@example.com' });

  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, 'DEMASIADOS_INTENTOS');
});

test('US-66: si Supabase Auth no responde recibo 503 AUTH_NO_DISPONIBLE', async () => {
  fallo = new ApiError(503, 'AUTH_NO_DISPONIBLE', 'El servicio de autenticación no está disponible. Inténtalo más tarde.');
  const response = await reenviar({ email: 'centro@example.com' });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AUTH_NO_DISPONIBLE');
});

test('US-66: sin Supabase configurado la ruta devuelve 503 y solo admite POST', async () => {
  const sinAuth = await startApi({});
  try {
    const response = await postJson(`${sinAuth.baseUrl}/api/auth/reenviar-confirmacion`, { email: 'centro@example.com' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'AUTH_NO_DISPONIBLE');
  } finally {
    await sinAuth.close();
  }

  const response = await fetch(`${api.baseUrl}/api/auth/reenviar-confirmacion`);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
  assert.equal((await response.json()).error.code, 'METODO_NO_PERMITIDO');
});
