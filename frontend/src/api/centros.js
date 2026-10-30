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
