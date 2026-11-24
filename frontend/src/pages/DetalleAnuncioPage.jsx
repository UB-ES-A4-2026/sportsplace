import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { RUTA_CATALOGO, TEXTOS, VISTAS, vistaSegunCatalogo, vistaSegunPropietario } from '../anuncios/detalleOtroCentro.js';
import { TEXTO_NO_ENCONTRADO } from '../anuncios/ficha.js';
import { obtenerAnuncio, obtenerAnuncioDelCatalogo } from '../api/anuncios.js';
import DetalleOtroCentro from '../components/DetalleOtroCentro.jsx';
import AnuncioPage from './AnuncioPage.jsx';

// US-24 T24-2: /anuncios/:id. Decide entre la ficha de propietario de E03 (US-12) y la vista de otro centro.
// - GET /api/catalogo/:id con `es_propio` → ficha de propietario (CA2, CA14); sin él → vista de otro centro (CA3, CA4).
// - 404 del catálogo → GET /api/anuncios/:id, por si es un anuncio propio que los demás no ven (pausado o entregado).
//   Si también da 404: «Este anuncio no existe o ya no está disponible.» con «Ir al catálogo» (CA5).
// - Red caída, 500 o 503: «No se ha podido cargar. » con «Reintentar» (CA11).
export default function DetalleAnuncioPage() {
  const { id } = useParams();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);

  // Cada carga se identifica por id + intento: mientras no llega su resultado, se muestra «Cargando…».
  const clave = `${id}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    const { signal } = control;
    const terminar = (datos) => { if (!signal.aborted) setResultado({ clave, ...datos }); };

    async function cargar() {
      try {
        const anuncio = await obtenerAnuncioDelCatalogo(id, { signal });
        terminar({ vista: vistaSegunCatalogo({ anuncio }), anuncio });
        return;
      } catch (fallo) {
        if (fallo?.name === 'AbortError') return;
        const vista = vistaSegunCatalogo({ fallo });
        if (vista !== VISTAS.comprobarPropietario) {
          terminar({ vista });
          return;
        }
      }
      try {
        const anuncio = await obtenerAnuncio(id, { signal });
        terminar({ vista: vistaSegunPropietario({ anuncio }) });
      } catch (fallo) {
        if (fallo?.name === 'AbortError') return;
        terminar({ vista: vistaSegunPropietario({ fallo }) });
      }
    }

    cargar();
    return () => control.abort();
  }, [id, clave]);

  const actual = resultado?.clave === clave ? resultado : null;

  // La ficha de propietario hace su propia carga y conserva sus avisos (p. ej. «Anuncio publicado.»).
  if (actual?.vista === VISTAS.propietario) return <AnuncioPage />;
  if (actual?.vista === VISTAS.otroCentro) return <DetalleOtroCentro anuncio={actual.anuncio} />;
  if (actual?.vista === VISTAS.noDisponible) return <AnuncioNoDisponible />;

  return (
    <section className="pagina pagina-anuncio" aria-busy={!actual || undefined}>
      {!actual && <p className="intro-text" role="status">Cargando…</p>}
      {actual?.vista === VISTAS.error && (
        <div className="ficha-error">
          <p className="intro-text" role="alert">No se ha podido cargar. </p>
          <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}
    </section>
  );
}

// CA5 de US-24 y «Propiedad» de E03 comparten el texto. Con un 404 no se sabe si quien mira es el propietario de un
// anuncio retirado o otro centro, así que se ofrecen las dos salidas: «Ir al catálogo» y «Volver a mis anuncios».
function AnuncioNoDisponible() {
  return (
    <section className="pagina pagina-anuncio" aria-labelledby="titulo-pagina">
      <h1 id="titulo-pagina">{TEXTO_NO_ENCONTRADO.titulo}</h1>
      <p className="intro-text">{TEXTOS.noDisponible}</p>
      <div className="detalle-no-disponible-botones">
        <Link to={RUTA_CATALOGO} className="boton-enlace">{TEXTOS.irAlCatalogo}</Link>
        <Link to="/mis-anuncios" className="boton-enlace boton-enlace-secundario">{TEXTO_NO_ENCONTRADO.boton}</Link>
      </div>
    </section>
  );
}
