import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { obtenerAnuncioDelCatalogo } from '../api/anuncios.js';
import { conversacionDelAnuncio, crearConversacion } from '../api/mensajes.js';
import Aviso from '../components/Aviso.jsx';
import CabeceraAnuncioMensajes from '../components/CabeceraAnuncioMensajes.jsx';
import CuadroMensaje from '../components/CuadroMensaje.jsx';
import { anuncioAdmiteConversacion, resultadoDelFallo, TEXTOS, textoDeAyuda } from '../mensajes/conversacion.js';
import '../mensajes/mensajes.css';

// US-28 T28-3: /mensajes/nueva?anuncio=:id · primer mensaje sobre un anuncio de otro centro.
export default function MensajeNuevoPage() {
  const [parametros] = useSearchParams();
  const anuncioId = parametros.get('anuncio');
  const navigate = useNavigate();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);
  const clave = `${anuncioId}#${intento}`;

  useEffect(() => {
    if (!anuncioId) return undefined;
    const control = new AbortController();
    const opciones = { signal: control.signal };
    Promise.all([obtenerAnuncioDelCatalogo(anuncioId, opciones), conversacionDelAnuncio(anuncioId, opciones)])
      .then(([anuncio, conversacion]) => {
        // CA4: si ya hay conversación sobre el anuncio, se va a ella sin dejar /mensajes/nueva en el historial.
        if (conversacion) navigate(`/mensajes/${encodeURIComponent(conversacion.id)}`, { replace: true });
        else setResultado({ clave, anuncio });
      })
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, noDisponible: fallo?.status === 404, error: fallo?.status !== 404 });
      });
    return () => control.abort();
  }, [anuncioId, clave, navigate]);

  const actual = resultado?.clave === clave ? resultado : null;
  // CA5: sin `anuncio`, inexistente, propio o no disponible.
  const noDisponible = !anuncioId || actual?.noDisponible || (actual?.anuncio && !anuncioAdmiteConversacion(actual.anuncio));

  async function enviar(valor) {
    setEnviando(true);
    try {
      const { conversacion } = await crearConversacion({ anuncioId, texto: valor.trim() });
      // CA6 y CA16: aviso verde «Mensaje enviado.» y a la conversación, con el mensaje como último del hilo.
      navigate(`/mensajes/${encodeURIComponent(conversacion.id)}`, {
        state: { aviso: { tipo: 'exito', texto: TEXTOS.enviado } },
      });
    } catch (fallo) {
      const { ir, aviso: textoAviso } = resultadoDelFallo(fallo);
      if (ir) {
        navigate(ir, { replace: true });
        return;
      }
      // CA17 y CA18: aviso rojo y el texto se conserva.
      setAviso({ tipo: 'error', texto: textoAviso });
      setEnviando(false);
    }
  }

  if (noDisponible) {
    return (
      <section className="pagina pagina-mensajes" aria-labelledby="titulo-pagina">
        <h1 id="titulo-pagina" className="mensajes-titulo">{TEXTOS.anuncioNoDisponible}</h1>
        <p><Link to="/catalogo">{TEXTOS.irAlCatalogo}</Link></p>
      </section>
    );
  }

  const anuncio = actual?.anuncio;
  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina pagina-mensajes" aria-labelledby="titulo-pagina" aria-busy={!actual || undefined}>
        <Link to={`/anuncios/${encodeURIComponent(anuncioId)}`} className="enlace-volver">{TEXTOS.volverAnuncio}</Link>
        <h1 id="titulo-pagina" className="mensajes-titulo">{TEXTOS.nueva}</h1>

        {!actual && <p className="intro-text" role="status">{TEXTOS.cargando}</p>}
        {actual?.error && (
          <div className="ficha-error">
            <p className="intro-text" role="alert">{TEXTOS.errorCarga}</p>
            <button type="button" className="s2-boton" onClick={() => setIntento((n) => n + 1)}>{TEXTOS.reintentar}</button>
          </div>
        )}

        {anuncio && (
          <>
            <CabeceraAnuncioMensajes anuncio={anuncio} vendedor={anuncio.centro?.nombre} />
            <CuadroMensaje valor={texto} onCambiar={setTexto} onEnviar={enviar} enviando={enviando} filas={5}
              ayuda={textoDeAyuda(anuncio.centro?.nombre)} />
          </>
        )}
      </section>
    </>
  );
}
