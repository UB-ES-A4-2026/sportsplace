import { precioDelAnuncio } from '../anuncios/precio.js';

// Precio de un anuncio (US-14, CA6 y CA7): «8,50 € / unidad» o la etiqueta verde «Donación · Gratis».
// En la ficha va bajo el título y en grande (`grande`); en la fila de «Mis anuncios», sin `grande`.
// Uso: <PrecioAnuncio anuncio={anuncio} grande /> o <PrecioAnuncio anuncio={resumen} />
export default function PrecioAnuncio({ anuncio, grande = false }) {
  const { donacion, texto } = precioDelAnuncio(anuncio);
  if (donacion) return <span className="etiqueta etiqueta-verde">{texto}</span>;
  return <span className={grande ? 'precio-anuncio precio-anuncio-grande' : 'precio-anuncio'}>{texto}</span>;
}
