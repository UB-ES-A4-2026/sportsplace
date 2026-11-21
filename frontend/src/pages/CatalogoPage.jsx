import { ChevronLeft, ChevronRight, CloudOff, PackageOpen, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { listarCatalogo } from '../api/anuncios.js';
import BarraFiltros from '../components/BarraFiltros.jsx';
import CuadroBusqueda from '../components/CuadroBusqueda.jsx';
import SinResultadosBusqueda from '../components/SinResultadosBusqueda.jsx';
import TarjetaAnuncio from '../components/TarjetaAnuncio.jsx';
import { textoResultados } from '../catalogo/busqueda.js';
import {
  TEXTOS, consultaDeApi, hayPaginacion, paginaFueraDeRango, textoPagina, tipoDeVacio,
} from '../catalogo/catalogo.js';
import { TEXTOS as TEXTOS_FILTROS, numeroDeFiltros, parametrosDeApi, sinFiltros } from '../catalogo/filtros.js';
import useBusquedaCatalogo from '../catalogo/useBusquedaCatalogo.js';
import useFiltrosCatalogo from '../catalogo/useFiltrosCatalogo.js';
import usePaginaCatalogo from '../catalogo/usePaginaCatalogo.js';
import '../catalogo/catalogo.css';

// US-96 T96-3 (T21-4): /catalogo · anuncios de otros centros, del más reciente al más antiguo (GET /api/catalogo).
// Junta la búsqueda (T21-5) y la barra de filtros (T21-6), que viven en la URL igual que la página.
export default function CatalogoPage() {
  const { parametros, filtros, corregidos: filtrosPorCorregir, cambiar } = useFiltrosCatalogo();
  const { q, corregidos: busquedaPorCorregir, buscar, quitar } = useBusquedaCatalogo();
  const { pagina, corregidos: paginaPorCorregir, irAPagina, corregirPagina } = usePaginaCatalogo();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);
  const inicioResultados = useRef(null);

  // Mientras alguna pieza corrige la URL con `replace`, no se piden datos: esa consulta va a cambiar enseguida.
  const urlCorrecta = !filtrosPorCorregir && !busquedaPorCorregir && !paginaPorCorregir;
  const consulta = useMemo(() => consultaDeApi({ q, filtros: parametrosDeApi(filtros), pagina }), [q, filtros, pagina]);
  // Cada carga se identifica por consulta + intento: mientras no llega su resultado, se muestra «Cargando…» (CA13).
  const clave = `${new URLSearchParams(consulta)}#${intento}`;

  useEffect(() => {
    if (!urlCorrecta) return undefined;
    const control = new AbortController();
    listarCatalogo(consulta, { signal: control.signal })
      .then((datos) => setResultado({ clave, datos }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, error: true });
      });
    return () => control.abort();
  }, [urlCorrecta, consulta, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const datos = actual?.datos;

  // CA10: una página mayor que la última carga la última y corrige la URL.
  const ultima = datos ? paginaFueraDeRango(pagina, datos) : null;
  useEffect(() => {
    if (ultima) corregirPagina(ultima);
  }, [ultima, corregirPagina]);

  // CA9: al cambiar de página, la vista sube al principio de los resultados.
  function cambiarPagina(numero) {
    irAPagina(numero);
    inicioResultados.current?.scrollIntoView({ block: 'start' });
  }

  const cargando = !actual || Boolean(ultima);

  return (
    <section className="pagina pagina-catalogo" aria-labelledby="titulo-pagina" aria-busy={cargando || undefined}>
      {/* Diseño con vida (#361): portada a todo el ancho con una foto (decorativa, va de fondo en el CSS) y, encima, una
          tarjeta blanca con el título y la búsqueda, como la portada de los marketplaces. */}
      <div className="catalogo-portada">
        <div className="catalogo-portada-tarjeta">
          <h1 id="titulo-pagina">{TEXTOS.titulo}</h1>
          <CuadroBusqueda q={q} alBuscar={buscar} alQuitar={quitar} />
        </div>
      </div>
      <BarraFiltros parametros={parametros} filtros={filtros} onCambiar={cambiar} />
      <div ref={inicioResultados} />

      {/* CA13: «Cargando…» en lugar de la rejilla, con esqueletos de tarjeta. */}
      {cargando && (
        <>
          <p className="catalogo-cargando" role="status">{TEXTOS.cargando}</p>
          <Esqueletos />
        </>
      )}

      {/* CA15: con la API caída, el error y «Reintentar», que repite la misma petición. */}
      {actual?.error && (
        <div className="catalogo-estado">
          <span className="catalogo-estado-icono" aria-hidden="true"><CloudOff size={24} /></span>
          <p role="alert">{TEXTOS.error}</p>
          <button type="button" className="s2-boton" onClick={() => setIntento((n) => n + 1)}>{TEXTOS.reintentar}</button>
        </div>
      )}

      {datos && !ultima && (
        datos.total === 0
          ? <SinAnuncios q={q} filtros={filtros} alLimpiarFiltros={() => cambiar(sinFiltros(parametros))} />
          : <Resultados datos={datos} q={q} pagina={pagina} alCambiarPagina={cambiarPagina} />
      )}
    </section>
  );
}

