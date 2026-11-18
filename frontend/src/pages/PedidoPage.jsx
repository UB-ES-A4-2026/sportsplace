import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import AccionesCierrePedido from '../components/AccionesCierrePedido.jsx';
import Aviso from '../components/Aviso.jsx';
import EtiquetaPagado from '../components/EtiquetaPagado.jsx';
import { obtenerPedido } from '../pedidos/api.js';
import { lineaRecibido } from '../pedidos/cierre.js';
import {
  anuncioRetirado,
  datosDeEntrega,
  datosDelOtroCentro,
  datosDelPedido,
  etiquetaDelEstado,
  fraseDeSituacion,
  historial,
  resultadoDeLaCarga,
  rutaDeVuelta,
  TEXTOS,
} from '../pedidos/detalle.js';
import '../anuncios/anuncios.css';
import '../pedidos/pedido.css';

// E06 US-108 (T32-5): /pedidos/:id · «Pedido de <título>». Privada (CA1, la protege RutaPrivada).
// Secciones en el orden del boceto: volver, estado, frase, anuncio, datos, otro centro, entrega (US-40), historial.
// US-80 y US-42 (AccionesCierrePedido): «Marcar como cobrado» en la barra de acciones y «He recibido el material»
// al final de la sección «Entrega», con «Recibido el …» (US-42). La etiqueta «Pagado» es EtiquetaPagado.
// La sección «Motivo» y Aceptar/Rechazar (US-33, US-79) se montan al integrar US-33.
// El aviso verde «Pedido enviado. El vendedor lo revisará.» llega en `location.state.aviso` desde «Pedir» (US-32 CA14).
export default function PedidoPage() {
  const { id } = useParams();
  const location = useLocation();
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [aviso, setAviso] = useState(() => location.state?.aviso ?? null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Cada carga se identifica por id + intento: mientras no llega su resultado, se muestra «Cargando…» (CA4).
  const clave = `${id}#${intento}`;

  useEffect(() => {
    const control = new AbortController();
    obtenerPedido(id, { signal: control.signal })
      .then((pedido) => setResultado({ clave, pedido }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, ...resultadoDeLaCarga(fallo) });
      });
    return () => control.abort();
  }, [id, clave]);

  const actual = resultado?.clave === clave ? resultado : null;

  if (actual?.noEncontrado) {
    return (
      <section className="pagina" aria-labelledby="titulo-pedido">
        <h1 id="titulo-pedido">Pedido</h1>
        <p className="intro-text" role="alert">{TEXTOS.sinAcceso}</p>
        <Link to="/pedidos" className="boton-enlace">{TEXTOS.irAPedidos}</Link>
      </section>
    );
  }

  if (!actual?.pedido) {
    return (
      <section className="pagina" aria-busy={!actual || undefined}>
        {!actual && <p className="intro-text" role="status">{TEXTOS.cargando}</p>}
        {actual?.error && (
          <div className="ficha-error">
            <p className="intro-text" role="alert">{TEXTOS.error}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)}>{TEXTOS.reintentar}</button>
          </div>
        )}
      </section>
    );
  }

  // Tras una acción, la pantalla se actualiza con el pedido que devuelve la API (US-80 CA2, US-42 CA4). Ante un 409,
  // aviso rojo con el `message` y se recarga el pedido para ver su estado real.
  const actualizar = (pedido) => setResultado({ clave, pedido });
  function mostrarFallo(fallo) {
    if (fallo.noEncontrado) {
      setResultado({ clave, noEncontrado: true });
      return;
    }
    setAviso({ tipo: 'error', texto: fallo.mensaje });
    if (fallo.recargar) setIntento((n) => n + 1);
  }

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <DetallePedido pedido={actual.pedido} onActualizado={actualizar} onAviso={setAviso} onFallo={mostrarFallo} />
    </>
  );
}

function DetallePedido({ pedido, onActualizado, onAviso, onFallo }) {
  const acciones = { onActualizado, onAviso, onFallo };
  const estado = etiquetaDelEstado(pedido.estado);
  const otro = datosDelOtroCentro(pedido);
  const entrega = datosDeEntrega(pedido);
  const retirado = anuncioRetirado(pedido);

  return (
    <section className="pagina pagina-pedido" aria-labelledby="titulo-pedido">
      <Link to={rutaDeVuelta(pedido)} className="enlace-volver">{TEXTOS.volver}</Link>

      <h1 id="titulo-pedido">Pedido de {pedido.anuncio.titulo}</h1>
      <p className="pedido-estado">
        <span className={`etiqueta-estado ${estado.clase}`}>{estado.texto}</span>
        <EtiquetaPagado pedido={pedido} />
      </p>
      <p className="pedido-frase">{fraseDeSituacion(pedido)}</p>

      <div className="pedido-anuncio">
        {pedido.anuncio.foto_principal_url
          ? <img src={pedido.anuncio.foto_principal_url} alt="" />
          : <span className="pedido-anuncio-sin-foto">Sin foto</span>}
        <div>
          {retirado
            ? <p className="pedido-anuncio-titulo">{pedido.anuncio.titulo} {TEXTOS.anuncioRetirado}</p>
            : <Link to={`/anuncios/${encodeURIComponent(pedido.anuncio.id)}`} className="pedido-anuncio-titulo">{pedido.anuncio.titulo}</Link>}
          <p className="pedido-anuncio-modalidad">{pedido.modalidad === 'venta' ? 'Venta' : 'Donación'}</p>
        </div>
      </div>

      <section className="pedido-seccion" aria-labelledby="titulo-datos">
        <h2 id="titulo-datos">Datos del pedido</h2>
        {datosDelPedido(pedido).map(({ etiqueta, valor }) => (
          <p key={etiqueta ?? valor}>{etiqueta ? `${etiqueta}: ${valor}` : valor}</p>
        ))}
      </section>

      {entrega && (
        <section className="pedido-seccion" aria-labelledby="titulo-entrega">
          <h2 id="titulo-entrega">Entrega</h2>
          <p>{entrega.metodo}</p>
          {entrega.lineas.map((linea) => <p key={linea}>{linea}</p>)}
          {entrega.aviso && <p className="pedido-entrega-aviso">{entrega.aviso}</p>}
          {entrega.escribir && (
            <Link to={`/mensajes/nueva?anuncio=${encodeURIComponent(pedido.anuncio.id)}`}>{TEXTOS.escribirVendedor}</Link>
          )}
          {lineaRecibido(pedido) && <p>{lineaRecibido(pedido)}</p>}
          <AccionesCierrePedido pedido={pedido} solo="recibir" {...acciones} />
        </section>
      )}

      <section className="pedido-seccion" aria-labelledby="titulo-otro">
        <h2 id="titulo-otro">{otro.titulo}</h2>
        {otro.lineas.map((linea) => <p key={linea}>{linea}</p>)}
      </section>

      <section className="pedido-seccion" aria-labelledby="titulo-historial">
        <h2 id="titulo-historial">Historial</h2>
        <ul className="pedido-historial">
          {historial(pedido).map((linea) => <li key={linea}>{linea}</li>)}
        </ul>
      </section>

      <div className="pedido-acciones">
        <AccionesCierrePedido pedido={pedido} solo="marcar_pagado" {...acciones} />
      </div>
    </section>
  );
}
