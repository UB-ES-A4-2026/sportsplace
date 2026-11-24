import { api } from './cliente.js';

// Cierre de un pedido (E06 US-80 y E07 US-42). En su propio archivo para no chocar con api/pedidos.js (US-108,
// US-109) ni con api/accionesPedido.js (US-33). `llamarApi` solo se cambia en los tests.

// US-80 CA4: POST /api/pedidos/:id/marcar-pagado, sin cuerpo → 200 { pedido } con `pagado_en`.
export async function marcarPedidoPagado(id, llamarApi = api) {
  const { pedido } = await llamarApi(`/pedidos/${encodeURIComponent(id)}/marcar-pagado`, { method: 'POST' });
  return pedido;
}

// US-42 CA11: POST /api/pedidos/:id/recibir, sin cuerpo → 200 { pedido } con `estado: 'recibido'` y `recibido_en`.
export async function recibirPedido(id, llamarApi = api) {
  const { pedido } = await llamarApi(`/pedidos/${encodeURIComponent(id)}/recibir`, { method: 'POST' });
  return pedido;
}
