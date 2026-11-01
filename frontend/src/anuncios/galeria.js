// Galería de la ficha (US-13 T13-4): qué foto se ve grande y el texto alternativo de cada imagen.
// `fotos` es el array del objeto `anuncio` del contrato: [{ id, url, orden, es_principal }] ordenado por `orden`.

export const TEXTO_SIN_FOTOS = 'Sin fotos';

// Las fotos en orden de `orden`, aunque la API las devolviera desordenadas.
export function fotosOrdenadas(fotos) {
  return [...(fotos ?? [])].sort((a, b) => a.orden - b.orden);
}

// CA9: al cargar la ficha se ve la principal (si por error no hubiera ninguna marcada, la primera).
export function fotoInicial(fotos) {
  const lista = fotosOrdenadas(fotos);
  return (lista.find((foto) => foto.es_principal) ?? lista[0])?.id ?? null;
}

// CA10: `alt` = título del anuncio en la principal y «<título> · foto n» en el resto (n = posición, 1..8).
export function textoAlternativo(titulo, foto, fotos) {
  if (foto.es_principal) return titulo;
  const posicion = fotosOrdenadas(fotos).findIndex((candidata) => candidata.id === foto.id) + 1;
  return `${titulo} · foto ${posicion}`;
}
