import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CARACTERES,
  TEXTOS,
  busquedaDeUrl,
  conBusqueda,
  leerBusqueda,
  mismaBusqueda,
  normalizarBusqueda,
  sinBusqueda,
  textoResultados,
  textoSinResultados,
  validarBusqueda,
} from './busqueda.js';

const url = (texto) => new URLSearchParams(texto);

test('US-21 · textos de la especificación', () => {
  assert.equal(TEXTOS.ejemplo, 'Buscar material…');
  assert.equal(TEXTOS.buscar, 'Buscar');
  assert.equal(TEXTOS.corta, 'Escribe al menos 2 caracteres.');
  assert.equal(TEXTOS.palabras, 'Usa como máximo 5 palabras.');
  assert.equal(TEXTOS.consejo, 'Prueba con otras palabras o quita algún filtro.');
  assert.equal(TEXTOS.quitarTodo, 'Quitar búsqueda y filtros');
  assert.equal(MAX_CARACTERES, 100); // CA1: maxlength del cuadro
});

test('US-21 · CA2 · quita espacios de los extremos y reduce los repetidos', () => {
  assert.equal(normalizarBusqueda('  balon   futbol \t 7 '), 'balon futbol 7');
  assert.equal(normalizarBusqueda('\n balón  fútbol '), 'balón fútbol');
  assert.equal(normalizarBusqueda(undefined), '');
});

test('US-21 · CA3 · vacío o solo espacios no es un error: no hay búsqueda', () => {
  for (const texto of ['', '   ', '\t\n']) assert.deepEqual(validarBusqueda(texto), { valor: null });
});

test('US-21 · CA4 · 1 carácter no se busca; 2 sí', () => {
  assert.deepEqual(validarBusqueda('a'), { error: 'Escribe al menos 2 caracteres.' });
  assert.deepEqual(validarBusqueda(' a '), { error: 'Escribe al menos 2 caracteres.' }); // E2E-3
  assert.deepEqual(validarBusqueda('pa'), { valor: 'pa' });
  // Un emoji es un carácter (como en la API), aunque en JS ocupe 2 unidades.
  assert.deepEqual(validarBusqueda('⚽'), { error: 'Escribe al menos 2 caracteres.' });
});

test('US-21 · CA5 · como máximo 5 palabras', () => {
  assert.deepEqual(validarBusqueda('uno dos tres cuatro cinco'), { valor: 'uno dos tres cuatro cinco' });
  assert.deepEqual(validarBusqueda('uno dos tres cuatro cinco seis'), { error: 'Usa como máximo 5 palabras.' }); // E2E-3
  // Los espacios repetidos no crean palabras vacías (CA2 antes que CA5).
  assert.deepEqual(validarBusqueda('uno    dos   tres  cuatro   cinco'), { valor: 'uno dos tres cuatro cinco' });
});

test('US-21 · CA20 · más de 100 caracteres (solo posible desde la URL)', () => {
  assert.deepEqual(validarBusqueda('a'.repeat(100)), { valor: 'a'.repeat(100) });
  assert.deepEqual(validarBusqueda('a'.repeat(101)), { error: 'La búsqueda puede tener como máximo 100 caracteres.' });
});

test('US-21 · CA11 y CA23 · los símbolos se envían tal cual', () => {
  assert.deepEqual(validarBusqueda('%%'), { valor: '%%' });
  assert.deepEqual(validarBusqueda('50% _x\\'), { valor: '50% _x\\' });
});

test('US-21 · CA6 y CA13 · buscar escribe `q`, vuelve a la página 1 y conserva filtros y orden', () => {
  const { parametros } = conBusqueda(url('categoria=balones&pagina=3&orden=recientes'), '  balon   futbol ');
  assert.equal(parametros.get('q'), 'balon futbol');
  assert.equal(parametros.get('pagina'), null);
  assert.equal(parametros.get('categoria'), 'balones');
  assert.equal(parametros.get('orden'), 'recientes');
  // E2E-1: la URL pasa a `?q=BALON` (sin cambiar mayúsculas: las ignora la API, CA8).
  assert.equal(busquedaDeUrl(conBusqueda(url(''), 'BALON').parametros), '?q=BALON');
  assert.equal(busquedaDeUrl(conBusqueda(url(''), 'balon futbol').parametros), '?q=balon+futbol');
});

