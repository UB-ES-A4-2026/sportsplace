import { ApiError } from '../errors.js';

// E06 «Máquina de estados del pedido» (docs/especificacion/E06-pedidos-y-pago.md).
// Cada acción dice qué papel la hace y desde qué estados. La misma tabla calcula
// `pedido.acciones` (US-108 CA13) y valida las transiciones (comprobarTransicion),
// así la web nunca ofrece un botón que la API vaya a rechazar.
// US-33 y US-79 traen aquí sus rutas; US-80 (marcar_pagado) y US-39 (cancelar)
// añadirán su entrada cuando tengan endpoint, para no pintar botones sin ruta.
export const ACCIONES_PEDIDO = Object.freeze({
  // US-33 CA1 y US-34 CA9: sin unidades suficientes en el anuncio, no se ofrece aceptar.
  aceptar: Object.freeze({
    papel: 'vendedor',
    desde: Object.freeze(['pendiente']),
    disponible: (pedido) => !(pedido.anuncio?.unidades_disponibles < pedido.unidades),
  }),
  rechazar: Object.freeze({ papel: 'vendedor', desde: Object.freeze(['pendiente']) }), // US-79 CA1
});

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

// Lanza el error que toca si el centro no puede hacer `accion` en el pedido.
// El pedido inexistente o ajeno ya lo resuelve el repositorio con 404.
export function comprobarTransicion(pedido, centroId, accion) {
  const regla = ACCIONES_PEDIDO[accion];
  if (!regla) throw new Error(`Acción de pedido desconocida: ${accion}`);
  if (papelEn(pedido, centroId) !== regla.papel) throw sinPermiso();
  if (!regla.desde.includes(pedido.estado)) throw transicionNoPermitida(pedido.estado);
}

// US-108 CA13: lo que el centro puede hacer ahora, en el orden de la tabla.
export function accionesPermitidas(pedido, centroId) {
  const papel = papelEn(pedido, centroId);
  if (papel === null) return [];
  return Object.entries(ACCIONES_PEDIDO)
    .filter(([, regla]) => regla.papel === papel && regla.desde.includes(pedido.estado))
    .filter(([, regla]) => !regla.disponible || regla.disponible(pedido))
    .map(([accion]) => accion);
}
