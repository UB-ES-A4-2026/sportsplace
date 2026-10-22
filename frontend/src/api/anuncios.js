import { api } from './cliente.js';

// Rutas de anuncios del contrato (docs/api-contrato.md). `llamarApi` solo se cambia en los tests.

// US-70: DELETE /api/anuncios/:id. Retirada lógica; la API responde 204 sin cuerpo.
export async function retirarAnuncio(id, llamarApi = api) {
  await llamarApi(`/anuncios/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
