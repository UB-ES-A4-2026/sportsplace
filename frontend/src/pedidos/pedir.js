// Formulario /anuncios/:id/pedir (T32-4: US-32 T32-4, US-35 T35-3 y US-40 T40-4): textos, validación en la web,
// total, cuerpo de POST /api/pedidos y qué hacer con cada error de la API. Sin React, para poder probarlo.
import { esquemaDireccionEnvio } from '../validacion/entrega-pedido.js';
import { formatearEuros } from '../utilidades/euros.js';

export const MAX_MENSAJE = 500;

export const TEXTOS = {
  titulo: 'Hacer un pedido',
  noDisponible: 'Este anuncio no está disponible para pedidos.',
  volverAlCatalogo: 'Volver al catálogo',
  unidades: 'Unidades',
  menos: 'Quitar una unidad',
  mas: 'Añadir una unidad',
  formaPago: 'Forma de pago',
  transferencia: 'Transferencia bancaria',
  ayudaTransferencia: 'Pediréis los datos bancarios al vendedor cuando acepte el pedido.',
  efectivo: 'Efectivo al recoger',
  ayudaEfectivo: 'Pagas en mano al recoger el material.',
  errorPago: 'Elige una forma de pago.',
  entrega: 'Entrega',
  recogida: 'Paso a recogerlo',
  envio: 'Que me lo envíen',
  ayudaEntrega: 'El coste y la forma del envío los acordáis entre los dos centros.',
  errorEntrega: 'Elige cómo quieres recibir el material.',
  efectivoConEnvio: 'Con envío, acordad con el vendedor cómo pagar en efectivo.',
  mensaje: 'Mensaje para el vendedor (opcional)',
  errorMensaje: 'El mensaje no puede superar 500 caracteres.',
  sinCoste: 'Donación: sin coste',
  avisoDinero: 'El pago y la entrega se acuerdan entre los dos centros. Sportsplace no cobra ni gestiona el dinero.',
  enviar: 'Enviar pedido',
  enviando: 'Enviando…',
  cancelar: 'Cancelar',
  salirTitulo: '¿Salir sin enviar el pedido?',
  salirTexto: 'Se perderán los datos.',
  salir: 'Salir',
  seguir: 'Seguir aquí',
  enviado: 'Pedido enviado. El vendedor lo revisará.',
  noDisponibleApi: 'Este anuncio ya no está disponible.',
  errorGenerico: 'No se ha podido completar la acción. Inténtalo de nuevo.',
  cargando: 'Cargando…',
  error: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
};

// US-40, pantalla: campos de la dirección de envío, en orden, con sus etiquetas.
export const CAMPOS_DIRECCION = [
  { nombre: 'destinatario', etiqueta: 'Persona de contacto' },
  { nombre: 'calle_numero', etiqueta: 'Dirección' },
  { nombre: 'piso_puerta', etiqueta: 'Piso, puerta (opcional)' },
  { nombre: 'codigo_postal', etiqueta: 'Código postal' },
  { nombre: 'localidad', etiqueta: 'Localidad' },
  { nombre: 'provincia', etiqueta: 'Provincia' },
  { nombre: 'telefono_contacto', etiqueta: 'Teléfono de contacto' },
  { nombre: 'indicaciones', etiqueta: 'Indicaciones para la entrega (opcional)' },
];

// CA5: solo se puede pedir un anuncio de otro centro que esté activo (respuesta de GET /api/catalogo/:id).
export function sePuedePedir(anuncio) {
  return Boolean(anuncio) && anuncio.es_propio !== true && anuncio.estado === 'activo';
}

// Tarjeta resumen: «Venta · 8,50 € por unidad» o «Donación».
export function textoModalidad({ modalidad, precio_unitario_centimos: centimos }) {
  return modalidad === 'donacion' ? 'Donación' : `Venta · ${formatearEuros(centimos)} por unidad`;
}

export function textoDisponibles(unidades) {
  return `Disponibles: ${unidades}`;
}

// CA7: el mensaje lleva el máximo disponible.
export function errorDeUnidades(maximo) {
  return `Indica entre 1 y ${maximo} unidades.`;
}

