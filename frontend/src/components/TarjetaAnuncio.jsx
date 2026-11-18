import { ImageOff } from 'lucide-react';
import { Link } from 'react-router';
import {
  TEXTOS, estaNoDisponible, partesPrecio, textoEstadoYUnidades, textoOrigen, textoPublicado,
} from '../catalogo/tarjeta.js';
import '../catalogo/catalogo.css';

// US-96 (T21-4): tarjeta de anuncio del catálogo con el diseño S2 (#250). Todo el bloque es un enlace a la ficha
// (CA3). De arriba abajo, como en la especificación: foto 4:3 (o «Sin foto») con «No disponible» si está reservado,
// título, precio, estado del material y unidades, centro y localidad, y fecha de publicación.
export default function TarjetaAnuncio({ anuncio }) {
  const origen = textoOrigen(anuncio.centro);
  const { importe, sufijo } = partesPrecio(anuncio);
  return (
    <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-anuncio">
      <div className="tarjeta-foto">
        {anuncio.foto_principal_url
          ? <img src={anuncio.foto_principal_url} alt="" loading="lazy" decoding="async" />
          : (
            <span className="tarjeta-sin-foto">
              <ImageOff size={22} aria-hidden="true" />
              {TEXTOS.sinFoto}
            </span>
          )}
        {estaNoDisponible(anuncio) && <span className="tarjeta-no-disponible">{TEXTOS.noDisponible}</span>}
      </div>
      <div className="tarjeta-cuerpo">
        <h2 className="tarjeta-titulo">{anuncio.titulo}</h2>
        <p className={sufijo ? 'tarjeta-precio' : 'tarjeta-precio tarjeta-precio-donacion'}>
          <strong>{importe}</strong>
          {sufijo && <> <span className="tarjeta-precio-sufijo">{sufijo}</span></>}
        </p>
        <p className="tarjeta-detalle">{textoEstadoYUnidades(anuncio)}</p>
        <div className="tarjeta-pie">
          <p className="tarjeta-origen" title={origen}>
            <span className="tarjeta-centro-punto" aria-hidden="true" />
            {origen}
          </p>
          <p className="tarjeta-fecha">{textoPublicado(anuncio.publicado_en)}</p>
        </div>
      </div>
    </Link>
  );
}
