import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnvironment } from '../environment.js';

const local = {
  DATABASE_URL: 'postgresql://postgres:local@127.0.0.1:54322/postgres',
  DATABASE_SSL_CA_FILE: '/local/ca.crt',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'local-only',
  E2E_CENTRO_A_EMAIL: 'a@example.test', E2E_CENTRO_B_EMAIL: 'b@example.test',
  E2E_SIN_CONFIRMAR_EMAIL: 'c@example.test', E2E_PASSWORD: 'local-only',
};

test('admite configuración local y no propaga otras credenciales', () => {
  assert.deepEqual(validateEnvironment({ ...local, MIGRATION_DATABASE_URL: 'private' }), local);
});

test('rechaza destinos compartidos aunque se hereden del entorno', () => {
  for (const [key, value] of [
    ['DATABASE_URL', 'postgresql://postgres:secret@shared.example.com/postgres'],
    ['SUPABASE_URL', 'https://shared.supabase.co'],
    ['SUPABASE_URL', 'http://localhost.example.com'],
    ['SUPABASE_URL', 'file://localhost/file'],
  ]) {
    assert.throws(() => validateEnvironment({ ...local, [key]: value }), /local aislado/);
  }
});

test('falta de configuración falla antes de arrancar los servidores', () => {
  for (const key of Object.keys(local)) {
    assert.throws(() => validateEnvironment({ ...local, [key]: '' }), /Falta configuración/);
  }
});
