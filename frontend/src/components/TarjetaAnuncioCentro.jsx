import { Link } from 'react-router';
import { precioDelAnuncio } from '../anuncios/precio.js';
import { etiquetaDeAnuncio } from '../perfil/perfilPublico.js';

// Tarjeta de un anuncio en «Anuncios activos» del perfil de un centro (US-10 CA3 y CA6). Sigue la tarjeta del catálogo
// de US-96 (foto principal, título, precio y «No disponible» si está reservado). Toda la tarjeta lleva a /anuncios/:id.
export default function TarjetaAnuncioCentro({ anuncio }) {
  const etiqueta = etiquetaDeAnuncio(anuncio);
  return (
    <li className="tarjeta-centro">
      <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-centro-enlace">
        {anuncio.foto_principal_url
          ? <img className="tarjeta-centro-foto" src={anuncio.foto_principal_url} alt="" />
          : <span className="tarjeta-centro-foto tarjeta-centro-sin-foto">Sin foto</span>}
        <span className="tarjeta-centro-cuerpo">
          {etiqueta && <span className="etiqueta-estado etiqueta-naranja">{etiqueta}</span>}
          <span className="tarjeta-centro-titulo">{anuncio.titulo}</span>
          <span className="tarjeta-centro-precio">{precioDelAnuncio(anuncio).texto}</span>
        </span>
      </Link>
    </li>
  );
}
