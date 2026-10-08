import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createDatabase } from '../src/database.js';
import { runDatabaseCheck } from '../scripts/check-database.js';

const databaseUrl = 'postgresql://postgres.project:fake-password@pooler.example.invalid:6543/postgres';

function fixture({ environment = { DATABASE_URL: databaseUrl }, queryError, centrosExists = true, readCertificate } = {}) {
  const pool = new EventEmitter();
  const queries = [];
  let configuration;
  let closeCalls = 0;
  pool.query = async (sql) => {
    queries.push(sql);
    if (queryError) throw queryError;
    return { rows: [{ centros_exists: centrosExists }] };
  };
  pool.end = async () => { closeCalls += 1; };
  const idleErrors = [];
  const database = createDatabase({
    environment,
    readCertificate,
    onPoolError: (error) => idleErrors.push(error),
    poolFactory: (options) => {
      configuration = options;
      return pool;
    },
  });
  return { database, pool, configuration, queries, idleErrors, get closeCalls() { return closeCalls; } };
}

test('DATABASE_URL is required and malformed URLs fail without exposing credentials', () => {
  assert.throws(() => createDatabase({ environment: {} }), /Falta DATABASE_URL/);
  for (const value of ['not-a-url-fake-password', 'https://postgres:fake-password@example.invalid/db', 'postgresql://example.invalid/']) {
    assert.throws(() => createDatabase({ environment: { DATABASE_URL: value } }), (error) => {
      assert.equal(error.code, 'DATABASE_CONFIGURATION_ERROR');
      assert.doesNotMatch(error.message, /fake-password|example\.invalid/);
      return true;
    });
  }
});

test('pool uses a small connection limit, bounded timeouts and certificate verification', async () => {
  const { database, configuration } = fixture();
  assert.equal(configuration.host, 'pooler.example.invalid');
  assert.equal(configuration.port, 6543);
  assert.equal(configuration.user, 'postgres.project');
  assert.equal(configuration.database, 'postgres');
  assert.equal(configuration.max, 2);
  assert.equal(configuration.connectionTimeoutMillis, 5_000);
  assert.equal(configuration.query_timeout, 5_000);
  assert.equal(configuration.statement_timeout, 5_000);
  assert.deepEqual(configuration.ssl, { rejectUnauthorized: true });
  assert.equal(configuration.connectionString, undefined);
  await database.close();
});

test('accepted sslmode values cannot overwrite strict TLS', async () => {
  for (const mode of ['require', 'verify-ca', 'verify-full']) {
    const { database, configuration } = fixture({ environment: { DATABASE_URL: `${databaseUrl}?sslmode=${mode}` } });
    assert.equal(configuration.ssl.rejectUnauthorized, true);
    await database.close();
  }
});

test('weak TLS modes and URL options that could override configuration are rejected', () => {
  for (const option of ['sslmode=disable', 'sslmode=no-verify', 'sslmode=allow', 'sslmode=prefer', 'ssl=false', 'statement_timeout=0', 'sslrootcert=/secret/path', 'sslcert=/secret/path', 'sslkey=/secret/path']) {
    assert.throws(() => fixture({ environment: { DATABASE_URL: `${databaseUrl}?${option}` } }), (error) => {
      assert.equal(error.code, 'DATABASE_CONFIGURATION_ERROR');
      assert.doesNotMatch(error.message, /fake-password|\/secret\/path/);
      return true;
    });
  }
});

test('a separate PEM CA file is included without changing certificate verification', async () => {
  const pem = '-----BEGIN CERTIFICATE-----\nFAKE-TEST-CA\n-----END CERTIFICATE-----';
  const reads = [];
  const { database, configuration } = fixture({
    environment: { DATABASE_URL: databaseUrl, DATABASE_SSL_CA_FILE: '/certificates/ca.pem' },
    readCertificate: (...arguments_) => { reads.push(arguments_); return pem; },
  });
  assert.deepEqual(reads, [['/certificates/ca.pem', 'utf8']]);
  assert.deepEqual(configuration.ssl, { rejectUnauthorized: true, ca: pem });
  await database.close();
});

