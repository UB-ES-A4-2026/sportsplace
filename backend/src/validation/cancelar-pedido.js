import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';

// E06 «Listas fijas de motivos», cancelación (US-39): quién ve cada motivo en el desplegable.
export const MOTIVOS_CANCELACION = Object.freeze({
  ya_no_necesario: Object.freeze(['comprador']),
  otra_opcion: Object.freeze(['comprador']),
  material_no_disponible: Object.freeze(['vendedor']),
  sin_acuerdo_entrega: Object.freeze(['comprador', 'vendedor']),
  sin_respuesta: Object.freeze(['comprador', 'vendedor']),
  error_pedido: Object.freeze(['comprador', 'vendedor']),
  otro: Object.freeze(['comprador', 'vendedor']),
});

const ELIGE_MOTIVO = 'Elige un motivo.';

function datosInvalidos(detalles) {
  return new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, detalles);
}

// US-39 CA2 y CA6: el motivo tiene que ser uno de cancelación y el texto sigue la
// regla común de E06 (10-300 caracteres con «otro»; 0-300 con el resto). El papel
// todavía no se conoce aquí: lo comprueba motivoDelPapel con el pedido ya leído.
export function validarCancelacionPedido(cuerpo) {
  const motivoCodigo = cuerpo?.motivo_codigo;
  const texto = cuerpo?.motivo_texto ?? '';
  const motivoTexto = typeof texto === 'string' && !texto.includes('\0') ? texto.trim() : null;
  const longitud = motivoTexto === null ? -1 : [...motivoTexto].length;
  const detalles = {};

  if (!Object.hasOwn(MOTIVOS_CANCELACION, motivoCodigo)) detalles.motivo_codigo = ELIGE_MOTIVO;
  if (longitud < 0 || longitud > 300) {
    detalles.motivo_texto = 'El texto no puede superar 300 caracteres.';
  } else if (motivoCodigo === 'otro' && longitud < 10) {
    detalles.motivo_texto = 'Explica el motivo (entre 10 y 300 caracteres).';
  }

  if (Object.keys(detalles).length > 0) throw datosInvalidos(detalles);
  return { motivo_codigo: motivoCodigo, motivo_texto: motivoTexto || null };
}

// US-39 CA6: un motivo del otro papel (p. ej. el comprador con material_no_disponible) es 400.
export function motivoDelPapel(motivoCodigo, papel) {
  if (!MOTIVOS_CANCELACION[motivoCodigo]?.includes(papel)) {
    throw datosInvalidos({ motivo_codigo: ELIGE_MOTIVO });
  }
}
