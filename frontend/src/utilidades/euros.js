// Formato de importes en euros con el estilo español (US-14, CA6).
// Se hace a mano porque Intl en «es-ES» no separa los miles en números de 4 cifras (1234,50).
export function formatearEuros(centimos) {
  const euros = String(Math.trunc(centimos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = String(centimos % 100).padStart(2, '0');
  return `${euros},${decimales} €`;
}
