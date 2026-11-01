import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarMisAnuncios } from '../api/anuncios.js';
import {
  paginaCorregida,
  paginaDeLaUrl,
  POR_PAGINA,
  TEXTOS,
  textoTotal,
  totalDePaginas,
} from '../anuncios/misAnuncios.js';
import FilaAnuncio from '../components/FilaAnuncio.jsx';

// US-18 T18-2: /mis-anuncios · anuncios del centro, del último modificado al más antiguo (GET /api/anuncios/mios).
export default function MisAnunciosPage() {
  const [parametros, setParametros] = useSearchParams();
  // CA2: la página está en la URL (`?pagina=2`), así que recargar la mantiene.
  const pagina = paginaDeLaUrl(parametros.get('pagina'));
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);

  // Cada carga se identifica por página + intento: mientras no llega su resultado, se muestra «Cargando…».
  const clave = `${pagina}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    listarMisAnuncios({ pagina, porPagina: POR_PAGINA }, { signal: control.signal })
      .then((lista) => setResultado({ clave, lista }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, error: true });
      });
    return () => control.abort();
  }, [pagina, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const lista = actual?.lista;

  // CA10: una página mayor que la última (por ejemplo, tras retirar) muestra la última.
  const corregida = lista ? paginaCorregida(pagina, lista.total, lista.por_pagina) : null;
  useEffect(() => {
    if (corregida) setParametros({ pagina: String(corregida) }, { replace: true });
  }, [corregida, setParametros]);

  function irAPagina(numero) {
    setParametros({ pagina: String(numero) });
    window.scrollTo(0, 0);
  }

  return (
    <section className="pagina pagina-anuncio pagina-mis-anuncios" aria-labelledby="titulo-pagina"
      aria-busy={!actual || undefined}>
      <div className="mis-anuncios-cabecera">
        <h1 id="titulo-pagina">Mis anuncios</h1>
        <Link to="/anuncios/nuevo" className="boton-enlace">Publicar anuncio</Link>
      </div>

      {!actual && <p className="intro-text" role="status">{TEXTOS.cargando}</p>}

      {actual?.error && (
        <div className="ficha-error">
          <p className="intro-text" role="alert">{TEXTOS.error}</p>
          <button type="button" onClick={() => setIntento((n) => n + 1)}>{TEXTOS.reintentar}</button>
        </div>
      )}

      {lista && !corregida && (
        lista.total === 0
          ? <ListaVacia />
          : <Lista lista={lista} pagina={pagina} irAPagina={irAPagina} />
      )}
    </section>
  );
}

// CA8.
function ListaVacia() {
  return (
    <div className="mis-anuncios-vacio">
      <p className="intro-text">{TEXTOS.vacio}</p>
      <Link to="/anuncios/nuevo" className="boton-enlace">{TEXTOS.publicarPrimero}</Link>
    </div>
  );
}

function Lista({ lista, pagina, irAPagina }) {
  const paginas = totalDePaginas(lista.total, lista.por_pagina);

  return (
    <>
      <p className="mis-anuncios-total">{textoTotal(lista.total)}</p>
      {/* [Depende de US-71] filtros */}

      <ul className="lista-anuncios">
        {/* Acciones de cada fila (CA6): [Depende de US-15, US-16, US-17, US-70, US-19 y US-90]. Al montarlas, la fila
            se actualiza con `conFilaActualizada` y desaparece al retirar con `sinFila` (anuncios/misAnuncios.js). */}
        {lista.anuncios.map((anuncio) => <FilaAnuncio key={anuncio.id} anuncio={anuncio} />)}
      </ul>

      {/* CA5: 20 por página; sin paginación si caben en una. */}
      {paginas > 1 && (
        <nav className="paginacion" aria-label="Paginación">
          <button type="button" className="boton-secundario" disabled={pagina <= 1}
            onClick={() => irAPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {paginas}</span>
          <button type="button" className="boton-secundario" disabled={pagina >= paginas}
            onClick={() => irAPagina(pagina + 1)}>Siguiente</button>
        </nav>
      )}
    </>
  );
}
