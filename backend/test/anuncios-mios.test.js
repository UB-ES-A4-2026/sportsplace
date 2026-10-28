import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { aResumen, createAnunciosRepository } from '../src/repositories/anuncios.js';
import { validarPaginacion } from '../src/validation/anuncios.js';
import { startApi } from './helpers.js';

// US-18: GET /api/anuncios/mios (CA10-CA15). El doble de la API simula la
// tabla anuncios con su propiedad; el del repositorio, la base de datos.
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let filas;
let llamadas;
let caida;
const fakeAnuncios = {
  async listarMios(usuarioId, { pagina, porPagina }) {
    if (caida) throw databaseUnavailable();
    llamadas.push({ usuarioId, pagina, porPagina });
    const propios = filas
      .filter((fila) => fila.centro_id === centroDe[usuarioId] && fila.estado !== 'retirado')
      .sort((x, y) => y.actualizado_en.localeCompare(x.actualizado_en) || y.id.localeCompare(x.id));
    const ultima = Math.max(1, Math.ceil(propios.length / porPagina));
    const servida = Math.min(pagina, ultima);
    return {
      anuncios: propios.slice((servida - 1) * porPagina, servida * porPagina).map(aResumen),
      total: propios.length,
      pagina: servida,
      por_pagina: porPagina,
    };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => {
  filas = [];
  llamadas = [];
  caida = false;
});

function crearFila(centroId, n, estado = 'activo') {
  const ahora = new Date(Date.UTC(2026, 10, 3, 10, n)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    centro_id: centroId,
    titulo: `Anuncio ${n}`,
    descripcion: 'Material deportivo en buen estado para otros centros.',
    categoria: 'balones',
    deporte: 'futbol',
    unidades_disponibles: n,
    estado_material: 'buen_estado',
    estado,
    publicado_en: ahora,
    creado_en: ahora,
    actualizado_en: ahora,
  };
}

const mios = (query = '', token = 'token-a') => fetch(`${api.baseUrl}/api/anuncios/mios${query}`, {
  headers: { Authorization: `Bearer ${token}` },
});

test('US-18 CA11/CA12: sin parámetros responde la página 1 de 20 con el resumen de cada anuncio', async () => {
  filas.push(crearFila('centro-a', 1));
  const response = await mios();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    anuncios: [{
      id: '00000000-0000-4000-8000-000000000001',
      titulo: 'Anuncio 1',
      categoria: 'balones',
      deporte: 'futbol',
      unidades_disponibles: 1,
      modalidad: 'donacion',
      precio_unitario_centimos: null,
      estado: 'activo',
      foto_principal_url: null,
      publicado_en: '2026-11-03T10:01:00.000Z',
      actualizado_en: '2026-11-03T10:01:00.000Z',
    }],
    total: 1,
    pagina: 1,
    por_pagina: 20,
  });
  assert.deepEqual(llamadas, [{ usuarioId: 'usuario-a', pagina: 1, porPagina: 20 }]);
});

test('US-18 CA15/E2E-3: con 21 anuncios, la página 1 tiene 20 y la 2 tiene 1', async () => {
  for (let n = 1; n <= 21; n += 1) filas.push(crearFila('centro-a', n));

  const primera = await (await mios('?pagina=1')).json();
  assert.equal(primera.anuncios.length, 20);
  assert.equal(primera.total, 21);
  assert.equal(primera.anuncios[0].titulo, 'Anuncio 21');

  const segunda = await (await mios('?pagina=2&por_pagina=20')).json();
  assert.deepEqual(segunda.anuncios.map((anuncio) => anuncio.titulo), ['Anuncio 1']);
  assert.equal(segunda.pagina, 2);
});

test('US-18 CA10: una página mayor que la última devuelve la última', async () => {
  for (let n = 1; n <= 3; n += 1) filas.push(crearFila('centro-a', n));
  const cuerpo = await (await mios('?pagina=5&por_pagina=2')).json();

  assert.equal(cuerpo.pagina, 2);
  assert.deepEqual(cuerpo.anuncios.map((anuncio) => anuncio.titulo), ['Anuncio 1']);
});

test('US-18 CA3/CA14/E2E-6: solo los anuncios no retirados del centro de la sesión', async () => {
  for (let n = 1; n <= 30; n += 1) filas.push(crearFila('centro-a', n));
  filas.push(crearFila('centro-b', 31), crearFila('centro-b', 32, 'retirado'));

  const cuerpo = await (await mios('', 'token-b')).json();
  assert.equal(cuerpo.total, 1);
  assert.deepEqual(cuerpo.anuncios.map((anuncio) => anuncio.titulo), ['Anuncio 31']);
});

