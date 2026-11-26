import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { validarConsultaFavoritos } from '../validation/favoritos.js';

// US-25: favoritos del centro de la sesión. Como el catálogo, exigen la
// sesión y el email confirmado; cada centro solo ve y cambia los suyos (CA18).
export function favoritosRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // CA6, CA7 y CA15.
  router.get('/', async (request, response) => {
    const consulta = validarConsultaFavoritos(request.query);
    response.json(await getAnuncios(request).listarFavoritos(request.usuario.id, consulta));
  });
  router.all('/', methodNotAllowed(['GET']));

  // CA13 y CA14: PUT y DELETE idempotentes, 204 sin cuerpo.
  router.put('/:anuncioId', async (request, response) => {
    await getAnuncios(request).guardarFavorito(request.usuario.id, request.params.anuncioId);
    response.status(204).end();
  });
  router.delete('/:anuncioId', async (request, response) => {
    await getAnuncios(request).quitarFavorito(request.usuario.id, request.params.anuncioId);
    response.status(204).end();
  });
  router.all('/:anuncioId', methodNotAllowed(['PUT', 'DELETE']));

  return router;
}
