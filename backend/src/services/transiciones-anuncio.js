import { ApiError } from '../errors.js';

// E03 «Estados del anuncio y transiciones» (docs/especificacion/E03-publicacion-de-material.md).
// Cada acción dice desde qué estados se permite y a qué estado lleva. El cambio
// lo hace `transicionar` del repositorio con un único UPDATE ... WHERE estado IN (...).
// US-17 (reservar, quitar-reserva, entregar) y US-70 (retirar) añaden aquí sus
// acciones y reutilizan el mismo `transicionar`.
export const ACCIONES = Object.freeze({
  pausar: Object.freeze({ desde: Object.freeze(['activo']), hacia: 'pausado' }), // US-16 CA6
  reactivar: Object.freeze({ desde: Object.freeze(['pausado']), hacia: 'activo' }), // US-16 CA7
  // US-17 CA7. Entregar es final: el UPDATE pone entregado_en = now() (CA5).
  reservar: Object.freeze({ desde: Object.freeze(['activo']), hacia: 'reservado' }),
  'quitar-reserva': Object.freeze({ desde: Object.freeze(['reservado']), hacia: 'activo' }),
  entregar: Object.freeze({ desde: Object.freeze(['activo', 'reservado']), hacia: 'entregado' }),
  // US-70 CA7/CA8: se retira desde cualquier estado salvo entregado (y retirado,
  // que ya no se encuentra: 404). `borrador` llegará con US-20.
  retirar: Object.freeze({
    desde: Object.freeze(['borrador', 'activo', 'pausado', 'reservado']),
    hacia: 'retirado',
  }),
});

// Cualquier transición que no está en la tabla (US-16 CA8).
export function transicionNoPermitida(estadoActual) {
  return new ApiError(
    409,
    'TRANSICION_NO_PERMITIDA',
    'Esta acción no está disponible en el estado actual del anuncio.',
    { estado_actual: estadoActual },
  );
}
