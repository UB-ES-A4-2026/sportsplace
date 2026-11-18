// Búsqueda por palabras de /catalogo (T21-5: US-21 T21-3). El texto vive en la URL como `q`, con el mismo nombre
// que en GET /api/catalogo (E04, «Base común»). Las reglas son las de backend/src/validation/catalogo.js (CA2-CA5).

export const RUTA_CATALOGO = '/catalogo';
export const MAX_CARACTERES = 100;
export const MAX_PALABRAS = 5;

export const TEXTOS = {
  etiqueta: 'Buscar material',
  ejemplo: 'Buscar material…',
  buscar: 'Buscar',
  quitar: 'Quitar la búsqueda',
  corta: 'Escribe al menos 2 caracteres.',
  larga: 'La búsqueda puede tener como máximo 100 caracteres.',
  palabras: 'Usa como máximo 5 palabras.',
  consejo: 'Prueba con otras palabras o quita algún filtro.',
  quitarTodo: 'Quitar búsqueda y filtros',
};

// CA2: sin espacios al principio ni al final y los repetidos reducidos a uno.
export function normalizarBusqueda(texto) {
  return String(texto ?? '').trim().replace(/\s+/gu, ' ');
}

// CA3-CA5 (y CA20 para la URL): { valor: null } si no hay búsqueda, { valor } si se puede buscar o { error }.
// La longitud se cuenta en caracteres, no en unidades UTF-16 (un emoji cuenta 1), igual que la API.
export function validarBusqueda(texto) {
  const valor = normalizarBusqueda(texto);
  if (valor === '') return { valor: null };
  const longitud = [...valor].length;
  if (longitud < 2) return { error: TEXTOS.corta };
  if (longitud > MAX_CARACTERES) return { error: TEXTOS.larga };
  if (valor.split(' ').length > MAX_PALABRAS) return { error: TEXTOS.palabras };
  return { valor };
}

// CA15: la búsqueda de la URL rellena el cuadro. Un `q` escrito a mano que no se acepta (1 carácter, más de 100
// o más de 5 palabras), vacío o repetido se quita con `replace` y se carga sin él: la web nunca muestra un error por
// la URL (E04, «Web»). `corregidos` trae los parámetros sin `q`, o null si la URL ya está bien.
export function leerBusqueda(parametros) {
  const valores = parametros.getAll('q');
  if (valores.length === 0) return { q: null, corregidos: null };
  const { valor } = valores.length === 1 ? validarBusqueda(valores[0]) : {};
  if (valor) return { q: valor, corregidos: null };
  const corregidos = new URLSearchParams(parametros);
  corregidos.delete('q');
  return { q: null, corregidos };
}

// CA13: cualquier cambio de búsqueda vuelve a la página 1.
function sinPagina(parametros) {
  const nuevos = new URLSearchParams(parametros);
  nuevos.delete('pagina');
  return nuevos;
}

// CA2-CA6 y CA13: lo que pasa al pulsar Intro o «Buscar». Devuelve { error } (no se busca) o { parametros } para la
// URL: con `q` normalizado, o sin `q` si el cuadro está vacío (CA3). Se conservan los filtros y el orden.
export function conBusqueda(parametros, texto) {
  const { valor, error } = validarBusqueda(texto);
  if (error) return { error };
  const nuevos = sinPagina(parametros);
  if (valor) nuevos.set('q', valor);
  else nuevos.delete('q');
  return { parametros: nuevos };
}

// CA14: la «×» quita `q` y conserva los filtros que hubiera.
export function sinBusqueda(parametros) {
  const nuevos = sinPagina(parametros);
  nuevos.delete('q');
  return nuevos;
}

// ¿Cambia algo respecto a la URL actual? Buscar lo mismo otra vez no debe añadir una entrada al historial.
export function mismaBusqueda(actuales, nuevos) {
  return new URLSearchParams(actuales).toString() === new URLSearchParams(nuevos).toString();
}

// Texto de `search` para navegar (`?q=balon+futbol`, como en la especificación); sin parámetros, ''.
// Las comas de `estado_material` se dejan legibles, como hace la barra de filtros (T21-6).
export function busquedaDeUrl(parametros) {
  const texto = new URLSearchParams(parametros).toString().replaceAll('%2C', ',');
  return texto ? `?${texto}` : '';
}

function anuncios(total) {
  return total === 1 ? '1 anuncio' : `${total} anuncios`;
}

// Línea de resultados. CA17: «N anuncios para «balon futbol»», «1 anuncio para «balon»». Sin búsqueda, la de US-96
// CA11: «41 anuncios», «1 anuncio».
export function textoResultados(total, q) {
  return q ? `${anuncios(total)} para «${q}»` : anuncios(total);
}

// CA18: título del bloque sin resultados cuando hay búsqueda.
export function textoSinResultados(q) {
  return `No hay anuncios para «${q}».`;
}
