import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';

// E06 y US-79 CA8. anuncio_sin_stock solo lo registra el sistema al reservar.
const MOTIVOS_VENDEDOR = new Set([
  'sin_unidades',
  'comprometido_otro_centro',
  'entrega_inviable',
  'condiciones_pago',
  'otro',
]);

export function validarRechazoPedido(cuerpo) {
  const motivoCodigo = cuerpo?.motivo_codigo;
  const texto = cuerpo?.motivo_texto ?? '';
  const motivoTexto = typeof texto === 'string' && !texto.includes('\0') ? texto.trim() : null;
  const longitud = motivoTexto === null ? -1 : [...motivoTexto].length;
  const detalles = {};

  if (!MOTIVOS_VENDEDOR.has(motivoCodigo)) detalles.motivo_codigo = 'Elige un motivo.';
  if (longitud < 0 || longitud > 300) {
    detalles.motivo_texto = 'El texto no puede superar 300 caracteres.';
  } else if (motivoCodigo === 'otro' && longitud < 10) {
    detalles.motivo_texto = 'Explica el motivo (entre 10 y 300 caracteres).';
  }

  if (Object.keys(detalles).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, detalles);
  }
  return { motivo_codigo: motivoCodigo, motivo_texto: motivoTexto || null };
}
