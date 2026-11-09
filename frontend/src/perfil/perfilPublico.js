// Perfil de otro centro en /centros/:id (US-10 T10-2): textos de la pantalla, cabecera, contacto, paginación de sus
// anuncios y qué se muestra según la carga. `centro` es la respuesta de GET /api/centros/:id (CA11).
import { formatearFecha } from '../anuncios/ficha.js';
import { textoZona } from './ubicacion.js';

export const RUTA_CATALOGO = '/catalogo';
export const ANUNCIOS_POR_PAGINA = 20;

export const TEXTOS = {
  titulo: 'Perfil de centro',
  sobreNosotros: 'Sobre nosotros',
  contacto: 'Contacto',
  sinContacto: 'Este centro no ha indicado datos de contacto.',
  sinAnuncios: 'Este centro no tiene anuncios activos ahora mismo.',
  noEncontradoTitulo: 'Centro no encontrado',
  noEncontradoTexto: 'Este centro no existe o ya no está en Sportsplace.',
  irAlCatalogo: 'Ir al catálogo',
  bandaPropia: 'Así ven tu perfil los demás centros.',
  editarPerfil: 'Editar perfil',
  verComoMeVen: 'Ver cómo ven mi perfil',
  anterior: 'Anterior',
  siguiente: 'Siguiente',
  noDisponible: 'No disponible',
};

// Pantalla: «En Sportsplace desde dd/mm/aaaa» a partir de `creado_en` (CA5).
export function textoAntiguedad(creadoEn) {
  return `En Sportsplace desde ${formatearFecha(creadoEn)}`;
}

// CA5 y CA19: «Zona: Barcelona (Barcelona)», o solo la localidad si no hay provincia. Sin localidad no se pinta.
export function zonaDelCentro(centro) {
  return centro?.localidad ? textoZona(centro) : null;
}

// CA8: solo los datos que existan, en este orden. La web se abre en pestaña nueva con rel="noopener noreferrer"; el
// email como mailto: y el teléfono como tel: (sin espacios). Sin ninguno: «Este centro no ha indicado datos de
// contacto.».
export function enlacesDeContacto({ telefono, email_contacto: email, web } = {}) {
  const enlaces = [];
  if (telefono) enlaces.push({ tipo: 'telefono', texto: telefono, href: `tel:${telefono.replace(/\s+/g, '')}` });
  if (email) enlaces.push({ tipo: 'email', texto: email, href: `mailto:${email}` });
  if (web) enlaces.push({ tipo: 'web', texto: web, href: web, externo: true });
  return enlaces;
}

// CA3, CA12 y CA17: la página sale de `?pagina=n`; algo que no sea un entero ≥ 1 cuenta como la 1.
export function paginaDeLaUrl(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

export function totalDePaginas(total) {
  return Math.max(1, Math.ceil((total ?? 0) / ANUNCIOS_POR_PAGINA));
}

// CA17: con 21 anuncios, página 1 sin «Anterior» activo y página 2 sin «Siguiente» activo.
export function paginacion(pagina, total) {
  const paginas = totalDePaginas(total);
  return { pagina, paginas, hayAnterior: pagina > 1, haySiguiente: pagina < paginas };
}

// Encabezado de la sección: «Anuncios activos (n)».
export function tituloDeAnuncios(total) {
  return `Anuncios activos (${total ?? 0})`;
}

// CA6: un anuncio reservado aparece como «No disponible».
export function etiquetaDeAnuncio(anuncio) {
  return anuncio?.estado === 'reservado' ? TEXTOS.noDisponible : null;
}

// Qué se muestra en /centros/:id según la carga de GET /api/centros/:id.
// CA9: 404 (no existe, id que no es UUID o centro eliminado) → «Centro no encontrado».
// CA10: red caída, 500 o 503 → «No se ha podido cargar. » con «Reintentar».
export const VISTAS = { perfil: 'perfil', noEncontrado: 'no-encontrado', error: 'error' };

export function vistaDelPerfil({ centro, fallo } = {}) {
  if (centro) return VISTAS.perfil;
  return fallo?.status === 404 ? VISTAS.noEncontrado : VISTAS.error;
}

// Pantalla: si es mi propio centro (`es_mio`), banda «Así ven tu perfil los demás centros.» con «Editar perfil».
export function esMiCentro(centro) {
  return centro?.es_mio === true;
}

// CA1: el nombre del centro en el detalle del anuncio (US-24) enlaza a /centros/:centro_id.
export function rutaDelCentro(id) {
  return `/centros/${encodeURIComponent(id)}`;
}
