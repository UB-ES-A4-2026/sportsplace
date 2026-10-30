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

// US-18 CA11-CA12: GET /api/anuncios/mios?pagina=p&por_pagina=n. Responde 200 { anuncios, total, pagina, por_pagina }.
export async function listarMisAnuncios({ pagina, porPagina }, { signal } = {}, llamarApi = api) {
  const parametros = new URLSearchParams({ pagina: String(pagina), por_pagina: String(porPagina) });
  return llamarApi(`/anuncios/mios?${parametros}`, { signal });
}
