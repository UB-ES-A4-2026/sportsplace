import { ApiError } from '../errors.js';
import { esIdDeAnuncio } from '../repositories/anuncios.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';

const METODOS_PAGO = ['transferencia', 'efectivo_recogida'];

// US-32 CA17, CA25 y CA26: validar antes de consultar el anuncio y conservar
// solo los campos aceptados. El pago se valida con la modalidad guardada en BD.
export function validarPedido(cuerpo) {
  const datos = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {};
  const details = {};
  if (!esIdDeAnuncio(datos.anuncio_id)) details.anuncio_id = 'Anuncio no válido.';
  if (!Number.isSafeInteger(datos.unidades) || datos.unidades < 1) {
    details.unidades = 'Indica al menos 1 unidad.';
  }

  let mensaje = null;
  if (datos.mensaje != null) {
    if (typeof datos.mensaje !== 'string' || datos.mensaje.includes('\0')) {
      details.mensaje = 'El mensaje debe ser un texto válido.';
    } else {
      mensaje = datos.mensaje.trim() || null;
      if (mensaje && [...mensaje].length > 500) {
        details.mensaje = 'El mensaje no puede superar 500 caracteres.';
      }
    }
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }

  const pedido = { anuncio_id: datos.anuncio_id, unidades: datos.unidades, mensaje };
  if (Object.hasOwn(datos, 'metodo_pago')) pedido.metodo_pago = datos.metodo_pago;
  return pedido;
}

// US-35 CA3 y CA4: la modalidad viene del anuncio, nunca del cuerpo del pedido.
export function validarMetodoPago(pedido, modalidad) {
  let error;
  if (modalidad === 'donacion') {
    if (!Object.hasOwn(pedido, 'metodo_pago')) return null;
    error = 'Las donaciones no tienen forma de pago.';
  } else {
    if (METODOS_PAGO.includes(pedido.metodo_pago)) return pedido.metodo_pago;
    error = 'Elige una forma de pago.';
  }
  throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, { metodo_pago: error });
}
