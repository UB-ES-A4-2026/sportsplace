import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { databaseUnavailable } from '../repositories/centros.js';
import { listarMisAnuncios } from './anuncios.js';

function getConversacionesAnuncio(request) {
  const conversaciones = request.app.get('conversacionesAnuncio');
  if (!conversaciones) throw databaseUnavailable();
  return conversaciones;
}

export function conversacionesAnuncioRouter() {
  const router = Router();
  const privada = [requireAuth, requireEmailConfirmado];

  router.get('/api/anuncios/:id/conversaciones', ...privada, async (request, response) => {
    response.json(await getConversacionesAnuncio(request).listar(request.usuario.id, request.params.id));
  });
  router.post('/api/conversaciones/:id/leida', ...privada, async (request, response) => {
    await getConversacionesAnuncio(request).marcarLeida(request.usuario.id, request.params.id);
    response.status(204).end();
  });
  router.get('/api/mis-anuncios', ...privada, listarMisAnuncios);

  router.all('/api/anuncios/:id/conversaciones', ...privada, methodNotAllowed(['GET']));
  router.all('/api/conversaciones/:id/leida', ...privada, methodNotAllowed(['POST']));
  router.all('/api/mis-anuncios', ...privada, methodNotAllowed(['GET']));
  return router;
}
