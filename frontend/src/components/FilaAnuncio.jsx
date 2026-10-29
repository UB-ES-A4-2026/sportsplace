import { Link } from 'react-router';
import { formatearFecha } from '../anuncios/ficha.js';
import { textoCategoriaDeporte, textoUnidades } from '../anuncios/misAnuncios.js';
import EtiquetaEstado from './EtiquetaEstado.jsx';
import MenuMas from './MenuMas.jsx';

// Fila de «Mis anuncios» (US-18): miniatura, título (→ ficha), categoría y deporte, unidades, estado y fecha.
// `children`: las acciones del menú «Más ▾» (US-16, US-17, US-70, US-19, US-90), cada una con su botón.
export default function FilaAnuncio({ anuncio, children }) {
  return (
    <li className="fila-anuncio">
      <div className="fila-miniatura">
        {anuncio.foto_principal_url
          ? <img src={anuncio.foto_principal_url} alt="" width="64" height="64" />
          : <span className="sin-foto">Sin foto</span>}
      </div>

      <div className="fila-datos">
        {/* CA16: el título se corta con «…» en una línea; el completo queda en `title`. */}
        <Link to={`/anuncios/${anuncio.id}`} className="fila-titulo" title={anuncio.titulo}>{anuncio.titulo}</Link>
        <p className="fila-detalle">
          <span>{textoCategoriaDeporte(anuncio)}</span>
          {' · '}
          <span>{textoUnidades(anuncio.unidades_disponibles)}</span>
          {/* [Depende de US-14] precio «8,50 € / unidad» o «Donación · Gratis» (T14-4) */}
        </p>
        <p className="fila-estado">
          <EtiquetaEstado estado={anuncio.estado} />
          <span>Modificado el {formatearFecha(anuncio.actualizado_en)}</span>
        </p>
      </div>

      <div className="fila-acciones">
        {/* Botón principal: [Depende de US-15] «Editar» · [Depende de US-20] «Completar y publicar». */}
        <MenuMas>{children}</MenuMas>
      </div>
    </li>
  );
}
