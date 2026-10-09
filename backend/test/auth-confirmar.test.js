import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { ApiError } from '../src/errors.js';
import { postJson, sesion, startApi } from './helpers.js';

// US-02: confirmar mi email tras registrarme. El doble de Supabase Auth
// genera un enlace por cuenta, como hace Supabase con su plantilla de email.
let cuentas;
let enlaces;
let confirmaciones;
const fakeAuth = {
  async signUp(email) {
    const usuario = { id: `u${cuentas.size + 1}`, email, email_confirmado: false };
    cuentas.set(usuario.id, usuario);
    enlaces.set(`hash-${usuario.id}`, usuario.id);
    return usuario;
  },
  async verifyEmail(tokenHash) {
    const id = enlaces.get(tokenHash);
    if (!id) throw new ApiError(400, 'ENLACE_INVALIDO', 'El enlace de confirmación no es válido o ha caducado.');
    enlaces.delete(tokenHash);
    const usuario = { ...cuentas.get(id), email_confirmado: true };
    cuentas.set(id, usuario);
    return { usuario, confirmadoEn: '2026-10-09T10:00:00Z', sesion };
  },
  async signIn(email) {
    const usuario = [...cuentas.values()].find((cuenta) => cuenta.email === email);
    if (!usuario.email_confirmado) throw new ApiError(403, 'EMAIL_NO_CONFIRMADO', 'Confirma tu email.');
    return { usuario, sesion };
  },
};
const fakeCentros = {
  async registrar(centro, crearCuenta) { return crearCuenta(); },
  async marcarEmailConfirmado(usuarioId, confirmadoEn) { confirmaciones.push([usuarioId, confirmadoEn]); },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, centros: fakeCentros }); });
after(() => api.close());
beforeEach(() => {
  cuentas = new Map();
  enlaces = new Map();
  confirmaciones = [];
});

const confirmar = (body) => postJson(`${api.baseUrl}/api/auth/confirmar`, body);
const login = () => postJson(`${api.baseUrl}/api/auth/login`, { email: 'centro@example.com', password: 'contraseña-segura' });

async function registrar() {
  const response = await postJson(`${api.baseUrl}/api/auth/registro`, {
    nombre: 'Club', email: 'centro@example.com', password: 'contraseña-segura',
    localidad: 'Barcelona', acepta_politica_privacidad: true,
  });
  return (await response.json()).usuario;
}

test('US-02: tras registrarme recibo un enlace y al abrirlo mi cuenta queda activa', async () => {
  const usuario = await registrar();
  assert.equal(usuario.email_confirmado, false);
  assert.equal(enlaces.size, 1, 'Supabase genera el enlace del email de confirmación');

  const response = await confirmar({ token_hash: `hash-${usuario.id}`, type: 'email' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    usuario: { id: usuario.id, email: 'centro@example.com', email_confirmado: true },
    sesion,
  });
  assert.deepEqual(confirmaciones, [[usuario.id, '2026-10-09T10:00:00Z']]);
});

test('US-02: hasta confirmar el email no puedo entrar; después sí', async () => {
  const usuario = await registrar();

  const before = await login();
  assert.equal(before.status, 403);
  assert.equal((await before.json()).error.code, 'EMAIL_NO_CONFIRMADO');

  await confirmar({ token_hash: `hash-${usuario.id}` });
  assert.equal((await login()).status, 200);
});

test('US-02: un enlace ya usado o inventado no activa la cuenta', async () => {
  const usuario = await registrar();
  await confirmar({ token_hash: `hash-${usuario.id}` });

  for (const body of [{ token_hash: `hash-${usuario.id}` }, { token_hash: 'inventado' }, { token_hash: 'x', type: 'recovery' }]) {
    const response = await confirmar(body);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'ENLACE_INVALIDO');
  }
  assert.equal(confirmaciones.length, 1);
});

test('US-02: sin token_hash la API indica el campo que falta', async () => {
  const response = await confirmar({});

  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).error.details, { token_hash: 'Falta el token del enlace.' });
});

test('US-02: si falla la copia en centros, la confirmación sigue siendo correcta', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(fakeCentros, 'marcarEmailConfirmado', async () => { throw Object.assign(new Error(), { code: '08006' }); });
  const usuario = await registrar();

  const response = await confirmar({ token_hash: `hash-${usuario.id}` });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).usuario.email_confirmado, true);
});
