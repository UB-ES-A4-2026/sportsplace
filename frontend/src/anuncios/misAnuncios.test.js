import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  conFilaActualizada,
  paginaCorregida,
  paginaDeLaUrl,
  sinFila,
  TEXTOS,
  textoCategoriaDeporte,
  textoTotal,
  textoUnidades,
  totalDePaginas,
} from './misAnuncios.js';

describe('paginaDeLaUrl (CA2)', () => {
  test('número entero ≥ 1 → esa página', () => {
    assert.equal(paginaDeLaUrl('2'), 2);
    assert.equal(paginaDeLaUrl('15'), 15);
  });

  test('sin valor, no numérica, decimal o < 1 → la 1', () => {
    for (const valor of [null, '', 'abc', '0', '-3', '1.5', '2x']) {
      assert.equal(paginaDeLaUrl(valor), 1, `valor ${JSON.stringify(valor)}`);
    }
  });
});

describe('paginación (CA5, CA10, CA15)', () => {
  test('CA15: 21 anuncios → 2 páginas; 20 → 1; 0 → 1', () => {
    assert.equal(totalDePaginas(21), 2);
    assert.equal(totalDePaginas(20), 1);
    assert.equal(totalDePaginas(0), 1);
  });

  test('CA10: página mayor que la última → la última', () => {
    assert.equal(paginaCorregida(3, 21), 2);
    assert.equal(paginaCorregida(2, 20), 1);
  });

  test('página válida o lista vacía → no hay que corregir', () => {
    assert.equal(paginaCorregida(2, 21), null);
    assert.equal(paginaCorregida(1, 0), null);
    assert.equal(paginaCorregida(4, 0), null);
  });
});

describe('textos de la lista', () => {
  test('«n anuncios» o «1 anuncio»', () => {
    assert.equal(textoTotal(1), '1 anuncio');
    assert.equal(textoTotal(4), '4 anuncios');
    assert.equal(textoTotal(0), '0 anuncios');
  });

  test('«12 unidades» o «1 unidad»', () => {
    assert.equal(textoUnidades(1), '1 unidad');
    assert.equal(textoUnidades(12), '12 unidades');
  });

  test('«Balones · Fútbol»', () => {
    assert.equal(textoCategoriaDeporte({ categoria: 'balones', deporte: 'futbol' }), 'Balones · Fútbol');
    assert.equal(textoCategoriaDeporte({ categoria: 'ropa_equipacion', deporte: 'gimnasio_fitness' }),
      'Ropa y equipación · Gimnasio y fitness');
  });

  test('CA8 y CA9: textos exactos', () => {
    assert.equal(TEXTOS.vacio, 'Todavía no has publicado ningún anuncio.');
    assert.equal(TEXTOS.publicarPrimero, 'Publicar tu primer anuncio');
    assert.equal(TEXTOS.cargando, 'Cargando…');
    assert.equal(TEXTOS.error, 'No se ha podido cargar. ');
    assert.equal(TEXTOS.reintentar, 'Reintentar');
  });
});

describe('actualizar filas tras una acción (CA6, CA7)', () => {
  const lista = {
    anuncios: [{ id: 'a', estado: 'activo' }, { id: 'b', estado: 'activo' }, { id: 'c', estado: 'reservado' }],
    total: 23,
    pagina: 2,
    por_pagina: 20,
  };

  test('la fila se sustituye por el anuncio devuelto sin moverse', () => {
    assert.deepEqual(conFilaActualizada(lista.anuncios, { id: 'b', estado: 'pausado' }),
      [{ id: 'a', estado: 'activo' }, { id: 'b', estado: 'pausado' }, { id: 'c', estado: 'reservado' }]);
  });

  test('al retirar, la fila desaparece, el total baja y se queda en la misma página', () => {
    assert.deepEqual(sinFila(lista, 'a'), {
      anuncios: [{ id: 'b', estado: 'activo' }, { id: 'c', estado: 'reservado' }],
      total: 22,
      pagina: 2,
      por_pagina: 20,
    });
  });

  test('un id que no está en la página no cambia nada', () => {
    assert.deepEqual(sinFila(lista, 'z'), lista);
  });
});
