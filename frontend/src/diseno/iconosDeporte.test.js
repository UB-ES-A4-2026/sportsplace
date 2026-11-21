import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAZOS, COLORES_DEPORTE, ICONO_CATEGORIA, trazosDe, coloresDeporte, iconoCategoria, barrasEstado,
} from './iconosDeporte.js';
import { CATEGORIAS as LISTA_CATEGORIAS, DEPORTES as LISTA_DEPORTES } from '../anuncios/valores.js';

// Slugs del diccionario de E04, leídos de anuncios/valores.js: si se añade un deporte o una categoría, este test
// obliga a darle icono y colores.
const DEPORTES = LISTA_DEPORTES.map(({ valor }) => valor);
const CATEGORIAS = LISTA_CATEGORIAS.map(({ valor }) => valor);

describe('iconosDeporte (diseño S2)', () => {
  test('cada deporte de E04 tiene trazos y colores', () => {
    for (const slug of DEPORTES) {
      assert.ok(TRAZOS[slug]?.length > 0, `faltan trazos de ${slug}`);
      assert.match(COLORES_DEPORTE[slug].color, /^#[0-9A-F]{6}$/);
      assert.match(COLORES_DEPORTE[slug].tinte, /^#[0-9A-F]{6}$/);
    }
  });

  test('cada categoría de E04 tiene un icono que existe', () => {
    for (const slug of CATEGORIAS) assert.ok(TRAZOS[ICONO_CATEGORIA[slug]], `sin icono para ${slug}`);
  });

  test('un slug desconocido cae en «varios»', () => {
    assert.equal(trazosDe('golf'), TRAZOS.varios);
    assert.deepEqual(coloresDeporte('golf'), COLORES_DEPORTE.varios);
    assert.equal(iconoCategoria('pelotas'), 'varios');
  });

  test('un slug conocido devuelve lo suyo', () => {
    assert.equal(trazosDe('tenis'), TRAZOS.tenis);
    assert.equal(coloresDeporte('natacion').color, '#1D4ED8');
    assert.equal(iconoCategoria('balones'), 'balon');
  });

  test('barritas del estado del material', () => {
    assert.deepEqual(barrasEstado('nuevo'), [true, true, true, true, true]);
    assert.deepEqual(barrasEstado('buen_estado'), [true, true, true, false, false]);
    assert.deepEqual(barrasEstado('para_reparar'), [true, false, false, false, false]);
    assert.deepEqual(barrasEstado('otro'), [false, false, false, false, false]);
  });
});
