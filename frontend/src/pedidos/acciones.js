// Reglas de la web para aceptar y rechazar un pedido (E06: US-33, US-79 y US-34). Funciones puras para
// probarlas sin navegador; los componentes AccionesPedidoVendedor, DialogoRechazo y SeccionMotivo las usan.

export const AVISO_ACEPTADO = 'Pedido aceptado.';
export const AVISO_RECHAZADO = 'Pedido rechazado.';
export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

// E06 «Listas fijas de motivos». En el desplegable solo salen los del vendedor: `anuncio_sin_stock` lo pone
// el sistema al reservar (US-34) y no se puede elegir (US-79 CA8).
export const MOTIVOS_RECHAZO = [
  { codigo: 'sin_unidades', texto: 'Ya no tengo unidades suficientes' },
  { codigo: 'comprometido_otro_centro', texto: 'El material está comprometido con otro centro' },
  { codigo: 'entrega_inviable', texto: 'No puedo hacer la entrega que se pide' },
  { codigo: 'condiciones_pago', texto: 'No acepto las condiciones de pago' },
  { codigo: 'otro', texto: 'Otro motivo' },
];

const TEXTO_MOTIVO = Object.fromEntries([
  ...MOTIVOS_RECHAZO.map(({ codigo, texto }) => [codigo, texto]),
  ['anuncio_sin_stock', 'Se han agotado las unidades del anuncio'],
]);

export function textoDelMotivo(codigo) {
  return TEXTO_MOTIVO[codigo] ?? null;
}

// US-79 CA2 y CA3 (mensajes de la base común, los mismos que devuelve la API).
export const MENSAJES_RECHAZO = {
  motivo: 'Elige un motivo.',
  explicacionCorta: 'Explica el motivo (entre 10 y 300 caracteres).',
  explicacionLarga: 'El texto no puede superar 300 caracteres.',
};
export const EXPLICACION_MAX = 300;
const EXPLICACION_MIN_OTRO = 10;

// Se cuentan caracteres, no unidades de UTF-16 (un emoji cuenta 1), igual que el servidor.
export const longitud = (texto) => [...texto].length;

export function etiquetaExplicacion(motivoCodigo) {
  return motivoCodigo === 'otro' ? 'Explicación (obligatoria)' : 'Explicación';
}

// Devuelve un objeto campo → mensaje (`motivo_codigo`, `motivo_texto`), vacío si todo es correcto.
export function validarRechazo({ motivoCodigo, motivoTexto }) {
  const errores = {};
  const texto = (motivoTexto ?? '').trim();
  if (!MOTIVOS_RECHAZO.some((motivo) => motivo.codigo === motivoCodigo)) {
    errores.motivo_codigo = MENSAJES_RECHAZO.motivo;
  }
  if (longitud(texto) > EXPLICACION_MAX) {
    errores.motivo_texto = MENSAJES_RECHAZO.explicacionLarga;
  } else if (motivoCodigo === 'otro' && longitud(texto) < EXPLICACION_MIN_OTRO) {
    errores.motivo_texto = MENSAJES_RECHAZO.explicacionCorta;
  }
  return errores;
}

// Cuerpo de POST /rechazar: la explicación recortada, o null si está vacía.
export function cuerpoDelRechazo({ motivoCodigo, motivoTexto }) {
  const texto = (motivoTexto ?? '').trim();
  return { motivoCodigo, motivoTexto: texto === '' ? null : texto };
}

// US-34 CA9: el pedido pide más unidades de las que quedan en el anuncio.
export function faltanUnidades(pedido) {
  const disponibles = pedido?.anuncio?.unidades_disponibles;
  return Number.isInteger(disponibles) && pedido.unidades > disponibles;
}

const unidades = (n) => (n === 1 ? '1 unidad' : `${n} unidades`);

// US-34: aviso amarillo «Este pedido pide <u> unidades y solo te quedan <n>.» (con 1, «1 unidad»).
export function textoFaltanUnidades(pedido) {
  return `Este pedido pide ${unidades(pedido.unidades)} y solo te quedan ${pedido.anuncio.unidades_disponibles}.`;
}

// Qué botones de esta tarea se pintan. Los permisos los decide el servidor con `acciones` (US-108 CA9):
// - «Aceptar» si `acciones` incluye `aceptar` (US-33 CA1). Si el servidor no lo ofrece porque faltan unidades
//   (US-34 CA9), se pinta igualmente pero deshabilitado y con el aviso amarillo; solo si el pedido sí se
//   puede rechazar, que es lo que indica que soy el vendedor y está pendiente.
// - «Rechazar» si `acciones` incluye `rechazar` (US-79 CA1).
export function botonesDelVendedor(pedido) {
  const acciones = pedido?.acciones ?? [];
  const rechazar = acciones.includes('rechazar');
  const sinStock = rechazar && !acciones.includes('aceptar') && faltanUnidades(pedido);
  return {
    aceptar: acciones.includes('aceptar') || sinStock,
    aceptarDeshabilitado: sinStock,
    rechazar,
    avisoSinStock: sinStock ? textoFaltanUnidades(pedido) : null,
  };
}

// US-33: diálogo «¿Aceptar el pedido?». US-34 añade «Quedarán <n> unidades disponibles en el anuncio.»
export function dialogoAceptar(pedido) {
  const lineas = [
    `Te comprometes a entregar ${unidades(pedido.unidades)} de «${pedido.anuncio.titulo}» a ${pedido.comprador.nombre}. `
      + 'Después tendréis que acordar la entrega y el pago.',
  ];
  const disponibles = pedido.anuncio?.unidades_disponibles;
  if (Number.isInteger(disponibles)) {
    const quedan = disponibles - pedido.unidades;
    lineas.push(quedan === 1 ? 'Quedará 1 unidad disponible en el anuncio.' : `Quedarán ${quedan} unidades disponibles en el anuncio.`);
  }
  return { titulo: '¿Aceptar el pedido?', texto: lineas.join(' '), textoConfirmar: 'Aceptar pedido', textoEnviando: 'Aceptando…' };
}

// Traduce el fallo de aceptar o rechazar a lo que muestra la pantalla:
// - 409 (TRANSICION_NO_PERMITIDA, ANUNCIO_NO_DISPONIBLE, UNIDADES_INSUFICIENTES): el `message` de la API en
//   rojo y recargar el pedido para ver su estado real (US-33 CA9 y CA11).
// - 400 DATOS_INVALIDOS del rechazo: cada mensaje bajo su campo del diálogo (US-79 CA8).
// - 404: la pantalla «Este pedido no existe o no tienes acceso.» (US-108 CA3).
// - 403: el `message` de la API (SIN_PERMISO o EMAIL_NO_CONFIRMADO).
// - 500, 503, sin conexión y el resto: aviso genérico y `conservar: true`. El diálogo de rechazo se queda
//   abierto con lo escrito, para reintentar sin volver a escribirlo (guía común: «Los datos del formulario
//   se conservan»).
export function resultadoDelFallo(fallo) {
  if (fallo?.status === 409) return { mensaje: fallo.message || MENSAJE_ERROR_GENERICO, recargar: true };
  if (fallo?.status === 400 && fallo.details) {
    const errores = {};
    for (const campo of ['motivo_codigo', 'motivo_texto']) if (fallo.details[campo]) errores[campo] = fallo.details[campo];
    if (Object.keys(errores).length > 0) return { errores };
  }
  if (fallo?.status === 404) return { noEncontrado: true };
  if (fallo?.status === 403 && fallo.message) return { mensaje: fallo.message };
  return { mensaje: MENSAJE_ERROR_GENERICO, conservar: true };
}
