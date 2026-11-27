// Reglas de la web para cancelar un pedido (E06 US-39). Funciones puras para probarlas sin navegador; las usa
// AccionesCancelacion. Los motivos y la regla del texto son los de E06 («Listas fijas de motivos»).
import { cuerpoDelRechazo, MOTIVOS_CANCELACION, validarMotivo } from './acciones.js';

export const AVISO_CANCELADO = 'Pedido cancelado.';

// US-39 CA1: el botón sale solo si el servidor ofrece `cancelar` en `pedido.acciones` (US-108 CA9).
export function puedeCancelar(pedido) {
  return (pedido?.acciones ?? []).includes('cancelar');
}

// US-39 CA2: en el desplegable, solo los motivos de mi papel.
export function motivosDeCancelacion(papel) {
  return MOTIVOS_CANCELACION.filter((motivo) => motivo.papeles.includes(papel));
}

// US-39 CA2: motivo obligatorio y de mi papel; explicación con la regla común.
export function validarCancelacion(valores, papel) {
  return validarMotivo(valores, motivosDeCancelacion(papel));
}

// Cuerpo de POST /cancelar: la misma forma que el del rechazo.
export const cuerpoDeLaCancelacion = cuerpoDelRechazo;

// El otro centro del pedido, el que verá el motivo.
function otroCentro(pedido) {
  return pedido.mi_papel === 'comprador' ? pedido.vendedor : pedido.comprador;
}

// Diálogo «Cancelar el pedido»: «<otro centro> verá el motivo. No se puede deshacer.» y, si el pedido está
// aceptado, «Las unidades volverán a estar disponibles en el anuncio.» (US-39, pantalla, y CA9).
export function dialogoCancelar(pedido) {
  const lineas = [`${otroCentro(pedido).nombre} verá el motivo. No se puede deshacer.`];
  if (pedido.estado === 'aceptado') lineas.push('Las unidades volverán a estar disponibles en el anuncio.');
  return {
    titulo: 'Cancelar el pedido',
    texto: lineas.join(' '),
    textoConfirmar: 'Cancelar pedido',
    textoEnviando: 'Cancelando…',
    textoVolver: 'Volver',
  };
}
