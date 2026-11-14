import { api } from './cliente.js';

// US-96 CA16 (T21-4): GET /api/catalogo con la búsqueda, los filtros y la página, con los mismos nombres que la URL
// de /catalogo (E04, «Base común»). Responde 200 { anuncios, pagina, por_pagina, total, total_paginas }.
// `consulta` es un objeto { q, categoria, …, pagina } sin valores vacíos. `llamarApi` solo se cambia en los tests.
export async function listarCatalogo(consulta, { signal } = {}, llamarApi = api) {
  const texto = new URLSearchParams(consulta).toString().replaceAll('%2C', ',');
  return llamarApi(`/catalogo${texto ? `?${texto}` : ''}`, { signal });
}
