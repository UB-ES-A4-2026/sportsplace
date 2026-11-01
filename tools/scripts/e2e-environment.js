import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, copyFile, mkdir, readFile, readdir, realpath, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import selfsigned from 'selfsigned';
import { fixtureCentros, fixturePassword, seedAnuncios } from './e2e-fixtures.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = join(root, '.e2e');
const cliPath = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const excludedServices = 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor';

export function projectId(path) {
  return `sportsplace-e2e-${createHash('sha256').update(path).digest('hex').slice(0, 12)}`;
}

export function localEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([name]) => !/^(SUPABASE_|DATABASE_|MIGRATION_|PG|GOTRUE_)/i.test(name)));
}

export function validateStatus(status) {
  const api = new URL(status.API_URL);
  const database = new URL(status.DB_URL);
  if (api.origin !== 'http://127.0.0.1:54321' || api.pathname !== '/' || api.username || api.password
      || database.protocol !== 'postgresql:' || database.hostname !== '127.0.0.1'
      || database.port !== '54322' || database.pathname !== '/postgres' || database.username !== 'postgres'
      || database.search || database.hash || !database.password
      || !(status.PUBLISHABLE_KEY || status.ANON_KEY) || !(status.SERVICE_ROLE_KEY || status.SECRET_KEY)) {
    throw new Error('La CLI no devuelve las conexiones locales esperadas. No se usará otra base de datos.');
  }
  return status;
}

