// Ficha propia del anuncio (US-12 T12-4): formatos de fecha y qué mostrar si falla la carga.

export const TEXTO_NO_ENCONTRADO = {
  titulo: 'Anuncio no encontrado',
  texto: 'Este anuncio no existe o ya no está disponible.',
  boton: 'Volver a mis anuncios',
};

const ZONA = 'Europe/Madrid';

const FORMATO_FECHA = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric',
});
const FORMATO_HORA = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function partes(formato, fecha) {
  return Object.fromEntries(formato.formatToParts(fecha).map(({ type, value }) => [type, value]));
}

// «dd/mm/aaaa» en hora de Madrid (guía común, «Formatos»).
export function formatearFecha(iso) {
  const { day, month, year } = partes(FORMATO_FECHA, new Date(iso));
  return `${day}/${month}/${year}`;
}

// «dd/mm/aaaa hh:mm» en hora de Madrid.
export function formatearFechaHora(iso) {
  const { hour, minute } = partes(FORMATO_HORA, new Date(iso));
  return `${formatearFecha(iso)} ${hour}:${minute}`;
}

// «Publicado el dd/mm/aaaa · Última modificación dd/mm/aaaa hh:mm». Un borrador (US-20) no tiene `publicado_en`.
export function lineaDeFechas({ publicado_en: publicado, actualizado_en: actualizado }) {
  const trozos = [];
  if (publicado) trozos.push(`Publicado el ${formatearFecha(publicado)}`);
  if (actualizado) trozos.push(`Última modificación ${formatearFechaHora(actualizado)}`);
  return trozos.join(' · ');
}

// Cualquier 404 de un anuncio muestra «Anuncio no encontrado» («Propiedad»). El resto: «No se ha podido cargar.»
// con «Reintentar» (guía común).
export function resultadoDeLaCarga(fallo) {
  return fallo?.status === 404 ? { noEncontrado: true } : { error: true };
}
