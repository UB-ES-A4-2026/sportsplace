// Pantalla /catalogo (US-96 T96-3; T21-4): textos, página de la URL y consulta a GET /api/catalogo.
// La búsqueda (`q`, T21-5) y los filtros (T21-6) tienen sus propios módulos; este junta las piezas.

export const TEXTOS = {
  titulo: 'Catálogo',
  cargando: 'Cargando…',
  error: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
  vacio: 'Todavía no hay anuncios de otros centros. Vuelve más tarde o publica el tuyo.',
  publicar: 'Publicar anuncio',
  ordenarPor: 'Ordenar por',
  recientes: 'Más recientes',
  anterior: 'Anterior',
  siguiente: 'Siguiente',
  paginacion: 'Paginación',
};

// Máximo que acepta la API (CA17). Con más, la web carga la página 1 sin error, como con `0` o `abc`.
const PAGINA_MAXIMA = 10000;

// CA9 y CA10: la página vive en la URL como `pagina`. La 1 no se escribe, así que `pagina=1`, `0`, `-1`, `abc`, `1.5`
// o el parámetro repetido se quitan con `replace` y se carga la página 1 (E04, «Web»: nunca un error por la URL).
// `corregidos` trae los parámetros sin `pagina`, o null si la URL ya está bien.
export function leerPagina(parametros) {
  const valores = parametros.getAll('pagina');
  if (valores.length === 0) return { pagina: 1, corregidos: null };
  const numero = valores.length === 1 && /^\d+$/.test(valores[0]) ? Number(valores[0]) : 0;
  if (numero > 1 && numero <= PAGINA_MAXIMA) return { pagina: numero, corregidos: null };
  const corregidos = new URLSearchParams(parametros);
  corregidos.delete('pagina');
  return { pagina: 1, corregidos };
}

// CA9: cambiar de página conserva la búsqueda y los filtros; la página 1 no se escribe.
export function conPagina(parametros, pagina) {
  const nuevos = new URLSearchParams(parametros);
  if (pagina > 1) nuevos.set('pagina', String(pagina));
  else nuevos.delete('pagina');
  return nuevos;
}

// CA10 y CA18: si la URL pide una página mayor que la última y hay anuncios, la API responde `anuncios: []` con el
// total real; la web va a la última. Si no hace falta, null.
export function paginaFueraDeRango(pagina, { total_paginas: ultima }) {
  return ultima > 0 && pagina > ultima ? ultima : null;
}

// CA8: con 20 anuncios o menos no hay paginación.
export function hayPaginacion({ total_paginas: paginas }) {
  return paginas > 1;
}

export function textoPagina(pagina, paginas) {
  return `Página ${pagina} de ${paginas}`;
}

// Consulta para GET /api/catalogo con los nombres de la URL: `q`, los filtros de la barra y la página (la 1 no se
// envía, es la de por defecto).
export function consultaDeApi({ q, filtros, pagina }) {
  return {
    ...(q ? { q } : {}),
    ...filtros,
    ...(pagina > 1 ? { pagina: String(pagina) } : {}),
  };
}

// Qué se muestra cuando la consulta no da ningún anuncio: el bloque de la búsqueda (US-21 CA18), el de los filtros
// (US-22 CA10) o el del catálogo vacío (US-96 CA14).
export function tipoDeVacio({ q, filtrosActivos }) {
  if (q) return 'busqueda';
  if (filtrosActivos > 0) return 'filtros';
  return 'catalogo';
}
