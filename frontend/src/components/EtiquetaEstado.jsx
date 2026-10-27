import { ESTADOS_ANUNCIO } from '../anuncios/valores.js';

// Etiqueta de estado del anuncio con su color («Estados del anuncio y transiciones»). `retirado` no se muestra.
export default function EtiquetaEstado({ estado }) {
  const info = ESTADOS_ANUNCIO[estado];
  if (!info) return null;
  return <span className={`etiqueta-estado etiqueta-${info.color}`}>{info.etiqueta}</span>;
}
