import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { anuncioNoEncontrado, esIdDeAnuncio } from '../repositories/anuncios.js';
import { validarConsultaCatalogo } from '../validation/catalogo.js';

// E04: el catálogo es privado y exige el email confirmado (CA23).
export function catalogoRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // US-96: anuncios de otros centros, 20 por página (CA16-CA19).
  router.get('/', async (request, response) => {
    const consulta = validarConsultaCatalogo(request.query);
    response.json(await getAnuncios(request).listarCatalogo(request.usuario.id, consulta));
  });
  router.all('/', methodNotAllowed(['GET']));

  router.get('/:id', async (request, response) => {
    if (!esIdDeAnuncio(request.params.id)) throw anuncioNoEncontrado();
    const anuncio = await getAnuncios(request).obtenerCatalogo(request.usuario.id, request.params.id);
    response.json(anuncio);
  });
  router.all('/:id', methodNotAllowed(['GET']));

  return router;
}
