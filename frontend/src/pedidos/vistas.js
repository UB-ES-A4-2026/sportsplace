// /pedidos/:id con dos vistas según `pedido.mi_papel` (diseño con vida de Lucía, #361, mockups «PedidoRecibido» y
// «PedidoRealizado»). Misma ruta, misma API y mismos textos de los CA (detalle.js, acciones.js y cierre.js): aquí solo
// se decide qué panel sale y con qué datos. Funciones puras para probarlas sin navegador; las usa PedidoPage.
import { botonesDelVendedor } from './acciones.js';
import { accionesDeCierre } from './cierre.js';
import { datosDelOtroCentro, TEXTOS } from './detalle.js';

// Textos de presentación que no están en los CA (los decide Lucía en la revisión; ninguno sustituye a un texto de un CA).
export const TEXTOS_VISTA = {
  pedidoRecibido: 'Pedido recibido',
  pedidoRealizado: 'Pedido realizado',
  aceptas: '¿Aceptas este pedido?',
  unidades: 'Unidades', // nombre de la lista de las tres cifras, para el lector de pantalla
  tePiden: 'te piden',
  tienesDisponibles: 'tienes disponibles',
  quedaran: 'quedarán en el anuncio',
  noTeLlegan: 'no te llegan',
  responder: 'Responder al pedido', // nombre del grupo «Rechazar» / «Aceptar», para el lector de pantalla
  contactar: (centro) => `Ya puedes contactar con ${centro}:`,
  email: 'Email:', // delante del email y del teléfono, solo para el lector de pantalla
  telefono: 'Teléfono:',
  cobroTitulo: '¿Ya te han pagado?',
  cobroAyuda: 'Cuando recibas el pago, márcalo aquí. No se puede deshacer.',
  seguimiento: '¿En qué punto está tu pedido?', // título del seguimiento, solo para el lector de pantalla
  pasoEnviado: 'Pedido enviado',
  pasoRespuesta: 'Respuesta del vendedor',
  pasoAceptado: 'Aceptado',
  pasoRechazado: 'Rechazado',
  pasoCancelado: 'Cancelado',
  pasoRecibido: 'Material recibido',
  // Estado de cada paso, solo para el lector de pantalla: «Pedido enviado (hecho)».
  estadoPaso: { hecho: 'hecho', espera: 'en espera', mal: 'no', futuro: 'todavía no' },
  recibirPregunta: '¿Ya tienes el material en tu centro?',
  // Comprador con el pedido pendiente, bajo «Esperando la respuesta de …» (no en la tarjeta «Vendedor»: CA7).
  esperaContacto: 'Cuando lo acepte, aquí verás su email y su teléfono para quedar.',
};

export const esVendedor = (pedido) => pedido?.mi_papel === 'vendedor';

// Etiqueta junto al título: «Pedido recibido» (vendedor, flecha hacia abajo) o «Pedido realizado» (comprador).
export function etiquetaDelPapel(pedido) {
  return esVendedor(pedido)
    ? { texto: TEXTOS_VISTA.pedidoRecibido, clase: 'recibido' }
    : { texto: TEXTOS_VISTA.pedidoRealizado, clase: 'realizado' };
}

// Color de la pantalla según el estado (pastilla, panel y seguimiento). Un estado desconocido va en gris.
const COLORES = ['pendiente', 'aceptado', 'rechazado', 'cancelado', 'recibido'];
export function colorDelEstado(estado) {
  return COLORES.includes(estado) ? estado : 'cancelado';
}

// Panel de arriba a la izquierda en la vista del vendedor:
// - 'decidir': pendiente con «Aceptar» o «Rechazar» (US-33, US-79): «¿Aceptas este pedido?», la frase de CA5, las tres
//   cifras de US-34 y los botones.
// - 'aceptado', 'recibido', 'rechazado' y 'cancelado': la frase de CA5 con el contacto (aceptado) o el motivo.
// - 'situacion': el resto (pendiente sin acciones, estado desconocido): solo la frase.
export function panelDelVendedor(pedido) {
  if (pedido.estado === 'pendiente') {
    const botones = botonesDelVendedor(pedido);
    return botones.aceptar || botones.rechazar ? 'decidir' : 'situacion';
  }
  return ['aceptado', 'recibido', 'rechazado', 'cancelado'].includes(pedido.estado) ? pedido.estado : 'situacion';
}

// Dónde va el email y el teléfono del otro centro (US-108 CA7): en el panel de arriba, salvo para el vendedor de un
// pedido recibido, que los tiene en la tarjeta «Comprador» (su panel azul solo dice «Material recibido.»). Así salen
// una sola vez en la pantalla. null si no hay contacto.
export function lugarDelContacto(pedido) {
  if (!datosDelOtroCentro(pedido).contacto) return null;
  return esVendedor(pedido) && pedido.estado === 'recibido' ? 'tarjeta' : 'panel';
}

