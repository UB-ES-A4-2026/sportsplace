import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';

export function healthRouter({ commit = null } = {}) {
  const router = Router();
  const status = { status: 'ok', service: 'sportsplace-api' };
  // Solo el SHA público del despliegue; nunca se devuelve el entorno completo.
  if (typeof commit === 'string' && commit.length === 40 && /^[a-f0-9]{40}$/i.test(commit)) {
    status.commit = commit.toLowerCase();
  }

  // /api/health es el endpoint público; /health es un alias para las sondas de Docker.
  for (const path of ['/api/health', '/health']) {
    router.get(path, (request, response) => {
      response.json(status);
    });
    router.all(path, methodNotAllowed(['GET']));
  }

  return router;
}
