// US-17 «Pantallas para el boceto»: franja bajo el título de la ficha de un anuncio reservado o entregado.

const FORMATO_FECHA = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
});

// «dd/mm/aaaa» en hora de Madrid (guía común, «Formatos»; las fechas de la API vienen en UTC).
function fechaEnMadrid(iso) {
  const partes = Object.fromEntries(FORMATO_FECHA.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return `${partes.day}/${partes.month}/${partes.year}`;
}

// Devuelve { tipo, texto } o null si el anuncio no está reservado ni entregado.
// La fecha de entrega es `entregado_en` (CA5). Como `entregado` es final, si faltara se usa `actualizado_en`,
// que se renueva en la misma transición.
export function franjaDeReservaOEntrega({ estado, entregado_en: entregado, actualizado_en: actualizado }) {
  if (estado === 'reservado') {
    return { tipo: 'reservado', texto: 'Este anuncio está reservado: los demás centros lo ven como no disponible.' };
  }
  if (estado === 'entregado') {
    const fecha = entregado ?? actualizado;
    const cuando = fecha ? ` el ${fechaEnMadrid(fecha)}` : '';
    return { tipo: 'entregado', texto: `Material entregado${cuando}. Este anuncio ya no se puede modificar.` };
  }
  return null;
}
