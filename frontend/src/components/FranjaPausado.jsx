// US-16: en la ficha, si el anuncio está pausado, franja gris bajo el título. Se actualiza con el estado del anuncio (CA3).
export default function FranjaPausado({ estado }) {
  if (estado !== 'pausado') return null;
  return <p className="franja-pausado">Este anuncio está pausado: los demás centros no lo ven.</p>;
}
