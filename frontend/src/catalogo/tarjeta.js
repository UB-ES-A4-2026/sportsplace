// Textos de la tarjeta de anuncio del catálogo (US-96, «Pantallas para el boceto»; T21-4).
import { textoUnidades } from '../anuncios/misAnuncios.js';
import { ESTADOS_MATERIAL, etiquetaDe } from '../anuncios/valores.js';
import { formatearEuros } from '../utilidades/euros.js';

export const TEXTOS = {
  sinFoto: 'Sin foto',
  noDisponible: 'No disponible',
  donacion: 'Gratis · Donación',
};

// Las fechas se muestran en la hora de España, aunque el navegador esté en otra zona.
const FECHA = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
});

// CA12: «12,50 € / unidad» o «1.234,50 € / unidad» en venta; «Gratis · Donación» en donación.
// La tarjeta pinta el importe grande y «/ unidad» pequeño (boceto S2 de #250), pero el texto es el mismo.
export function partesPrecio({ modalidad, precio_unitario_centimos: centimos }) {
  if (modalidad === 'donacion') return { importe: TEXTOS.donacion, sufijo: null };
  return { importe: formatearEuros(centimos), sufijo: '/ unidad' };
}

export function textoPrecio(anuncio) {
  const { importe, sufijo } = partesPrecio(anuncio);
  return sufijo ? `${importe} ${sufijo}` : importe;
}

// «Buen estado · 12 unidades» o «Como nuevo · 1 unidad».
export function textoEstadoYUnidades({ estado_material: estado, unidades_disponibles: unidades }) {
  return `${etiquetaDe(ESTADOS_MATERIAL, estado)} · ${textoUnidades(unidades)}`;
}

// «CE Montjuïc · Barcelona».
export function textoOrigen({ nombre, localidad }) {
  return `${nombre} · ${localidad}`;
}

// «Publicado el 20/10/2026».
export function textoPublicado(fecha) {
  return `Publicado el ${FECHA.format(new Date(fecha))}`;
}

// CA6: los reservados siguen en su sitio, con la etiqueta naranja «No disponible».
export function estaNoDisponible({ estado }) {
  return estado === 'reservado';
}
