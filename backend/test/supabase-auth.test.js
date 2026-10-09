import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseAuth } from '../src/services/supabase-auth.js';

const environment = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };

function serviceWith(authApi) {
  let options;
  const auth = createSupabaseAuth({
    environment,
    clientFactory: (url, key, clientOptions) => {
      options = clientOptions;
      return { auth: authApi };
    },
  });
  return { auth, options };
}

test('without Supabase configuration the service is not created', () => {
  assert.equal(createSupabaseAuth({ environment: {} }), null);
  assert.equal(createSupabaseAuth({ environment: { SUPABASE_URL: ' ', SUPABASE_PUBLISHABLE_KEY: 'x' } }), null);
});

test('the server client does not persist or refresh sessions', () => {
  const { options } = serviceWith({});
  assert.deepEqual(options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});

test('getUser maps the Supabase user to the API user', async () => {
  const { auth } = serviceWith({
    getUser: async () => ({
      data: { user: { id: 'u1', email: 'centro@example.com', email_confirmed_at: '2026-10-09T10:00:00Z' } },
      error: null,
    }),
  });
  assert.deepEqual(await auth.getUser('token'), { id: 'u1', email: 'centro@example.com', email_confirmado: true });
});

test('getUser returns null for invalid tokens and 503 if Supabase fails', async () => {
  const invalid = serviceWith({ getUser: async () => ({ data: { user: null }, error: { status: 403 } }) });
  assert.equal(await invalid.auth.getUser('token'), null);

  const down = serviceWith({ getUser: async () => ({ data: { user: null }, error: { status: 500 } }) });
  await assert.rejects(down.auth.getUser('token'), { status: 503, code: 'AUTH_NO_DISPONIBLE' });
});

function signInWith(result) {
  const requests = [];
  const { auth } = serviceWith({
    signInWithPassword: async (credentials) => {
      requests.push(credentials);
      return result;
    },
  });
  return { auth, requests };
}

const supabaseUser = { id: 'u1', email: 'centro@example.com', email_confirmed_at: '2026-10-09T10:00:00Z' };
const supabaseSession = { access_token: 'a', refresh_token: 'r', expires_at: 1, token_type: 'bearer', user: supabaseUser };

test('signIn normalizes the email and returns only the public session fields', async () => {
  const { auth, requests } = signInWith({ data: { user: supabaseUser, session: supabaseSession }, error: null });

  const result = await auth.signIn('  Centro@Example.COM ', 'secreta');

  assert.deepEqual(requests, [{ email: 'centro@example.com', password: 'secreta' }]);
  assert.deepEqual(result, {
    usuario: { id: 'u1', email: 'centro@example.com', email_confirmado: true },
    sesion: { access_token: 'a', refresh_token: 'r', expires_at: 1 },
  });
});

test('signIn maps Supabase errors to the API errors', async () => {
  const cases = [
    [{ code: 'invalid_credentials', status: 400 }, 401, 'CREDENCIALES_INCORRECTAS'],
    [{ code: 'validation_failed', status: 400 }, 401, 'CREDENCIALES_INCORRECTAS'],
    [{ code: 'email_not_confirmed', status: 400 }, 403, 'EMAIL_NO_CONFIRMADO'],
    [{ code: 'over_request_rate_limit', status: 429 }, 429, 'DEMASIADOS_INTENTOS'],
    [{ code: 'unexpected_failure', status: 500 }, 503, 'AUTH_NO_DISPONIBLE'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 503, 'AUTH_NO_DISPONIBLE'],
  ];
  for (const [error, status, code] of cases) {
    const { auth } = signInWith({ data: { user: null, session: null }, error });
    await assert.rejects(auth.signIn('a@b.c', 'x'), { status, code }, JSON.stringify(error));
  }
});

test('signUp creates the account with the normalized email', async () => {
  const requests = [];
  const { auth } = serviceWith({
    signUp: async (credentials) => {
      requests.push(credentials);
      return { data: { user: { ...supabaseUser, email_confirmed_at: null, identities: [{}] }, session: null }, error: null };
    },
  });

  assert.deepEqual(await auth.signUp(' Centro@Example.com', 'secreta123'), {
    id: 'u1', email: 'centro@example.com', email_confirmado: false,
  });
  assert.deepEqual(requests, [{ email: 'centro@example.com', password: 'secreta123' }]);
});

test('signUp detects existing accounts and maps Supabase errors', async () => {
  const existing = serviceWith({
    signUp: async () => ({ data: { user: { ...supabaseUser, identities: [] }, session: null }, error: null }),
  });
  await assert.rejects(existing.auth.signUp('a@b.c', 'secreta123'), { status: 409, code: 'EMAIL_YA_REGISTRADO' });

  const cases = [
    [{ code: 'user_already_exists', status: 422 }, 409, 'EMAIL_YA_REGISTRADO'],
    [{ code: 'weak_password', status: 422 }, 400, 'DATOS_INVALIDOS'],
    [{ code: 'email_address_invalid', status: 400 }, 400, 'DATOS_INVALIDOS'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 429, 'DEMASIADOS_INTENTOS'],
    [{ code: 'unexpected_failure', status: 500 }, 503, 'AUTH_NO_DISPONIBLE'],
  ];
  for (const [error, status, code] of cases) {
    const { auth } = serviceWith({ signUp: async () => ({ data: { user: null, session: null }, error }) });
    await assert.rejects(auth.signUp('a@b.c', 'secreta123'), { status, code }, JSON.stringify(error));
  }
});

test('signOut closes only the current session and tolerates closed sessions', async () => {
  const requests = [];
  const ok = serviceWith({
    admin: { signOut: async (jwt, scope) => { requests.push([jwt, scope]); return { data: null, error: null }; } },
  });
  await ok.auth.signOut('token');
  assert.deepEqual(requests, [['token', 'local']]);

  const closed = serviceWith({ admin: { signOut: async () => ({ data: null, error: { status: 404 } }) } });
  await closed.auth.signOut('token');

  const down = serviceWith({ admin: { signOut: async () => ({ data: null, error: { status: 502 } }) } });
  await assert.rejects(down.auth.signOut('token'), { status: 503, code: 'AUTH_NO_DISPONIBLE' });
});

test('refresh returns a new session or asks to log in again', async () => {
  const ok = serviceWith({
    refreshSession: async () => ({ data: { user: supabaseUser, session: supabaseSession }, error: null }),
  });
  assert.equal((await ok.auth.refresh('r')).sesion.access_token, 'a');

  const expired = serviceWith({
    refreshSession: async () => ({ data: { user: null, session: null }, error: { code: 'refresh_token_not_found', status: 400 } }),
  });
  await assert.rejects(expired.auth.refresh('r'), { status: 401, code: 'NO_AUTENTICADO' });
});
