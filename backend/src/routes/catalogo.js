import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
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

  return router;
}