test('US-18 CA11: `pagina` no entera o menor que 1 responde 400 con su mensaje', async () => {
  for (const pagina of ['0', '-1', '2.5', 'abc', '', '1e3']) {
    const response = await mios(`?pagina=${pagina}`);
    assert.equal(response.status, 400, `pagina=${pagina}`);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'DATOS_INVALIDOS',
        message: 'Revisa los campos marcados.',
        details: { pagina: 'Debe ser un número entero mayor que 0.' },
      },
    });
  }
  assert.equal((await mios('?pagina=1&pagina=2')).status, 400);
  assert.deepEqual(llamadas, []);
});

test('US-18 CA11: `por_pagina` fuera de 1-50 responde 400 con su mensaje; 1 y 50 se aceptan', async () => {
  for (const porPagina of ['0', '51', '2.5', 'veinte']) {
    const response = await mios(`?por_pagina=${porPagina}`);
    assert.equal(response.status, 400, `por_pagina=${porPagina}`);
    assert.deepEqual((await response.json()).error.details, { por_pagina: 'Debe ser un número entre 1 y 50.' });
  }
  assert.equal((await mios('?por_pagina=1')).status, 200);
  assert.equal((await mios('?por_pagina=50')).status, 200);
});

test('US-18 CA11: con los dos parámetros mal, `details` trae los dos', async () => {
  const response = await mios('?pagina=0&por_pagina=100');
  assert.deepEqual(Object.keys((await response.json()).error.details).sort(), ['pagina', 'por_pagina']);
});

test('US-18 CA13: sin sesión 401, sin email confirmado 403; «mios» no se toma como id', async () => {
  const sinToken = await fetch(`${api.baseUrl}/api/anuncios/mios`);
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await mios('', 'token-sin-confirmar');
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');

  assert.equal((await mios()).status, 200);
});

test('US-18: con la base de datos caída responde 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  caida = true;
  const response = await mios();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-18: otros métodos en /mios responden 405', async () => {
  const response = await fetch(`${api.baseUrl}/api/anuncios/mios`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-a' },
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});

test('US-18 CA11: validarPaginacion aplica los valores por defecto', () => {
  assert.deepEqual(validarPaginacion({}), { pagina: 1, porPagina: 20 });
  assert.deepEqual(validarPaginacion({ pagina: '3', por_pagina: '5' }), { pagina: 3, porPagina: 5 });
});

// Repositorio con un doble de la base de datos.
function fakeDatabase(respuestas) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      const respuesta = respuestas.shift();
      if (respuesta instanceof Error) throw respuesta;
      return { rows: respuesta };
    },
  };
}

test('US-18 CA3/CA4: listarMios filtra por el centro de la sesión, sin retirados, y ordena por actualizado_en e id', async () => {
  const fila = crearFila('centro-a', 7);
  const database = fakeDatabase([[{ total: 45 }], [fila]]);
  const resultado = await createAnunciosRepository(database).listarMios('u1', { pagina: 2, porPagina: 20 });

  assert.deepEqual(resultado, { anuncios: [aResumen(fila)], total: 45, pagina: 2, por_pagina: 20 });
  const [conteo, pagina] = database.log;
  assert.match(conteo.sql, /WHERE a\.centro_id = \(SELECT c\.id FROM public\.centros c WHERE c\.usuario_id = \$1\) AND a\.estado <> 'retirado'$/);
  assert.deepEqual(conteo.values, ['u1']);
  assert.match(pagina.sql, /AND a\.estado <> 'retirado' ORDER BY a\.actualizado_en DESC, a\.id DESC LIMIT \$2 OFFSET \$3$/);
  assert.deepEqual(pagina.values, ['u1', 20, 20]);
});

test('US-18 CA10: listarMios sirve la última página si se pide una mayor, y la 1 si no hay anuncios', async () => {
  const database = fakeDatabase([[{ total: 21 }], []]);
  const resultado = await createAnunciosRepository(database).listarMios('u1', { pagina: 9, porPagina: 20 });
  assert.equal(resultado.pagina, 2);
  assert.deepEqual(database.log[1].values, ['u1', 20, 20]);

  const vacia = await createAnunciosRepository(fakeDatabase([[{ total: 0 }], []]))
    .listarMios('u1', { pagina: 3, porPagina: 20 });
  assert.deepEqual(vacia, { anuncios: [], total: 0, pagina: 1, por_pagina: 20 });
});

test('US-18: los errores de PostgreSQL en listarMios se ocultan como 503', async () => {
  const database = fakeDatabase([Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })]);
  await assert.rejects(
    createAnunciosRepository(database).listarMios('u1', { pagina: 1, porPagina: 20 }),
    { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' },
  );
});
