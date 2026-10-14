import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';

export function healthRouter() {
  const router = Router();

  // /api/health es el endpoint público; /health es un alias para las sondas de Docker.
  for (const path of ['/api/health', '/health']) {
    router.get(path, (request, response) => {
      response.json({ status: 'ok', service: 'sportsplace-api' });
    });
    router.all(path, methodNotAllowed(['GET']));
  }

  return router;
}
