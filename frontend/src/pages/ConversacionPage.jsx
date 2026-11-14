import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { enviarMensaje, obtenerConversacion } from '../api/mensajes.js';
import Aviso from '../components/Aviso.jsx';
import CabeceraAnuncioMensajes from '../components/CabeceraAnuncioMensajes.jsx';
import CuadroMensaje from '../components/CuadroMensaje.jsx';
import {
  bandaDeEstado,
  conMensajesAnteriores,
  conMensajesNuevos,
  fechaDelMensaje,
  otroCentro,
  REFRESCO_MS,
  resultadoDelFallo,
  TEXTOS,
  tituloConEnlace,
  ultimoId,
} from '../mensajes/conversacion.js';
import '../mensajes/mensajes.css';

// US-28 T28-3: /mensajes/:id · hilo de una conversación (también la usará US-77 para el vendedor).
export default function ConversacionPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  // CA16: «Mensaje enviado.» llega en `state.aviso` desde /mensajes/nueva.
  const [aviso, setAviso] = useState(() => location.state?.aviso ?? null);
  const cerrarAviso = useCallback(() => setAviso(null), []);
  const ultimo = useRef(null);
  const final = useRef(null);
  const bajarAlFinal = useRef(true);
  const clave = `${id}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    obtenerConversacion(id, { signal: control.signal })
      .then((datos) => {
        bajarAlFinal.current = true;
        setResultado({ clave, conversacion: datos.conversacion, hilo: datos.mensajes, hayAnteriores: datos.hay_anteriores });
      })
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, noExiste: fallo?.status === 404, error: fallo?.status !== 404 });
      });
    return () => control.abort();
  }, [id, clave]);

  const actual = resultado?.clave === clave ? resultado : null;
  const hilo = actual?.hilo;

  // El aviso se muestra una vez: se quita del historial para que no vuelva a salir al recargar.
  useEffect(() => {
    if (location.state?.aviso) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  // Último mensaje para el sondeo, y la vista baja al final tras cargar, enviar o recibir.
  useEffect(() => {
    ultimo.current = hilo ? ultimoId(hilo) : null;
    if (hilo && bajarAlFinal.current) {
      final.current?.scrollIntoView?.({ block: 'end' });
      bajarAlFinal.current = false;
    }
  }, [hilo]);

  // CA14: cada 15 s, con la pestaña visible, se piden los mensajes posteriores al último (sin tiempo real).
  const cargado = Boolean(hilo);
  useEffect(() => {
    if (!cargado) return undefined;
    const control = new AbortController();
    const temporizador = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      obtenerConversacion(id, { despues: ultimo.current ?? undefined, signal: control.signal })
        .then((datos) => {
          if (datos.mensajes.length > 0) bajarAlFinal.current = true;
          setResultado((anterior) => (anterior?.clave === clave ? {
            ...anterior, conversacion: datos.conversacion, hilo: conMensajesNuevos(anterior.hilo, datos.mensajes),
          } : anterior));
        })
        .catch(() => {});
    }, REFRESCO_MS);
    return () => {
      window.clearInterval(temporizador);
      control.abort();
    };
  }, [cargado, id, clave]);

  // CA22: «Ver mensajes anteriores» trae los 50 anteriores al primero del hilo.
  async function verAnteriores() {
    setCargandoAnteriores(true);
    try {
      const datos = await obtenerConversacion(id, { antes: hilo[0]?.id });
      setResultado((anterior) => ({
        ...anterior, hilo: conMensajesAnteriores(anterior.hilo, datos.mensajes), hayAnteriores: datos.hay_anteriores,
      }));
    } catch {
      setAviso({ tipo: 'error', texto: resultadoDelFallo(null).aviso });
    } finally {
      setCargandoAnteriores(false);
    }
  }

  // CA11, CA12 y CA17: se envía, se vacía el cuadro y el mensaje se añade al final sin recargar.
  async function enviar(valor) {
    setEnviando(true);
    try {
      const mensaje = await enviarMensaje(id, valor.trim());
      bajarAlFinal.current = true;
      setResultado((anterior) => ({ ...anterior, hilo: conMensajesNuevos(anterior.hilo, [mensaje]) }));
      setTexto('');
    } catch (fallo) {
      setAviso({ tipo: 'error', texto: resultadoDelFallo(fallo).aviso });
    } finally {
      setEnviando(false);
    }
  }

  // E2E-5: un tercer centro (o un id que no existe) ve «Esta conversación no existe.».
  if (actual?.noExiste) {
    return (
      <section className="pagina pagina-mensajes" aria-labelledby="titulo-pagina">
        <h1 id="titulo-pagina" className="mensajes-titulo">{TEXTOS.noExiste}</h1>
        <p><Link to="/mensajes">{TEXTOS.irAMensajes}</Link></p>
      </section>
    );
  }

  const conversacion = actual?.conversacion;
  const centro = conversacion ? otroCentro(conversacion.otro_centro) : null;
  const banda = conversacion ? bandaDeEstado(conversacion.anuncio.estado) : null;
  const vendedor = conversacion?.soy === 'comprador' ? centro?.nombre : null;

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina pagina-mensajes pagina-conversacion" aria-labelledby="titulo-pagina"
        aria-busy={!actual || undefined}>
        <Link to="/mensajes" className="enlace-volver">{TEXTOS.volverMensajes}</Link>
        {/* Pantalla «Conversación»: el título se ve desde el primer momento, también mientras carga. */}
        <h1 id="titulo-pagina" className="mensajes-titulo">{TEXTOS.conversacion}</h1>

        {!actual && <p className="intro-text" role="status">{TEXTOS.cargando}</p>}
        {actual?.error && (
          <div className="ficha-error">
            <p className="intro-text" role="alert">{TEXTOS.errorCarga}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)}>{TEXTOS.reintentar}</button>
          </div>
        )}

        {conversacion && (
          <>
            {/* Debajo del título, el otro centro: enlace a su perfil, o «Centro eliminado» sin enlace. */}
            <p className="mensajes-otro-centro">
              {centro.enlace ? <Link to={centro.enlace}>{centro.nombre}</Link> : centro.nombre}
            </p>
            <CabeceraAnuncioMensajes anuncio={conversacion.anuncio} vendedor={vendedor}
              conEnlace={tituloConEnlace(conversacion.anuncio.estado)} />
            {banda && <p className="franja-pausado mensajes-banda" role="status">{banda}</p>}

            <div className="mensajes-hilo">
              {actual.hayAnteriores && (
                <button type="button" className="boton-secundario mensajes-anteriores" disabled={cargandoAnteriores}
                  onClick={verAnteriores}>
                  {TEXTOS.verAnteriores}
                </button>
              )}
              <ol className="mensajes-lista" aria-label={TEXTOS.conversacion}>
                {hilo.map((mensaje) => (
                  <li key={mensaje.id} className={mensaje.es_mio ? 'mensaje mensaje-mio' : 'mensaje mensaje-otro'}>
                    {/* CA15: React escapa el texto (`<b>` se ve tal cual) y el CSS respeta los saltos de línea. */}
                    <p className="mensaje-texto">{mensaje.texto}</p>
                    <time className="mensaje-fecha" dateTime={mensaje.creado_en}>{fechaDelMensaje(mensaje)}</time>
                  </li>
                ))}
              </ol>
              <div ref={final} />
            </div>

            {/* CA35: si el otro centro ya no está, no se puede escribir. */}
            <div className="mensajes-pie">
              {conversacion.puede_escribir
                ? <CuadroMensaje valor={texto} onCambiar={setTexto} onEnviar={enviar} enviando={enviando} filas={3} />
                : <p className="franja-pausado">{TEXTOS.sinEscribir}</p>}
            </div>
          </>
        )}
      </section>
    </>
  );
}
