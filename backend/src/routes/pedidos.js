import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getPedidos, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { validarEntregaPedido } from '../validation/entrega-pedido.js';
import { validarPedido } from '../validation/pedidos.js';

// E06: todas las rutas de pedidos son privadas y exigen el email confirmado.
export function pedidosRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  router.post('/', async (request, response) => {
    const datos = { ...validarPedido(request.body), ...validarEntregaPedido(request.body) };
    const pedido = await getPedidos(request).crear(request.usuario.id, datos);
    response.status(201).location(`/api/pedidos/${pedido.id}`).json({ pedido });
  });

  // US-108 (CA10-CA14): detalle de un pedido del que el centro es parte.
  router.get('/:id', async (request, response) => {
    const pedido = await getPedidos(request).obtener(request.usuario.id, request.params.id);
    response.json({ pedido });
  });

  // US-80 CA4: marca de cobro. US-42 CA11: recepción, sin cuerpo.
  router.post('/:id/marcar-pagado', async (request, response) => {
    const pedido = await getPedidos(request).marcarPagado(request.usuario.id, request.params.id);
    response.json({ pedido });
  });

  router.post('/:id/recibir', async (request, response) => {
    const pedido = await getPedidos(request).recibir(request.usuario.id, request.params.id);
    response.json({ pedido });
  });

  router.all('/', methodNotAllowed(['POST']));
  router.all('/:id', methodNotAllowed(['GET']));
  router.all('/:id/marcar-pagado', methodNotAllowed(['POST']));
  router.all('/:id/recibir', methodNotAllowed(['POST']));

  return router;
}
