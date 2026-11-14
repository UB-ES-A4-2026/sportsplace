import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { anuncioNoEncontrado, esIdDeAnuncio } from '../repositories/anuncios.js';

export function catalogoRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  router.get('/:id', async (request, response) => {
    if (!esIdDeAnuncio(request.params.id)) throw anuncioNoEncontrado();
    const anuncio = await getAnuncios(request).obtenerCatalogo(request.usuario.id, request.params.id);
    response.json(anuncio);
  });
  router.all('/:id', methodNotAllowed(['GET']));

  return router;
}
