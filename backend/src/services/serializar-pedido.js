import { accionesPermitidas, papelEn } from './transiciones-pedido.js';

const fecha = (valor) => (valor === null || valor === undefined ? null : new Date(valor).toISOString());
const valor = (dato) => dato ?? null;

// US-108 CA7 y CA12: el email y el teléfono del otro centro solo se ven cuando
// el pedido está aceptado o recibido; en otro estado las claves no aparecen.
const CON_CONTACTO = new Set(['aceptado', 'recibido']);

function aCentro(centro, conContacto) {
  const resultado = { id: centro.id, nombre: centro.nombre, localidad: centro.localidad };
  if (conContacto) {
    resultado.email = valor(centro.email);
    resultado.telefono = valor(centro.telefono);
  }
  return resultado;
}

// US-40 CA14-CA16: el envío conserva su copia. Para la recogida el comprador
// puede ver la dirección actual del vendedor una vez aceptado el pedido.
function aEntrega(fila, vendedor, papel) {
  const metodo = valor(fila.metodo_entrega);
  const mostrarRecogida = metodo === 'recogida' && papel === 'comprador'
    && CON_CONTACTO.has(fila.estado) && Boolean(vendedor.direccion);
  return {
    metodo,
    direccion_envio: metodo === 'envio' && papel ? valor(fila.direccion_envio) : null,
    direccion_recogida: mostrarRecogida ? {
      direccion: vendedor.direccion,
      codigo_postal: valor(vendedor.codigo_postal),
      localidad: vendedor.localidad,
    } : null,
  };
}

// Fila de `pedidos` con su anuncio y sus dos centros → objeto `pedido` de la API
// («Objeto `pedido` en la API», E06). Las columnas que traen historias posteriores
// (respondido_en, motivo, pagado_en, cancelado_en…) salen null mientras no existan.
// `mi_papel` y `acciones` dependen del centro que consulta (US-108 CA10, CA13).
export function aPedido({ fila, anuncio, comprador, vendedor }, centroId) {
  const conContacto = CON_CONTACTO.has(fila.estado);
  const pedido = {
    id: fila.id,
    anuncio: {
      id: anuncio.id,
      titulo: fila.titulo_anuncio,
      foto_principal_url: valor(anuncio.foto_principal_url),
      estado: anuncio.estado,
      unidades_disponibles: anuncio.unidades_disponibles, // US-34 CA9
    },
    comprador: aCentro(comprador, conContacto),
    vendedor: aCentro(vendedor, conContacto),
    mi_papel: null,
    unidades: fila.unidades,
    modalidad: fila.modalidad,
    precio_unitario_centimos: valor(fila.precio_unitario_centimos),
    total_centimos: fila.total_centimos,
    metodo_pago: valor(fila.metodo_pago),
    metodo_entrega: valor(fila.metodo_entrega),
    mensaje: valor(fila.mensaje),
    estado: fila.estado,
    motivo_codigo: valor(fila.motivo_codigo),
    motivo_texto: valor(fila.motivo_texto),
    cerrado_por: valor(fila.cerrado_por),
    pagado_en: fecha(fila.pagado_en),
    creado_en: fecha(fila.creado_en),
    respondido_en: fecha(fila.respondido_en),
    cancelado_en: fecha(fila.cancelado_en),
    acciones: [],
  };
  pedido.mi_papel = papelEn(pedido, centroId);
  pedido.entrega = aEntrega(fila, vendedor, pedido.mi_papel);
  pedido.acciones = accionesPermitidas(pedido, centroId);
  return pedido;
}
