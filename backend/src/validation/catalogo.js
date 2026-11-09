import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';

// E04 «Base común»: parámetros de GET /api/catalogo. Un parámetro vacío
// (`pagina=`) equivale a no enviarlo y los desconocidos se ignoran. Cada valor
// no aceptado se devuelve en `details.<parámetro>` con 400 DATOS_INVALIDOS.
// US-21 (q), US-22, US-73 y US-74 (filtros) añaden aquí sus parámetros.
export const POR_PAGINA_CATALOGO = 20;
export const PAGINA_MAXIMA_CATALOGO = 10000;
export const MENSAJE_PAGINA_CATALOGO = 'La página debe ser un número entero entre 1 y 10000.';

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

export function validarConsultaCatalogo(query = {}) {
  const details = {};
  const consulta = {};

  const pagina = validarPagina(query.pagina);
  if (pagina.error) details.pagina = pagina.error;
  else consulta.pagina = pagina.valor;

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }
  return consulta;
}
