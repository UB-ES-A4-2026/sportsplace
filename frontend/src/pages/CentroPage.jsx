import { CalendarDays, ExternalLink, Eye, Globe, Info, Mail, MapPin, MessageSquare, Pencil, Phone } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { listarAnunciosDelCentro, obtenerCentro } from '../api/centros.js';
import TarjetaAnuncioCentro from '../components/TarjetaAnuncioCentro.jsx';
import { IconoDeporte } from '../diseno/IconoDeporte.jsx';
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
import { inicialesDe } from '../utilidades/iniciales.js';

// Icono decorativo y etiqueta de cada dato de contacto (el texto del enlace es el dato; la etiqueta va fuera de él).
const CONTACTO = {
  telefono: { Icono: Phone, etiqueta: 'Teléfono' },
  email: { Icono: Mail, etiqueta: 'Email de contacto' },
  web: { Icono: Globe, etiqueta: 'Web' },
};

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

// Diseño con vida (#361, mockup «Centro» de Lucía): franja de campo con las iniciales grandes, el nombre y las pastillas
// «Zona» y «En Sportsplace desde»; debajo, «Sobre nosotros» y «Contacto» en tarjetas a la izquierda y «Anuncios
// activos (n)» con las tarjetas del catálogo a la derecha.
function PerfilDeCentro({ centro, lista, pagina, alCambiarDePagina }) {
  const zona = zonaDelCentro(centro);
  const contacto = enlacesDeContacto(centro);
  const anuncios = lista?.anuncios ?? [];
  const total = lista?.total ?? 0;
  const { paginas, hayAnterior, haySiguiente } = paginacion(pagina, total);

  return (
    <section className="pagina pagina-anuncio pagina-centro" aria-labelledby="titulo-pagina">
      {/* Banda amarilla encima de la franja: así ve el propio centro su perfil público. */}
      {esMiCentro(centro) && (
        <div className="perfil-banda centro-banda-propia" role="status">
          <p><Eye size={24} strokeWidth={2.4} aria-hidden="true" />{TEXTOS.bandaPropia}</p>
          <Link to="/perfil/editar" className="boton-enlace">
            <Pencil size={20} strokeWidth={2.6} aria-hidden="true" />{TEXTOS.editarPerfil}
          </Link>
        </div>
      )}

      {/* Franja de campo a todo el ancho con las iniciales del centro (decorativas: el nombre va al lado). */}
      <div className="perfil-portada s2-campo">
        <span className="s2-campo-circulo" aria-hidden="true" />
        <span className="s2-campo-area s2-campo-area--der" aria-hidden="true" />
        <div className="perfil-portada-datos">
          <span className="perfil-avatar" aria-hidden="true">{inicialesDe(centro.nombre)}</span>
          <div className="perfil-portada-texto">
            <p className="centro-antetitulo">{TEXTOS.titulo}</p>
            <h1 id="titulo-pagina">{centro.nombre}</h1>
            <div className="perfil-meta">
              {zona && <p className="perfil-ubicacion"><MapPin size={18} strokeWidth={2.6} aria-hidden="true" />{zona}</p>}
              <p className="perfil-desde"><CalendarDays size={18} strokeWidth={2.6} aria-hidden="true" />{textoAntiguedad(centro.creado_en)}</p>
            </div>
          </div>
        </div>
      </div>
      {/* [Depende de US-45] hueco para la puntuación del centro. */}

      <div className="centro-cuerpo">
        <div className="perfil-rejilla">
          <section className="perfil-bloque" aria-labelledby="titulo-sobre-nosotros">
            <h2 id="titulo-sobre-nosotros">
              <span className="perfil-bloque-icono" aria-hidden="true"><Info size={20} strokeWidth={2.6} /></span>
              {TEXTOS.sobreNosotros}
            </h2>
            {/* CA18: React escapa el texto (el HTML o un enlace se ven tal cual) y el CSS respeta los saltos de línea. */}
            {centro.descripcion
              ? <p className="perfil-descripcion">{centro.descripcion}</p>
              : <p className="perfil-vacio">{TEXTOS_PERFIL.sinDato}</p>}
          </section>

          <section className="perfil-bloque" aria-labelledby="titulo-contacto">
            <h2 id="titulo-contacto">
              <span className="perfil-bloque-icono" aria-hidden="true"><MessageSquare size={20} strokeWidth={2.6} /></span>
              {TEXTOS.contacto}
            </h2>
            {contacto.length === 0 ? (
              <p className="perfil-vacio perfil-vacio-caja">{TEXTOS.sinContacto}</p>
            ) : (
              <ul className="centro-contacto">
                {contacto.map((enlace) => (
                  <li key={enlace.tipo} className={`centro-contacto-${enlace.tipo}`}>
                    <ContactoIcono tipo={enlace.tipo} />
                    <span className="centro-contacto-texto">
                      <span className="centro-contacto-etiqueta">{CONTACTO[enlace.tipo].etiqueta}</span>
                      {/* CA8: la web en pestaña nueva con rel="noopener noreferrer"; email con mailto: y teléfono con
                          tel:. El enlace cubre toda la fila (::after), pero su nombre sigue siendo el dato. */}
                      <a
                        href={enlace.href}
                        {...(enlace.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      >
                        {enlace.tipo === 'telefono' ? enlace.texto : conCortes(enlace.texto)}
                        {enlace.externo && <ExternalLink size={16} strokeWidth={2.6} aria-hidden="true" />}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="perfil-bloque-anuncios" aria-labelledby="titulo-anuncios">
          <h2 id="titulo-anuncios">{tituloDeAnuncios(total)}</h2>
          {anuncios.length === 0 ? (
            <div className="centro-sin-anuncios">
              <span className="centro-sin-anuncios-icono" aria-hidden="true"><IconoDeporte nombre="balon" tamano={48} /></span>
              <p className="perfil-vacio">{TEXTOS.sinAnuncios}</p>
            </div>
          ) : (
            <ul className="centro-rejilla">
              {anuncios.map((anuncio) => <TarjetaAnuncioCentro key={anuncio.id} anuncio={anuncio} />)}
            </ul>
          )}
          {/* CA3 y CA17: «Anterior» deshabilitado en la 1 y «Siguiente» en la última; con una sola página no se ve. */}
          {paginas > 1 && (
            <nav className="centro-paginacion" aria-label="Páginas de anuncios">
              <button type="button" className="s2-boton s2-boton-secundario" disabled={!hayAnterior}
                onClick={() => alCambiarDePagina(pagina - 1)}>
                {TEXTOS.anterior}
              </button>
              <span>Página {pagina} de {paginas}</span>
              <button type="button" className="s2-boton s2-boton-secundario" disabled={!haySiguiente}
                onClick={() => alCambiarDePagina(pagina + 1)}>
                {TEXTOS.siguiente}
              </button>
            </nav>
          )}
        </section>
      </div>
    </section>
  );
}

// El email y la web pueden no caber en la columna: se dejan cortar tras «@», «.» y «/» (<wbr>, que no añade texto ni
// cambia el nombre del enlace) en lugar de a mitad de palabra.
function conCortes(texto) {
  return texto.split(/(?<=[@./])/).map((trozo, i) => (i === 0 ? trozo : <Fragment key={i}><wbr />{trozo}</Fragment>));
}

function ContactoIcono({ tipo }) {
  const { Icono } = CONTACTO[tipo];
  return <span className="centro-contacto-icono" aria-hidden="true"><Icono size={22} strokeWidth={2.4} /></span>;
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
