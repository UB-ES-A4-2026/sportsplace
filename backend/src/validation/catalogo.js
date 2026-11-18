import { ApiError } from '../errors.js';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL, MENSAJE_DATOS_INVALIDOS, MODALIDADES } from './anuncios.js';

// E04 «Base común»: parámetros de GET /api/catalogo. Un parámetro vacío
// (`pagina=`) equivale a no enviarlo y los desconocidos se ignoran. Cada valor
// no aceptado se devuelve en `details.<parámetro>` con 400 DATOS_INVALIDOS.
// US-22, US-73 y US-74 añaden sus filtros con los slugs de E03 (sin otra lista).
export const POR_PAGINA_CATALOGO = 20;
export const PAGINA_MAXIMA_CATALOGO = 10000;
export const MENSAJE_PAGINA_CATALOGO = 'La página debe ser un número entero entre 1 y 10000.';
export const PRECIO_MAXIMO_FILTRO = 99999;
const MENSAJE_PRECIO = 'Indica un precio entero entre 0 y 99.999 €.';
const MENSAJE_PRECIO_CRUZADO = 'El precio mínimo no puede ser mayor que el máximo.';

const vacio = (valor) => valor === undefined || valor === '';

// US-96 CA17: enteros de 1 a 10000; «0», «10001», «abc», «2.5», «-1» o el
// parámetro repetido (?pagina=1&pagina=2) se rechazan.
function validarPagina(valor) {
  if (vacio(valor)) return { valor: 1 };
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return { error: MENSAJE_PAGINA_CATALOGO };
  const pagina = Number(valor);
  if (pagina < 1 || pagina > PAGINA_MAXIMA_CATALOGO) return { error: MENSAJE_PAGINA_CATALOGO };
  return { valor: pagina };
}

// US-21 CA2–CA5 y CA20. Los caracteres de búsqueda se conservan para que
// el repositorio los trate literalmente al construir sus patrones SQL.
function validarBusqueda(valor) {
  if (vacio(valor)) return {};
  if (typeof valor !== 'string' || valor.includes('\0')) {
    return { error: 'La búsqueda no es válida.' };
  }

  const busqueda = valor.trim().replace(/\s+/gu, ' ');
  if (busqueda === '') return {};

  const longitud = [...busqueda].length;
  if (longitud < 2) return { error: 'Escribe al menos 2 caracteres.' };
  if (longitud > 100) return { error: 'La búsqueda puede tener como máximo 100 caracteres.' };
  if (busqueda.split(' ').length > 5) return { error: 'Usa como máximo 5 palabras.' };
  return { valor: busqueda };
}

// US-22 CA12–CA13 y US-74 CA6: un slug exacto (distingue mayúsculas); el
// parámetro repetido llega como array y se rechaza.
function validarSlug(valor, opciones, mensaje) {
  if (vacio(valor)) return {};
  if (typeof valor !== 'string' || !opciones.includes(valor)) return { error: mensaje };
  return { valor };
}

// US-73 CA2 y CA11: slugs separados por comas, sin repetir. Los 5 marcados
// equivalen a no filtrar.
function validarEstadosMaterial(valor) {
  if (vacio(valor)) return {};
  const error = { error: 'Estado del material no válido.' };
  if (typeof valor !== 'string') return error;
  const estados = valor.split(',');
  if (estados.some((estado) => !ESTADOS_MATERIAL.includes(estado))) return error;
  if (new Set(estados).size !== estados.length) return error;
  if (estados.length === ESTADOS_MATERIAL.length) return {};
  return { valor: estados };
}

// US-73 CA3 y CA12: euros enteros de 0 a 99999.
function validarPrecio(valor) {
  if (vacio(valor)) return {};
  if (typeof valor !== 'string' || !/^\d{1,5}$/.test(valor)) return { error: MENSAJE_PRECIO };
  return { valor: Number(valor) };
}

export function validarConsultaCatalogo(query = {}) {
  const details = {};
  const consulta = {};

  const pagina = validarPagina(query.pagina);
  if (pagina.error) details.pagina = pagina.error;
  else consulta.pagina = pagina.valor;

  const busqueda = validarBusqueda(query.q);
  if (busqueda.error) details.q = busqueda.error;
  else if (busqueda.valor !== undefined) consulta.q = busqueda.valor;

  const campos = {
    categoria: validarSlug(query.categoria, CATEGORIAS, 'Categoría no válida.'),
    deporte: validarSlug(query.deporte, DEPORTES, 'Deporte no válido.'),
    estado_material: validarEstadosMaterial(query.estado_material),
    precio_min: validarPrecio(query.precio_min),
    precio_max: validarPrecio(query.precio_max),
    modalidad: validarSlug(query.modalidad, MODALIDADES, 'Modalidad no válida.'),
  };
  for (const [campo, resultado] of Object.entries(campos)) {
    if (resultado.error) details[campo] = resultado.error;
    else if (resultado.valor !== undefined) consulta[campo] = resultado.valor;
  }
  // US-73 CA4 y CA12: «Desde» = «Hasta» es válido.
  if (consulta.precio_min !== undefined && consulta.precio_max !== undefined
    && consulta.precio_min > consulta.precio_max) {
    details.precio_min = MENSAJE_PRECIO_CRUZADO;
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }
  return consulta;
}
