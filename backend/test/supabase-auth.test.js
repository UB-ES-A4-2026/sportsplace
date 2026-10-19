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
