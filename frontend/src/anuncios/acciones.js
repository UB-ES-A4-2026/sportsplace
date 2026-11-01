// Reglas de la web para las acciones sobre un anuncio (E03, «Estados del anuncio y transiciones»).

export const MENSAJE_TRANSICION_NO_PERMITIDA = 'Esta acción no está disponible en el estado actual del anuncio.';
export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

// US-16: «Pausar» solo en activo y «Reactivar» solo en pausado (CA1); textos de CA2 y avisos de CA4.
const PAUSA = {
  activo: { accion: 'pausar', texto: 'Pausar', textoEnviando: 'Pausando…', aviso: 'Anuncio pausado.' },
  pausado: { accion: 'reactivar', texto: 'Reactivar', textoEnviando: 'Reactivando…', aviso: 'Anuncio reactivado.' },
};

// Devuelve { accion, texto, textoEnviando, aviso } o null si en ese estado no se ofrece ninguno de los dos
// (borrador, reservado, entregado y retirado).
export function accionDePausa(estado) {
  return Object.hasOwn(PAUSA, estado) ? PAUSA[estado] : null;
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
