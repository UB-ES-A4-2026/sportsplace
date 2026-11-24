import { Clock3, ImageOff, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { DEPORTES, etiquetaDe } from '../anuncios/valores.js';
import { MODALIDADES } from '../catalogo/filtros.js';
import {
  TEXTOS, estaNoDisponible, partesPrecio, textoEstadoYUnidades, textoOrigen, textoPublicado,
} from '../catalogo/tarjeta.js';
import { CirculoDeporte } from '../diseno/IconoDeporte.jsx';
import { coloresDeporte, iconoCategoria } from '../diseno/iconosDeporte.js';
import BarrasEstado from './BarrasEstado.jsx';
import '../catalogo/catalogo.css';

// US-96 (T21-4): tarjeta de anuncio del catálogo. Todo el bloque es un enlace a la ficha (CA3). De arriba abajo, como
// en la especificación: foto 4:3 (o «Sin foto») con «Reservado» si está reservado, título, precio, estado del material
// y unidades, centro y localidad, y fecha de publicación. Diseño con vida (#361, mockup de Lucía): tarjeta blanca con
// borde, la modalidad en una pastilla sobre la foto, el precio grande y un pie con el centro.
export default function TarjetaAnuncio({ anuncio }) {
  const { importe, sufijo } = partesPrecio(anuncio);
  const { nombre, localidad } = anuncio.centro;
  return (
    <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-anuncio">
      <FotoTarjeta anuncio={anuncio} reservado={estaNoDisponible(anuncio) ? TEXTOS.noDisponible : null} />
      <div className="tarjeta-cuerpo">
        {/* El deporte solo si la API lo trae (GET /api/catalogo no lo incluye en US-96 CA16). */}
        {anuncio.deporte && <p className="tarjeta-deporte">{etiquetaDe(DEPORTES, anuncio.deporte)}</p>}
        <h2 className="tarjeta-titulo">{anuncio.titulo}</h2>
        {sufijo
          ? <p className="tarjeta-precio"><strong>{importe}</strong> <span className="tarjeta-precio-sufijo">{sufijo}</span></p>
          : <p className="tarjeta-precio-donacion">{importe}</p>}
        <p className="tarjeta-detalle"><BarrasEstado estado={anuncio.estado_material} />{textoEstadoYUnidades(anuncio)}</p>
        {/* «Centro · Localidad» sigue siendo un solo texto (CA y E2E); el CSS pone el nombre en su línea y la
            localidad con la fecha debajo, como en el mockup. */}
        <div className="tarjeta-pie">
          <p className="tarjeta-origen" title={textoOrigen(anuncio.centro)}>
            <span className="tarjeta-origen-nombre">{nombre}</span>
            <span className="tarjeta-origen-separador"> · </span>
            <span className="tarjeta-origen-lugar"><MapPin size={16} strokeWidth={2.4} aria-hidden="true" />{localidad}</span>
          </p>
          <p className="tarjeta-fecha">{textoPublicado(anuncio.publicado_en)}</p>
        </div>
      </div>
    </Link>
  );
}

// Zona de la foto, compartida con la tarjeta del perfil de un centro (US-10): la foto principal o, sin foto, el círculo
// del deporte (si se sabe) con «Sin foto» (US-96); encima, la modalidad y «Reservado» en pastillas.
export function FotoTarjeta({ anuncio, reservado }) {
  const tinte = anuncio.deporte ? { background: coloresDeporte(anuncio.deporte).tinte } : undefined;
  // Los balones y «Otros» llevan el icono de su deporte; el resto de categorías, el suyo (conos, porterías…).
  const icono = !anuncio.categoria || ['balones', 'otros'].includes(anuncio.categoria)
    ? anuncio.deporte : iconoCategoria(anuncio.categoria);
  const donacion = anuncio.modalidad === 'donacion';
  return (
    <span className="tarjeta-foto" style={tinte}>
      {anuncio.foto_principal_url
        ? <img src={anuncio.foto_principal_url} alt="" loading="lazy" decoding="async" />
        : (
          <span className="tarjeta-sin-foto">
            {anuncio.deporte
              ? <CirculoDeporte deporte={anuncio.deporte} icono={icono} tamano={116} />
              : <span className="tarjeta-sin-foto-circulo" aria-hidden="true"><ImageOff size={44} /></span>}
            {TEXTOS.sinFoto}
          </span>
        )}
      <span className="tarjeta-etiquetas">
        <span className={donacion ? 'tarjeta-modalidad tarjeta-modalidad-donacion' : 'tarjeta-modalidad'}>
          {etiquetaDe(MODALIDADES, anuncio.modalidad)}
        </span>
        {reservado && (
          <span className="tarjeta-no-disponible"><Clock3 size={14} strokeWidth={3} aria-hidden="true" />{reservado}</span>
        )}
      </span>
    </span>
  );
}
