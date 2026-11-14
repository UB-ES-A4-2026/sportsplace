import { Link } from 'react-router';
import { fotoPrincipal, precioDeCabecera, TEXTOS } from '../mensajes/conversacion.js';

// US-28, pantallas `/mensajes/nueva` y `/mensajes/:id`: miniatura 64×64, título (enlace a /anuncios/:id salvo que
// `conEnlace` sea false, CA34), precio unitario o «Donación» y nombre del centro vendedor.
export default function CabeceraAnuncioMensajes({ anuncio, vendedor, conEnlace = true }) {
  const foto = fotoPrincipal(anuncio);
  return (
    <div className="mensajes-anuncio">
      {foto
        ? <img className="mensajes-anuncio-foto" src={foto} alt="" width="64" height="64" />
        : <div className="mensajes-anuncio-foto mensajes-anuncio-sin-foto">{TEXTOS.sinFoto}</div>}
      <div className="mensajes-anuncio-datos">
        {conEnlace
          ? <Link className="mensajes-anuncio-titulo" to={`/anuncios/${encodeURIComponent(anuncio.id)}`}>{anuncio.titulo}</Link>
          : <span className="mensajes-anuncio-titulo">{anuncio.titulo}</span>}
        <span className="mensajes-anuncio-precio">{precioDeCabecera(anuncio)}</span>
        {vendedor && <span className="mensajes-anuncio-centro">{vendedor}</span>}
      </div>
    </div>
  );
}
