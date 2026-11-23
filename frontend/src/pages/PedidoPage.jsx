import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Check } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import AccionesCierrePedido from '../components/AccionesCierrePedido.jsx';
import Aviso from '../components/Aviso.jsx';
import ContactoPedido from '../components/ContactoPedido.jsx';
import EtiquetaPagado from '../components/EtiquetaPagado.jsx';
import PanelPedidoVendedor from '../components/PanelPedidoVendedor.jsx';
import SeguimientoPedido from '../components/SeguimientoPedido.jsx';
import { obtenerPedido } from '../pedidos/api.js';
import { lineaRecibido } from '../pedidos/cierre.js';
import {
  anuncioRetirado,
  datosDeEntrega,
  datosDelOtroCentro,
  datosDelPedido,
  etiquetaDelEstado,
  lineasDelHistorial,
  resultadoDeLaCarga,
  rutaDeVuelta,
  TEXTOS,
} from '../pedidos/detalle.js';
import {
  baldosasDelPedido,
  colorDelEstado,
  esVendedor,
  etiquetaDelPapel,
  lugarDelContacto,
  mensajeDelComprador,
  puedeCobrar,
  TEXTOS_VISTA,
} from '../pedidos/vistas.js';
import { inicialesDe } from '../utilidades/iniciales.js';
import '../anuncios/anuncios.css';
import '../pedidos/pedido.css';

// E06 US-108 (T32-5): /pedidos/:id · «Pedido de <título>». Privada (CA1, la protege RutaPrivada).
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

  // Tras una acción, la pantalla se actualiza con el pedido que devuelve la API (US-33 CA4, US-79 CA4, US-80 CA2,
  // US-42 CA4). Ante un 409, aviso rojo con el `message` y se recarga el pedido para ver su estado real (US-33 CA9, CA11).
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
      <DetallePedido pedido={actual.pedido} acciones={{ onActualizado: actualizar, onAviso: setAviso, onFallo: mostrarFallo }} />
    </>
  );
}

