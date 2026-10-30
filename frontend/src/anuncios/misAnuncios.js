// «Mis anuncios» (US-18 T18-2): página de la URL, textos de la lista y actualización de filas.
import { CATEGORIAS, DEPORTES, etiquetaDe } from './valores.js';

export const POR_PAGINA = 20;

export const TEXTOS = {
  vacio: 'Todavía no has publicado ningún anuncio.',
  publicarPrimero: 'Publicar tu primer anuncio',
  cargando: 'Cargando…',
  error: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
};

// CA2: `?pagina=` no numérica, decimal o < 1 → se muestra la 1.
export function paginaDeLaUrl(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

export function totalDePaginas(total, porPagina = POR_PAGINA) {
  return Math.max(1, Math.ceil(total / porPagina));
}

// CA10: si se pide una página mayor que la última y hay anuncios, se va a la última. Si no hace falta, null.
export function paginaCorregida(pagina, total, porPagina = POR_PAGINA) {
  const ultima = totalDePaginas(total, porPagina);
  return total > 0 && pagina > ultima ? ultima : null;
}

// «n anuncios» o «1 anuncio».
export function textoTotal(total) {
  return total === 1 ? '1 anuncio' : `${total} anuncios`;
}

// «12 unidades» o «1 unidad».
export function textoUnidades(unidades) {
  return unidades === 1 ? '1 unidad' : `${unidades} unidades`;
}

// «Balones · Fútbol».
export function textoCategoriaDeporte({ categoria, deporte }) {
  return `${etiquetaDe(CATEGORIAS, categoria)} · ${etiquetaDe(DEPORTES, deporte)}`;
}

// CA6-CA7: tras una acción, la fila se sustituye por el anuncio devuelto sin cambiar de posición.
export function conFilaActualizada(anuncios, anuncio) {
  return anuncios.map((fila) => (fila.id === anuncio.id ? { ...fila, ...anuncio } : fila));
}

// CA6: si se retira, la fila desaparece y el total baja en uno.
export function sinFila(lista, id) {
  const anuncios = lista.anuncios.filter((fila) => fila.id !== id);
  return { ...lista, anuncios, total: lista.total - (lista.anuncios.length - anuncios.length) };
}
