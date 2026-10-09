import { createServer } from 'node:http';
import express from 'express';
import { errorHandler, notFoundHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';

// `auth` es el servicio de autenticación (Supabase Auth en producción y un
// doble en las pruebas). Puede ser null si falta la configuración de Supabase.
export function createApp({ auth = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('auth', auth);

  app.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter());
  app.use('/api/auth', authRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export function createAppServer(options) {
  return createServer(createApp(options));
}
