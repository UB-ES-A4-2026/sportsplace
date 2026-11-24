import { formatearEuros } from '../utilidades/euros.js';

// Texto del precio de un anuncio en la ficha, en la fila de «Mis anuncios» y en las tarjetas del perfil de un centro
// (US-14 CA6 y CA7, US-18 y US-10). T14-6 (decisión de la PO, 17/11): «Gratis · Donación», como en el catálogo.
// Sirve tanto para el objeto `anuncio` como para el `resumen` de US-18: los dos traen `modalidad`
// y `precio_unitario_centimos`.
export function precioDelAnuncio({ modalidad, precio_unitario_centimos: centimos }) {
  if (modalidad === 'donacion') return { donacion: true, texto: 'Gratis · Donación' };
  return { donacion: false, texto: `${formatearEuros(centimos)} / unidad` };
}
