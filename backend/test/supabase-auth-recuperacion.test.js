import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseAuth } from '../src/services/supabase-auth.js';

// US-04: recuperar la contraseña con Supabase Auth (doble del cliente).
const environment = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const sesion = { access_token: 'access-recuperacion', refresh_token: 'refresh-recuperacion', expires_at: 1760000000 };

// Cada cliente creado por el servicio recibe un doble nuevo de `auth` y deja
// constancia de las llamadas en `clientes[i].llamadas`.
function serviceWith(crearAuth) {
  const clientes = [];
  const auth = createSupabaseAuth({
    environment,
    clientFactory: (url, key, options) => {
      const llamadas = [];
      clientes.push({ url, key, options, llamadas });
      return { auth: crearAuth(llamadas) };
    },
  });
  return { auth, clientes };
}

function recuperacion({ verify = { data: { user: { id: 'u1' }, session: sesion }, error: null }, update = { error: null }, signOut = { error: null } } = {}) {
  return (llamadas) => ({
    async resetPasswordForEmail(email, options) {
      llamadas.push(['resetPasswordForEmail', email, options]);
      return { data: {}, error: null };
    },
    async verifyOtp(params) {
      llamadas.push(['verifyOtp', params]);
      return verify;
    },
    async updateUser(attributes) {
      llamadas.push(['updateUser', attributes]);
      return { data: { user: { id: 'u1' } }, ...update };
    },
    admin: {
      async signOut(jwt, scope) {
        llamadas.push(['signOut', jwt, scope]);
        return { data: null, ...signOut };
      },
    },
  });
}

test('US-04 CA19/CA25: pide el email de recuperación con el email normalizado', async () => {
  const { auth, clientes } = serviceWith(recuperacion());
  await auth.requestPasswordReset('  Piscina@ClubNatacio.CAT ');
  assert.deepEqual(clientes[0].llamadas, [['resetPasswordForEmail', 'piscina@clubnatacio.cat', undefined]]);
});

test('US-04 CA19/CA23: errores de Supabase al pedir el enlace (429, caída) y el resto se oculta', async () => {
  const con = (error) => serviceWith(() => ({ resetPasswordForEmail: async () => ({ data: {}, error }) })).auth;

  for (const error of [{ status: 400, code: 'validation_failed' }, { status: 404, code: 'user_not_found' }, { status: 422 }]) {
    await con(error).requestPasswordReset('centro@example.com');
  }
  await assert.rejects(con({ status: 429, code: 'over_email_send_rate_limit' }).requestPasswordReset('centro@example.com'), {
    status: 429, code: 'DEMASIADOS_INTENTOS',
  });
  for (const error of [{ status: 500 }, { status: 0 }, {}]) {
    await assert.rejects(con(error).requestPasswordReset('centro@example.com'), { status: 503, code: 'AUTH_NO_DISPONIBLE' });
  }
});

test('US-04 CA20/CA14: verifica el enlace de recuperación, cambia la contraseña y cierra todas las sesiones', async () => {
  const { auth, clientes } = serviceWith(recuperacion());
  await auth.resetPassword('hash-del-enlace', 'Natacio2026!');

  // El cliente 0 es el compartido del servidor; el 1 es el de esta petición.
  assert.equal(clientes.length, 2);
  assert.deepEqual(clientes[0].llamadas, []);
  assert.deepEqual(clientes[1].options, clientes[0].options);
  assert.deepEqual(clientes[1].llamadas, [
    ['verifyOtp', { token_hash: 'hash-del-enlace', type: 'recovery' }],
    ['updateUser', { password: 'Natacio2026!' }],
    ['signOut', 'access-recuperacion', 'global'],
  ]);
});

