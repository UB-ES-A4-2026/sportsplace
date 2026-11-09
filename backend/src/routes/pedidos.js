import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getPedidos, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';

// E06: todas las rutas de pedidos son privadas y exigen el email confirmado.
export function pedidosRouter() {
  const router = Router();
  router.use(requireAuth, requireEmailConfirmado);

  // US-108 (CA10-CA14): detalle de un pedido del que el centro es parte.
  router.get('/:id', async (request, response) => {
    const pedido = await getPedidos(request).obtener(request.usuario.id, request.params.id);
    response.json({ pedido });
  });

  router.all('/:id', methodNotAllowed(['GET']));

  return router;
}