// Línea de resultados (CA11), rejilla de tarjetas y paginación (CA7-CA9).
function Resultados({ datos, q, pagina, alCambiarPagina }) {
  return (
    <>
      <div className="catalogo-resultados">
        <p className="catalogo-total">{textoResultados(datos.total, q)}</p>
        {/* En esta historia solo hay «Más recientes»; US-23 añade «Más cercanos». */}
        <div className="catalogo-orden">
          <label htmlFor="catalogo-orden">{TEXTOS.ordenarPor}</label>
          <select id="catalogo-orden" defaultValue="recientes">
            <option value="recientes">{TEXTOS.recientes}</option>
          </select>
        </div>
      </div>

      <ul className="catalogo-rejilla">
        {datos.anuncios.map((anuncio) => (
          <li key={anuncio.id}><TarjetaAnuncio anuncio={anuncio} /></li>
        ))}
      </ul>

      {hayPaginacion(datos) && (
        <nav className="catalogo-paginacion" aria-label={TEXTOS.paginacion}>
          <button type="button" className="s2-boton s2-boton-secundario" disabled={pagina <= 1}
            onClick={() => alCambiarPagina(pagina - 1)}>
            <ChevronLeft size={18} aria-hidden="true" />
            {TEXTOS.anterior}
          </button>
          <span className="catalogo-pagina-actual">{textoPagina(pagina, datos.total_paginas)}</span>
          <button type="button" className="s2-boton s2-boton-secundario" disabled={pagina >= datos.total_paginas}
            onClick={() => alCambiarPagina(pagina + 1)}>
            {TEXTOS.siguiente}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      )}
    </>
  );
}

// Sin anuncios: el bloque de la búsqueda (US-21 CA18), el de los filtros (US-22 CA10) o el del catálogo vacío (CA14).
function SinAnuncios({ q, filtros, alLimpiarFiltros }) {
  const tipo = tipoDeVacio({ q, filtrosActivos: numeroDeFiltros(filtros) });
  if (tipo === 'busqueda') return <SinResultadosBusqueda q={q} />;
  if (tipo === 'filtros') {
    return (
      <div className="catalogo-estado" role="status">
        <span className="catalogo-estado-icono" aria-hidden="true"><SearchX size={24} /></span>
        <p>{TEXTOS_FILTROS.sinResultados}</p>
        <button type="button" className="s2-boton s2-boton-secundario" onClick={alLimpiarFiltros}>{TEXTOS_FILTROS.limpiar}</button>
      </div>
    );
  }
  return (
    <div className="catalogo-estado">
      <span className="catalogo-estado-icono" aria-hidden="true"><PackageOpen size={24} /></span>
      <p>{TEXTOS.vacio}</p>
      <Link to="/anuncios/nuevo" className="s2-boton">{TEXTOS.publicar}</Link>
    </div>
  );
}

// Esqueletos de 8 tarjetas mientras carga: solo decoración; el estado lo anuncia «Cargando…».
function Esqueletos() {
  return (
    <ul className="catalogo-rejilla catalogo-esqueletos" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i}>
          <div className="tarjeta-esqueleto">
            <div className="esqueleto-foto" />
            <div className="esqueleto-lineas"><span /><span /><span /><span /></div>
          </div>
        </li>
      ))}
    </ul>
  );
}
