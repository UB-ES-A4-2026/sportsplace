import { api } from './cliente.js';

// Rutas de anuncios del contrato (docs/api-contrato.md). `llamarApi` solo se cambia en los tests.

// US-70: DELETE /api/anuncios/:id. Retirada lógica; la API responde 204 sin cuerpo.
export async function retirarAnuncio(id, llamarApi = api) {
  await llamarApi(`/anuncios/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// US-17 CA7: POST /api/anuncios/:id/reservar, /quitar-reserva y /entregar, sin cuerpo. Devuelven 200 { anuncio }.
// `accion` es la de accionesDeReservaYEntrega: 'reservar', 'quitar-reserva' o 'entregar'.
export async function cambiarReservaOEntrega(id, accion, llamarApi = api) {
  const { anuncio } = await llamarApi(`/anuncios/${encodeURIComponent(id)}/${accion}`, { method: 'POST' });
  return anuncio;
}
