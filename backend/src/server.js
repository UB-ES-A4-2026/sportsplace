import { createAppServer } from './app.js';
import { createDatabase } from './database.js';
import { createAnunciosRepository } from './repositories/anuncios.js';
import { createCentrosRepository } from './repositories/centros.js';
import { createFotosStorage, urlPublicaFoto } from './services/storage-fotos.js';
import { createSupabaseAuth } from './services/supabase-auth.js';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const auth = createSupabaseAuth();
if (!auth) {
  console.log('Supabase Auth pendiente de configuración: faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY.');
}

const fotos = createFotosStorage();
if (!fotos) {
  console.log('Storage de fotos pendiente de configuración: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
}
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const urlFoto = supabaseUrl ? (ruta) => urlPublicaFoto(supabaseUrl, ruta) : undefined;

let database;

if (process.env.DATABASE_URL?.trim()) {
  try {
    database = createDatabase({
      onPoolError: (error) => console.error(error.message),
    });
    database.check().then(() => {
      console.log('Conexión PostgreSQL: correcta.');
    }).catch((error) => {
      console.error(error.message);
    });
  } catch (error) {
    console.error(error.message);
  }
} else {
  console.log('PostgreSQL pendiente de configuración: falta DATABASE_URL.');
}

const centros = database ? createCentrosRepository(database) : null;
const anuncios = database ? createAnunciosRepository(database, { urlFoto }) : null;
const server = createAppServer({
  auth,
  centros,
  anuncios,
  fotos,
  webRoot: process.env.STATIC_WEB_DIR?.trim() || null,
});

server.on('error', (error) => {
  console.error(`Unable to start Sportsplace API: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Sportsplace API listening on http://${host}:${port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping Sportsplace API.`);

  const timeout = setTimeout(() => {
    console.error('API shutdown timed out.');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close(async (error) => {
    if (error) {
      console.error(`Unable to close Sportsplace API: ${error.message}`);
      process.exitCode = 1;
    }
    if (database) {
      try {
        await database.close();
      } catch {
        console.error('No se pudo cerrar la conexión PostgreSQL.');
        process.exitCode = 1;
      }
    }
    clearTimeout(timeout);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
