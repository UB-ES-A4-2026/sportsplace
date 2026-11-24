import { Link } from 'react-router';
import { textoUnidades } from '../anuncios/misAnuncios.js';
import { DEPORTES, ESTADOS_MATERIAL, etiquetaDe } from '../anuncios/valores.js';
import { partesPrecio, textoPublicado } from '../catalogo/tarjeta.js';
import { etiquetaDeAnuncio } from '../perfil/perfilPublico.js';
import BarrasEstado from './BarrasEstado.jsx';
import { FotoTarjeta } from './TarjetaAnuncio.jsx';
import '../catalogo/catalogo.css';

// Tarjeta de un anuncio en «Anuncios activos» del perfil de un centro (US-10 CA3 y CA6). Sigue la tarjeta del catálogo
// de US-96 (foto principal, título, precio y «Reservado» si está reservado). Toda la tarjeta lleva a /anuncios/:id.
// Diseño con vida (#361, mockup de Lucía): la misma tarjeta que el catálogo (catalogo.css), con «Deporte · N unidades»
// arriba y la fecha de publicación en el pie (el centro ya es el de la página). Cada dato solo si la API lo trae.
export default function TarjetaAnuncioCentro({ anuncio }) {
  const { importe, sufijo } = partesPrecio(anuncio);
  const deporte = anuncio.deporte ? etiquetaDe(DEPORTES, anuncio.deporte) : null;
  return (
    <li className="tarjeta-centro">
      <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-centro-enlace">
        <FotoTarjeta anuncio={anuncio} reservado={etiquetaDeAnuncio(anuncio)} />
        <span className="tarjeta-cuerpo tarjeta-centro-cuerpo">
          {deporte && (
            <span className="tarjeta-deporte">{deporte} · {textoUnidades(anuncio.unidades_disponibles)}</span>
          )}
          <span className="tarjeta-titulo tarjeta-centro-titulo">{anuncio.titulo}</span>
          {sufijo
            ? <span className="tarjeta-precio"><strong>{importe}</strong> <span className="tarjeta-precio-sufijo">{sufijo}</span></span>
            : <span className="tarjeta-precio-donacion">{importe}</span>}
          {anuncio.estado_material && (
            <span className="tarjeta-detalle">
              <BarrasEstado estado={anuncio.estado_material} />{etiquetaDe(ESTADOS_MATERIAL, anuncio.estado_material)}
            </span>
          )}
          {anuncio.publicado_en && (
            <span className="tarjeta-pie tarjeta-centro-pie">{textoPublicado(anuncio.publicado_en)}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
