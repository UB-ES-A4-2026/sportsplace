// Iniciales de un centro para su avatar (diseño con vida, #361): la primera letra de las dos primeras palabras con
// contenido, sin artículos ni preposiciones. «Club Natació Sabadell» → «CN»; «Escola de Bàsquet Gràcia» → «EB»;
// «CE Montjuïc» → «CM». El avatar es decorativo (aria-hidden): el nombre completo siempre va escrito al lado.
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'i', 'y', 'e', 'les', 'l', 'd']);

export function inicialesDe(nombre) {
  const palabras = String(nombre ?? '')
    .split(/[\s'’·.-]+/)
    .filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra.toLocaleLowerCase('es')))
    .filter((palabra) => /\p{L}|\p{N}/u.test(palabra));
  return palabras
    .slice(0, 2)
    .map((palabra) => [...palabra].find((caracter) => /\p{L}|\p{N}/u.test(caracter)))
    .join('')
    .toLocaleUpperCase('es');
}
