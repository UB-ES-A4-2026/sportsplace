import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { anuncioNoEncontrado, esIdDeAnuncio } from '../repositories/anuncios.js';
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

  // US-15: modificar un anuncio publicado (CA11-CA17, CA20). Mismas reglas que
  // al publicar; `estado` y el resto de claves no previstas se ignoran.
  // Mientras US-13 no esté en dev, el cuerpo es JSON y sin fotos, igual que
  // POST en esta rama (US-12, CA30).
  // Un :id que no es un UUID responde 404 antes de mirar el cuerpo («Propiedad»).
  router.patch('/:id', async (request, response) => {
    if (!esIdDeAnuncio(request.params.id)) throw anuncioNoEncontrado();
    const datos = validarAnuncio(request.body);
    const anuncio = await getAnuncios(request).editar(request.usuario.id, request.params.id, datos);
    response.json({ anuncio });
  });

  router.all('/', methodNotAllowed(['POST']));
  router.all('/:id', methodNotAllowed(['GET', 'PATCH']));

  return router;
}
