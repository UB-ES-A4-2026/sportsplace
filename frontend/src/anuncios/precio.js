import { formatearEuros } from '../utilidades/euros.js';

// Texto del precio de un anuncio en la ficha y en la fila de «Mis anuncios» (US-14, CA6 y CA7).
// Sirve tanto para el objeto `anuncio` como para el `resumen` de US-18: los dos traen `modalidad`
// y `precio_unitario_centimos`.
export function precioDelAnuncio({ modalidad, precio_unitario_centimos: centimos }) {
  if (modalidad === 'donacion') return { donacion: true, texto: 'Donación · Gratis' };
  return { donacion: false, texto: `${formatearEuros(centimos)} / unidad` };
}
