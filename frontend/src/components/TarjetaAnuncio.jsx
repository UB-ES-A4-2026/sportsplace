import { Link } from 'react-router';
import {
  TEXTOS, estaNoDisponible, textoEstadoYUnidades, textoOrigen, textoPrecio, textoPublicado,
} from '../catalogo/tarjeta.js';
import '../catalogo/catalogo.css';

// US-96 (T21-4): tarjeta de anuncio del catálogo. Todo el bloque es un enlace a la ficha (CA3).
// De arriba abajo: foto 4:3 (o «Sin foto») con «No disponible» si está reservado, título, precio,
// estado del material y unidades, centro y localidad, y fecha de publicación.
export default function TarjetaAnuncio({ anuncio }) {
  const origen = textoOrigen(anuncio.centro);
  return (
    <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-anuncio">
      <div className="tarjeta-foto">
        {anuncio.foto_principal_url
          ? <img src={anuncio.foto_principal_url} alt="" loading="lazy" decoding="async" />
          : <span className="tarjeta-sin-foto">{TEXTOS.sinFoto}</span>}
        {estaNoDisponible(anuncio) && <span className="tarjeta-no-disponible">{TEXTOS.noDisponible}</span>}
      </div>
      <div className="tarjeta-cuerpo">
        <h2 className="tarjeta-titulo">{anuncio.titulo}</h2>
        <p className={anuncio.modalidad === 'donacion' ? 'tarjeta-precio tarjeta-precio-donacion' : 'tarjeta-precio'}>
          {textoPrecio(anuncio)}
        </p>
        <p className="tarjeta-detalle">{textoEstadoYUnidades(anuncio)}</p>
        <p className="tarjeta-origen" title={origen}>{origen}</p>
        <p className="tarjeta-fecha">{textoPublicado(anuncio.publicado_en)}</p>
      </div>
    </Link>
  );
}
