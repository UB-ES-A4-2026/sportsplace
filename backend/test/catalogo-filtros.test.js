import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createAnunciosRepository } from '../src/repositories/anuncios.js';
import { validarConsultaCatalogo } from '../src/validation/catalogo.js';
import { startApi } from './helpers.js';

// E04 T21-3: filtros de GET /api/catalogo (US-22, US-73 y US-74). Los E2E de
// API de T21-7 los prueban contra PostgreSQL; aquí, validación, ruta y SQL.
const PRECIO = 'Indica un precio entero entre 0 y 99.999 €.';

const invalido = (query, details) => assert.throws(() => validarConsultaCatalogo(query), {
  status: 400,
  code: 'DATOS_INVALIDOS',
  details,
});

test('US-22 CA11 y US-74 CA2: acepta los slugs de categoría, deporte y modalidad', () => {
  assert.deepEqual(
    validarConsultaCatalogo({ categoria: 'balones', deporte: 'baloncesto', modalidad: 'donacion' }),
    { pagina: 1, categoria: 'balones', deporte: 'baloncesto', modalidad: 'donacion' },
  );
  // US-22 CA4: «Varios» y «Otros» son valores normales.
  assert.deepEqual(validarConsultaCatalogo({ categoria: 'otros', deporte: 'varios', modalidad: 'venta' }), {
    pagina: 1, categoria: 'otros', deporte: 'varios', modalidad: 'venta',
  });
});

test('E04 base común: un parámetro vacío equivale a no enviarlo y los desconocidos se ignoran', () => {
  assert.deepEqual(validarConsultaCatalogo({
    categoria: '', deporte: '', estado_material: '', precio_min: '', precio_max: '', modalidad: '', color: 'rojo',
  }), { pagina: 1 });
});

test('US-22 CA12–CA13: slug desconocido, en mayúsculas o repetido → 400 con su campo', () => {
  for (const categoria of ['pelotas', 'Balones', ['balones', 'calzado']]) {
    invalido({ categoria }, { categoria: 'Categoría no válida.' });
  }
  for (const deporte of ['golf', 'Futbol', ['futbol', 'tenis']]) {
    invalido({ deporte }, { deporte: 'Deporte no válido.' });
  }
});

test('US-74 CA6: modalidad distinta de venta/donacion → 400', () => {
  for (const modalidad of ['gratis', 'Venta', 'donación', ['venta', 'donacion']]) {
    invalido({ modalidad }, { modalidad: 'Modalidad no válida.' });
  }
});

test('US-73 CA1 y CA2: varios estados con O; los 5 marcados equivalen a no filtrar', () => {
  assert.deepEqual(validarConsultaCatalogo({ estado_material: 'nuevo,como_nuevo' }), {
    pagina: 1, estado_material: ['nuevo', 'como_nuevo'],
  });
  assert.deepEqual(validarConsultaCatalogo({
    estado_material: 'para_reparar,usado,buen_estado,como_nuevo,nuevo',
  }), { pagina: 1 });
});

test('US-73 CA11: estado inválido, repetido, vacío entre comas o parámetro repetido → 400', () => {
  for (const estado of ['nuevo,roto', 'nuevo,nuevo', 'Nuevo', 'nuevo,', 'nuevo, usado', ['nuevo', 'usado']]) {
    invalido({ estado_material: estado }, { estado_material: 'Estado del material no válido.' });
  }
});

test('US-73 CA3 y CA4: precios enteros de 0 a 99999; «Desde» = «Hasta» es válido', () => {
  assert.deepEqual(validarConsultaCatalogo({ precio_min: '0', precio_max: '99999' }), {
    pagina: 1, precio_min: 0, precio_max: 99999,
  });
  assert.deepEqual(validarConsultaCatalogo({ precio_min: '10', precio_max: '10' }), {
    pagina: 1, precio_min: 10, precio_max: 10,
  });
});

test('US-73 CA12: precio fuera de rango, no entero o repetido → 400 con su campo', () => {
  for (const valor of ['-1', '100000', '12.5', '12,5', 'abc', ' 5', ['1', '2']]) {
    invalido({ precio_min: valor }, { precio_min: PRECIO });
    invalido({ precio_max: valor }, { precio_max: PRECIO });
  }
  invalido({ precio_min: '30', precio_max: '20' }, {
    precio_min: 'El precio mínimo no puede ser mayor que el máximo.',
  });
});

