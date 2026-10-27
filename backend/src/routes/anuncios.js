import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAnuncios, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { ACCIONES } from '../services/transiciones-anuncio.js';
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

  // E03: cambio de estado sin cuerpo; responde 200 { anuncio } o 404/409.
  const transicion = (accion) => async (request, response) => {
    const anuncio = await getAnuncios(request).transicionar(
      request.usuario.id,
      request.params.id,
      ACCIONES[accion],
    );
    response.json({ anuncio });
  };

  // US-16 (CA6-CA9): pausar y reactivar. US-17 (CA7, CA8): reservar,
  // quitar-reserva y entregar.
  for (const accion of ['pausar', 'reactivar', 'reservar', 'quitar-reserva', 'entregar']) {
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
  router.all('/:id', methodNotAllowed(['GET', 'DELETE']));

  return router;
}
