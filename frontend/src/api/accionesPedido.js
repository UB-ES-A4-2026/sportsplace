import { api } from './cliente.js';

// Acciones del vendedor sobre un pedido (E06, US-33 y US-79). Van en su propio archivo para no chocar con
// api/pedidos.js de US-109 (#310) y de US-108 (T32-5). `llamarApi` solo se cambia en los tests.

// US-33 CA6: POST /api/pedidos/:id/aceptar, sin cuerpo → 200 { pedido }.
export async function aceptarPedido(id, llamarApi = api) {
  const { pedido } = await llamarApi(`/pedidos/${encodeURIComponent(id)}/aceptar`, { method: 'POST' });
  return pedido;
}

// US-79 CA7: POST /api/pedidos/:id/rechazar { motivo_codigo, motivo_texto } → 200 { pedido }.
export async function rechazarPedido(id, { motivoCodigo, motivoTexto }, llamarApi = api) {
  const { pedido } = await llamarApi(`/pedidos/${encodeURIComponent(id)}/rechazar`, {
    method: 'POST',
    body: { motivo_codigo: motivoCodigo, motivo_texto: motivoTexto },
  });
  return pedido;
}
