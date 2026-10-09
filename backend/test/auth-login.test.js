import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ApiError } from '../src/errors.js';
import { postJson, sesion, startApi, usuarioConfirmado } from './helpers.js';

// US-03: entrar en mi cuenta con mi email y contraseña.
const PASSWORD = 'contraseña-correcta';
const calls = [];
const fakeAuth = {
  async signIn(email, password) {
    calls.push({ email, password });
    if (email === 'sin-confirmar@example.com' && password === PASSWORD) {
      throw new ApiError(403, 'EMAIL_NO_CONFIRMADO', 'Confirma tu email.');
    }
    if (email !== usuarioConfirmado.email || password !== PASSWORD) {
      throw new ApiError(401, 'CREDENCIALES_INCORRECTAS', 'Email o contraseña incorrectos.');
    }
    return { usuario: usuarioConfirmado, sesion };
  },
  async refresh(refreshToken) {
    if (refreshToken !== sesion.refresh_token) {
      throw new ApiError(401, 'NO_AUTENTICADO', 'Tu sesión no es válida. Vuelve a entrar.');
    }
    return { usuario: usuarioConfirmado, sesion: { ...sesion, access_token: 'access-2' } };
  },
  async getUser(token) {
    return token === sesion.access_token ? usuarioConfirmado : null;
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth }); });
after(() => api.close());

test('US-03: con email y contraseña correctos entro y recibo la sesión', async () => {
  const response = await postJson(`${api.baseUrl}/api/auth/login`, { email: usuarioConfirmado.email, password: PASSWORD });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { usuario: usuarioConfirmado, sesion });
});

test('US-03: con la contraseña incorrecta no entro y el error es genérico', async () => {
  const response = await postJson(`${api.baseUrl}/api/auth/login`, { email: usuarioConfirmado.email, password: 'otra' });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: 'CREDENCIALES_INCORRECTAS', message: 'Email o contraseña incorrectos.' },
  });
});

test('US-03: con un email que no existe recibo exactamente el mismo error', async () => {
  const wrongPassword = await postJson(`${api.baseUrl}/api/auth/login`, { email: usuarioConfirmado.email, password: 'otra' });
  const unknownEmail = await postJson(`${api.baseUrl}/api/auth/login`, { email: 'nadie@example.com', password: PASSWORD });

  assert.equal(unknownEmail.status, wrongPassword.status);
  assert.deepEqual(await unknownEmail.json(), await wrongPassword.json());
});

test('US-03: sin email o contraseña la API indica los campos obligatorios', async () => {
  const callsBefore = calls.length;
  const response = await postJson(`${api.baseUrl}/api/auth/login`, { email: '  ' });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los datos del formulario.',
      details: { email: 'El email es obligatorio.', password: 'La contraseña es obligatoria.' },
    },
  });
  assert.equal(calls.length, callsBefore, 'no se consulta Supabase con datos incompletos');
});

test('US-02/US-03: con la contraseña correcta pero sin confirmar el email no entro', async () => {
  const response = await postJson(`${api.baseUrl}/api/auth/login`, { email: 'sin-confirmar@example.com', password: PASSWORD });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'EMAIL_NO_CONFIRMADO');
});

test('US-03: el login solo admite POST', async () => {
  const response = await fetch(`${api.baseUrl}/api/auth/login`);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});

test('US-03: con un refresh_token válido recibo una sesión nueva', async () => {
  const response = await postJson(`${api.baseUrl}/api/auth/refresh`, { refresh_token: sesion.refresh_token });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).sesion.access_token, 'access-2');
});

test('US-03: con un refresh_token no válido debo volver a entrar', async () => {
  const response = await postJson(`${api.baseUrl}/api/auth/refresh`, { refresh_token: 'caducado' });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'NO_AUTENTICADO');
});

test('/me devuelve el usuario de la sesión', async () => {
  const response = await fetch(`${api.baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${sesion.access_token}` },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { usuario: usuarioConfirmado });
});

test('/me sin token o con un token no válido devuelve 401', async () => {
  const withoutToken = await fetch(`${api.baseUrl}/api/auth/me`);
  const invalidToken = await fetch(`${api.baseUrl}/api/auth/me`, { headers: { Authorization: 'Bearer falso' } });

  assert.equal(withoutToken.status, 401);
  assert.equal((await withoutToken.json()).error.code, 'NO_AUTENTICADO');
  assert.equal(invalidToken.status, 401);
  assert.equal((await invalidToken.json()).error.code, 'NO_AUTENTICADO');
});

test('sin Supabase configurado la API responde 503', async () => {
  const unconfigured = await startApi({ auth: null });
  try {
    const response = await postJson(`${unconfigured.baseUrl}/api/auth/login`, { email: 'a@b.c', password: 'x' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'AUTH_NO_DISPONIBLE');
  } finally {
    await unconfigured.close();
  }
});
