// Pantalla /pedidos/:id (E06 US-108, con la fila de US-35 y la sección «Entrega» de US-40). Funciones puras para
// probarlas sin navegador; las usa PedidoPage.
import { formatearFechaHora } from '../anuncios/ficha.js';
import { formatearEuros } from '../utilidades/euros.js';

export const TEXTOS = {
  cargando: 'Cargando…',
  error: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
  sinAcceso: 'Este pedido no existe o no tienes acceso.', // CA3
  irAPedidos: 'Ir a pedidos',
  volver: '← Volver a pedidos',
  sinMensaje: 'Sin mensaje',
  donacion: 'Donación: sin coste',
  anuncioRetirado: '(anuncio retirado)',
  esperaRecogida: 'Verás la dirección de recogida cuando el vendedor acepte el pedido.', // US-40 CA15
  sinDireccion: 'El vendedor aún no ha indicado su dirección. Escríbele para acordarla.', // US-40 CA14
  escribirVendedor: 'Escribir al vendedor',
  mensajeComprador: 'Mensaje del comprador',
};

// E06 «Etiquetas de estado en la web».
export const ETIQUETAS_ESTADO = {
  pendiente: { texto: 'Pendiente', clase: 'etiqueta-amarilla' },
  aceptado: { texto: 'Aceptado', clase: 'etiqueta-verde' },
  rechazado: { texto: 'Rechazado', clase: 'etiqueta-roja' },
  cancelado: { texto: 'Cancelado', clase: 'etiqueta-gris' },
  recibido: { texto: 'Recibido', clase: 'etiqueta-azul' },
};

export function etiquetaDelEstado(estado) {
  return ETIQUETAS_ESTADO[estado] ?? { texto: estado, clase: 'etiqueta-gris' };
}

// E06 US-35: texto de la forma de pago.
export const FORMAS_DE_PAGO = { transferencia: 'Transferencia bancaria', efectivo_recogida: 'Efectivo al recoger' };

const otroCentro = (pedido) => (pedido.mi_papel === 'comprador' ? pedido.vendedor : pedido.comprador);

// CA2: «← Volver a pedidos» abre la pestaña según mi papel.
export function rutaDeVuelta(pedido) {
  return pedido?.mi_papel === 'vendedor' ? '/pedidos?pestana=recibidos' : '/pedidos?pestana=realizados';
}

// CA5: frase de situación según el estado y el papel.
export function fraseDeSituacion(pedido) {
  const { estado, mi_papel: papel, comprador, vendedor } = pedido;
  if (estado === 'pendiente') {
    return papel === 'vendedor'
      ? `${comprador.nombre} te ha pedido este material. Acepta o rechaza el pedido.`
      : `Esperando la respuesta de ${vendedor.nombre}.`;
  }
  // T32-7 (decisión de la PO, 17/11): en una donación no hay pago que acordar.
  if (estado === 'aceptado') {
    return pedido.modalidad === 'donacion' ? 'Pedido aceptado. Acordad la entrega.' : 'Pedido aceptado. Acordad la entrega y el pago.';
  }
  if (estado === 'rechazado') return `${vendedor.nombre} ha rechazado el pedido.`;
  if (estado === 'cancelado') {
    const quien = pedido.cerrado_por === 'vendedor' ? vendedor.nombre : comprador.nombre;
    return `Pedido cancelado por ${quien}.`;
  }
  if (estado === 'recibido') return 'Material recibido.'; // T32-7
  return null;
}

// CA8: el título enlaza a /anuncios/:id mientras el anuncio siga existiendo; retirado, sin enlace y con la marca.
export function anuncioRetirado(pedido) {
  return pedido?.anuncio?.estado === 'retirado';
}

// «Datos del pedido»: filas en el orden de la pantalla (punto 5). La forma de pago solo en venta (US-35 CA6).
export function datosDelPedido(pedido) {
  const filas = [{ etiqueta: 'Unidades', valor: String(pedido.unidades) }];
  if (pedido.modalidad === 'venta') {
    filas.push({ etiqueta: 'Precio por unidad', valor: formatearEuros(pedido.precio_unitario_centimos) });
    filas.push({ etiqueta: 'Total', valor: formatearEuros(pedido.total_centimos) });
    if (FORMAS_DE_PAGO[pedido.metodo_pago]) filas.push({ etiqueta: 'Forma de pago', valor: FORMAS_DE_PAGO[pedido.metodo_pago] });
  } else {
    filas.push({ etiqueta: null, valor: TEXTOS.donacion });
  }
  filas.push({ etiqueta: TEXTOS.mensajeComprador, valor: pedido.mensaje || TEXTOS.sinMensaje });
  return filas;
}

