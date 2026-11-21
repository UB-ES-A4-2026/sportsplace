import { Clock3, ImageOff } from 'lucide-react';
import { Link } from 'react-router';
import { precioDelAnuncio } from '../anuncios/precio.js';
import { CirculoDeporte } from '../diseno/IconoDeporte.jsx';
import { coloresDeporte } from '../diseno/iconosDeporte.js';
import { etiquetaDeAnuncio } from '../perfil/perfilPublico.js';
import '../catalogo/catalogo.css';

// Tarjeta de un anuncio en «Anuncios activos» del perfil de un centro (US-10 CA3 y CA6). Sigue la tarjeta del catálogo
// de US-96 (foto principal, título, precio y «Reservado» si está reservado). Toda la tarjeta lleva a /anuncios/:id.
// Diseño con vida (#361): mismo aspecto que la del catálogo (catalogo.css), sin caja alrededor.
export default function TarjetaAnuncioCentro({ anuncio }) {
  const etiqueta = etiquetaDeAnuncio(anuncio);
  const { texto: precio, donacion } = precioDelAnuncio(anuncio);
  const tinte = anuncio.deporte ? { background: coloresDeporte(anuncio.deporte).tinte } : undefined;
  return (
    <li className="tarjeta-centro">
      <Link to={`/anuncios/${anuncio.id}`} className="tarjeta-centro-enlace">
        <span className="tarjeta-foto" style={tinte}>
          {anuncio.foto_principal_url
            ? <img className="tarjeta-centro-foto" src={anuncio.foto_principal_url} alt="" loading="lazy" decoding="async" />
            : (
              <span className="tarjeta-sin-foto tarjeta-centro-sin-foto">
                {anuncio.deporte ? <CirculoDeporte deporte={anuncio.deporte} tamano={64} /> : <ImageOff size={24} aria-hidden="true" />}
                Sin foto
              </span>
            )}
          {etiqueta && (
            <span className="tarjeta-no-disponible"><Clock3 size={14} strokeWidth={2.4} aria-hidden="true" />{etiqueta}</span>
          )}
        </span>
        <span className="tarjeta-cuerpo tarjeta-centro-cuerpo">
          <span className="tarjeta-titulo tarjeta-centro-titulo">{anuncio.titulo}</span>
          <span className={donacion ? 'tarjeta-centro-precio tarjeta-centro-precio-donacion' : 'tarjeta-centro-precio'}>{precio}</span>
        </span>
      </Link>
    </li>
  );
}