// CA7: entero de 1 al máximo. «2,5», «2.5», «-1», «0» o vacío no valen. Devuelve el número o null.
export function leerUnidades(texto, maximo) {
  const valor = String(texto ?? '').trim();
  if (!/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return numero >= 1 && numero <= maximo ? numero : null;
}

// CA9: «Total: 34,00 €» (4 × 8,50 €) en venta; «Donación: sin coste» en donación. Con unidades no válidas, 0.
export function textoTotal(anuncio, textoUnidades) {
  if (anuncio.modalidad === 'donacion') return TEXTOS.sinCoste;
  const unidades = leerUnidades(textoUnidades, Number.MAX_SAFE_INTEGER) ?? 0;
  return `Total: ${formatearEuros(unidades * anuncio.precio_unitario_centimos)}`;
}

// US-40 CA3: al elegir envío la primera vez se rellena con los datos del centro; persona y provincia, vacías.
export function direccionInicial(centro) {
  return {
    destinatario: '',
    calle_numero: centro?.direccion ?? '',
    piso_puerta: '',
    codigo_postal: centro?.codigo_postal ?? '',
    localidad: centro?.localidad ?? '',
    provincia: '',
    telefono_contacto: centro?.telefono ?? '',
    indicaciones: '',
  };
}

// US-35 CA8: aviso no bloqueante al juntar envío con efectivo.
export function avisoEfectivoConEnvio({ metodoPago, metodoEntrega }) {
  return metodoPago === 'efectivo_recogida' && metodoEntrega === 'envio' ? TEXTOS.efectivoConEnvio : null;
}

// CA7-CA8 (US-32), CA2 (US-35) y CA1-CA12 (US-40): valida el formulario. Devuelve { errores } con un texto por
// campo (claves como las de `details` de la API) o { cuerpo } listo para POST /api/pedidos. La web nunca envía
// precio ni total (CA11).
export function validarPedido(anuncio, formulario, maximo = anuncio.unidades_disponibles) {
  const errores = {};
  const unidades = leerUnidades(formulario.unidades, maximo);
  if (unidades === null) errores.unidades = errorDeUnidades(maximo);

  const mensaje = String(formulario.mensaje ?? '').trim();
  if ([...mensaje].length > MAX_MENSAJE) errores.mensaje = TEXTOS.errorMensaje;

  const venta = anuncio.modalidad !== 'donacion';
  if (venta && !['transferencia', 'efectivo_recogida'].includes(formulario.metodoPago)) {
    errores.metodo_pago = TEXTOS.errorPago;
  }

  let direccion = null;
  if (!['recogida', 'envio'].includes(formulario.metodoEntrega)) {
    errores.metodo_entrega = TEXTOS.errorEntrega;
  } else if (formulario.metodoEntrega === 'envio') {
    const resultado = esquemaDireccionEnvio.safeParse(formulario.direccion);
    if (resultado.success) direccion = resultado.data;
    else {
      for (const problema of resultado.error.issues) {
        const clave = `direccion_envio.${problema.path[0]}`;
        errores[clave] ??= problema.message;
      }
    }
  }

  if (Object.keys(errores).length > 0) return { errores };
  return {
    cuerpo: {
      anuncio_id: anuncio.id,
      unidades,
      mensaje,
      ...(venta ? { metodo_pago: formulario.metodoPago } : {}),
      metodo_entrega: formulario.metodoEntrega,
      ...(direccion ? { direccion_envio: direccion } : {}),
    },
  };
}

// CA6: ¿ha cambiado algo respecto al formulario recién abierto? Si es así, «Cancelar» pregunta antes de salir.
export function hayCambios(inicial, actual) {
  return JSON.stringify(inicial) !== JSON.stringify(actual);
}

// Qué hace la pantalla con un fallo de POST /api/pedidos:
// - 400 DATOS_INVALIDOS: errores por campo (CA17; US-35 CA3; US-40 CA19).
// - 409 UNIDADES_INSUFICIENTES: el texto bajo «Unidades» y el nuevo máximo (CA19).
// - 409 PEDIDO_YA_PENDIENTE: ir a ese pedido (CA22).
// - 409 ANUNCIO_NO_DISPONIBLE: aviso rojo y volver a /anuncios/:id (CA20).
// - 404 o 403 PEDIDO_PROPIO: el anuncio no se puede pedir (CA5, CA18, CA21).
// - El resto (red, 500, 503): aviso rojo genérico, con los datos conservados.
export function resultadoDelFallo(fallo, anuncioId) {
  const { status, code, message, details } = fallo ?? {};
  if (status === 400 && code === 'DATOS_INVALIDOS' && details && typeof details === 'object') {
    return { errores: { ...details } };
  }
  if (status === 409 && code === 'UNIDADES_INSUFICIENTES') {
    const disponibles = Number(details?.unidades_disponibles);
    return {
      errores: { unidades: message || `Solo quedan ${disponibles} unidades disponibles.` },
      maximo: Number.isInteger(disponibles) ? disponibles : null,
    };
  }
  if (status === 409 && code === 'PEDIDO_YA_PENDIENTE' && details?.pedido_id) {
    return { irA: `/pedidos/${details.pedido_id}` };
  }
  if (status === 409 && code === 'ANUNCIO_NO_DISPONIBLE') {
    return { aviso: message || TEXTOS.noDisponibleApi, irA: `/anuncios/${anuncioId}` };
  }
  if (status === 404 || (status === 403 && code === 'PEDIDO_PROPIO')) return { noDisponible: true };
  return { aviso: TEXTOS.errorGenerico };
}
