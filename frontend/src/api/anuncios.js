import { api } from './cliente.js';

// Rutas de anuncios del contrato (docs/api-contrato.md). `llamarApi` solo se cambia en los tests.

// US-16 CA6 y CA7: POST /api/anuncios/:id/pausar y /reactivar, sin cuerpo. Devuelven 200 { anuncio }.
export async function pausarAnuncio(id, llamarApi = api) {
  const { anuncio } = await llamarApi(`/anuncios/${encodeURIComponent(id)}/pausar`, { method: 'POST' });
  return anuncio;
}

export async function reactivarAnuncio(id, llamarApi = api) {
  const { anuncio } = await llamarApi(`/anuncios/${encodeURIComponent(id)}/reactivar`, { method: 'POST' });
  return anuncio;
}
