import { createServer } from 'node:http';
import express from 'express';
import { errorHandler, notFoundHandler } from './errors.js';
import { anunciosRouter } from './routes/anuncios.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { staticWeb } from './static-web.js';
import { marcarEnterosConDecimales } from './validation/anuncios.js';

// `auth` es el servicio de autenticación (Supabase Auth en producción y un
// doble en las pruebas); `centros` y `anuncios`, los repositorios de sus tablas.
// Cualquiera puede ser null si falta su configuración.
export function createApp({ auth = null, centros = null, anuncios = null, webRoot = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('auth', auth);
  app.set('centros', centros);
  app.set('anuncios', anuncios);

  app.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '100kb', reviver: marcarEnterosConDecimales }));

  app.use(healthRouter());
  app.use('/api/auth', authRouter());
  app.use('/api/anuncios', anunciosRouter());

  if (webRoot !== null) app.use(staticWeb(webRoot));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export function createAppServer(options) {
  return createServer(createApp(options));
}
