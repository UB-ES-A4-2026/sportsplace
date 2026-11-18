// Reglas de la web para cerrar un pedido: «Marcar como cobrado» (E06 US-80) y «He recibido el material»
// (E07 US-42). Funciones puras para probarlas sin navegador; las usan AccionesCierrePedido y EtiquetaPagado.
import { formatearFechaHora } from '../anuncios/ficha.js';
import { formatearEuros } from '../utilidades/euros.js';

export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

// E06 US-35: texto de la forma de pago, en minúscula dentro de una frase.
const FORMA_DE_PAGO = { transferencia: 'transferencia bancaria', efectivo_recogida: 'efectivo al recoger' };

const unidades = (n) => (n === 1 ? '1 unidad' : `${n} unidades`);

// Los botones se pintan solo a partir de `pedido.acciones` (US-108 CA9): el servidor ya comprueba el papel, el
// estado, la modalidad, si está pagado y la incidencia abierta.
// - `marcar_pagado`: vendedor, venta, aceptado o recibido y sin pagar (US-80 CA1).
// - `recibir`: comprador, aceptado y sin incidencia abierta (US-42 CA1).
export const ACCIONES_CIERRE = {
  marcar_pagado: {
    accion: 'marcar_pagado',
    texto: 'Marcar como cobrado',
    aviso: 'Pedido marcado como cobrado.',
    dialogo: (pedido) => ({
      titulo: '¿Has cobrado este pedido?',
      texto: `Confirma que has recibido ${formatearEuros(pedido.total_centimos)} de ${pedido.comprador.nombre}`
        + `${FORMA_DE_PAGO[pedido.metodo_pago] ? ` por ${FORMA_DE_PAGO[pedido.metodo_pago]}` : ''}. No se puede deshacer.`,
      textoConfirmar: 'Sí, lo he cobrado',
      textoEnviando: 'Guardando…',
    }),
  },
  recibir: {
    accion: 'recibir',
    texto: 'He recibido el material',
    aviso: 'Pedido marcado como recibido.',
    dialogo: (pedido) => ({
      titulo: '¿Confirmas que has recibido el material?',
      // T42-4 (decisión de la PO, 17/11): sin «El pedido quedará cerrado y no se podrá deshacer.».
      texto: `Confirmas que has recibido ${unidades(pedido.unidades)} de «${pedido.anuncio.titulo}».`,
      textoConfirmar: 'Sí, lo he recibido',
      textoEnviando: 'Guardando…',
    }),
  },
};

export function accionesDeCierre(pedido) {
  const acciones = pedido?.acciones ?? [];
  return Object.values(ACCIONES_CIERRE).filter((opcion) => acciones.includes(opcion.accion));
}

// US-80 CA2, CA3 y CA9: etiqueta «Pagado» junto al estado, para los dos centros, si consta `pagado_en`.
export function estaPagado(pedido) {
  return Boolean(pedido?.pagado_en);
}

// Líneas del historial (US-108 punto 8) y de la sección «Entrega» (US-42), con fecha y hora de Madrid.
export function lineaPagado(pedido) {
  return pedido?.pagado_en ? `Marcado como pagado el ${formatearFechaHora(pedido.pagado_en)}` : null;
}

export function lineaRecibido(pedido) {
  return pedido?.recibido_en ? `Recibido el ${formatearFechaHora(pedido.recibido_en)}.` : null;
}

// Traduce el fallo a lo que muestra la pantalla:
// - 409 (TRANSICION_NO_PERMITIDA, YA_PAGADO, PEDIDO_DONACION, INCIDENCIA_ABIERTA): el `message` de la API en rojo y
//   recargar el pedido para ver su estado real.
// - 404: la pantalla «Este pedido no existe o no tienes acceso.» (US-108 CA3).
// - 403: el `message` de la API (SIN_PERMISO o EMAIL_NO_CONFIRMADO).
// - Red caída, 500, 503 y el resto: aviso genérico.
export function resultadoDelFallo(fallo) {
  if (fallo?.status === 409) return { mensaje: fallo.message || MENSAJE_ERROR_GENERICO, recargar: true };
  if (fallo?.status === 404) return { noEncontrado: true };
  if (fallo?.status === 403 && fallo.message) return { mensaje: fallo.message };
  return { mensaje: MENSAJE_ERROR_GENERICO };
}
