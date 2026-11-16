import { api } from '../api/cliente.js';

// Llamadas de pedidos (E06). Están en `pedidos/api.js` y no en `api/pedidos.js`: con el servidor de desarrollo, ese
// módulo se descargaría como `/src/api/pedidos.js` y los E2E que simulan la API con `page.route('**/api/pedidos**')`
// también lo interceptarían. `llamarApi` solo se cambia en los tests.

// US-32 CA16 (+ US-35 `metodo_pago` y US-40 `metodo_entrega` y `direccion_envio`): POST /api/pedidos.
// Responde 201 { pedido }.
export async function crearPedido(cuerpo, llamarApi = api) {
  const datos = await llamarApi('/pedidos', { method: 'POST', body: cuerpo });
  return datos.pedido;
}

// US-108 CA10: GET /api/pedidos/:id → 200 { pedido }; 404 NO_ENCONTRADO si no existe o el centro no es parte.
export async function obtenerPedido(id, { signal } = {}, llamarApi = api) {
  const datos = await llamarApi(`/pedidos/${encodeURIComponent(id)}`, { signal });
  return datos.pedido;
}
