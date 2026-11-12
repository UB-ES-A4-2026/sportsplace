import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getPedidos, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { validarEntregaPedido } from '../validation/entrega-pedido.js';
import { validarListaPedidos, validarPedido } from '../validation/pedidos.js';
import { validarRechazoPedido } from '../validation/rechazar-pedido.js';

// E06: todas las rutas de pedidos son privadas y exigen el email confirmado.
export function pedidosRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // US-109 (CA10-CA13): bandeja de pedidos recibidos o realizados por el centro.
  router.get('/', async (request, response) => {
    const consulta = validarListaPedidos(request.query);
    response.json(await getPedidos(request).listar(request.usuario.id, consulta));
  });

  // US-109 CA12: pedidos recibidos pendientes. Va antes que /:id.
  router.get('/contador', async (request, response) => {
    response.json(await getPedidos(request).contador(request.usuario.id));
  });

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

  router.post('/:id/aceptar', async (request, response) => {
    const pedido = await getPedidos(request).aceptar(request.usuario.id, request.params.id);
    response.json({ pedido });
  });

  router.post('/:id/rechazar', async (request, response) => {
    const datos = validarRechazoPedido(request.body);
    const pedido = await getPedidos(request).rechazar(request.usuario.id, request.params.id, datos);
    response.json({ pedido });
  });

  router.all('/', methodNotAllowed(['GET', 'POST']));
  router.all('/contador', methodNotAllowed(['GET']));
  router.all('/:id', methodNotAllowed(['GET']));
  router.all('/:id/aceptar', methodNotAllowed(['POST']));
  router.all('/:id/rechazar', methodNotAllowed(['POST']));

  return router;
}
