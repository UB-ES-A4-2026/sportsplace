import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MigrationConfigurationError,
  MigrationUsageError,
  prepareMigration,
  sanitizeCliOutput,
} from '../scripts/migrate.js';

const exampleUrl = 'postgresql://postgres.project:example%40pass@db.example.test:5432/postgres';

test('missing credentials and invalid arguments fail before invoking the CLI', () => {
  assert.throws(() => prepareMigration([], {}), MigrationConfigurationError);
  for (const argv of [['--local'], ['--db-url', exampleUrl], ['--dry-run', '--dry-run']]) {
    assert.throws(() => prepareMigration(argv, { DATABASE_URL: exampleUrl }), MigrationUsageError);
  }
});

test('malformed connection errors do not expose the supplied connection', () => {
  for (const value of ['not-a-url-secret', 'https://user:example-secret@example.test/db',
    'postgresql://user:invalid%escape@db.example.test/postgres']) {
    assert.throws(() => prepareMigration([], { DATABASE_URL: value }), (error) => {
      assert.ok(error instanceof MigrationConfigurationError);
      assert.ok(!error.message.includes(value));
      return true;
    });
  }
});

test('migration credentials override application credentials and require verified TLS', () => {
  const plan = prepareMigration(['--dry-run'], {
    DATABASE_URL: 'postgresql://app:application-pass@db.example.test/postgres',
    MIGRATION_DATABASE_URL: `${exampleUrl}?sslmode=disable`,
  });
  const parsed = new URL(plan.databaseUrl);
  assert.equal(parsed.username, 'postgres.project');
  assert.equal(parsed.searchParams.get('sslmode'), 'verify-full');
  assert.ok(plan.args.includes('--dry-run'));
  assert.ok(plan.args.includes('--skip-vault'));
  assert.ok(plan.args.includes('--yes'));
  assert.equal(plan.args[plan.args.indexOf('--workdir') + 1], '/workspace');
});

test('backend CA paths are mapped into the tools repository mount', () => {
  const plan = prepareMigration([], {
    DATABASE_URL: exampleUrl,
    DATABASE_SSL_CA_FILE: '/app/.certs/supabase-ca.crt',
  });
  assert.equal(plan.caFile, '/workspace/backend/.certs/supabase-ca.crt');
  assert.equal(new URL(plan.databaseUrl).searchParams.get('sslrootcert'), plan.caFile);
  assert.equal(prepareMigration([], {
    DATABASE_URL: exampleUrl,
    DATABASE_SSL_CA_FILE: '/custom/ca.crt',
  }).caFile, '/custom/ca.crt');
});

test('TLS alternatives cannot change verification or load client private keys', () => {
  for (const option of ['ssl=false', 'ssl=no-verify', 'sslcert=/private/cert', 'sslkey=/private/key']) {
    assert.throws(() => prepareMigration([], { DATABASE_URL: `${exampleUrl}?${option}` }), MigrationConfigurationError);
  }
});

test('CLI output removes URLs, encoded and decoded passwords, and password assignments', () => {
  const plan = prepareMigration([], { DATABASE_URL: exampleUrl });
  const output = [
    `CLI received ${exampleUrl}`,
    `Connecting to ${plan.databaseUrl}`,
    'Error for example@pass / example%40pass',
    'Other connection postgres://another:other-pass@example.test:5432/db',
    'PGPASSWORD=other-pass password="third-pass"',
    'Applying migration 20261008000000_crear_centros.sql',
  ].join('\n');
  const safe = sanitizeCliOutput(output, plan.secrets);
  for (const secret of [exampleUrl, plan.databaseUrl, 'example@pass', 'example%40pass', 'other-pass', 'third-pass']) {
    assert.ok(!safe.includes(secret));
  }
  assert.match(safe, /Applying migration 20261008000000_crear_centros\.sql/);
});
