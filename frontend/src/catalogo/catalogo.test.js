import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  TEXTOS, conPagina, consultaDeApi, hayPaginacion, leerPagina, paginaFueraDeRango, textoPagina, tipoDeVacio,
} from './catalogo.js';

const url = (texto) => new URLSearchParams(texto);

describe('leerPagina (CA9 y CA10)', () => {
  test('sin `pagina` es la 1 y no hay nada que corregir', () => {
    assert.deepEqual(leerPagina(url('')), { pagina: 1, corregidos: null });
    assert.deepEqual(leerPagina(url('categoria=balones')), { pagina: 1, corregidos: null });
  });

  test('una página válida mayor que 1 se usa tal cual', () => {
    assert.deepEqual(leerPagina(url('pagina=2')), { pagina: 2, corregidos: null });
    assert.deepEqual(leerPagina(url('q=balon&pagina=9')), { pagina: 9, corregidos: null });
    assert.deepEqual(leerPagina(url('pagina=10000')), { pagina: 10000, corregidos: null });
  });

  test('`pagina=0`, `-1`, `abc` y `1.5` cargan la 1 y se quitan de la URL', () => {
    for (const valor of ['0', '-1', 'abc', '1.5', '', '10001']) {
      const { pagina, corregidos } = leerPagina(url(`categoria=balones&pagina=${valor}`));
      assert.equal(pagina, 1, valor);
      assert.equal(corregidos.toString(), 'categoria=balones', valor);
    }
  });

  test('la página 1 escrita a mano se quita (la página por defecto no va en la URL)', () => {
    const { pagina, corregidos } = leerPagina(url('q=balon&pagina=1'));
    assert.equal(pagina, 1);
    assert.equal(corregidos.toString(), 'q=balon');
  });

  test('el parámetro repetido no se acepta', () => {
    const { pagina, corregidos } = leerPagina(url('pagina=2&pagina=3'));
    assert.equal(pagina, 1);
    assert.equal(corregidos.toString(), '');
  });
});

describe('conPagina (CA9)', () => {
  test('escribe la página y conserva la búsqueda y los filtros', () => {
    assert.equal(conPagina(url('q=balon&categoria=balones'), 2).toString(), 'q=balon&categoria=balones&pagina=2');
  });

  test('la página 1 no se escribe', () => {
    assert.equal(conPagina(url('categoria=balones&pagina=2'), 1).toString(), 'categoria=balones');
    assert.equal(conPagina(url('pagina=3'), 1).toString(), '');
  });
});

describe('paginaFueraDeRango (CA10 y CA18)', () => {
  test('una página mayor que la última va a la última', () => {
    assert.equal(paginaFueraDeRango(9, { total_paginas: 3 }), 3);
  });

  test('dentro del rango, o sin anuncios, no hay que corregir', () => {
    assert.equal(paginaFueraDeRango(3, { total_paginas: 3 }), null);
    assert.equal(paginaFueraDeRango(1, { total_paginas: 3 }), null);
    assert.equal(paginaFueraDeRango(4, { total_paginas: 0 }), null);
  });
});

describe('paginación (CA7 y CA8)', () => {
  test('solo hay paginación con más de una página', () => {
    assert.equal(hayPaginacion({ total_paginas: 3 }), true);
    assert.equal(hayPaginacion({ total_paginas: 1 }), false);
    assert.equal(hayPaginacion({ total_paginas: 0 }), false);
  });

  test('«Página X de Y»', () => {
    assert.equal(textoPagina(2, 3), 'Página 2 de 3');
  });
});

describe('consultaDeApi', () => {
  test('sin búsqueda, filtros ni página no envía nada', () => {
    assert.deepEqual(consultaDeApi({ q: null, filtros: {}, pagina: 1 }), {});
  });

  test('junta `q`, los filtros de la barra y la página con los nombres de la URL', () => {
    const filtros = { categoria: 'balones', estado_material: 'nuevo,usado', precio_max: '20' };
    assert.deepEqual(consultaDeApi({ q: 'balon futbol', filtros, pagina: 2 }), {
      q: 'balon futbol', categoria: 'balones', estado_material: 'nuevo,usado', precio_max: '20', pagina: '2',
    });
  });
});

describe('tipoDeVacio', () => {
  test('con búsqueda: el bloque de US-21 CA18, aunque haya filtros', () => {
    assert.equal(tipoDeVacio({ q: 'trampolin', filtrosActivos: 2 }), 'busqueda');
  });

  test('solo con filtros: «No hay anuncios con estos filtros.» (US-22 CA10)', () => {
    assert.equal(tipoDeVacio({ q: null, filtrosActivos: 1 }), 'filtros');
  });

  test('sin búsqueda ni filtros: el catálogo está vacío (US-96 CA14)', () => {
    assert.equal(tipoDeVacio({ q: null, filtrosActivos: 0 }), 'catalogo');
    assert.equal(TEXTOS.vacio, 'Todavía no hay anuncios de otros centros. Vuelve más tarde o publica el tuyo.');
  });
});
