import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { postJson, sesion, startApi, usuarioConfirmado } from './helpers.js';

// US-67: cerrar sesión. El doble de Supabase guarda las sesiones activas para
// comprobar que, una vez cerrada, la sesión no da acceso a nada privado.
const activeTokens = new Set();
const fakeAuth = {
  async signIn() {
    activeTokens.add(sesion.access_token);
    return { usuario: usuarioConfirmado, sesion };
  },
  async signOut(token) {
    activeTokens.delete(token);
  },
  async getUser(token) {
    return activeTokens.has(token) ? usuarioConfirmado : null;
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth }); });
after(() => api.close());

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function login() {
  const response = await postJson(`${api.baseUrl}/api/auth/login`, { email: usuarioConfirmado.email, password: 'x' });
  return (await response.json()).sesion.access_token;
}

test('US-67: puedo cerrar sesión en cualquier momento', async () => {
  const token = await login();

  const response = await postJson(`${api.baseUrl}/api/auth/logout`, {}, bearer(token));

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
});

test('US-67: una vez cerrada, no puedo ver nada privado sin volver a entrar', async () => {
  const token = await login();
  assert.equal((await fetch(`${api.baseUrl}/api/auth/me`, { headers: bearer(token) })).status, 200);

  await postJson(`${api.baseUrl}/api/auth/logout`, {}, bearer(token));
  const afterLogout = await fetch(`${api.baseUrl}/api/auth/me`, { headers: bearer(token) });

  assert.equal(afterLogout.status, 401);
  assert.equal((await afterLogout.json()).error.code, 'NO_AUTENTICADO');

  const again = await login();
  assert.equal((await fetch(`${api.baseUrl}/api/auth/me`, { headers: bearer(again) })).status, 200);
});

test('US-67: cerrar sesión sin una sesión válida devuelve 401', async () => {
  const withoutToken = await postJson(`${api.baseUrl}/api/auth/logout`, {});
  const closedToken = await postJson(`${api.baseUrl}/api/auth/logout`, {}, bearer('ya-cerrada'));

  assert.equal(withoutToken.status, 401);
  assert.equal(closedToken.status, 401);
});

test('US-67: el cierre de sesión solo admite POST', async () => {
  const response = await fetch(`${api.baseUrl}/api/auth/logout`);

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});