test('US-21 · CA4 y CA5 · con error no se busca y la URL no cambia', () => {
  assert.deepEqual(conBusqueda(url('q=balon&pagina=2'), 'a'), { error: 'Escribe al menos 2 caracteres.' });
  assert.deepEqual(conBusqueda(url(''), 'uno dos tres cuatro cinco seis'), { error: 'Usa como máximo 5 palabras.' });
});

test('US-21 · CA3 · buscar con el cuadro vacío quita `q`', () => {
  const { parametros } = conBusqueda(url('q=balon&categoria=balones&pagina=2'), '   ');
  assert.equal(busquedaDeUrl(parametros), '?categoria=balones');
});

test('US-21 · CA14 · la «×» quita `q` y la página, y conserva los filtros (E2E-4)', () => {
  assert.equal(busquedaDeUrl(sinBusqueda(url('q=balon&categoria=balones'))), '?categoria=balones');
  assert.equal(busquedaDeUrl(sinBusqueda(url('q=balon&pagina=2'))), '');
  assert.equal(busquedaDeUrl(sinBusqueda(url('estado_material=nuevo,usado&q=x1'))), '?estado_material=nuevo,usado');
});

test('US-21 · CA15 · `q` de la URL rellena el cuadro', () => {
  assert.deepEqual(leerBusqueda(url('q=balon')), { q: 'balon', corregidos: null });
  assert.deepEqual(leerBusqueda(url('q=balon+futbol&categoria=balones')), { q: 'balon futbol', corregidos: null });
  assert.deepEqual(leerBusqueda(url('categoria=balones')), { q: null, corregidos: null });
  // Espacios de más: se busca normalizado, sin reescribir la URL.
  assert.deepEqual(leerBusqueda(url('q=%20balon%20%20futbol%20')), { q: 'balon futbol', corregidos: null });
});

test('US-21 · E04 «Web» · un `q` no aceptado en la URL se quita sin error', () => {
  for (const malo of ['q=a', 'q=', 'q=%20%20', `q=${'a'.repeat(101)}`, 'q=uno+dos+tres+cuatro+cinco+seis', 'q=ab&q=cd']) {
    const { q, corregidos } = leerBusqueda(url(`${malo}&categoria=balones&pagina=2`));
    assert.equal(q, null, malo);
    assert.equal(corregidos.toString(), 'categoria=balones&pagina=2', malo);
  }
});

test('US-21 · buscar lo mismo no cambia la URL', () => {
  assert.equal(mismaBusqueda(url('q=balon&categoria=balones'), conBusqueda(url('q=balon&categoria=balones'), ' balon ').parametros), true);
  assert.equal(mismaBusqueda(url('q=balon'), conBusqueda(url('q=balon'), 'red').parametros), false);
});

test('US-21 · CA17 · línea de resultados con búsqueda (y US-96 CA11 sin ella)', () => {
  assert.equal(textoResultados(3, 'balon futbol'), '3 anuncios para «balon futbol»');
  assert.equal(textoResultados(1, 'BALON'), '1 anuncio para «BALON»'); // E2E-1
  assert.equal(textoResultados(0, 'balon'), '0 anuncios para «balon»');
  assert.equal(textoResultados(41, null), '41 anuncios');
  assert.equal(textoResultados(1, null), '1 anuncio');
});

test('US-21 · CA18 · sin resultados', () => {
  assert.equal(textoSinResultados('futbol padel'), 'No hay anuncios para «futbol padel».'); // E2E-2
});
