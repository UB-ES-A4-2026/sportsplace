import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;
const TLS_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

function configurationError(message) {
  const error = new Error(message);
  error.code = 'DATABASE_CONFIGURATION_ERROR';
  return error;
}

function connectionError(error) {
  const tlsFailure = TLS_ERROR_CODES.has(error?.code);
  const safeError = new Error(tlsFailure
    ? 'No se pudo verificar el certificado TLS de PostgreSQL.'
    : 'No se pudo conectar o consultar PostgreSQL. Revisa la configuración y la disponibilidad del proyecto.');
  safeError.code = tlsFailure ? 'DATABASE_TLS_ERROR' : 'DATABASE_CONNECTION_ERROR';
  return safeError;
}

function poolConfiguration(environment, readCertificate) {
  if (!environment.DATABASE_URL?.trim()) {
    throw configurationError('Falta DATABASE_URL en la configuración del servidor.');
  }

  let url;
  try {
    url = new URL(environment.DATABASE_URL);
  } catch {
    throw configurationError('DATABASE_URL debe ser una URL PostgreSQL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !url.hostname || !url.pathname.slice(1) || url.hash) {
    throw configurationError('DATABASE_URL debe ser una URL PostgreSQL válida con servidor y base de datos.');
  }

  for (const [name, value] of url.searchParams) {
    const parameter = name.toLowerCase();
    if (['sslcert', 'sslkey', 'sslrootcert'].includes(parameter)) {
      throw configurationError('Usa DATABASE_SSL_CA_FILE para el certificado CA; no incluyas parámetros de certificados en DATABASE_URL.');
    }
    if (parameter === 'sslmode') {
      if (!['require', 'verify-ca', 'verify-full'].includes(value.toLowerCase())) {
        throw configurationError('DATABASE_URL no puede desactivar ni reducir la verificación TLS.');
      }
    } else if (parameter !== 'application_name') {
      throw configurationError('DATABASE_URL contiene un parámetro no admitido. Usa la URL de conexión PostgreSQL del proyecto.');
    }
  }

  const ssl = { rejectUnauthorized: true };
  if (environment.DATABASE_SSL_CA_FILE?.trim()) {
    try {
      ssl.ca = readCertificate(environment.DATABASE_SSL_CA_FILE, 'utf8');
    } catch {
      throw configurationError('No se pudo leer DATABASE_SSL_CA_FILE. Comprueba la ruta del certificado CA en el servidor.');
    }
    if (typeof ssl.ca !== 'string' || !ssl.ca.includes('-----BEGIN CERTIFICATE-----')) {
      throw configurationError('DATABASE_SSL_CA_FILE debe contener un certificado CA en formato PEM.');
    }
  }

  try {
    // Pass individual values: node-postgres URL parameters cannot override TLS or timeouts.
    return {
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username) || undefined,
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      application_name: url.searchParams.get('application_name') || 'sportsplace-backend',
      ssl,
      max: 2,
      connectionTimeoutMillis: 5_000,
      query_timeout: 5_000,
      statement_timeout: 5_000,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: true,
    };
  } catch {
    throw configurationError('DATABASE_URL debe ser una URL PostgreSQL válida.');
  }
}

export function createDatabase({
  environment = process.env,
  poolFactory = (configuration) => new Pool(configuration),
  readCertificate = readFileSync,
  onPoolError = () => {},
} = {}) {
  const configuration = poolConfiguration(environment, readCertificate);
  let pool;
  try {
    pool = poolFactory(configuration);
  } catch {
    throw configurationError('No se pudo preparar la conexión PostgreSQL. Revisa la configuración del servidor.');
  }

  // A pool can report an error on an idle connection. Never expose its raw error.
  pool.on('error', (error) => onPoolError(connectionError(error)));
  let closing;

  return {
    async check({ includeSchema = false } = {}) {
      try {
        await pool.query('SELECT 1');
        if (!includeSchema) return { connected: true };

        const result = await pool.query("SELECT to_regclass('public.centros') IS NOT NULL AS centros_exists");
        return { connected: true, centrosExists: result.rows[0]?.centros_exists === true };
      } catch (error) {
        throw connectionError(error);
      }
    },
    close() {
      closing ??= Promise.resolve().then(() => pool.end()).catch(() => {
        throw new Error('No se pudo cerrar la conexión PostgreSQL.');
      });
      return closing;
    },
  };
}
