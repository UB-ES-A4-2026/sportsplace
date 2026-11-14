import { Link, useLocation } from 'react-router';
import {
  TEXTOS,
  botonesDelDetalle,
  destinoDeVolver,
  precioDelDetalle,
  textoDistancia,
  textoUnidades,
} from '../anuncios/detalleOtroCentro.js';
import { formatearFecha } from '../anuncios/ficha.js';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL, etiquetaDe } from '../anuncios/valores.js';
import BotonEscribirAlCentro from './BotonEscribirAlCentro.jsx';
import GaleriaDetalle from './GaleriaDetalle.jsx';

// US-24 T24-2: vista de un anuncio de otro centro en /anuncios/:id (respuesta de GET /api/catalogo/:id).
// Dos columnas en escritorio (galería | datos) y una en < 900 px; debajo, a todo el ancho, la descripción.
export default function DetalleOtroCentro({ anuncio }) {
  const location = useLocation();
  const reservado = anuncio.estado === 'reservado';
  // CA10: hasta que exista US-32 (pedidos), «Pedir material» va deshabilitado. US-28 ya activa «Escribir al centro».
  const botones = botonesDelDetalle(anuncio, { mensajes: true });
  const distancia = textoDistancia(anuncio.distancia_km);

  return (
    <section className="pagina pagina-anuncio detalle-otro-centro" aria-labelledby="titulo-pagina">
      {/* CA1 (T24-3): vuelve a la URL del catálogo de la que se vino; si se entró por el enlace, a /catalogo. */}
      <Link to={destinoDeVolver(location.state)} className="enlace-volver">{TEXTOS.volver}</Link>

      <div className="detalle-columnas">
        <GaleriaDetalle titulo={anuncio.titulo} fotos={anuncio.fotos} />

        <div className="detalle-datos">
          {/* CA4: etiqueta naranja solo si está reservado. */}
          {reservado && <p className="etiqueta-estado etiqueta-naranja detalle-reservado">{TEXTOS.reservado}</p>}
          <h1 id="titulo-pagina">{anuncio.titulo}</h1>
          <p className="detalle-precio">{precioDelDetalle(anuncio)}</p>

          <section aria-labelledby="titulo-detalles">
            <h2 id="titulo-detalles" className="detalle-subtitulo">{TEXTOS.detalles}</h2>
            <dl className="detalle-lista">
              <div><dt>Categoría</dt><dd>{etiquetaDe(CATEGORIAS, anuncio.categoria)}</dd></div>
              <div><dt>Deporte</dt><dd>{etiquetaDe(DEPORTES, anuncio.deporte)}</dd></div>
              <div><dt>Estado del material</dt><dd>{etiquetaDe(ESTADOS_MATERIAL, anuncio.estado_material)}</dd></div>
              <div><dt>Unidades disponibles</dt><dd>{textoUnidades(anuncio.unidades_disponibles)}</dd></div>
              {anuncio.publicado_en && (
                <div><dt>Publicado el</dt><dd>{formatearFecha(anuncio.publicado_en)}</dd></div>
              )}
            </dl>
          </section>

          {/* CA3, CA4 y CA10: «Pedir material» [US-32] principal y «Escribir al centro» [US-28] secundario. */}
          <div className="detalle-botones">
            <BotonDependiente id="pedir" texto={TEXTOS.pedir} estado={botones.pedir} principal />
            {/* US-28 CA1-CA2: esta vista solo se pinta para anuncios activos o reservados de otro centro. */}
            {botones.escribir.habilitado && <BotonEscribirAlCentro anuncioId={anuncio.id} />}
          </div>

          <section className="detalle-centro" aria-labelledby="titulo-centro">
            <h2 id="titulo-centro" className="detalle-subtitulo">{TEXTOS.ofrecidoPor}</h2>
            {/* [Depende de US-10] el nombre enlazará a /centros/:id cuando exista esa página; ahora es texto. */}
            <p className="detalle-centro-nombre">{anuncio.centro?.nombre}</p>
            <p className="detalle-centro-datos">
              {anuncio.centro?.localidad}
              {distancia && <> · {distancia}</>}
            </p>
          </section>
        </div>
      </div>

      <section className="ficha-descripcion detalle-descripcion" aria-labelledby="titulo-descripcion">
        <h2 id="titulo-descripcion">{TEXTOS.descripcion}</h2>
        {/* CA8: React escapa el texto (un <script> se ve tal cual) y el CSS respeta los saltos de línea. */}
        <p>{anuncio.descripcion}</p>
      </section>
    </section>
  );
}

function BotonDependiente({ id, texto, estado, principal = false }) {
  const idAyuda = estado.ayuda ? `ayuda-${id}` : undefined;
  return (
    <div className="detalle-boton">
      <button
        type="button"
        className={principal ? undefined : 'boton-secundario'}
        disabled={!estado.habilitado}
        aria-describedby={idAyuda}
      >
        {texto}
      </button>
      {estado.ayuda && <p id={idAyuda} className="detalle-ayuda">{estado.ayuda}</p>}
    </div>
  );
}
