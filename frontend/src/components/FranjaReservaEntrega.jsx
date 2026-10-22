import { franjaDeReservaOEntrega } from '../anuncios/franjas.js';

// US-17: en la ficha, bajo el título, franja naranja si el anuncio está reservado y azul si está entregado
// («Material entregado el dd/mm/aaaa. …»). Se actualiza con el anuncio que devuelve la API.
export default function FranjaReservaEntrega({ anuncio }) {
  const franja = franjaDeReservaOEntrega(anuncio);
  if (!franja) return null;
  return <p className={`franja-${franja.tipo}`}>{franja.texto}</p>;
}
