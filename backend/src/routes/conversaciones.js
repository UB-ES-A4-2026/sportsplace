import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getConversaciones, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { conversacionNoEncontrada } from '../repositories/conversaciones.js';
import { esUuid, validarCursor, validarMensaje, validarNuevaConversacion } from '../validation/mensajes.js';

// E05 · US-28: todas las rutas son privadas y exigen el email confirmado. Los
// mensajes no se editan ni se borran: no hay PATCH ni DELETE (CA30).
export function conversacionesRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // CA20, CA21, CA32, CA33 y CA36: el centro interesado abre la conversación
  // con su primer mensaje.
  router.post('/', async (request, response) => {
    const datos = validarNuevaConversacion(request.body);
    const creada = await getConversaciones(request).crear(request.usuario.id, datos);
    response.status(201).location(`/api/conversaciones/${creada.conversacion.id}`).json(creada);
  });

  // CA22, CA23 y CA31. Un :id que no es un UUID responde como una conversación
  // inexistente, antes de mirar los parámetros.
  router.get('/:id', async (request, response) => {
    if (!esUuid(request.params.id)) throw conversacionNoEncontrada();
    const cursor = validarCursor(request.query);
    response.json(await getConversaciones(request).obtener(request.usuario.id, request.params.id.toLowerCase(), cursor));
  });

  // CA25, CA26 y CA31: escriben el comprador (US-28) y el vendedor (US-77).
  router.post('/:id/mensajes', async (request, response) => {
    if (!esUuid(request.params.id)) throw conversacionNoEncontrada();
    const datos = validarMensaje(request.body);
    const mensaje = await getConversaciones(request).enviar(request.usuario.id, request.params.id.toLowerCase(), datos);
    response.status(201).json({ mensaje });
  });

  router.all('/', methodNotAllowed(['POST']));
  router.all('/:id', methodNotAllowed(['GET']));
  router.all('/:id/mensajes', methodNotAllowed(['POST']));

  return router;
}