test('Varios parámetros inválidos se devuelven juntos en details', () => {
  invalido({ categoria: 'pelotas', modalidad: 'gratis', precio_max: 'abc', pagina: '0' }, {
    pagina: 'La página debe ser un número entero entre 1 y 10000.',
    categoria: 'Categoría no válida.',
    modalidad: 'Modalidad no válida.',
    precio_max: PRECIO,
  });
});

// ---------------------------------------------------------------- ruta

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

test('GET /api/catalogo pasa los filtros validados al repositorio', async () => {
  const respuesta = await catalogo(
    'categoria=balones&deporte=futbol&estado_material=nuevo,usado&precio_min=5&precio_max=20&modalidad=venta&q=bal%C3%B3n',
  );
  assert.equal(respuesta.status, 200);
  assert.deepEqual(llamadas.at(-1), {
    usuarioId: 'usuario-a',
    consulta: {
      pagina: 1,
      q: 'balón',
      categoria: 'balones',
      deporte: 'futbol',
      estado_material: ['nuevo', 'usado'],
      precio_min: 5,
      precio_max: 20,
      modalidad: 'venta',
    },
  });
});

test('GET /api/catalogo responde 400 sin consultar con un filtro inválido (US-22 CA13)', async () => {
  const previas = llamadas.length;
  const respuesta = await catalogo('categoria=balones&categoria=calzado');
  assert.equal(respuesta.status, 400);
  assert.deepEqual(await respuesta.json(), {
    error: {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: { categoria: 'Categoría no válida.' },
    },
  });
  assert.equal(llamadas.length, previas);
});

// ---------------------------------------------------------------- repositorio

function repositorioEspia() {
  const consultas = [];
  const respuestas = [[{ total: 1 }], []];
  const database = {
    async query(sql, valores) {
      consultas.push({ sql, valores });
      return { rows: respuestas.shift() };
    },
  };
  return { repo: createAnunciosRepository(database), consultas };
}

test('US-22 CA11, US-73 CA6–CA8 y US-74 CA2: filtros ligados, con Y, en el total y en el listado', async () => {
  const { repo, consultas } = repositorioEspia();
  await repo.listarCatalogo('usuario-a', {
    pagina: 2,
    q: 'balón',
    categoria: 'balones',
    deporte: 'baloncesto',
    estado_material: ['nuevo', 'como_nuevo'],
    precio_min: 0,
    precio_max: 20,
    modalidad: 'venta',
  });
  const [total, listado] = consultas;
  assert.deepEqual(total.valores, [
    'usuario-a', 'balones', 'baloncesto', ['nuevo', 'como_nuevo'], 0, 2000, 'venta', 'balón',
  ]);
  assert.deepEqual(listado.valores, [...total.valores, 20, 20]);
  const filtro = total.sql.slice(total.sql.indexOf('WHERE '));
  assert.equal(listado.sql.slice(listado.sql.indexOf('WHERE '), listado.sql.indexOf('ORDER BY')).trim(), filtro.trim());
  assert.match(filtro, /a\.categoria = \$2\s+AND a\.deporte = \$3/);
  assert.match(filtro, /a\.estado_material = ANY\(\$4::text\[\]\)/);
  // US-73 CA6 y CA7: extremos incluidos, en céntimos, y la donación cuenta como 0 €.
  assert.match(filtro, /COALESCE\(a\.precio_unitario_centimos, 0\) >= \$5/);
  assert.match(filtro, /COALESCE\(a\.precio_unitario_centimos, 0\) <= \$6/);
  assert.match(filtro, /a\.modalidad = \$7/);
  assert.match(filtro, /normalizar_busqueda_catalogo\(\$8\)/);
  assert.match(listado.sql, /LIMIT \$9 OFFSET \$10/);
  assert.doesNotMatch(total.sql, /balones|baloncesto|venta'/);
});

test('Sin filtros, la consulta solo liga el usuario (US-96 sin cambios)', async () => {
  const { repo, consultas } = repositorioEspia();
  await repo.listarCatalogo('usuario-a', { pagina: 1 });
  assert.deepEqual(consultas[0].valores, ['usuario-a']);
  assert.doesNotMatch(consultas[0].sql.slice(consultas[0].sql.indexOf('WHERE ')), /categoria|deporte|modalidad|COALESCE/);
});