test('US-04: cada restablecimiento usa su propio cliente (la sesión de recuperación no se comparte)', async () => {
  const { auth, clientes } = serviceWith(recuperacion());
  await Promise.all([auth.resetPassword('hash-a', 'Contrasena-A1'), auth.resetPassword('hash-b', 'Contrasena-B2')]);
  assert.equal(clientes.length, 3);
  assert.deepEqual(clientes.slice(1).map((cliente) => cliente.llamadas[0][1].token_hash).sort(), ['hash-a', 'hash-b']);
});

test('US-04 CA26: elegir la misma contraseña que antes se acepta (y cierra las sesiones igualmente)', async () => {
  const { auth, clientes } = serviceWith(recuperacion({ update: { error: { status: 422, code: 'same_password' } } }));
  await auth.resetPassword('hash-del-enlace', 'Antigua2025');
  assert.deepEqual(clientes[1].llamadas.at(-1), ['signOut', 'access-recuperacion', 'global']);
});

test('US-04 CA11/CA12/CA13/CA20: un enlace usado, caducado o sustituido da 400 ENLACE_INVALIDO sin cambiar nada', async () => {
  for (const error of [{ status: 403, code: 'otp_expired' }, { status: 400, code: 'validation_failed' }, { status: 404 }]) {
    const { auth, clientes } = serviceWith(recuperacion({ verify: { data: { user: null, session: null }, error } }));
    await assert.rejects(auth.resetPassword('hash-usado', 'Natacio2026!'), {
      status: 400,
      code: 'ENLACE_INVALIDO',
      message: 'El enlace para cambiar la contraseña no es válido o ha caducado.',
    });
    assert.deepEqual(clientes[1].llamadas.map(([metodo]) => metodo), ['verifyOtp']);
  }

  const sinSesion = serviceWith(recuperacion({ verify: { data: { user: { id: 'u1' }, session: null }, error: null } }));
  await assert.rejects(sinSesion.auth.resetPassword('hash', 'Natacio2026!'), { code: 'ENLACE_INVALIDO' });
});

test('US-04 CA20: 429 y caídas de Supabase al verificar el enlace', async () => {
  const limitado = serviceWith(recuperacion({ verify: { data: {}, error: { status: 429 } } }));
  await assert.rejects(limitado.auth.resetPassword('hash', 'Natacio2026!'), { status: 429, code: 'DEMASIADOS_INTENTOS' });

  for (const error of [{ status: 500 }, { status: 0 }, {}]) {
    const caido = serviceWith(recuperacion({ verify: { data: {}, error } }));
    await assert.rejects(caido.auth.resetPassword('hash', 'Natacio2026!'), { status: 503, code: 'AUTH_NO_DISPONIBLE' });
  }
});

test('US-04: errores al cambiar la contraseña (débil, 429, caída) no cierran las sesiones', async () => {
  const casos = [
    [{ status: 422, code: 'weak_password' }, { status: 400, code: 'DATOS_INVALIDOS', details: { password: 'La contraseña es demasiado débil.' } }],
    [{ status: 429 }, { status: 429, code: 'DEMASIADOS_INTENTOS' }],
    [{ status: 500 }, { status: 503, code: 'AUTH_NO_DISPONIBLE' }],
  ];
  for (const [error, esperado] of casos) {
    const { auth, clientes } = serviceWith(recuperacion({ update: { error } }));
    await assert.rejects(auth.resetPassword('hash', 'Natacio2026!'), esperado);
    assert.ok(!clientes[1].llamadas.some(([metodo]) => metodo === 'signOut'));
  }
});

test('US-04 CA14: si cerrar las sesiones falla por una caída, 503; si ya no había sesión, se da por cerrada', async () => {
  const caido = serviceWith(recuperacion({ signOut: { error: { status: 500 } } }));
  await assert.rejects(caido.auth.resetPassword('hash', 'Natacio2026!'), { status: 503, code: 'AUTH_NO_DISPONIBLE' });

  for (const status of [401, 403, 404]) {
    const cerrada = serviceWith(recuperacion({ signOut: { error: { status } } }));
    await cerrada.auth.resetPassword('hash', 'Natacio2026!');
  }
});
