import { api } from './cliente.js';

// Pedidos (docs/especificacion/E06-pedidos-y-pago.md, US-109). `llamarApi` solo se cambia en los tests.

// CA10: GET /api/pedidos?rol=recibidos|realizados&pagina=n → { pedidos, pagina, total, por_pagina }.
export async function listarPedidos({ rol, pagina = 1 }, { signal } = {}, llamarApi = api) {
  const consulta = new URLSearchParams({ rol, pagina: String(pagina) });
  return llamarApi(`/pedidos?${consulta}`, { signal });
}

// CA12: GET /api/pedidos/contador → número de pedidos recibidos en `pendiente`.
export async function contarPedidosPendientes({ signal } = {}, llamarApi = api) {
  const datos = await llamarApi('/pedidos/contador', { signal });
  return datos.recibidos_pendientes;
}
