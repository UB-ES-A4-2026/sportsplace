import { access, constants } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const cliPath = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url));
const workdir = '/workspace';
const maximumOutputBytes = 8 * 1024 * 1024;

export class MigrationConfigurationError extends Error {}
export class MigrationUsageError extends Error {}

function certificatePath(path) {
  return path.startsWith('/app/.certs/')
    ? `/workspace/backend/.certs/${path.slice('/app/.certs/'.length)}`
    : path;
}

export function prepareMigration(argv, env) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--dry-run')) {
    throw new MigrationUsageError('Uso: dbtools [--dry-run]. No se admiten otros argumentos.');
  }

  const connectionString = env.MIGRATION_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new MigrationConfigurationError('Configura DATABASE_URL o MIGRATION_DATABASE_URL en tu .env local.');
  }

  let url;
  try {
    url = new URL(connectionString);
    // Validate encoded credentials without including their value in errors.
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new MigrationConfigurationError('La conexión debe ser una URL PostgreSQL válida con sus caracteres reservados codificados.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username
      || !url.password || !url.pathname || url.pathname === '/' || url.hash) {
    throw new MigrationConfigurationError('La URL PostgreSQL debe incluir servidor, usuario, contraseña y base de datos.');
  }

  const unsafeTlsParameters = ['ssl', 'sslcert', 'sslkey', 'sslpassword'];
  if (unsafeTlsParameters.some((name) => url.searchParams.has(name))) {
    throw new MigrationConfigurationError('No configures opciones TLS alternativas en la URL; usa DATABASE_SSL_CA_FILE para el certificado CA.');
  }

  // This command always verifies the database server certificate and hostname.
  url.searchParams.set('sslmode', 'verify-full');
  const configuredCa = env.DATABASE_SSL_CA_FILE?.trim() || url.searchParams.get('sslrootcert');
  const caFile = configuredCa ? certificatePath(configuredCa) : undefined;
  if (caFile) url.searchParams.set('sslrootcert', caFile);

  const databaseUrl = url.toString();
  return {
    databaseUrl,
    caFile,
    dryRun: argv.length === 1,
    secrets: [connectionString, databaseUrl, url.password, decodeURIComponent(url.password)],
    args: ['db', 'push', '--db-url', databaseUrl, '--workdir', workdir, '--skip-vault', '--yes', ...argv],
  };
}

export function sanitizeCliOutput(output, secrets) {
  let clean = String(output);
  // Process complete output rather than individual chunks: credentials may span chunks.
  for (const secret of [...new Set(secrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    clean = clean.split(secret).join('[credencial omitida]');
  }
  return clean
    .replace(/\bpostgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[conexión omitida]')
    .replace(/\b(?:password|PGPASSWORD)\s*[=:]\s*(?:'[^']*'|"[^"]*"|[^\s,;]+)/gi, 'password=[credencial omitida]');
}

export async function runMigration(argv = process.argv.slice(2), env = process.env) {
  let plan;
  try {
    plan = prepareMigration(argv, env);
    if (plan.caFile) await access(plan.caFile, constants.R_OK);
    await access(`${workdir}/supabase/migrations`, constants.R_OK);
  } catch (error) {
    if (error instanceof MigrationUsageError) {
      console.error(error.message);
      return 2;
    }
    console.error(error instanceof MigrationConfigurationError
      ? error.message
      : 'No se puede leer la carpeta de migraciones o el certificado CA configurado.');
    return 1;
  }

  console.log(plan.dryRun
    ? 'Revisando las migraciones pendientes; no se aplicarán migraciones.'
    : 'Aplicando las migraciones pendientes del repositorio.');

  return new Promise((resolveExit) => {
    const child = spawn(cliPath, plan.args, {
      cwd: workdir,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const captured = { stdout: [], stderr: [] };
    let bytes = 0;
    let exceededLimit = false;

    for (const name of ['stdout', 'stderr']) {
      child[name].on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > maximumOutputBytes) {
          exceededLimit = true;
          child.kill('SIGTERM');
          return;
        }
        captured[name].push(chunk);
      });
    }

    const forwardSignal = (signal) => child.kill(signal);
    const onInterrupt = () => forwardSignal('SIGINT');
    const onTerminate = () => forwardSignal('SIGTERM');
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);

    child.once('error', () => {
      console.error('No se ha podido iniciar la CLI de Supabase. Reconstruye la imagen de herramientas.');
    });
    child.once('close', (code, signal) => {
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onTerminate);
      if (exceededLimit) {
        console.error('La CLI superó el límite de salida. Se ha detenido la ejecución; comprueba el estado antes de repetirla.');
        resolveExit(1);
        return;
      }
      for (const name of ['stdout', 'stderr']) {
        const clean = sanitizeCliOutput(Buffer.concat(captured[name]).toString('utf8'), plan.secrets);
        if (clean) process[name].write(clean);
      }
      resolveExit(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runMigration();
}
