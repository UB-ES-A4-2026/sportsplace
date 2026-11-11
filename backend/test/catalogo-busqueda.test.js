import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createAnunciosRepository } from '../src/repositories/anuncios.js';
import { validarConsultaCatalogo } from '../src/validation/catalogo.js';
import { startApi } from './helpers.js';

test('US-21 CA2–CA3: q ausente o en blanco conserva la consulta sin búsqueda', () => {
  for (const q of [undefined, '', '  \t\n  ']) {
    assert.deepEqual(validarConsultaCatalogo({ q, pagina: '3' }), { pagina: 3 });
  }
});

test('US-21 CA2, CA11 y CA23: normaliza espacios y conserva acentos y símbolos', () => {
  assert.deepEqual(validarConsultaCatalogo({ q: ' \tBALÓN   fútbol\n %%_\\ ' }), {
    pagina: 1,
    q: 'BALÓN fútbol %%_\\',
  });
  assert.deepEqual(validarConsultaCatalogo({ q: '%%' }), { pagina: 1, q: '%%' });
});

test('US-21 CA4–CA5 y CA20: admite 2 y 100 caracteres Unicode y hasta 5 palabras', () => {
  for (const q of ['pa', '🏀'.repeat(100), 'uno dos tres cuatro cinco']) {
    assert.deepEqual(validarConsultaCatalogo({ q }), { pagina: 1, q });
  }
  for (const [q, mensaje] of [
    ['  🏀 ', 'Escribe al menos 2 caracteres.'],
    ['🏀'.repeat(101), 'La búsqueda puede tener como máximo 100 caracteres.'],
    ['uno dos tres cuatro cinco seis', 'Usa como máximo 5 palabras.'],
    [['balón', 'pádel'], 'La búsqueda no es válida.'],
    ['balón\0', 'La búsqueda no es válida.'],
  ]) {
    assert.throws(() => validarConsultaCatalogo({ q }), {
      status: 400,
      code: 'DATOS_INVALIDOS',
      details: { q: mensaje },
    });
  }
});

const llamadas = [];
let api;

before(async () => {
  api = await startApi({
    auth: { getUser: async () => ({ id: 'usuario-a', email_confirmado: true }) },
    anuncios: {
      async listarCatalogo(usuarioId, consulta) {
        llamadas.push({ usuarioId, consulta });
        return { anuncios: [], pagina: consulta.pagina, por_pagina: 20, total: 0, total_paginas: 0 };
      },
    },
  });
});
after(() => api.close());

const catalogo = (query) => fetch(`${api.baseUrl}/api/catalogo?${query}`, {
  headers: { Authorization: 'Bearer token-a' },
});

test('GET /api/catalogo pasa q normalizado y pagina al repositorio', async () => {
  const respuesta = await catalogo('q=%20BAL%C3%93N%20%20f%C3%BAtbol%20&pagina=2');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(llamadas.at(-1), {
    usuarioId: 'usuario-a',
    consulta: { pagina: 2, q: 'BALÓN fútbol' },
  });
});

test('GET /api/catalogo devuelve details.q y omite la consulta cuando q es inválido', async () => {
  const llamadasPrevias = llamadas.length;
  const casos = [
    ['q=a', 'Escribe al menos 2 caracteres.'],
    ['q=balones&q=raquetas', 'La búsqueda no es válida.'],
  ];
  for (const [query, mensaje] of casos) {
    const respuesta = await catalogo(query);
    assert.equal(respuesta.status, 400);
    assert.deepEqual(await respuesta.json(), {
      error: { code: 'DATOS_INVALIDOS', message: 'Revisa los campos marcados.', details: { q: mensaje } },
    });
  }
  assert.equal(llamadas.length, llamadasPrevias);
});

test('US-21 CA19: el listado y el total usan los mismos términos ligados sin alterar la página', async () => {
  const consultas = [];
  const respuestas = [[{ total: 22 }], []];
  const database = {
    async query(sql, valores) {
      consultas.push({ sql, valores });
      return { rows: respuestas.shift() };
    },
  };
  const repo = createAnunciosRepository(database);
  const resultado = await repo.listarCatalogo('usuario-a', { pagina: 3, q: "BALÓN %_\\!'" });
  const [total, listado] = consultas;
  assert.deepEqual(resultado, { anuncios: [], pagina: 3, por_pagina: 20, total: 22, total_paginas: 2 });
  assert.deepEqual(total.valores, ['usuario-a', 'BALÓN', "%_\\!'"]);
  assert.deepEqual(listado.valores, [...total.valores, 20, 40]);
  const filtroTotal = total.sql.slice(total.sql.indexOf('WHERE '));
  const filtroListado = listado.sql.slice(listado.sql.indexOf('WHERE '), listado.sql.indexOf('ORDER BY'));
  assert.equal(filtroListado.trim(), filtroTotal.trim());
  assert.match(filtroTotal, /normalizar_busqueda_catalogo\(\$2\)/);
  assert.match(filtroTotal, /normalizar_busqueda_catalogo\(\$3\)/);
  assert.doesNotMatch(total.sql, /BALÓN/);
  assert.match(listado.sql, /LIMIT \$4 OFFSET \$5/);
});
