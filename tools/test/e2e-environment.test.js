import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localEnvironment, projectId, validateStatus } from '../scripts/e2e-environment.js';
import { fixtureAnuncios, fixtureCentros, seedAnuncios } from '../scripts/e2e-fixtures.js';

const status = {
  API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://postgres:local@127.0.0.1:54322/postgres',
  ANON_KEY: 'local-public', SERVICE_ROLE_KEY: 'local-admin',
};

test('las credenciales del compartido no llegan a la CLI ni a Docker', () => {
  assert.deepEqual(localEnvironment({ PATH: 'path', DATABASE_URL: 'secret', SUPABASE_ACCESS_TOKEN: 'secret',
    MIGRATION_DATABASE_URL: 'secret', PGPASSWORD: 'secret', GOTRUE_SITE_URL: 'shared' }), { PATH: 'path' });
});

test('el estado solo acepta los endpoints del proyecto local', () => {
  assert.equal(validateStatus(status), status);
  for (const change of [
    { API_URL: 'https://shared.supabase.co' },
    { API_URL: 'http://127.0.0.1:54321.evil.example' },
    { DB_URL: 'postgresql://postgres:secret@shared.example/postgres' },
    { DB_URL: 'postgresql://postgres:local@127.0.0.1:54322/postgres?sslmode=disable' },
    { SERVICE_ROLE_KEY: '' },
  ]) assert.throws(() => validateStatus({ ...status, ...change }));
});

test('cada checkout identifica sus propios contenedores', () => {
  assert.equal(projectId('/one'), projectId('/one'));
  assert.notEqual(projectId('/one'), projectId('/two'));
  assert.match(projectId('/one'), /^sportsplace-e2e-[a-f0-9]{12}$/);
});

test('la semilla separa propiedad, confirmación y las 21 filas paginadas', () => {
  assert.equal(fixtureCentros.filter((row) => row.confirmed).length, 2);
  assert.equal(fixtureCentros.filter((row) => !row.confirmed).length, 1);
  const rows = fixtureAnuncios();
  assert.equal(rows.filter((row) => row.centro_id === fixtureCentros[0].id && row.estado !== 'retirado').length, 21);
  assert.equal(rows.filter((row) => row.centro_id === fixtureCentros[1].id).length, 1);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
});

test('sin T12-1 se informa pendiente; el modo estricto rechaza validar anuncios', async () => {
  const client = { query: async () => ({ rows: [{ exists: false }] }) };
  assert.match((await seedAnuncios(client)).pending, /Falta T12-1/);
  await assert.rejects(seedAnuncios(client, { requireAnuncios: true }), /Falta la migración T12-1/);
});

test('un esquema anuncios incompleto no se rellena con SQL alternativo', async () => {
  let queries = 0;
  const client = { query: async () => ++queries === 1 ? { rows: [{ exists: true }] } : { rows: [{ column_name: 'id' }] } };
  await assert.rejects(seedAnuncios(client), /no coincide/);
  assert.equal(queries, 2);
});
