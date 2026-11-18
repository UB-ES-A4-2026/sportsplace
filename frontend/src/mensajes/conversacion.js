// Mensajes con el centro de un anuncio (US-28 T28-3): textos, validación del cuadro, cabecera del anuncio, bandas
// de estado, errores de la API y unión de mensajes del hilo. Las pantallas son /mensajes/nueva y /mensajes/:id.
import { fotosDelDetalle } from '../anuncios/detalleOtroCentro.js';
import { formatearFechaHora } from '../anuncios/ficha.js';
import { MENSAJE_ERROR_GENERICO } from '../auth/recuperacion.js';
import { formatearEuros } from '../utilidades/euros.js';

export const MAXIMO_CARACTERES = 2000;
export const AVISO_CARACTERES = 1900;
export const REFRESCO_MS = 15000;

export const TEXTOS = {
  escribir: 'Escribir al centro',
  nueva: 'Nueva conversación',
  conversacion: 'Conversación',
  volverAnuncio: '← Volver al anuncio',
  volverMensajes: '← Mensajes',
  placeholder: 'Escribe tu mensaje…',
  enviar: 'Enviar',
  enviando: 'Enviando…',
  enviado: 'Mensaje enviado.',
  anuncioNoDisponible: 'Este anuncio no está disponible.',
  irAlCatalogo: 'Ir al catálogo',
  noExiste: 'Esta conversación no existe.',
  irAMensajes: 'Ir a mensajes',
  verAnteriores: 'Ver mensajes anteriores',
  cargando: 'Cargando…',
  errorCarga: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
  centroEliminado: 'Centro eliminado',
  sinEscribir: 'Este centro ya no está en Sportsplace. No puedes enviar más mensajes.',
  bandaNoDisponible: 'Este anuncio ya no está disponible en el catálogo.',
  bandaRetirado: 'El vendedor ha retirado este anuncio.',
  donacion: 'Donación',
  sinFoto: 'Sin foto',
};

// Pantalla `/mensajes/nueva`, punto 3.
export function textoDeAyuda(nombreCentro) {
  return `Escribe tu pregunta a ${nombreCentro}. Solo vosotros dos veréis esta conversación.`;
}

// CA7 y CA8: de 1 a 2000 caracteres tras quitar los espacios de los extremos. Vacío → «Enviar» deshabilitado.
export function puedeEnviar(texto) {
  const limpio = texto.trim();
  return limpio.length >= 1 && limpio.length <= MAXIMO_CARACTERES;
}

// CA10: «n/2000», en rojo a partir de 1900.
export function contador(texto) {
  return { texto: `${texto.length}/${MAXIMO_CARACTERES}`, alerta: texto.length >= AVISO_CARACTERES };
}

// CA13: Ctrl+Enter (o Cmd+Enter) envía; Enter solo, salto de línea.
export function esAtajoDeEnvio({ key, ctrlKey, metaKey }) {
  return key === 'Enter' && Boolean(ctrlKey || metaKey);
}

// CA3: sin conversación → /mensajes/nueva?anuncio=:id; con ella → /mensajes/:id.
export function destinoDeEscribir(conversacion, anuncioId) {
  if (conversacion) return `/mensajes/${encodeURIComponent(conversacion.id)}`;
  return `/mensajes/nueva?anuncio=${encodeURIComponent(anuncioId)}`;
}

// Cabecera del anuncio en las dos pantallas: «12,00 € / unidad» o «Donación».
export function precioDeCabecera({ modalidad, precio_unitario_centimos: centimos }) {
  return modalidad === 'donacion' ? TEXTOS.donacion : `${formatearEuros(centimos)} / unidad`;
}

// La miniatura de /mensajes/nueva sale de las fotos del detalle (GET /api/catalogo/:id): la principal.
export function fotoPrincipal(anuncio) {
  return anuncio.foto_principal_url ?? fotosDelDetalle(anuncio.fotos)[0]?.url ?? null;
}

// CA33 y CA34: banda de estado de la conversación según el estado del anuncio.
export function bandaDeEstado(estado) {
  if (estado === 'pausado' || estado === 'entregado') return TEXTOS.bandaNoDisponible;
  if (estado === 'retirado') return TEXTOS.bandaRetirado;
  return null;
}

// CA34: con el anuncio retirado, el título deja de ser enlace.
export function tituloConEnlace(estado) {
  return estado !== 'retirado';
}

// Cabecera de /mensajes/:id: nombre del otro centro con enlace a su perfil, o «Centro eliminado» sin enlace.
export function otroCentro({ id, nombre, eliminado }) {
  if (eliminado) return { nombre: TEXTOS.centroEliminado, enlace: null };
  return { nombre, enlace: `/centros/${encodeURIComponent(id)}` };
}

// CA5: en /mensajes/nueva solo se puede escribir sobre un anuncio de otro centro, activo o reservado.
export function anuncioAdmiteConversacion(anuncio) {
  return Boolean(anuncio) && anuncio.es_propio !== true && ['activo', 'reservado'].includes(anuncio.estado);
}

// Mensaje de cada pie de mensaje: «dd/mm/aaaa hh:mm».
export function fechaDelMensaje(mensaje) {
  return formatearFechaHora(mensaje.creado_en);
}

// CA17, CA18, CA21, CA26 y CA35: qué hacer cuando falla un envío. Devuelve `{ ir }` si hay que navegar
// (CONVERSACION_YA_EXISTE) o `{ aviso }` con el texto del aviso rojo. El texto escrito se conserva siempre.
export function resultadoDelFallo(fallo) {
  const codigo = fallo?.code;
  if (codigo === 'CONVERSACION_YA_EXISTE' && fallo.details?.conversacion_id) {
    return { ir: `/mensajes/${encodeURIComponent(fallo.details.conversacion_id)}` };
  }
  const textos = {
    ANUNCIO_NO_DISPONIBLE: 'Este anuncio ya no está disponible.',
    ANUNCIO_PROPIO: 'No puedes escribirte sobre tu propio anuncio.',
    DEMASIADOS_INTENTOS: 'Has enviado demasiados mensajes seguidos. Espera un minuto.',
    CENTRO_ELIMINADO: TEXTOS.sinEscribir,
  };
  if (textos[codigo]) return { aviso: textos[codigo] };
  if (codigo === 'DATOS_INVALIDOS' && typeof fallo.details?.texto === 'string') return { aviso: fallo.details.texto };
  return { aviso: MENSAJE_ERROR_GENERICO };
}

// CA12 y CA14: une mensajes nuevos al hilo sin repetir (el sondeo puede traer uno que ya se añadió al enviarlo).
export function conMensajesNuevos(hilo, nuevos) {
  const vistos = new Set(hilo.map((mensaje) => mensaje.id));
  return [...hilo, ...nuevos.filter((mensaje) => !vistos.has(mensaje.id))];
}

// «Ver mensajes anteriores» pone los 50 anteriores delante, también sin repetir.
export function conMensajesAnteriores(hilo, anteriores) {
  const vistos = new Set(hilo.map((mensaje) => mensaje.id));
  return [...anteriores.filter((mensaje) => !vistos.has(mensaje.id)), ...hilo];
}

// CA14: el sondeo pide `?despues=<último id>`.
export function ultimoId(hilo) {
  return hilo.length > 0 ? hilo[hilo.length - 1].id : null;
}
