import { api } from './cliente.js';

// Rutas del centro de la sesión (docs/api-contrato.md, US-07). `llamarApi` solo se cambia en los tests.

// CA17: GET /api/centros/mio. Responde 200 { centro }.
export async function obtenerMiCentro({ signal } = {}, llamarApi = api) {
  const datos = await llamarApi('/centros/mio', { signal });
  return datos.centro;
}

// CA18: PATCH /api/centros/mio con los campos editables. Responde 200 { centro } ya actualizado.
export async function actualizarMiCentro(cambios, llamarApi = api) {
  const datos = await llamarApi('/centros/mio', { method: 'PATCH', body: cambios });
  return datos.centro;
}

// US-68 CA11: PUT /api/centros/mio/ubicacion con los tres campos. Responde 200 { centro } con provincia y coordenadas.
export async function guardarUbicacion(ubicacion, llamarApi = api) {
  const datos = await llamarApi('/centros/mio/ubicacion', { method: 'PUT', body: ubicacion });
  return datos.centro;
}

// US-10 CA11: GET /api/centros/:id, el perfil público de un centro. Responde 200 { centro } con `es_mio`;
// 404 NO_ENCONTRADO si no existe, el id no es un UUID o el centro está eliminado.
export async function obtenerCentro(id, { signal } = {}, llamarApi = api) {
  const datos = await llamarApi(`/centros/${encodeURIComponent(id)}`, { signal });
  return datos.centro;
}

// US-10 CA12: GET /api/centros/:id/anuncios?pagina=n. Responde 200 { anuncios, pagina, total }.
export async function listarAnunciosDelCentro(id, { pagina = 1, signal } = {}, llamarApi = api) {
  return llamarApi(`/centros/${encodeURIComponent(id)}/anuncios?pagina=${encodeURIComponent(pagina)}`, { signal });
}