// Never forward raw CLI output: status/start can contain local administrative keys.
function command(binary, args, { input } = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(binary, args, { cwd: runtime, env: localEnvironment(process.env), shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    let bytes = 0;
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes < 16 * 1024 * 1024) output.push(chunk);
      else child.kill();
    });
    child.stderr.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes >= 16 * 1024 * 1024) child.kill();
    });
    child.on('error', () => reject(new Error(`No se pudo ejecutar ${binary === process.execPath ? 'Supabase CLI' : 'Docker'}. Comprueba Node.js 24 y Docker Desktop.`)));
    child.on('close', (code) => code === 0
      ? resolveCommand(Buffer.concat(output).toString('utf8'))
      : reject(new Error(`Falló ${binary === process.execPath ? 'Supabase CLI' : 'Docker'} (${args[0]}). Comprueba Docker, red y puertos 54321/54322/54324. No se imprimen credenciales.`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

const cli = (...args) => command(process.execPath, [cliPath, ...args, '--workdir', runtime]);

async function owner({ create = false } = {}) {
  const checkout = await realpath(root);
  const expected = { checkout, project: projectId(checkout) };
  const ownerFile = join(runtime, 'owner.json');
  if (create) await mkdir(runtime, { recursive: true, mode: 0o700 });
  let existing;
  try { existing = JSON.parse(await readFile(ownerFile, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('No se puede validar el propietario de .e2e.', { cause: error });
    if (!create) throw new Error('Este checkout no tiene entorno de pruebas. Ejecuta test-env:up.', { cause: error });
    try {
      await access(join(runtime, 'supabase'));
      throw new Error('.e2e/supabase ya existe sin propietario; no se modificarán esos recursos.', { cause: error });
    } catch (missing) {
      if (missing.code !== 'ENOENT') throw missing;
    }
    await writeFile(ownerFile, JSON.stringify(expected), { mode: 0o600 });
    existing = expected;
  }
  if (existing.checkout !== expected.checkout || existing.project !== expected.project) {
    throw new Error('El entorno pertenece a otro checkout; no se modificarán sus recursos.');
  }
  return expected;
}

async function verifyContainer(project) {
  const container = `supabase_db_${project}`;
  const labels = JSON.parse(await command('docker', ['inspect', '--format', '{{json .Config.Labels}}', container]));
  if (labels['com.supabase.cli.project'] !== project
      || resolve(labels['com.supabase.cli.workdir']) !== runtime) {
    throw new Error('El contenedor no pertenece a este entorno de pruebas.');
  }
  return container;
}

async function verifyConfig(project) {
  const text = await readFile(join(runtime, 'supabase/config.toml'), 'utf8');
  if (!text.startsWith(`project_id = "${project}"\n`)) throw new Error('La configuración local no corresponde a este checkout.');
}

async function prepareFiles(project) {
  const destination = join(runtime, 'supabase');
  await mkdir(join(destination, 'migrations'), { recursive: true });
  const config = await readFile(join(root, 'supabase/config.toml'), 'utf8');
  await writeFile(join(destination, 'config.toml'), `project_id = "${project}"\n${config.replace(/^project_id = .*$/m, '')}`);
  // Exact migration snapshot: do not retain migrations removed by switching branches.
  for (const name of await readdir(join(destination, 'migrations'))) {
    if (!/^\d+_[\w-]+\.sql$/.test(name)) throw new Error('Hay un archivo inesperado en las migraciones temporales.');
    await unlink(join(destination, 'migrations', name));
  }
  for (const name of await readdir(join(root, 'supabase/migrations'))) {
    if (name.endsWith('.sql')) await copyFile(join(root, 'supabase/migrations', name), join(destination, 'migrations', name));
  }
}

async function configureTls(container) {
  const validity = { algorithm: 'sha256', keySize: 2048, notBeforeDate: new Date(Date.now() - 60_000), notAfterDate: new Date(Date.now() + 7 * 86400_000) };
  const ca = await selfsigned.generate([{ name: 'commonName', value: 'Sportsplace isolated E2E CA' }], {
    ...validity,
    extensions: [{ name: 'basicConstraints', cA: true }, { name: 'keyUsage', keyCertSign: true }],
  });
  const server = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    ...validity, ca: { key: ca.private, cert: ca.cert },
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] },
    ],
  });
  await writeFile(join(runtime, 'postgres-ca.crt'), ca.cert, { mode: 0o600 });
  await writeFile(join(runtime, 'server.crt'), server.cert, { mode: 0o600 });
  await writeFile(join(runtime, 'server.key'), server.private, { mode: 0o600 });
  await command('docker', ['exec', container, 'mkdir', '-p', '/tmp/sportsplace-e2e-tls']);
  try {
    await command('docker', ['cp', join(runtime, 'server.crt'), `${container}:/tmp/sportsplace-e2e-tls/server.crt`]);
    await command('docker', ['cp', join(runtime, 'server.key'), `${container}:/tmp/sportsplace-e2e-tls/server.key`]);
  } finally {
    await unlink(join(runtime, 'server.key'));
  }
  await command('docker', ['exec', container, 'chown', '-R', 'postgres:postgres', '/tmp/sportsplace-e2e-tls']);
  await command('docker', ['exec', container, 'chmod', '600', '/tmp/sportsplace-e2e-tls/server.key']);
  await command('docker', ['exec', '-i', container, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: "ALTER SYSTEM SET ssl_cert_file = '/tmp/sportsplace-e2e-tls/server.crt';\nALTER SYSTEM SET ssl_key_file = '/tmp/sportsplace-e2e-tls/server.key';\nALTER SYSTEM SET ssl = 'on';\nSELECT pg_reload_conf();\n",
  });
}

async function clientFor(status) {
  const url = new URL(status.DB_URL);
  const client = new pg.Client({ host: url.hostname, port: Number(url.port), user: 'postgres', password: decodeURIComponent(url.password), database: 'postgres',
    ssl: { rejectUnauthorized: true, ca: await readFile(join(runtime, 'postgres-ca.crt'), 'utf8') }, connectionTimeoutMillis: 5000 });
  await client.connect();
  const { rows: [tls] } = await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
  if (!tls?.ssl) throw new Error('La conexión de pruebas no ha negociado TLS.');
  return client;
}

