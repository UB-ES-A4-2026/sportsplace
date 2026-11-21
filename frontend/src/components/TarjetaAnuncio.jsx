import { Clock3, ImageOff, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import {
  TEXTOS, estaNoDisponible, partesPrecio, textoEstadoYUnidades, textoOrigen, textoPublicado,
} from '../catalogo/tarjeta.js';
import { CirculoDeporte } from '../diseno/IconoDeporte.jsx';
import { coloresDeporte } from '../diseno/iconosDeporte.js';
import BarrasEstado from './BarrasEstado.jsx';
import '../catalogo/catalogo.css';

// US-96 (T21-4): tarjeta de anuncio del catálogo. Todo el bloque es un enlace a la ficha (CA3). De arriba abajo, como
// en la especificación: foto 4:3 (o «Sin foto») con «Reservado» si está reservado, título, precio, estado del material
// y unidades, centro y localidad, y fecha de publicación. Diseño con vida (#361): sin caja alrededor (la foto y una
// línea fina separan cada parte), barritas del estado y, si la API trae el deporte, su color en el hueco de la foto.
export default function TarjetaAnuncio({ anuncio }) {
  const origen = textoOrigen(anuncio.centro);
  const { importe, sufijo } = partesPrecio(anuncio);
  const tinte = anuncio.deporte ? { background: coloresDeporte(anuncio.deporte).tinte } : undefined;
  return (
    <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-anuncio">
      <div className="tarjeta-foto" style={tinte}>
        {anuncio.foto_principal_url
          ? <img src={anuncio.foto_principal_url} alt="" loading="lazy" decoding="async" />
          : (
            <span className="tarjeta-sin-foto">
              {anuncio.deporte ? <CirculoDeporte deporte={anuncio.deporte} tamano={72} /> : <ImageOff size={26} aria-hidden="true" />}
              {TEXTOS.sinFoto}
            </span>
          )}
        {estaNoDisponible(anuncio) && (
          <span className="tarjeta-no-disponible"><Clock3 size={14} strokeWidth={2.4} aria-hidden="true" />{TEXTOS.noDisponible}</span>
        )}
      </div>
      <div className="tarjeta-cuerpo">
        <h2 className="tarjeta-titulo">{anuncio.titulo}</h2>
        <p className={sufijo ? 'tarjeta-precio' : 'tarjeta-precio tarjeta-precio-donacion'}>
          <strong>{importe}</strong>
          {sufijo && <> <span className="tarjeta-precio-sufijo">{sufijo}</span></>}
        </p>
        <p className="tarjeta-detalle"><BarrasEstado estado={anuncio.estado_material} />{textoEstadoYUnidades(anuncio)}</p>
        <div className="tarjeta-pie">
          <p className="tarjeta-origen" title={origen}>
            <MapPin size={14} aria-hidden="true" />
            <span>{origen}</span>
          </p>
          <p className="tarjeta-fecha">{textoPublicado(anuncio.publicado_en)}</p>
        </div>
      </div>
    </Link>
  );
}
