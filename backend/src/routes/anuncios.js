import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { validarAnuncio } from '../validation/anuncios.js';

// E03: todas las rutas de anuncios son privadas y exigen el email confirmado.
export function anunciosRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // US-12: publicar un anuncio (CA15-CA19, CA21, CA22).
  router.post('/', async (request, response) => {
    const datos = validarAnuncio(request.body);
    const anuncio = await getAnuncios(request).crear(request.usuario.id, datos);
    response.status(201).location(`/api/anuncios/${anuncio.id}`).json({ anuncio });
  });

  // US-12: ficha propia del anuncio (CA20, CA24).
  router.get('/:id', async (request, response) => {
    const anuncio = await getAnuncios(request).obtener(request.usuario.id, request.params.id);
    response.json({ anuncio });
  });

  router.all('/', methodNotAllowed(['POST']));
  router.all('/:id', methodNotAllowed(['GET']));

  return router;
}