// Punto 6 y CA7: «Comprador» o «Vendedor» (el otro centro) con su nombre y localidad; email y teléfono solo en
// aceptado o recibido y solo si la API los manda. `contacto` es null si no hay ninguno de los dos.
export function datosDelOtroCentro(pedido) {
  const centro = otroCentro(pedido);
  const email = centro.email || null;
  const telefono = centro.telefono || null;
  const conContacto = ['aceptado', 'recibido'].includes(pedido.estado) && Boolean(email || telefono);
  return {
    titulo: pedido.mi_papel === 'comprador' ? 'Vendedor' : 'Comprador',
    nombre: centro.nombre,
    localidad: centro.localidad || null,
    contacto: conContacto
      ? {
        email,
        telefono,
        enlaceEmail: email && `mailto:${email}`,
        // El enlace lleva solo las cifras (y el «+»); el texto, el teléfono tal cual lo manda la API.
        enlaceTelefono: telefono && `tel:${telefono.replace(/[^\d+]/g, '')}`,
      }
      : null,
  };
}

// US-40: sección «Entrega». Devuelve { metodo, lineas, aviso, escribir }:
// - Envío: «Método: Envío a tu dirección» (comprador) o «… a la dirección del comprador» (vendedor) y la dirección en
//   4 líneas (persona · dirección y piso · CP localidad (provincia) · teléfono) más «Indicaciones: …» si las hay.
// - Recogida: «Método: Recogida en el centro vendedor». El comprador ve «Dirección de recogida: …» en aceptado o
//   recibido (CA15); en pendiente, el aviso de espera; sin dirección del vendedor, el aviso de CA14 con «Escribir al
//   vendedor». El vendedor y los pedidos rechazados o cancelados no ven nada más.
export function datosDeEntrega(pedido) {
  const entrega = pedido.entrega ?? { metodo: pedido.metodo_entrega };
  const comprador = pedido.mi_papel === 'comprador';
  if (entrega.metodo === 'envio') {
    const d = entrega.direccion_envio ?? {};
    const lineas = [
      d.destinatario,
      [d.calle_numero, d.piso_puerta].filter(Boolean).join(', '),
      `${d.codigo_postal ?? ''} ${d.localidad ?? ''}${d.provincia ? ` (${d.provincia})` : ''}`.trim(),
      d.telefono_contacto,
    ].filter(Boolean);
    if (d.indicaciones) lineas.push(`Indicaciones: ${d.indicaciones}`);
    return {
      metodo: comprador ? 'Método: Envío a tu dirección' : 'Método: Envío a la dirección del comprador',
      lineas,
      aviso: null,
      escribir: false,
    };
  }
  if (entrega.metodo === 'recogida') {
    const resultado = { metodo: 'Método: Recogida en el centro vendedor', lineas: [], aviso: null, escribir: false };
    if (!comprador) return resultado;
    if (pedido.estado === 'pendiente') return { ...resultado, aviso: TEXTOS.esperaRecogida };
    if (['aceptado', 'recibido'].includes(pedido.estado)) {
      const r = entrega.direccion_recogida;
      if (r) {
        const lugar = [r.direccion, [r.codigo_postal, r.localidad].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        return { ...resultado, lineas: [`Dirección de recogida: ${lugar}`] };
      }
      return { ...resultado, aviso: TEXTOS.sinDireccion, escribir: true };
    }
    return resultado;
  }
  return null;
}

// Punto 8: «Historial», en orden de fechas, con hora de Madrid (CA6). Cada línea lleva su `tipo` para el color del
// punto que la acompaña (pendiente, aceptado, rechazado, cancelado o pagado); el texto ya dice qué es.
export function lineasDelHistorial(pedido) {
  const lineas = [];
  if (pedido.creado_en) lineas.push({ tipo: 'pendiente', texto: `Pedido el ${formatearFechaHora(pedido.creado_en)}` });
  if (pedido.respondido_en && ['aceptado', 'recibido'].includes(pedido.estado)) {
    lineas.push({ tipo: 'aceptado', texto: `Aceptado el ${formatearFechaHora(pedido.respondido_en)}` });
  }
  if (pedido.respondido_en && pedido.estado === 'rechazado') {
    lineas.push({ tipo: 'rechazado', texto: `Rechazado el ${formatearFechaHora(pedido.respondido_en)}` });
  }
  if (pedido.cancelado_en) {
    const quien = pedido.cerrado_por === 'vendedor' ? 'vendedor' : 'comprador';
    lineas.push({ tipo: 'cancelado', texto: `Cancelado el ${formatearFechaHora(pedido.cancelado_en)} por ${quien}` });
  }
  if (pedido.pagado_en) lineas.push({ tipo: 'pagado', texto: `Marcado como pagado el ${formatearFechaHora(pedido.pagado_en)}` });
  // «Recibido el …» va en la sección «Entrega» (US-42), no en el historial.
  return lineas;
}

export function historial(pedido) {
  return lineasDelHistorial(pedido).map(({ texto }) => texto);
}

// CA3 y CA4: 404 → «no existe o no tienes acceso»; el resto (red, 500, 503) → «No se ha podido cargar.» + «Reintentar».
export function resultadoDeLaCarga(fallo) {
  if (fallo?.status === 404) return { noEncontrado: true };
  return { error: true };
}
