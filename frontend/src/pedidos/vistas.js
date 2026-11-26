// /pedidos/:id con dos vistas según `pedido.mi_papel` (diseño con vida de Lucía, #361, imagen de referencia del vendedor
// con el pedido pendiente). Misma ruta, misma API y mismos textos de los CA (detalle.js, acciones.js y cierre.js): aquí
// solo se decide qué panel sale y con qué datos. Funciones puras para probarlas sin navegador; las usa PedidoPage.
import { botonesDelVendedor } from './acciones.js';
import { accionesDeCierre } from './cierre.js';
import { datosDelOtroCentro, datosDelPedido, TEXTOS } from './detalle.js';

// Textos de presentación que no están en los CA (los decide Lucía en la revisión; ninguno sustituye a un texto de un CA).
export const TEXTOS_VISTA = {
  responder: 'Responder al pedido', // nombre del grupo «Rechazar» / «Aceptar», para el lector de pantalla
  contactar: (centro) => `Ya puedes contactar con ${centro}:`,
  email: 'Email:', // delante del email y del teléfono, solo para el lector de pantalla
  telefono: 'Teléfono:',
  // Tarjeta del otro centro mientras el pedido está pendiente (el contacto aún no se ve, US-108 CA7).
  notaContacto: 'El email y el teléfono se ven cuando el pedido está aceptado.',
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
};

export const esVendedor = (pedido) => pedido?.mi_papel === 'vendedor';

// Color de la pantalla según el estado (pastilla, panel y seguimiento). Un estado desconocido va en gris.
const COLORES = ['pendiente', 'aceptado', 'rechazado', 'cancelado', 'recibido'];
export function colorDelEstado(estado) {
  return COLORES.includes(estado) ? estado : 'cancelado';
}

// Panel de arriba a la izquierda en la vista del vendedor:
// - 'decidir': pendiente con «Aceptar» o «Rechazar» (US-33, US-79): la frase de CA5 a la izquierda y los botones a la
//   derecha; si faltan unidades, el aviso de US-34 bajo la frase.
// - 'aceptado', 'recibido', 'rechazado' y 'cancelado': la frase de CA5 con el contacto (aceptado) o el motivo.
// - 'situacion': el resto (pendiente sin acciones, estado desconocido): solo la frase.
export function panelDelVendedor(pedido) {
  if (pedido.estado === 'pendiente') {
    const botones = botonesDelVendedor(pedido);
    return botones.aceptar || botones.rechazar ? 'decidir' : 'situacion';
  }
  return ['aceptado', 'recibido', 'rechazado', 'cancelado'].includes(pedido.estado) ? pedido.estado : 'situacion';
}

// El email y el teléfono del otro centro (US-108 CA7: solo en aceptado y recibido, y si la API los manda) van en el
// panel de arriba, a la derecha de la frase, para los dos centros: así salen una sola vez en la pantalla.
export function contactoEnElPanel(pedido) {
  return Boolean(datosDelOtroCentro(pedido).contacto);
}

// Nota pequeña de la tarjeta del otro centro: mientras el pedido está pendiente, cuándo se verá el contacto. En el
// resto de estados, nada (aceptado y recibido ya lo enseñan; rechazado y cancelado no lo enseñan nunca, CA7).
export function notaDelContacto(pedido) {
  return pedido?.estado === 'pendiente' ? TEXTOS_VISTA.notaContacto : null;
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

// «Datos del pedido» en baldosas de una rejilla de 3 columnas, como en la imagen de referencia:
// - venta: Unidades | Precio por unidad | Total (en verde) y Forma de pago | Mensaje del comprador (2 columnas);
// - donación: Unidades | «Donación: sin coste» (en verde, 2 columnas, sin etiqueta) y el mensaje a todo el ancho.
// Cada baldosa: { clave, etiqueta (null sin etiqueta), valor, tipo ('dato', 'total' o 'mensaje'), ancho (1, 2 o 3) y
// vacio (el mensaje es «Sin mensaje») }. El mensaje ocupa lo que queda de su fila (o la fila entera). Las unidades,
// «4 unidades» o «1 unidad»; el resto de valores, los de datosDelPedido (CA6 y US-35).
const COLUMNAS = 3;
const unidades = (n) => (n === 1 ? '1 unidad' : `${n} unidades`);

export function baldosasDelPedido(pedido) {
  let ocupadas = 0;
  return datosDelPedido(pedido).map(({ etiqueta, valor }) => {
    let baldosa;
    if (etiqueta === TEXTOS.mensajeComprador) {
      const resto = COLUMNAS - (ocupadas % COLUMNAS);
      baldosa = { clave: 'mensaje', etiqueta, valor, tipo: 'mensaje', ancho: resto, vacio: !pedido.mensaje };
    } else if (etiqueta === null) {
      baldosa = { clave: 'donacion', etiqueta, valor, tipo: 'total', ancho: 2, vacio: false };
    } else if (etiqueta === 'Unidades') {
      baldosa = { clave: etiqueta, etiqueta, valor: unidades(pedido.unidades), tipo: 'dato', ancho: 1, vacio: false };
    } else {
      baldosa = { clave: etiqueta, etiqueta, valor, tipo: etiqueta === 'Total' ? 'total' : 'dato', ancho: 1, vacio: false };
    }
    ocupadas += baldosa.ancho;
    return baldosa;
  });
}
