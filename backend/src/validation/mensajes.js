import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';

// E05 · US-28: reglas del texto de un mensaje (CA7-CA9) y de los parámetros
// de la conversación (CA20-CA22). Lo reutiliza US-77 al responder.

export const MAX_TEXTO_MENSAJE = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esUuid = (valor) => typeof valor === 'string' && UUID.test(valor);

function datosInvalidos(details) {
  return new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
}

// CA7-CA9: obligatorio, de 1 a 2000 caracteres Unicode tras quitar los espacios
// de los extremos. Los saltos de línea del medio se conservan. Devuelve
// { valor } o { error } con el texto de `details.texto`.
function revisarTexto(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return { error: 'Escribe un mensaje.' };
  const texto = valor.trim();
  if ([...texto].length > MAX_TEXTO_MENSAJE) {
    return { error: 'El mensaje no puede superar los 2000 caracteres.' };
  }
  return { valor: texto };
}

// POST /api/conversaciones/:id/mensajes (CA25).
export function validarMensaje(cuerpo) {
  const texto = revisarTexto(cuerpo?.texto);
  if (texto.error) throw datosInvalidos({ texto: texto.error });
  return { texto: texto.valor };
}

// POST /api/conversaciones (CA20, CA21): `anuncio_id` y `texto`.
export function validarNuevaConversacion(cuerpo) {
  const details = {};
  const texto = revisarTexto(cuerpo?.texto);
  if (texto.error) details.texto = texto.error;
  if (!esUuid(cuerpo?.anuncio_id)) details.anuncio_id = 'El anuncio no es válido.';
  if (Object.keys(details).length > 0) throw datosInvalidos(details);
  return { anuncioId: cuerpo.anuncio_id.toLowerCase(), texto: texto.valor };
}

// GET /api/conversaciones/:id (CA22): como mucho uno de `antes` y `despues`,
// cada uno el id (UUID) de un mensaje de la conversación.
export function validarCursor(query) {
  const details = {};
  for (const clave of ['antes', 'despues']) {
    if (query[clave] !== undefined && !esUuid(query[clave])) details[clave] = 'El mensaje no es válido.';
  }
  if (query.antes !== undefined && query.despues !== undefined) {
    details.antes = 'Usa solo «antes» o «despues».';
  }
  if (Object.keys(details).length > 0) throw datosInvalidos(details);
  if (query.antes !== undefined) return { antes: query.antes.toLowerCase() };
  if (query.despues !== undefined) return { despues: query.despues.toLowerCase() };
  return {};
}