test('unreadable or invalid CA files fail without exposing their contents or path', () => {
  for (const readCertificate of [() => { throw new Error('/secret/path fake-password'); }, () => 'fake-password']) {
    assert.throws(() => fixture({
      environment: { DATABASE_URL: databaseUrl, DATABASE_SSL_CA_FILE: '/secret/path' },
      readCertificate,
    }), (error) => {
      assert.equal(error.code, 'DATABASE_CONFIGURATION_ERROR');
      assert.doesNotMatch(error.message, /fake-password|\/secret\/path/);
      return true;
    });
  }
});

test('connectivity checks only request a constant and optionally table existence', async () => {
  const current = fixture();
  assert.deepEqual(await current.database.check(), { connected: true });
  assert.deepEqual(current.queries, ['SELECT 1']);
  assert.deepEqual(await current.database.check({ includeSchema: true }), { connected: true, centrosExists: true });
  assert.deepEqual(current.queries, ['SELECT 1', 'SELECT 1', "SELECT to_regclass('public.centros') IS NOT NULL AS centros_exists"]);
  await current.database.close();
});

test('query and timeout errors are redacted and the pool can still be closed', async () => {
  const current = fixture({ queryError: new Error(`timeout: ${databaseUrl}`) });
  await assert.rejects(current.database.check({ includeSchema: true }), (error) => {
    assert.equal(error.code, 'DATABASE_CONNECTION_ERROR');
    assert.doesNotMatch(error.message, /fake-password|pooler\.example\.invalid/);
    return true;
  });
  await current.database.close();
  assert.equal(current.closeCalls, 1);
});

test('TLS failures explain verification failure without exposing connection details', async () => {
  const queryError = Object.assign(new Error(databaseUrl), { code: 'SELF_SIGNED_CERT_IN_CHAIN' });
  const current = fixture({ queryError });
  await assert.rejects(current.database.check(), (error) => {
    assert.equal(error.code, 'DATABASE_TLS_ERROR');
    assert.match(error.message, /certificado TLS/);
    assert.doesNotMatch(error.message, /fake-password|pooler\.example\.invalid/);
    return true;
  });
  await current.database.close();
});

test('idle pool errors have a handler and are redacted', async () => {
  const current = fixture();
  current.pool.emit('error', new Error(databaseUrl));
  assert.equal(current.idleErrors.length, 1);
  assert.equal(current.idleErrors[0].code, 'DATABASE_CONNECTION_ERROR');
  assert.doesNotMatch(current.idleErrors[0].message, /fake-password|pooler\.example\.invalid/);
  await current.database.close();
});

test('closing a database twice ends the pool once', async () => {
  const current = fixture();
  await Promise.all([current.database.close(), current.database.close()]);
  assert.equal(current.closeCalls, 1);
});

test('db:check reports a missing migration as failure and closes its pool', async () => {
  const current = fixture({ centrosExists: false });
  const output = [];
  const exitCode = await runDatabaseCheck({ create: () => current.database, stdout: (line) => output.push(line), stderr: (line) => output.push(line) });
  assert.equal(exitCode, 1);
  assert.match(output.join('\n'), /migración pendiente/);
  assert.equal(current.closeCalls, 1);
});

test('db:check succeeds only when the connection and centros table are available', async () => {
  const current = fixture();
  const output = [];
  const exitCode = await runDatabaseCheck({ create: () => current.database, stdout: (line) => output.push(line), stderr: (line) => output.push(line) });
  assert.equal(exitCode, 0);
  assert.match(output.join('\n'), /Tabla public.centros: encontrada/);
  assert.equal(current.closeCalls, 1);
});

test('db:check has a useful missing-configuration error and redacts unexpected failures', async () => {
  for (const create of [() => createDatabase({ environment: {} }), () => { throw new Error(databaseUrl); }]) {
    const output = [];
    const exitCode = await runDatabaseCheck({ create, stdout: (line) => output.push(line), stderr: (line) => output.push(line) });
    assert.equal(exitCode, 1);
    assert.ok(output.length > 0);
    assert.doesNotMatch(output.join('\n'), /fake-password|pooler\.example\.invalid/);
  }
});

test('db:check closes its pool after a failed query', async () => {
  const current = fixture({ queryError: new Error(databaseUrl) });
  const output = [];
  const exitCode = await runDatabaseCheck({ create: () => current.database, stderr: (line) => output.push(line) });
  assert.equal(exitCode, 1);
  assert.equal(current.closeCalls, 1);
  assert.doesNotMatch(output.join('\n'), /fake-password|pooler\.example\.invalid/);
});
