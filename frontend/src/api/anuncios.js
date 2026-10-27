import { api } from './cliente.js';

// Rutas de anuncios del contrato (docs/api-contrato.md). `llamarApi` solo se cambia en los tests.

// US-12 CA15-CA16: POST /api/anuncios. Responde 201 { anuncio }.
export async function crearAnuncio(cuerpo, llamarApi = api) {
  const datos = await llamarApi('/anuncios', { method: 'POST', body: cuerpo });
  return datos.anuncio;
}

// US-12 CA20: GET /api/anuncios/:id. Responde 200 { anuncio }; 404 NO_ENCONTRADO si no existe, es de otro centro
// o está retirado («Propiedad»).
export async function obtenerAnuncio(id, { signal } = {}, llamarApi = api) {
  const datos = await llamarApi(`/anuncios/${encodeURIComponent(id)}`, { signal });
  return datos.anuncio;
}

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
