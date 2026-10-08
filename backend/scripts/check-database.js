import { pathToFileURL } from 'node:url';
import { createDatabase } from '../src/database.js';

export async function runDatabaseCheck({
  create = createDatabase,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  let database;
  let exitCode = 0;
  try {
    database = create();
    const result = await database.check({ includeSchema: true });
    stdout('Conexión PostgreSQL: correcta.');
    if (result.centrosExists) {
      stdout('Tabla public.centros: encontrada.');
    } else {
      stderr('Tabla public.centros: no encontrada; migración pendiente.');
      exitCode = 1;
    }
  } catch (error) {
    const knownCodes = ['DATABASE_CONFIGURATION_ERROR', 'DATABASE_CONNECTION_ERROR', 'DATABASE_TLS_ERROR'];
    stderr(knownCodes.includes(error?.code)
      ? error.message
      : 'No se pudo comprobar PostgreSQL. Revisa la configuración del servidor.');
    exitCode = 1;
  } finally {
    if (database) {
      try {
        await database.close();
      } catch {
        stderr('No se pudo cerrar la conexión PostgreSQL.');
        exitCode = 1;
      }
    }
  }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runDatabaseCheck();
}