// Dos vistas según `pedido.mi_papel` (diseño con vida de Lucía, #361): «Pedido recibido» para el vendedor y «Pedido
// realizado» para el comprador. Arriba, «← Volver a pedidos», la etiqueta del papel, el título y el estado con
// «Pagado». Debajo, dos columnas: a la izquierda lo que toca hacer (el panel del vendedor o el seguimiento del comprador,
// la tarjeta de cobro de US-80 y el mensaje del comprador) y a la derecha los datos, el otro centro, la entrega (US-40,
// con «Recibido el …» de US-42) y el historial. El orden del DOM es el visual (WCAG 2.4.3); en móvil, una columna.
function DetallePedido({ pedido, acciones }) {
  const vendedor = esVendedor(pedido);
  const papel = etiquetaDelPapel(pedido);
  const IconoPapel = vendedor ? ArrowDownToLine : ArrowUpFromLine;
  const entrega = datosDeEntrega(pedido);

  return (
    <section className={`pagina pagina-pedido pedido--${colorDelEstado(pedido.estado)}`} aria-labelledby="titulo-pedido">
      <div className="pedido-cabecera">
        <Link to={rutaDeVuelta(pedido)} className="enlace-volver">{TEXTOS.volver}</Link>
        <span className={`pedido-papel pedido-papel--${papel.clase}`}>
          <IconoPapel size={16} strokeWidth={2.8} aria-hidden="true" />
          {papel.texto}
        </span>
        <h1 id="titulo-pedido">Pedido de {pedido.anuncio.titulo}</h1>
        <p className="pedido-estado">
          <span className="pedido-etiqueta-estado">{etiquetaDelEstado(pedido.estado).texto}</span>
          <EtiquetaPagado pedido={pedido} />
        </p>
      </div>

      <div className="pedido-columnas">
        <div className="pedido-columna pedido-columna--principal">
          {vendedor ? <PanelPedidoVendedor pedido={pedido} acciones={acciones} /> : <SeguimientoPedido pedido={pedido} acciones={acciones} />}
          {vendedor && puedeCobrar(pedido) && <TarjetaCobro pedido={pedido} acciones={acciones} />}
          <MensajeDelComprador pedido={pedido} />
        </div>

        <div className="pedido-columna pedido-columna--datos">
          <DatosDelPedido pedido={pedido} />
          <OtroCentro pedido={pedido} />
          {entrega && <Entrega pedido={pedido} entrega={entrega} />}
          <section className="pedido-tarjeta" aria-labelledby="titulo-historial">
            <h2 id="titulo-historial" className="pedido-tarjeta-titulo">Historial</h2>
            <ol className="pedido-historial">
              {lineasDelHistorial(pedido).map(({ tipo, texto }) => (
                <li key={texto} className={`pedido-historial-linea pedido-historial-linea--${tipo}`}>{texto}</li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </section>
  );
}

// US-80: tarjeta de cobro del vendedor con «Marcar como cobrado», mientras `acciones` lo traiga (venta aceptada o
// recibida y sin cobrar).
function TarjetaCobro({ pedido, acciones }) {
  return (
    <section className="pedido-tarjeta pedido-cobro" aria-labelledby="titulo-cobro">
      <span className="pedido-cobro-icono" aria-hidden="true"><Banknote size={24} strokeWidth={2.4} /></span>
      <div className="pedido-cobro-textos">
        <h2 id="titulo-cobro" className="pedido-tarjeta-titulo">{TEXTOS_VISTA.cobroTitulo}</h2>
        <p>{TEXTOS_VISTA.cobroAyuda}</p>
      </div>
      <AccionesCierrePedido pedido={pedido} solo="marcar_pagado" {...acciones} />
    </section>
  );
}

// «Mensaje del comprador» (punto 5) como bocadillo de chat: a la izquierda con sus iniciales para el vendedor y a la
// derecha, en azul, para el comprador (es su propio mensaje).
function MensajeDelComprador({ pedido }) {
  const vendedor = esVendedor(pedido);
  const mensaje = mensajeDelComprador(pedido);
  return (
    <section className={`pedido-tarjeta pedido-mensaje${vendedor ? '' : ' pedido-mensaje--propio'}`} aria-labelledby="titulo-mensaje">
      {vendedor && <span className="pedido-avatar" aria-hidden="true">{inicialesDe(pedido.comprador.nombre)}</span>}
      <div className="pedido-mensaje-cuerpo">
        <h2 id="titulo-mensaje" className="pedido-tarjeta-titulo">{TEXTOS.mensajeComprador}</h2>
        <p className={mensaje.vacio ? 'pedido-mensaje-vacio' : 'pedido-bocadillo'}>{mensaje.texto}</p>
      </div>
    </section>
  );
}

// «Datos del pedido» (puntos 4 y 5): el anuncio (foto, título con enlace salvo retirado, CA8, y modalidad) y los datos en
// baldosas, con el total en verde.
function DatosDelPedido({ pedido }) {
  const { anuncio } = pedido;
  const { baldosas, sueltas } = baldosasDelPedido(datosDelPedido(pedido));
  return (
    <section className="pedido-tarjeta" aria-labelledby="titulo-datos">
      <h2 id="titulo-datos" className="pedido-tarjeta-titulo">Datos del pedido</h2>
      <div className="pedido-anuncio">
        {anuncio.foto_principal_url
          ? <img src={anuncio.foto_principal_url} alt="" />
          : <span className="pedido-anuncio-sin-foto">Sin foto</span>}
        <div className="pedido-anuncio-textos">
          {anuncioRetirado(pedido)
            ? <p className="pedido-anuncio-titulo">{anuncio.titulo} {TEXTOS.anuncioRetirado}</p>
            : <Link to={`/anuncios/${encodeURIComponent(anuncio.id)}`} className="pedido-anuncio-titulo">{anuncio.titulo}</Link>}
          <p className="pedido-anuncio-modalidad">{pedido.modalidad === 'venta' ? 'Venta' : 'Donación'}</p>
        </div>
      </div>
      {baldosas.length > 0 && (
        <dl className="pedido-baldosas">
          {baldosas.map(({ etiqueta, valor, destacada }) => (
            <div key={etiqueta} className={destacada ? 'pedido-baldosa pedido-baldosa--total' : 'pedido-baldosa'}>
              <dt>{etiqueta}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {sueltas.map((texto) => <p key={texto} className="pedido-baldosa pedido-baldosa--total pedido-baldosa--suelta">{texto}</p>)}
    </section>
  );
}

// «Comprador» o «Vendedor» (punto 6): nombre y localidad. El email y el teléfono van en el panel de arriba; solo el
// vendedor de un pedido recibido los tiene aquí (CA7: nunca en pendiente, rechazado o cancelado).
function OtroCentro({ pedido }) {
  const otro = datosDelOtroCentro(pedido);
  return (
    <section className="pedido-tarjeta" aria-labelledby="titulo-otro">
      <h2 id="titulo-otro" className="pedido-tarjeta-titulo">{otro.titulo}</h2>
      <p className="pedido-centro">
        <strong>{otro.nombre}</strong>
        {otro.localidad && (
          <span className="pedido-centro-localidad"><span aria-hidden="true"> · </span>{otro.localidad}</span>
        )}
      </p>
      {lugarDelContacto(pedido) === 'tarjeta' && <ContactoPedido contacto={otro.contacto} enLinea />}
    </section>
  );
}

// «Entrega» (US-40) con «Recibido el …» al final (US-42).
function Entrega({ pedido, entrega }) {
  const recibido = lineaRecibido(pedido);
  return (
    <section className="pedido-tarjeta" aria-labelledby="titulo-entrega">
      <h2 id="titulo-entrega" className="pedido-tarjeta-titulo">Entrega</h2>
      <p className="pedido-entrega-metodo">{entrega.metodo}</p>
      {entrega.lineas.map((linea) => <p key={linea} className="pedido-entrega-linea">{linea}</p>)}
      {entrega.aviso && <p className="pedido-entrega-aviso">{entrega.aviso}</p>}
      {entrega.escribir && (
        <Link to={`/mensajes/nueva?anuncio=${encodeURIComponent(pedido.anuncio.id)}`} className="pedido-entrega-escribir">
          {TEXTOS.escribirVendedor}
        </Link>
      )}
      {recibido && (
        <p className="pedido-entrega-recibido">
          <Check size={16} strokeWidth={3} aria-hidden="true" />
          {recibido}
        </p>
      )}
    </section>
  );
}
