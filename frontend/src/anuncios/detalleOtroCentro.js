// Vista de un anuncio de otro centro en /anuncios/:id (US-24 T24-2 y T24-3): textos de la pantalla, orden y
// navegación de la galería, formatos, estado de los botones y destino de «← Volver al catálogo».
// `anuncio` es la respuesta de GET /api/catalogo/:id (US-24 CA12).
import { formatearEuros } from '../utilidades/euros.js';

export const RUTA_CATALOGO = '/catalogo';

export const TEXTOS = {
  volver: '← Volver al catálogo',
  reservado: 'No disponible: este material está reservado.',
  noDisponible: 'Este anuncio no existe o ya no está disponible.',
  irAlCatalogo: 'Ir al catálogo',
  detalles: 'Detalles',
  pedir: 'Pedir material',
  escribir: 'Escribir al centro',
  proximamente: 'Disponible próximamente',
  ofrecidoPor: 'Ofrecido por',
  descripcion: 'Descripción',
  sinFoto: 'Sin foto',
};

// CA2 y CA14: si el anuncio es del propio centro, la web muestra la ficha de propietario de E03.
export function esDelPropioCentro(anuncio) {
  return anuncio?.es_propio === true;
}

// CA6 y CA12: la principal primero y después por `orden`, aunque la API las devolviera desordenadas.
export function fotosDelDetalle(fotos) {
  return [...(fotos ?? [])].sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.orden - b.orden);
}

// CA6: con 1 foto (o ninguna) no hay flechas ni miniaturas.
export function hayNavegacion(total) {
  return total > 1;
}

// CA6: las flechas avanzan y retroceden en bucle (de la última a la primera y al revés).
export function fotoSiguiente(indice, total) {
  return total > 0 ? (indice + 1) % total : 0;
}

export function fotoAnterior(indice, total) {
  return total > 0 ? (indice - 1 + total) % total : 0;
}

// CA6: ← y → del teclado cambian de foto. Devuelve el índice nuevo, o null si la tecla no es una flecha.
export function fotoConTecla(tecla, indice, total) {
  if (!hayNavegacion(total)) return null;
  if (tecla === 'ArrowRight') return fotoSiguiente(indice, total);
  if (tecla === 'ArrowLeft') return fotoAnterior(indice, total);
  return null;
}

// CA7: `alt` «Foto N de M: <título>» (N empieza en 1).
export function textoAlternativoDeFoto(posicion, total, titulo) {
  return `Foto ${posicion} de ${total}: ${titulo}`;
}

// CA9: «1 unidad» / «N unidades».
export function textoUnidades(unidades) {
  return unidades === 1 ? '1 unidad' : `${unidades} unidades`;
}

// Pantalla, punto 3: «12,50 € / unidad» o «Gratis · Donación».
export function precioDelDetalle({ modalidad, precio_unitario_centimos: centimos }) {
  if (modalidad === 'donacion') return 'Gratis · Donación';
  return `${formatearEuros(centimos)} / unidad`;
}

// CA3, CA4 y CA10: «Pedir material» depende de US-32 y «Escribir al centro» de US-28. Mientras no existan, los dos
// se ven deshabilitados con «Disponible próximamente». Con un anuncio reservado, «Pedir material» queda deshabilitado
// y «Escribir al centro» no.
export function botonesDelDetalle(anuncio, { pedidos = false, mensajes = false } = {}) {
  const reservado = anuncio.estado === 'reservado';
  return {
    pedir: { habilitado: pedidos && !reservado, ayuda: pedidos ? null : TEXTOS.proximamente },
    escribir: { habilitado: mensajes, ayuda: mensajes ? null : TEXTOS.proximamente },
  };
}

// CA1 (T24-3): la tarjeta del catálogo deja en `state.desde` la URL de la que se viene (ruta + `q`, filtros y
// `pagina`). Solo se acepta una URL de /catalogo; si se entró por el enlace, se vuelve a /catalogo.
export function destinoDeVolver(estadoDeLaRuta) {
  const desde = estadoDeLaRuta?.desde;
  if (typeof desde !== 'string') return RUTA_CATALOGO;
  return desde === RUTA_CATALOGO || desde.startsWith(`${RUTA_CATALOGO}?`) ? desde : RUTA_CATALOGO;
}

// Bloque «Ofrecido por» (US-23): «12,4 km». Sin coordenadas de alguno de los dos centros la API da null y no se pinta.
export function textoDistancia(km) {
  if (typeof km !== 'number' || !Number.isFinite(km)) return null;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

// Qué se muestra en /anuncios/:id. La ruta la comparten la ficha de propietario (E03) y la vista de otro centro.
// 1. GET /api/catalogo/:id: con `es_propio` → ficha de propietario (CA2, CA14); si no → vista de otro centro.
// 2. Un 404 del catálogo puede ser un anuncio propio que no está a la vista de los demás (pausado o entregado): se
//    pregunta a GET /api/anuncios/:id. Si también da 404, no existe o no está disponible (CA5, CA13).
// 3. Cualquier otro fallo (red, 500, 503): «No se ha podido cargar. » con «Reintentar» (CA11).
export const VISTAS = {
  propietario: 'propietario',
  otroCentro: 'otro-centro',
  comprobarPropietario: 'comprobar-propietario',
  noDisponible: 'no-disponible',
  error: 'error',
};

export function vistaSegunCatalogo({ anuncio, fallo } = {}) {
  if (anuncio) return esDelPropioCentro(anuncio) ? VISTAS.propietario : VISTAS.otroCentro;
  return fallo?.status === 404 ? VISTAS.comprobarPropietario : VISTAS.error;
}

export function vistaSegunPropietario({ anuncio, fallo } = {}) {
  if (anuncio) return VISTAS.propietario;
  return fallo?.status === 404 ? VISTAS.noDisponible : VISTAS.error;
}
