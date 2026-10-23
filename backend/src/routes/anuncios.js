import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, getFotosStorage, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { leerPublicacion } from '../middleware/multipart.js';
import { anuncioNoEncontrado, esIdDeAnuncio } from '../repositories/anuncios.js';
import { editarAnuncio } from '../services/editar-anuncio.js';
import { publicarAnuncio } from '../services/publicar-anuncio.js';
import { validarEdicion, validarPublicacion } from '../validation/fotos.js';

// E03: todas las rutas de anuncios son privadas y exigen el email confirmado.
export function anunciosRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // US-12 (CA15-CA19, CA21, CA22) y US-13 (CA12-CA20): publicar un anuncio
  // con sus fotos en multipart/form-data. Se valida todo antes de tocar la
  // base de datos o Storage.
  router.post('/', async (request, response) => {
    const { anuncio: datos, fotos } = validarPublicacion(await leerPublicacion(request));
    const anuncio = await publicarAnuncio({
      anuncios: getAnuncios(request),
      storage: getFotosStorage(request),
      usuarioId: request.usuario.id,
      datos,
      fotos,
    });
    response.status(201).location(`/api/anuncios/${anuncio.id}`).json({ anuncio });
  });

  // US-12: ficha propia del anuncio (CA20, CA24).
  router.get('/:id', async (request, response) => {
    const anuncio = await getAnuncios(request).obtener(request.usuario.id, request.params.id);
    response.json({ anuncio });
  });

  // US-15: modificar un anuncio publicado (CA5, CA7-CA17, CA20) con el mismo
  // multipart que al publicar: `datos` (con `fotos_conservar`), `fotos` nuevas
  // y `foto_principal`. `estado` y el resto de claves no previstas se ignoran.
  // Un :id que no es un UUID responde 404 antes de mirar el cuerpo («Propiedad»).
  router.patch('/:id', async (request, response) => {
    if (!esIdDeAnuncio(request.params.id)) throw anuncioNoEncontrado();
    const { anuncio: datos, ...fotos } = validarEdicion(await leerPublicacion(request));
    const anuncio = await editarAnuncio({
      anuncios: getAnuncios(request),
      storage: getFotosStorage(request),
      usuarioId: request.usuario.id,
      id: request.params.id,
      datos,
      ...fotos,
    });
    response.json({ anuncio });
  });

  router.all('/', methodNotAllowed(['POST']));
  router.all('/:id', methodNotAllowed(['GET', 'PATCH']));

  return router;
}
