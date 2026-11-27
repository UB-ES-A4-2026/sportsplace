import { ApiError } from '../errors.js';

// E06 «Máquina de estados del pedido» (docs/especificacion/E06-pedidos-y-pago.md).
// Cada acción dice qué papel la hace y desde qué estados. La misma tabla calcula
// `pedido.acciones` (US-108 CA13) y valida las transiciones (comprobarTransicion),
// así la web nunca ofrece un botón que la API vaya a rechazar.
// Cada acción entra en la tabla junto con su ruta, para no pintar botones sin ruta.
// `papel` es el papel que la hace, o la lista de papeles si la hacen los dos (US-39).
// `bloqueo` devuelve el error propio de la acción cuando el papel y el estado
// valen pero el pedido no la admite; mientras lo devuelva, no sale en `acciones`.
export const ACCIONES_PEDIDO = Object.freeze({
  // US-33 CA1 y US-34 CA9: sin unidades suficientes en el anuncio, no se ofrece aceptar.
  aceptar: Object.freeze({
    papel: 'vendedor',
    desde: Object.freeze(['pendiente']),
    disponible: (pedido) => !(pedido.anuncio?.unidades_disponibles < pedido.unidades),
  }),
  rechazar: Object.freeze({ papel: 'vendedor', desde: Object.freeze(['pendiente']) }), // US-79 CA1
  // US-80 CA1 y CA5: solo ventas, una vez; la marca no se quita (CA6).
  marcar_pagado: Object.freeze({
    papel: 'vendedor',
    desde: Object.freeze(['aceptado', 'recibido']),
    bloqueo: (pedido) => {
      if (pedido.modalidad !== 'venta') return pedidoDonacion();
      return pedido.pagado_en ? yaPagado() : null;
    },
  }),
  // US-42 CA1 y CA12: el comprador confirma un pedido aceptado sin incidencia
  // abierta (la columna la trae US-43; hasta entonces no hay ninguna).
  recibir: Object.freeze({
    papel: 'comprador',
    desde: Object.freeze(['aceptado']),
    bloqueo: (pedido) => (pedido.incidencia_abierta === true ? incidenciaAbierta() : null),
  }),
  // US-39 CA1 y CA8: comprador o vendedor, pendiente o aceptado, sin cobrar y sin
  // incidencia abierta (US-43). Va la última: el botón cierra la barra de acciones.
  cancelar: Object.freeze({
    papel: Object.freeze(['comprador', 'vendedor']),
    desde: Object.freeze(['pendiente', 'aceptado']),
    bloqueo: (pedido) => {
      if (pedido.pagado_en) return pedidoPagado();
      return pedido.incidencia_abierta === true ? incidenciaAbierta(CANCELAR_CON_INCIDENCIA) : null;
    },
  }),
});

const CANCELAR_CON_INCIDENCIA = 'Cierra la incidencia antes de cancelar el pedido.';

const hacePapel = (regla, papel) => (Array.isArray(regla.papel) ? regla.papel.includes(papel) : regla.papel === papel);

// Papel del centro en el pedido; null si no es parte (se responde 404).
export function papelEn(pedido, centroId) {
  if (centroId && pedido.comprador?.id === centroId) return 'comprador';
  if (centroId && pedido.vendedor?.id === centroId) return 'vendedor';
  return null;
}

// Reglas comunes de la API para toda transición.
export function sinPermiso() {
  return new ApiError(403, 'SIN_PERMISO', 'No puedes realizar esta acción en este pedido.');
}

export function transicionNoPermitida(estadoActual) {
  return new ApiError(
    409,
    'TRANSICION_NO_PERMITIDA',
    'El pedido ya no está en un estado que permita esta acción.',
    { estado_actual: estadoActual },
  );
}

export function pedidoDonacion() {
  return new ApiError(409, 'PEDIDO_DONACION', 'Las donaciones no se cobran.');
}

export function yaPagado() {
  return new ApiError(409, 'YA_PAGADO', 'Este pedido ya consta como cobrado.');
}

export function incidenciaAbierta(mensaje = 'Cierra la incidencia antes de confirmar la recepción.') {
  return new ApiError(409, 'INCIDENCIA_ABIERTA', mensaje);
}

// US-39 CA8 (y US-80 CA7): un pedido cobrado no se cancela.
export function pedidoPagado() {
  return new ApiError(
    409,
    'PEDIDO_PAGADO',
    'No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.',
  );
}

// Lanza el error que toca si el centro no puede hacer `accion` en el pedido.
// El pedido inexistente o ajeno ya lo resuelve el repositorio con 404.
export function comprobarTransicion(pedido, centroId, accion) {
  const regla = ACCIONES_PEDIDO[accion];
  if (!regla) throw new Error(`Acción de pedido desconocida: ${accion}`);
  if (!hacePapel(regla, papelEn(pedido, centroId))) throw sinPermiso();
  if (!regla.desde.includes(pedido.estado)) throw transicionNoPermitida(pedido.estado);
  const bloqueo = regla.bloqueo?.(pedido);
  if (bloqueo) throw bloqueo;
}

// US-108 CA13: lo que el centro puede hacer ahora, en el orden de la tabla.
export function accionesPermitidas(pedido, centroId) {
  const papel = papelEn(pedido, centroId);
  if (papel === null) return [];
  return Object.entries(ACCIONES_PEDIDO)
    .filter(([, regla]) => hacePapel(regla, papel) && regla.desde.includes(pedido.estado))
    .filter(([, regla]) => !regla.disponible || regla.disponible(pedido))
    .filter(([, regla]) => !regla.bloqueo?.(pedido))
    .map(([accion]) => accion);
}
