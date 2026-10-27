import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

// Nunca usar el .env del Supabase compartido ni variables heredadas para el destino.
export function validateEnvironment(environment) {
  const required = [
    'DATABASE_URL', 'DATABASE_SSL_CA_FILE', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY',
    'E2E_CENTRO_A_EMAIL', 'E2E_CENTRO_B_EMAIL', 'E2E_SIN_CONFIRMAR_EMAIL', 'E2E_PASSWORD',
  ];
  if (required.some((key) => !environment[key]?.trim())) {
    throw new Error('Falta configuración e2e. Ejecuta npm --prefix tools run test-env:up (T12-8).');
  }
  for (const key of ['DATABASE_URL', 'SUPABASE_URL']) {
    let url;
    try { url = new URL(environment[key]); } catch { throw new Error(`${key} de pruebas no es válida.`); }
    const protocols = key === 'DATABASE_URL' ? ['postgres:', 'postgresql:'] : ['http:', 'https:'];
    if (!protocols.includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error(`${key} debe apuntar al entorno de pruebas local aislado.`);
    }
  }
  const result = Object.fromEntries(required.map((key) => [key, environment[key]]));
  if (environment.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    result.SUPABASE_SERVICE_ROLE_KEY = environment.SUPABASE_SERVICE_ROLE_KEY;
  }
  return result;
}

export function loadTestEnvironment() {
  let content;
  try {
    content = readFileSync(new URL('../.e2e/runtime.env', import.meta.url), 'utf8');
  } catch {
    throw new Error('No existe .e2e/runtime.env. Ejecuta npm --prefix tools run test-env:up (T12-8).');
  }
  return validateEnvironment(parseEnv(content));
}
