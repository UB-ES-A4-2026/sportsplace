// Bandeja de pedidos /pedidos y contador de la cabecera (US-109, T109-2 de la especificación; T33-4 en GitHub).
// Especificación: docs/especificacion/E06-pedidos-y-pago.md («Base común» y US-109).
import { formatearFecha } from '../anuncios/ficha.js';
import { formatearEuros } from '../utilidades/euros.js';

export const POR_PAGINA_PEDIDOS = 20;
export const RUTA_PEDIDOS = '/pedidos';
export const PESTANAS = ['recibidos', 'realizados'];

export const TEXTOS = {
  titulo: 'Pedidos',
  enlaceCabecera: 'Pedidos',
  recibidos: 'Recibidos',
  realizados: 'Realizados',
  columnas: ['Anuncio', 'Centro', 'Unidades', 'Total', 'Estado', 'Fecha'],
  donacion: 'Donación',
  pagado: 'Pagado',
  vacioRecibidos: 'Todavía no has recibido pedidos. Cuando otro centro pida tu material, aparecerá aquí.',
  vacioRealizados: 'Todavía no has hecho pedidos.',
  irAlCatalogo: 'Ir al catálogo',
  cargando: 'Cargando…',
  error: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
  anterior: 'Anterior',
  siguiente: 'Siguiente',
};

// «Etiquetas de estado en la web» (E06, base común).
export const ESTADOS_PEDIDO = {
  pendiente: { etiqueta: 'Pendiente', color: 'amarillo' },
  aceptado: { etiqueta: 'Aceptado', color: 'verde' },
  rechazado: { etiqueta: 'Rechazado', color: 'rojo' },
  cancelado: { etiqueta: 'Cancelado', color: 'gris' },
  recibido: { etiqueta: 'Recibido', color: 'azul' },
};

// CA1: sin `pestana` o con otro valor se abre «Recibidos».
export function pestanaDeUrl(valor) {
  return PESTANAS.includes(valor) ? valor : 'recibidos';
}

// CA5: página de la URL; cualquier valor que no sea un entero mayor que 0 es la página 1.
export function paginaDeUrl(valor) {
  return /^[1-9]\d*$/.test(valor ?? '') ? Number(valor) : 1;
}

// CA1 y CA2: la pestaña siempre en la URL (`?pestana=recibidos`); la página, solo a partir de la 2.
export function parametrosDeBandeja(pestana, pagina = 1) {
  const parametros = new URLSearchParams({ pestana: pestanaDeUrl(pestana) });
  if (pagina > 1) parametros.set('pagina', String(pagina));
  return parametros;
}

// CA1: destino del enlace «Pedidos» de la cabecera.
export const ENLACE_CABECERA = `${RUTA_PEDIDOS}?${parametrosDeBandeja('recibidos')}`;

export function totalDePaginas(total, porPagina = POR_PAGINA_PEDIDOS) {
  return Math.max(1, Math.ceil(total / porPagina));
}

// CA9: el contador no se muestra con 0 y con más de 99 es «99+».
export function textoContador(n) {
  if (!Number.isInteger(n) || n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

// Pestaña «Recibidos (1 pendiente)» / «Recibidos (n pendientes)» (E06, decisión del 15/11; E2E-1).
// Con 0 pendientes no hay contador (CA9).
export function textoPestanaRecibidos(pendientes) {
  const contador = textoContador(pendientes);
  if (!contador) return TEXTOS.recibidos;
  return `${TEXTOS.recibidos} (${contador} ${contador === '1' ? 'pendiente' : 'pendientes'})`;
}

// Columna «Total»: «34,00 €» o «Donación».
export function textoTotal(pedido) {
  return pedido.modalidad === 'donacion' ? TEXTOS.donacion : formatearEuros(pedido.total_centimos);
}

// Columna «Fecha»: «dd/mm/aaaa» (hora de Madrid).
export function textoFecha(pedido) {
  return formatearFecha(pedido.creado_en);
}

export function rutaDelPedido(id) {
  return `${RUTA_PEDIDOS}/${encodeURIComponent(id)}`;
}

// Una fila de la tabla (o tarjeta en móvil) a partir de `pedido_resumen` (CA10).
export function filaDePedido(pedido) {
  const estado = ESTADOS_PEDIDO[pedido.estado] ?? { etiqueta: pedido.estado, color: 'gris' };
  return {
    id: pedido.id,
    ruta: rutaDelPedido(pedido.id),
    foto: pedido.anuncio?.foto_principal_url ?? null,
    anuncio: pedido.anuncio?.titulo ?? '',
    centro: pedido.otro_centro?.nombre ?? '',
    unidades: pedido.unidades,
    total: textoTotal(pedido),
    estado,
    pagado: Boolean(pedido.pagado_en),
    fecha: textoFecha(pedido),
  };
}

// CA7: textos de la bandeja vacía; «Realizados» además enlaza al catálogo.
export function vacioDe(pestana) {
  return pestana === 'realizados'
    ? { texto: TEXTOS.vacioRealizados, enlace: { texto: TEXTOS.irAlCatalogo, ruta: '/catalogo' } }
    : { texto: TEXTOS.vacioRecibidos, enlace: null };
}