// US-34 en grande: «te piden · tienes disponibles · quedarán en el anuncio». Si faltan unidades, las disponibles van
// en rojo y la tercera cifra es «—» con «no te llegan» (el aviso amarillo y «Aceptar» deshabilitado siguen igual).
// null si la API no manda las disponibles del anuncio.
export function cifrasDelPedido(pedido) {
  const disponibles = pedido?.anuncio?.unidades_disponibles;
  if (!Number.isInteger(disponibles)) return null;
  const faltan = pedido.unidades > disponibles;
  return [
    { clave: 'piden', valor: String(pedido.unidades), texto: TEXTOS_VISTA.tePiden, falta: false },
    { clave: 'disponibles', valor: String(disponibles), texto: TEXTOS_VISTA.tienesDisponibles, falta: faltan },
    faltan
      ? { clave: 'quedaran', valor: '—', texto: TEXTOS_VISTA.noTeLlegan, falta: false }
      : { clave: 'quedaran', valor: String(disponibles - pedido.unidades), texto: TEXTOS_VISTA.quedaran, falta: false },
  ];
}

// Botones de cierre (US-80 y US-42): se pintan solo si `pedido.acciones` los trae (US-108 CA9).
const tieneAccion = (pedido, accion) => accionesDeCierre(pedido).some((opcion) => opcion.accion === accion);
export const puedeCobrar = (pedido) => tieneAccion(pedido, 'marcar_pagado');
export const puedeRecibir = (pedido) => tieneAccion(pedido, 'recibir');

// Seguimiento del comprador en 3 pasos: Pedido enviado → Respuesta del vendedor → Material recibido.
// Cada paso: `tipo` ('hecho', 'espera', 'mal' o 'futuro') para el círculo, `lector` con el estado para el lector de
// pantalla, `actual` para aria-current="step" y `tramo`, el color de la línea hasta el paso siguiente (null en el último).
function paso(numero, texto, tipo, actual = false) {
  return { numero, texto, tipo, lector: TEXTOS_VISTA.estadoPaso[tipo], actual };
}

export function pasosDelSeguimiento(pedido) {
  const enviado = paso(1, TEXTOS_VISTA.pasoEnviado, 'hecho');
  let pasos;
  if (pedido.estado === 'pendiente') {
    pasos = [enviado, paso(2, TEXTOS_VISTA.pasoRespuesta, 'espera', true), paso(3, TEXTOS_VISTA.pasoRecibido, 'futuro')];
  } else if (pedido.estado === 'aceptado') {
    // Ya ha respondido: lo que queda es recibir el material.
    pasos = [enviado, paso(2, TEXTOS_VISTA.pasoAceptado, 'hecho'), paso(3, TEXTOS_VISTA.pasoRecibido, 'futuro', true)];
  } else if (pedido.estado === 'recibido') {
    pasos = [enviado, paso(2, TEXTOS_VISTA.pasoAceptado, 'hecho'), paso(3, TEXTOS_VISTA.pasoRecibido, 'hecho', true)];
  } else if (pedido.estado === 'rechazado' || pedido.estado === 'cancelado') {
    const texto = pedido.estado === 'rechazado' ? TEXTOS_VISTA.pasoRechazado : TEXTOS_VISTA.pasoCancelado;
    pasos = [enviado, paso(2, texto, 'mal', true), paso(3, TEXTOS_VISTA.pasoRecibido, 'futuro')];
  } else {
    pasos = [enviado, paso(2, TEXTOS_VISTA.pasoRespuesta, 'futuro'), paso(3, TEXTOS_VISTA.pasoRecibido, 'futuro')];
  }
  return pasos.map((actual, i) => {
    const siguiente = pasos[i + 1];
    if (!siguiente) return { ...actual, tramo: null };
    if (siguiente.tipo === 'mal') return { ...actual, tramo: 'mal' };
    return { ...actual, tramo: actual.tipo === 'hecho' ? 'hecho' : 'futuro' };
  });
}

// «Datos del pedido» en baldosas: las filas con etiqueta (Unidades, Precio por unidad, Total y Forma de pago), con el
// total destacado, y aparte la línea sin etiqueta («Donación: sin coste»). El mensaje del comprador va en su bocadillo.
export function baldosasDelPedido(filas) {
  const sinMensaje = filas.filter((fila) => fila.etiqueta !== TEXTOS.mensajeComprador);
  return {
    baldosas: sinMensaje.filter((fila) => fila.etiqueta).map((fila) => ({ ...fila, destacada: fila.etiqueta === 'Total' })),
    sueltas: sinMensaje.filter((fila) => !fila.etiqueta).map((fila) => fila.valor),
  };
}

// «Mensaje del comprador» como bocadillo de chat; sin mensaje, «Sin mensaje» como texto normal.
export function mensajeDelComprador(pedido) {
  return pedido.mensaje ? { texto: pedido.mensaje, vacio: false } : { texto: TEXTOS.sinMensaje, vacio: true };
}
