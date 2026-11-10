import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { listarAnunciosDelCentro, obtenerCentro } from '../api/centros.js';
import TarjetaAnuncioCentro from '../components/TarjetaAnuncioCentro.jsx';
import { TEXTOS_PERFIL } from '../perfil/perfil.js';
import {
  RUTA_CATALOGO,
  TEXTOS,
  VISTAS,
  enlacesDeContacto,
  esMiCentro,
  paginaDeLaUrl,
  paginacion,
  parametrosDePagina,
  textoAntiguedad,
  tituloDeAnuncios,
  vistaDelPerfil,
  zonaDelCentro,
} from '../perfil/perfilPublico.js';

// US-10 T10-2: /centros/:id · «Perfil de centro», lo que ven los demás centros (ruta privada, CA2).
// Carga a la vez GET /api/centros/:id (CA11) y GET /api/centros/:id/anuncios?pagina=n (CA12).
export default function CentroPage() {
  const { id } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const pagina = paginaDeLaUrl(parametros.get('pagina'));
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);

  // Cada carga se identifica por id + página + intento: mientras no llega su resultado, «Cargando…» (CA10).
  const clave = `${id}#${pagina}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    const { signal } = control;
    Promise.all([obtenerCentro(id, { signal }), listarAnunciosDelCentro(id, { pagina, signal })])
      .then(([centro, lista]) => {
        if (!signal.aborted) setResultado({ clave, vista: vistaDelPerfil({ centro }), centro, lista });
      })
      .catch((fallo) => {
        if (fallo?.name === 'AbortError' || signal.aborted) return;
        setResultado({ clave, vista: vistaDelPerfil({ fallo }) });
      });
    return () => control.abort();
  }, [id, pagina, clave]);

  const actual = resultado?.clave === clave ? resultado : null;

  if (actual?.vista === VISTAS.noEncontrado) return <CentroNoEncontrado />;

  if (actual?.vista === VISTAS.perfil) {
    return (
      <PerfilDeCentro
        centro={actual.centro}
        lista={actual.lista}
        pagina={pagina}
        alCambiarDePagina={(nueva) => {
          setParametros(parametrosDePagina(nueva));
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <section className="pagina pagina-anuncio pagina-centro" aria-busy={!actual || undefined}>
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

function PerfilDeCentro({ centro, lista, pagina, alCambiarDePagina }) {
  const zona = zonaDelCentro(centro);
  const contacto = enlacesDeContacto(centro);
  const anuncios = lista?.anuncios ?? [];
  const total = lista?.total ?? 0;
  const { paginas, hayAnterior, haySiguiente } = paginacion(pagina, total);

  return (
    <section className="pagina pagina-anuncio pagina-centro" aria-labelledby="titulo-pagina">
      {esMiCentro(centro) && (
        <div className="perfil-banda centro-banda-propia" role="status">
          <p>{TEXTOS.bandaPropia}</p>
          <Link to="/perfil/editar" className="boton-enlace">{TEXTOS.editarPerfil}</Link>
        </div>
      )}

      <p className="centro-antetitulo">{TEXTOS.titulo}</p>
      <h1 id="titulo-pagina">{centro.nombre}</h1>
      {zona && <p className="perfil-ubicacion">{zona}</p>}
      <p className="perfil-desde">{textoAntiguedad(centro.creado_en)}</p>
      {/* [Depende de US-45] hueco para la puntuación del centro. */}

      <section className="perfil-bloque" aria-labelledby="titulo-sobre-nosotros">
        <h2 id="titulo-sobre-nosotros">{TEXTOS.sobreNosotros}</h2>
        {/* CA18: React escapa el texto (el HTML o un enlace se ven tal cual) y el CSS respeta los saltos de línea. */}
        {centro.descripcion
          ? <p className="perfil-descripcion">{centro.descripcion}</p>
          : <p className="perfil-vacio">{TEXTOS_PERFIL.sinDato}</p>}
      </section>

      <section className="perfil-bloque" aria-labelledby="titulo-contacto">
        <h2 id="titulo-contacto">{TEXTOS.contacto}</h2>
        {contacto.length === 0 ? (
          <p className="perfil-vacio">{TEXTOS.sinContacto}</p>
        ) : (
          <ul className="centro-contacto">
            {contacto.map((enlace) => (
              <li key={enlace.tipo}>
                {/* CA8: la web en pestaña nueva con rel="noopener noreferrer"; email con mailto: y teléfono con tel:. */}
                <a
                  href={enlace.href}
                  {...(enlace.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {enlace.texto}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="perfil-bloque" aria-labelledby="titulo-anuncios">
        <h2 id="titulo-anuncios">{tituloDeAnuncios(total)}</h2>
        {anuncios.length === 0 ? (
          <p className="perfil-vacio">{TEXTOS.sinAnuncios}</p>
        ) : (
          <ul className="centro-rejilla">
            {anuncios.map((anuncio) => <TarjetaAnuncioCentro key={anuncio.id} anuncio={anuncio} />)}
          </ul>
        )}
        {/* CA3 y CA17: «Anterior» deshabilitado en la 1 y «Siguiente» en la última; con una sola página no se ve. */}
        {paginas > 1 && (
          <nav className="centro-paginacion" aria-label="Páginas de anuncios">
            <button type="button" disabled={!hayAnterior} onClick={() => alCambiarDePagina(pagina - 1)}>
              {TEXTOS.anterior}
            </button>
            <span>Página {pagina} de {paginas}</span>
            <button type="button" disabled={!haySiguiente} onClick={() => alCambiarDePagina(pagina + 1)}>
              {TEXTOS.siguiente}
            </button>
          </nav>
        )}
      </section>
    </section>
  );
}

// CA9: centro inexistente, id que no es UUID o centro eliminado.
function CentroNoEncontrado() {
  return (
    <section className="pagina pagina-anuncio pagina-centro" aria-labelledby="titulo-pagina">
      <h1 id="titulo-pagina">{TEXTOS.noEncontradoTitulo}</h1>
      <p className="intro-text">{TEXTOS.noEncontradoTexto}</p>
      <Link to={RUTA_CATALOGO} className="boton-enlace">{TEXTOS.irAlCatalogo}</Link>
    </section>
  );
}