async function authRequest(status, method, path, body) {
  const response = await fetch(`${status.API_URL}/auth/v1/admin/users${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { apikey: status.SERVICE_ROLE_KEY || status.SECRET_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY || status.SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`No se pudo preparar un usuario en Auth local (HTTP ${response.status}).`);
  return response.json();
}

async function seed(status, requireAnuncios) {
  const client = await clientFor(status);
  try {
    for (const centro of fixtureCentros) {
      const existing = await client.query('SELECT id FROM auth.users WHERE email = $1', [centro.email]);
      const user = await authRequest(status, existing.rows.length ? 'PUT' : 'POST', existing.rows.length ? `/${existing.rows[0].id}` : '', {
        email: centro.email, password: fixturePassword, email_confirm: centro.confirmed,
      });
      const userId = user.id || user.user?.id;
      if (!userId) throw new Error('Auth local no devolvió el identificador de la cuenta.');
      if (!centro.confirmed) await client.query('UPDATE auth.users SET email_confirmed_at = NULL WHERE id = $1', [userId]);
      await client.query(`INSERT INTO public.centros (id, usuario_id, nombre, email, localidad, politica_privacidad_aceptada, politica_privacidad_aceptada_en, email_confirmado_en)
        VALUES ($1, $2, $3, $4, 'Barcelona', true, now(), $5)
        ON CONFLICT (id) DO UPDATE SET usuario_id=EXCLUDED.usuario_id, nombre=EXCLUDED.nombre, email=EXCLUDED.email, email_confirmado_en=EXCLUDED.email_confirmado_en`,
      [centro.id, userId, centro.nombre, centro.email, centro.confirmed ? new Date() : null]);
    }
    await client.query('BEGIN');
    const result = await seedAnuncios(client, { requireAnuncios });
    await client.query('COMMIT');
    console.log('Semilla local: dos centros confirmados y uno sin confirmar. PostgreSQL conectado con TLS verificado.');
    if (result.pending) console.log(result.pending);
    else console.log('Semilla local: 21 anuncios visibles de A, uno de B y uno retirado.');
  } finally { await client.end(); }
}

async function writeRuntime(status) {
  const values = {
    DATABASE_URL: status.DB_URL,
    DATABASE_SSL_CA_FILE: join(runtime, 'postgres-ca.crt').replaceAll('\\', '/'),
    SUPABASE_URL: status.API_URL,
    SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY || status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY || status.SECRET_KEY,
    E2E_CENTRO_A_EMAIL: fixtureCentros[0].email,
    E2E_CENTRO_B_EMAIL: fixtureCentros[1].email,
    E2E_SIN_CONFIRMAR_EMAIL: fixtureCentros[2].email,
    E2E_PASSWORD: fixturePassword,
  };
  await writeFile(join(runtime, 'runtime.env'), Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
  await chmod(join(runtime, 'runtime.env'), 0o600);
}

export async function run(argv = process.argv.slice(2)) {
  const [action, ...flags] = argv;
  if (!['up', 'seed', 'down'].includes(action) || flags.some((flag) => flag !== '--require-anuncios') || (action === 'down' && flags.length)) {
    throw new Error('Uso: test-environment.js up|seed [--require-anuncios] | down');
  }
  const { project } = await owner({ create: action === 'up' });
  if (action === 'down') {
    await verifyConfig(project);
    await cli('stop', '--no-backup');
    await unlink(join(runtime, 'runtime.env')).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    console.log('Entorno de pruebas de este checkout detenido; volúmenes locales de pruebas eliminados.');
    return;
  }
  if (action === 'up') {
    await prepareFiles(project);
    console.log('Arrancando Supabase aislado (la primera descarga puede tardar varios minutos).');
    await cli('start', '--exclude', excludedServices);
    await verifyContainer(project);
    console.log('Restableciendo únicamente esta base local y aplicando las migraciones del checkout.');
    await cli('db', 'reset', '--local', '--yes');
    await configureTls(await verifyContainer(project));
  } else {
    await verifyConfig(project);
    await verifyContainer(project);
  }
  const status = validateStatus(JSON.parse(await cli('status', '--output', 'json')));
  await seed(status, flags.includes('--require-anuncios'));
  await writeRuntime(status);
  console.log('Configuración local disponible en .e2e/runtime.env. No subir este archivo ni incluirlo en artefactos.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await run(); } catch (error) {
    // Unexpected SDK/network errors may contain connection strings. Only our messages are shown.
    console.error(error.constructor === Error && !error.cause ? error.message : 'No se pudo preparar el entorno local. Comprueba Docker y repite test-env:up.');
    process.exitCode = 1;
  }
}
