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

const supabaseUser = { id: 'u1', email: 'centro@example.com', email_confirmed_at: '2026-10-09T10:00:00Z' };

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
