import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { obtenerAnuncio } from '../api/anuncios.js';
import { lineaDeFechas, resultadoDeLaCarga } from '../anuncios/ficha.js';
import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL, etiquetaDe } from '../anuncios/valores.js';
import AnuncioNoEncontrado from '../components/AnuncioNoEncontrado.jsx';
import Aviso from '../components/Aviso.jsx';
import BotonPausarReactivar from '../components/BotonPausarReactivar.jsx';
import BotonRetirarAnuncio from '../components/BotonRetirarAnuncio.jsx';
import EtiquetaEstado from '../components/EtiquetaEstado.jsx';
import FranjaPausado from '../components/FranjaPausado.jsx';
import GaleriaAnuncio from '../components/GaleriaAnuncio.jsx';

// US-12 T12-4: /anuncios/:id · ficha propia del anuncio (GET /api/anuncios/:id).
export default function AnuncioPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);
  // CA4: «Anuncio publicado.» llega en `state.aviso` desde «Publicar anuncio» (mismo formato que US-70).
  const [aviso, setAviso] = useState(() => location.state?.aviso ?? null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Cada carga se identifica por id + intento: mientras no llega su resultado, se muestra «Cargando…».
  const clave = `${id}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    obtenerAnuncio(id, { signal: control.signal })
      .then((anuncio) => setResultado({ clave, anuncio }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, ...resultadoDeLaCarga(fallo) });
      });
    return () => control.abort();
  }, [id, clave]);

  // El aviso se muestra una vez: se quita del historial para que no vuelva a salir al recargar.
  useEffect(() => {
    if (location.state?.aviso) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const actual = resultado?.clave === clave ? resultado : null;

  // US-16 CA3: tras pausar o reactivar, la ficha se actualiza con el anuncio que devuelve la API, sin recargar.
  const actualizarAnuncio = useCallback((anuncio) => {
    setResultado({ clave, anuncio });
  }, [clave]);

  // Fallo de una acción de la ficha (US-16 CA4 y US-70 CA6): el diálogo, si lo había, ya se ha cerrado sin cambios.
  // 404 → «Anuncio no encontrado»; 409 → aviso rojo y se recarga el anuncio para ver su estado real; el resto → aviso
  // rojo genérico.
  const mostrarFallo = useCallback(({ noEncontrado, mensaje, recargar }) => {
    if (noEncontrado) {
      setResultado({ clave, noEncontrado: true });
      return;
    }
    setAviso({ tipo: 'error', texto: mensaje });
    if (recargar) setIntento((n) => n + 1);
  }, [clave]);

  if (actual?.noEncontrado) return <AnuncioNoEncontrado />;

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina pagina-anuncio ficha" aria-labelledby="titulo-pagina" aria-busy={!actual || undefined}>
        <Link to="/mis-anuncios" className="enlace-volver">← Mis anuncios</Link>

        {!actual && <p className="intro-text" role="status">Cargando…</p>}

        {actual?.error && (
          <div className="ficha-error">
            <p className="intro-text" role="alert">No se ha podido cargar. </p>
            <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
          </div>
        )}

        {actual?.anuncio && (
          <Ficha anuncio={actual.anuncio} onActualizado={actualizarAnuncio} onAviso={setAviso} onFallo={mostrarFallo} />
        )}
      </section>
    </>
  );
}

function Ficha({ anuncio, onActualizado, onAviso, onFallo }) {
  return (
    <>
      <div className="ficha-cabecera">
        <h1 id="titulo-pagina">{anuncio.titulo}</h1>
        <EtiquetaEstado estado={anuncio.estado} />
      </div>
      {/* US-16: franja gris bajo el título mientras está pausado; cambia con el estado sin recargar (CA3). */}
      <FranjaPausado estado={anuncio.estado} />

      <GaleriaAnuncio titulo={anuncio.titulo} fotos={anuncio.fotos} />

      {/* [Depende de US-14] precio o «Donación · Gratis» */}

      <table className="ficha-datos">
        <tbody>
          <tr><th scope="row">Categoría</th><td>{etiquetaDe(CATEGORIAS, anuncio.categoria)}</td></tr>
          <tr><th scope="row">Deporte</th><td>{etiquetaDe(DEPORTES, anuncio.deporte)}</td></tr>
          <tr><th scope="row">Unidades disponibles</th><td>{anuncio.unidades_disponibles}</td></tr>
          <tr><th scope="row">Estado del material</th><td>{etiquetaDe(ESTADOS_MATERIAL, anuncio.estado_material)}</td></tr>
        </tbody>
      </table>

      <section className="ficha-descripcion" aria-labelledby="titulo-descripcion">
        <h2 id="titulo-descripcion">Descripción</h2>
        {/* CA25: React escapa el texto, así que un <script> se ve tal cual. Los saltos de línea se respetan con CSS. */}
        <p>{anuncio.descripcion}</p>
      </section>

      <p className="ficha-fechas">{lineaDeFechas(anuncio)}</p>

      {/* Zona «Acciones»: la rellenan US-15 (Editar), US-16 (Pausar/Reactivar), US-17, US-70 (Retirar) y US-19. */}
      <div className="ficha-acciones">
        {/* US-16 CA1-CA4: «Pausar» (activo) o «Reactivar» (pausado), sin diálogo; aviso verde y la ficha cambia en sitio.
            Con un 409 (estado desfasado, E2E-4), aviso rojo y se recarga el anuncio. */}
        <BotonPausarReactivar anuncio={anuncio} onActualizado={onActualizado} onAviso={onAviso} onFallo={onFallo} />
        {/* US-70 CA1: solo en borrador, activo, pausado y reservado (el botón no se pinta en entregado). Al retirar,
            va a /mis-anuncios con replace y el aviso «Anuncio retirado.» (CA4). */}
        <BotonRetirarAnuncio anuncio={anuncio} onFallo={onFallo} />
      </div>
    </>
  );
}
