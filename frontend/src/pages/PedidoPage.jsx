import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ban, Banknote, Check, Clock, Package, PackageCheck, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import AccionesCierrePedido from '../components/AccionesCierrePedido.jsx';
import Aviso from '../components/Aviso.jsx';
import EtiquetaPagado from '../components/EtiquetaPagado.jsx';
import PanelPedidoVendedor from '../components/PanelPedidoVendedor.jsx';
import SeguimientoPedido from '../components/SeguimientoPedido.jsx';
import { obtenerPedido } from '../pedidos/api.js';
import { lineaRecibido } from '../pedidos/cierre.js';
import {
  anuncioRetirado,
  datosDeEntrega,
  datosDelOtroCentro,
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
  notaDelContacto,
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

// Icono de la pastilla de estado (decorativo: el texto ya dice el estado).
const ICONOS_ESTADO = { pendiente: Clock, aceptado: Check, rechazado: X, cancelado: Ban, recibido: PackageCheck };

// Dos vistas según `pedido.mi_papel`, con la maquetación de la imagen de referencia de Lucía (vendedor con el pedido
// pendiente). Arriba, en una fila, «← Volver a pedidos», el título y el estado en pastilla (con «Pagado»). Debajo, dos
// columnas que empiezan a la misma altura:
// - izquierda (ancha): el panel de la situación (el del vendedor o el seguimiento del comprador), la tarjeta de cobro de
//   US-80 y la tarjeta del anuncio con «Datos del pedido» en baldosas;
// - derecha (360 px): el otro centro, la entrega (US-40, con «Recibido el …» de US-42) y el historial.
// El orden del DOM es el visual (WCAG 2.4.3); en móvil, una columna en ese mismo orden.
function DetallePedido({ pedido, acciones }) {
  const vendedor = esVendedor(pedido);
  const entrega = datosDeEntrega(pedido);
  const estado = etiquetaDelEstado(pedido.estado);
  const IconoEstado = ICONOS_ESTADO[pedido.estado] ?? Clock;

  return (
    <section className={`pagina pagina-pedido pedido--${colorDelEstado(pedido.estado)}`} aria-labelledby="titulo-pedido">
      <div className="pedido-cabecera">
        {/* La flecha se ve como icono; «←» sigue en el nombre accesible del enlace (CA2), solo para el lector. */}
        <Link to={rutaDeVuelta(pedido)} className="enlace-volver">
          <ArrowLeft size={18} strokeWidth={3} aria-hidden="true" />
          <span className="s2-solo-lectores">{TEXTOS.volver.slice(0, 2)}</span>
          {TEXTOS.volver.slice(2)}
        </Link>
        <h1 id="titulo-pedido">Pedido de {pedido.anuncio.titulo}</h1>
        <p className="pedido-estado">
          <span className="pedido-etiqueta-estado">
            <IconoEstado size={16} strokeWidth={2.8} aria-hidden="true" />
            {estado.texto}
          </span>
          <EtiquetaPagado pedido={pedido} />
        </p>
      </div>

      <div className="pedido-columnas">
        <div className="pedido-columna pedido-columna--principal">
          {vendedor ? <PanelPedidoVendedor pedido={pedido} acciones={acciones} /> : <SeguimientoPedido pedido={pedido} acciones={acciones} />}
          {vendedor && puedeCobrar(pedido) && <TarjetaCobro pedido={pedido} acciones={acciones} />}
          <DatosDelPedido pedido={pedido} />
        </div>

        <div className="pedido-columna pedido-columna--lateral">
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

// Tarjeta del anuncio y «Datos del pedido» (puntos 4 y 5): arriba el anuncio (foto pequeña o, sin foto, un icono;
// título con enlace salvo retirado, CA8; y modalidad), después el título y los datos en baldosas de 3 columnas, con el
// total en verde y el mensaje del comprador entre comillas (o «Sin mensaje»).
function DatosDelPedido({ pedido }) {
  const { anuncio } = pedido;
  return (
    <section className="pedido-tarjeta pedido-datos" aria-labelledby="titulo-datos">
      <div className="pedido-anuncio">
        <span className="pedido-anuncio-miniatura" aria-hidden="true">
          {anuncio.foto_principal_url
            ? <img src={anuncio.foto_principal_url} alt="" />
            : <span className="pedido-anuncio-icono"><Package size={20} strokeWidth={2.4} /></span>}
        </span>
        <div className="pedido-anuncio-textos">
          {anuncioRetirado(pedido)
            ? <p className="pedido-anuncio-titulo">{anuncio.titulo} {TEXTOS.anuncioRetirado}</p>
            : <Link to={`/anuncios/${encodeURIComponent(anuncio.id)}`} className="pedido-anuncio-titulo">{anuncio.titulo}</Link>}
          <p className="pedido-anuncio-modalidad">{pedido.modalidad === 'venta' ? 'Venta' : 'Donación'}</p>
        </div>
      </div>
      <h2 id="titulo-datos" className="pedido-tarjeta-titulo">Datos del pedido</h2>
      <dl className="pedido-baldosas">
        {baldosasDelPedido(pedido).map(({ clave, etiqueta, valor, tipo, ancho, vacio }) => (
          <div key={clave} className={`pedido-baldosa pedido-baldosa--${tipo} pedido-baldosa--ancho-${ancho}`}>
            {etiqueta && <dt>{etiqueta}</dt>}
            <dd>
              {tipo === 'mensaje' && !vacio
                ? <q className="pedido-baldosa-cita">{valor}</q>
                : <span className={vacio ? 'pedido-baldosa-vacia' : undefined}>{valor}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// «Comprador» o «Vendedor» (punto 6): círculo con las iniciales, el nombre en negrita y la localidad debajo. Mientras
// está pendiente, la nota de cuándo se verá el contacto; el email y el teléfono, cuando toca (CA7), van en el panel.
function OtroCentro({ pedido }) {
  const otro = datosDelOtroCentro(pedido);
  const nota = notaDelContacto(pedido);
  return (
    <section className="pedido-tarjeta" aria-labelledby="titulo-otro">
      <h2 id="titulo-otro" className="pedido-tarjeta-titulo">{otro.titulo}</h2>
      <div className="pedido-centro">
        <span className={`pedido-avatar pedido-avatar--${esVendedor(pedido) ? 'comprador' : 'vendedor'}`} aria-hidden="true">
          {inicialesDe(otro.nombre)}
        </span>
        <div className="pedido-centro-textos">
          <p className="pedido-centro-nombre">{otro.nombre}</p>
          {otro.localidad && <p className="pedido-centro-localidad">{otro.localidad}</p>}
        </div>
      </div>
      {nota && <p className="pedido-centro-nota">{nota}</p>}
    </section>
  );
}

// «Entrega» (US-40): el método en negrita, la dirección en un recuadro gris, las indicaciones debajo y, al final,
// «Recibido el …» (US-42).
function Entrega({ pedido, entrega }) {
  const recibido = lineaRecibido(pedido);
  return (
    <section className="pedido-tarjeta" aria-labelledby="titulo-entrega">
      <h2 id="titulo-entrega" className="pedido-tarjeta-titulo">Entrega</h2>
      <p className="pedido-entrega-metodo">{entrega.metodo}</p>
      {entrega.lineas.length > 0 && (
        <div className="pedido-entrega-direccion">
          {entrega.lineas.map((linea) => <p key={linea}>{linea}</p>)}
        </div>
      )}
      {entrega.indicaciones && <p className="pedido-entrega-indicaciones">{entrega.indicaciones}</p>}
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
