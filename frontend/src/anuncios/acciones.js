// Reglas de la web para las acciones sobre un anuncio (E03, «Estados del anuncio y transiciones»).

export const MENSAJE_TRANSICION_NO_PERMITIDA = 'Esta acción no está disponible en el estado actual del anuncio.';
export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';
export const AVISO_RETIRADO = 'Anuncio retirado.';

// US-70 CA1: «Retirar anuncio» se ve en borrador, activo, pausado y reservado; no en entregado.
const ESTADOS_RETIRABLES = ['borrador', 'activo', 'pausado', 'reservado'];

export function puedeRetirar(estado) {
  return ESTADOS_RETIRABLES.includes(estado);
}

// Traduce el fallo de una acción a lo que debe mostrar la pantalla:
// - 404: la pantalla «Anuncio no encontrado» («Propiedad» de la base común).
// - 409: aviso rojo de transición y recargar el anuncio para ver su estado real (US-16 CA4, US-17 CA4).
// - 403 EMAIL_NO_CONFIRMADO: el mensaje de la API (aviso de US-02).
// - 500, 503, sin conexión y el resto: aviso genérico (US-70 CA6).
export function resultadoDelFallo(fallo) {
  if (fallo?.status === 404) return { noEncontrado: true };
  if (fallo?.status === 409) return { mensaje: MENSAJE_TRANSICION_NO_PERMITIDA, recargar: true };
  if (fallo?.status === 403 && fallo.code === 'EMAIL_NO_CONFIRMADO') return { mensaje: fallo.message };
  return { mensaje: MENSAJE_ERROR_GENERICO };
}

// US-17 CA1: `activo` → «Marcar como reservado» y «Marcar como entregado»; `reservado` → «Quitar reserva» y
// «Marcar como entregado»; `pausado`, `borrador`, `entregado` (y `retirado`) → ninguno. Textos de CA2, avisos de CA4.
// «Marcar como entregado» pide confirmación (CA3); reservar y quitar reserva son inmediatos.
const RESERVAR = { accion: 'reservar', texto: 'Marcar como reservado', textoEnviando: 'Reservando…', aviso: 'Anuncio reservado.' };
const QUITAR_RESERVA = { accion: 'quitar-reserva', texto: 'Quitar reserva', textoEnviando: 'Quitando reserva…', aviso: 'Reserva quitada.' };
const ENTREGAR = {
  accion: 'entregar',
  texto: 'Marcar como entregado',
  textoEnviando: 'Marcando…',
  aviso: 'Anuncio entregado.',
  confirmacion: {
    titulo: '¿Marcar como entregado?',
    texto: 'Ya no podrás editarlo ni cambiar su estado.',
    textoConfirmar: 'Marcar como entregado',
  },
};
const RESERVA_Y_ENTREGA = {
  activo: [RESERVAR, ENTREGAR],
  reservado: [QUITAR_RESERVA, ENTREGAR],
};

// Devuelve las acciones de US-17 que se ofrecen en ese estado, en orden de pantalla ([] si ninguna).
export function accionesDeReservaYEntrega(estado) {
  return Object.hasOwn(RESERVA_Y_ENTREGA, estado) ? RESERVA_Y_ENTREGA[estado] : [];
}
