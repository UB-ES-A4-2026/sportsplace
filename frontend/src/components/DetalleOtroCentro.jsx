import { Clock3, MapPin, ShoppingBag } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router';
import {
  TEXTOS,
  accionDePedir,
  botonesDelDetalle,
  destinoDeVolver,
  enlaceAlCentro,
  partesDelPrecio,
  textoDistancia,
  textoUnidades,
} from '../anuncios/detalleOtroCentro.js';
import { formatearFecha } from '../anuncios/ficha.js';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL, etiquetaDe } from '../anuncios/valores.js';
import { CirculoDeporte, IconoDeporte } from '../diseno/IconoDeporte.jsx';
import { iconoCategoria } from '../diseno/iconosDeporte.js';
import { inicialesDe } from '../utilidades/iniciales.js';
import Aviso from './Aviso.jsx';
import BarrasEstado from './BarrasEstado.jsx';
import BotonEscribirAlCentro from './BotonEscribirAlCentro.jsx';
import GaleriaDetalle from './GaleriaDetalle.jsx';

// US-24 T24-2: vista de un anuncio de otro centro en /anuncios/:id (respuesta de GET /api/catalogo/:id).
// Diseño con vida (#361): dos columnas en escritorio (galería | datos) y una en < 900 px; los bloques se separan con
// líneas finas. El orden no cambia: título, precio, Detalles, Pedir, Escribir al centro, Ofrecido por y Descripción.
export default function DetalleOtroCentro({ anuncio }) {
  const location = useLocation();
  const reservado = anuncio.estado === 'reservado';
  // CA10: «Pedir» es de US-32 y US-28 activa «Escribir al centro».
  const botones = botonesDelDetalle(anuncio, { mensajes: true });
  const distancia = textoDistancia(anuncio.distancia_km);
  const { importe, sufijo } = partesDelPrecio(anuncio);
  // US-32 CA20: al volver de /anuncios/:id/pedir porque el anuncio ya no está disponible, aviso rojo.
  const [aviso, setAviso] = useState(() => location.state?.aviso ?? null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  return (
    <>
    <Aviso aviso={aviso} onCerrar={cerrarAviso} />
    <section className="pagina pagina-anuncio detalle-otro-centro" aria-labelledby="titulo-pagina">
      {/* CA1 (T24-3): vuelve a la URL del catálogo de la que se vino; si se entró por el enlace, a /catalogo. */}
      <Link to={destinoDeVolver(location.state)} className="enlace-volver">{TEXTOS.volver}</Link>

      <div className="detalle-columnas">
        <GaleriaDetalle titulo={anuncio.titulo} fotos={anuncio.fotos} deporte={anuncio.deporte} />

        <div className="detalle-datos">
          {/* CA4: aviso naranja solo si está reservado (los E2E lo buscan por .etiqueta-estado). */}
          {reservado && (
            <p className="etiqueta-estado etiqueta-naranja detalle-reservado">
              <Clock3 size={17} aria-hidden="true" />
              {TEXTOS.reservado}
            </p>
          )}
          <h1 id="titulo-pagina">{anuncio.titulo}</h1>
          <p className="detalle-precio">
            {importe}
            {sufijo && <> <span className="detalle-precio-sufijo">{sufijo}</span></>}
          </p>

          <section className="detalle-bloque" aria-labelledby="titulo-detalles">
            <h2 id="titulo-detalles" className="detalle-subtitulo">{TEXTOS.detalles}</h2>
            <dl className="detalle-lista">
              <div>
                <dt>Categoría</dt>
                <dd><IconoDeporte nombre={iconoCategoria(anuncio.categoria)} tamano={18} />{etiquetaDe(CATEGORIAS, anuncio.categoria)}</dd>
              </div>
              <div>
                <dt>Deporte</dt>
                <dd><CirculoDeporte deporte={anuncio.deporte} tamano={22} />{etiquetaDe(DEPORTES, anuncio.deporte)}</dd>
              </div>
              <div>
                <dt>Estado del material</dt>
                <dd><BarrasEstado estado={anuncio.estado_material} />{etiquetaDe(ESTADOS_MATERIAL, anuncio.estado_material)}</dd>
              </div>
              <div><dt>Unidades disponibles</dt><dd>{textoUnidades(anuncio.unidades_disponibles)}</dd></div>
              {anuncio.publicado_en && (
                <div><dt>Publicado el</dt><dd>{formatearFecha(anuncio.publicado_en)}</dd></div>
              )}
            </dl>
          </section>

          {/* CA3, CA4 y CA10: «Pedir» [US-32] principal y «Escribir al centro» [US-28] secundario. */}
          <div className="detalle-botones">
            <BloquePedir accion={accionDePedir(anuncio)} />
            {/* US-28 CA1-CA2: esta vista solo se pinta para anuncios activos o reservados de otro centro. */}
            {botones.escribir.habilitado && <BotonEscribirAlCentro anuncioId={anuncio.id} />}
          </div>

          <section className="detalle-centro" aria-labelledby="titulo-centro">
            {/* Diseño con vida: iniciales del centro, decorativas (el nombre va escrito al lado). */}
            <span className="detalle-centro-avatar" aria-hidden="true">{inicialesDe(anuncio.centro?.nombre)}</span>
            <div>
              <h2 id="titulo-centro" className="detalle-subtitulo">{TEXTOS.ofrecidoPor}</h2>
              {/* US-10 CA1: el nombre del centro enlaza a su perfil. */}
              <p className="detalle-centro-nombre">
                {enlaceAlCentro(anuncio.centro)
                  ? <Link to={enlaceAlCentro(anuncio.centro)}>{anuncio.centro.nombre}</Link>
                  : anuncio.centro?.nombre}
              </p>
              <p className="detalle-centro-datos">
                <MapPin size={15} aria-hidden="true" />
                {anuncio.centro?.localidad}
                {distancia && <> · {distancia}</>}
              </p>
            </div>
          </section>
        </div>
      </div>

      <section className="ficha-descripcion detalle-descripcion" aria-labelledby="titulo-descripcion">
        <h2 id="titulo-descripcion">{TEXTOS.descripcion}</h2>
        {/* CA8: React escapa el texto (un <script> se ve tal cual) y el CSS respeta los saltos de línea. */}
        <p>{anuncio.descripcion}</p>
      </section>
    </section>
    </>
  );
}

// US-32 CA1-CA4 (T32-3): «Pedir» (enlace a /anuncios/:id/pedir), deshabilitado con «Reservado» si está reservado,
// o el aviso de pedido pendiente con «Ver mi pedido».
function BloquePedir({ accion }) {
  if (!accion) return null;
  if (accion.tipo === 'pendiente') {
    return (
      <div className="detalle-boton detalle-pedido-pendiente">
        <p>{TEXTOS.pedidoPendiente}</p>
        <Link to={accion.ruta}>{TEXTOS.verMiPedido}</Link>
      </div>
    );
  }
  if (accion.tipo === 'reservado') {
    return (
      <div className="detalle-boton detalle-boton-pedir">
        <button type="button" className="s2-boton" disabled aria-describedby="ayuda-pedir">
          <ShoppingBag size={19} aria-hidden="true" />{TEXTOS.pedir}
        </button>
        <p id="ayuda-pedir" className="detalle-ayuda">{TEXTOS.noDisponibleParaPedir}</p>
      </div>
    );
  }
  return (
    <div className="detalle-boton detalle-boton-pedir">
      <Link to={accion.ruta} className="s2-boton"><ShoppingBag size={19} aria-hidden="true" />{TEXTOS.pedir}</Link>
    </div>
  );
}
