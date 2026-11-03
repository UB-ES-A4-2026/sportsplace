import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, getFotosStorage, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { leerPublicacion } from '../middleware/multipart.js';
import { publicarAnuncio } from '../services/publicar-anuncio.js';
import { ACCIONES } from '../services/transiciones-anuncio.js';
import { validarPaginacion } from '../validation/anuncios.js';
import { validarPublicacion } from '../validation/fotos.js';

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

  // US-18: «Mis anuncios», paginada (CA11-CA14). Va antes que /:id para que
  // «mios» no se tome como el id de un anuncio (CA13).
  router.get('/mios', async (request, response) => {
    const paginacion = validarPaginacion(request.query);
    response.json(await getAnuncios(request).listarMios(request.usuario.id, paginacion));
  });

  // US-12: ficha propia del anuncio (CA20, CA24).
  router.get('/:id', async (request, response) => {
    const anuncio = await getAnuncios(request).obtener(request.usuario.id, request.params.id);
    response.json({ anuncio });
  });

  // E03: cambio de estado sin cuerpo; responde 200 { anuncio } o 404/409.
  // US-17 reutiliza `transicion` con reservar, quitar-reserva y entregar.
  const transicion = (accion) => async (request, response) => {
    const anuncio = await getAnuncios(request).transicionar(
      request.usuario.id,
      request.params.id,
      ACCIONES[accion],
    );
    response.json({ anuncio });
  };

  // US-16 (CA6-CA9): pausar y reactivar.
  for (const accion of ['pausar', 'reactivar']) {
    router.post(`/:id/${accion}`, transicion(accion));
    router.all(`/:id/${accion}`, methodNotAllowed(['POST']));
  }

  // US-70 (CA7-CA12): retirada lógica. La fila no se borra: pasa a `retirado`
  // con retirado_en y desde entonces cualquier ruta responde 404 (CA11).
  router.delete('/:id', async (request, response) => {
    await getAnuncios(request).transicionar(request.usuario.id, request.params.id, ACCIONES.retirar);
    response.status(204).end();
  });

  router.all('/', methodNotAllowed(['POST']));
  router.all('/mios', methodNotAllowed(['GET']));
  router.all('/:id', methodNotAllowed(['GET', 'DELETE']));

  return router;
}
