import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { aTarjetaCatalogo, createAnunciosRepository } from '../src/repositories/anuncios.js';
import { MENSAJE_PAGINA_CATALOGO, validarConsultaCatalogo } from '../src/validation/catalogo.js';
import { startApi } from './helpers.js';

// E04 US-96 (T21-1): GET /api/catalogo. El doble de la API simula la tabla con
// los centros; el del repositorio, la base de datos.
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const centros = {
  'centro-a': { nombre: 'CE Montjuïc', localidad: 'Barcelona' },
  'centro-b': { nombre: 'Club Natació Sabadell', localidad: 'Sabadell' },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let filas;
let llamadas;
let caida;
const fakeAnuncios = {
  async listarCatalogo(usuarioId, { pagina }) {
    if (caida) throw databaseUnavailable();
    llamadas.push({ usuarioId, pagina });
    const visibles = filas
      .filter((fila) => ['activo', 'reservado'].includes(fila.estado) && fila.unidades_disponibles > 0
        && fila.centro_id !== centroDe[usuarioId])
      .sort((x, y) => y.publicado_en.localeCompare(x.publicado_en) || x.id.localeCompare(y.id));
    return {
      anuncios: visibles.slice((pagina - 1) * 20, pagina * 20).map((fila) => aTarjetaCatalogo({
        ...fila, centro_nombre: centros[fila.centro_id].nombre, centro_localidad: centros[fila.centro_id].localidad,
      })),
      pagina,
      por_pagina: 20,
      total: visibles.length,
      total_paginas: Math.ceil(visibles.length / 20),
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

// Fila de la tabla con las columnas que lee la consulta (y alguna que no debe salir).
function crearFila(centroId, n, cambios = {}) {
  const fecha = new Date(Date.UTC(2026, 9, 1, 10, n)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    centro_id: centroId,
    titulo: `Anuncio ${n}`,
    descripcion: 'Descripción completa que no va en la tarjeta.',
    modalidad: 'venta',
    precio_unitario_centimos: 1250,
    estado: 'activo',
    estado_material: 'buen_estado',
    unidades_disponibles: 12,
    publicado_en: fecha,
    ...cambios,
  };
}

const catalogo = (query = '', token = 'token-b') => fetch(`${api.baseUrl}/api/catalogo${query}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

// ---------------------------------------------------------------- API

test('US-96 CA16: sin parámetros responde la página 1 con la tarjeta de cada anuncio', async () => {
  filas.push(crearFila('centro-a', 1));
  const response = await catalogo();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    anuncios: [{
      id: '00000000-0000-4000-8000-000000000001',
      titulo: 'Anuncio 1',
      modalidad: 'venta',
      precio_unitario_centimos: 1250,
      estado: 'activo',
      estado_material: 'buen_estado',
      unidades_disponibles: 12,
      foto_principal_url: null,
      publicado_en: '2026-10-01T10:01:00.000Z',
      centro: { id: 'centro-a', nombre: 'CE Montjuïc', localidad: 'Barcelona' },
      distancia_km: null,
      es_favorito: false,
    }],
    pagina: 1,
    por_pagina: 20,
    total: 1,
    total_paginas: 1,
  });
  assert.deepEqual(llamadas, [{ usuarioId: 'usuario-b', pagina: 1 }]);
});

test('US-96 CA21: la tarjeta no lleva la descripción ni datos de contacto o dirección del centro', async () => {
  filas.push(crearFila('centro-a', 1));
  const [tarjeta] = (await (await catalogo()).json()).anuncios;

  assert.equal('descripcion' in tarjeta, false);
  assert.deepEqual(Object.keys(tarjeta.centro).sort(), ['id', 'localidad', 'nombre']);
});

test('US-96 CA4/CA24 y E2E-2/E2E-3: solo activo y reservado con unidades, nunca los del propio centro', async () => {
  filas.push(
    crearFila('centro-a', 1),
    crearFila('centro-a', 2, { estado: 'reservado' }),
    crearFila('centro-a', 3, { estado: 'pausado' }),
    crearFila('centro-a', 4, { estado: 'entregado' }),
    crearFila('centro-a', 5, { estado: 'retirado' }),
    crearFila('centro-a', 6, { unidades_disponibles: 0 }),
    crearFila('centro-b', 7),
  );

  const deB = await (await catalogo('', 'token-b')).json();
  assert.deepEqual(deB.anuncios.map((anuncio) => anuncio.titulo), ['Anuncio 2', 'Anuncio 1']);
  assert.equal(deB.total, 2);

  const deA = await (await catalogo('', 'token-a')).json();
  assert.deepEqual(deA.anuncios.map((anuncio) => anuncio.titulo), ['Anuncio 7']);
});

test('US-96 CA7: con 41 anuncios hay 3 páginas de 20, 20 y 1', async () => {
  for (let n = 1; n <= 41; n += 1) filas.push(crearFila('centro-a', n));

  const tamanos = [];
  for (const pagina of [1, 2, 3]) {
    const cuerpo = await (await catalogo(`?pagina=${pagina}`)).json();
    assert.equal(cuerpo.pagina, pagina);
    assert.equal(cuerpo.total, 41);
    assert.equal(cuerpo.total_paginas, 3);
    tamanos.push(cuerpo.anuncios.length);
  }
  assert.deepEqual(tamanos, [20, 20, 1]);
});

test('US-96 CA18: una página mayor que la última responde 200 vacía con el total real', async () => {
  for (let n = 1; n <= 3; n += 1) filas.push(crearFila('centro-a', n));
  const response = await catalogo('?pagina=9');

  assert.equal(response.status, 200);
  const cuerpo = await response.json();
  assert.deepEqual(cuerpo.anuncios, []);
  assert.equal(cuerpo.pagina, 9);
  assert.equal(cuerpo.total, 3);
  assert.equal(cuerpo.total_paginas, 1);
});

test('US-96 CA19: con 0 anuncios, total 0 y total_paginas 0', async () => {
  const cuerpo = await (await catalogo()).json();
  assert.deepEqual(cuerpo, { anuncios: [], pagina: 1, por_pagina: 20, total: 0, total_paginas: 0 });
});

test('US-96 CA17: pagina fuera de 1..10000 o no entera → 400 DATOS_INVALIDOS con details.pagina', async () => {
  for (const valor of ['0', '10001', 'abc', '2.5', '-1', '1e3']) {
    const response = await catalogo(`?pagina=${valor}`);
    assert.equal(response.status, 400, valor);
    assert.deepEqual(await response.json(), {
      error: { code: 'DATOS_INVALIDOS', message: 'Revisa los campos marcados.', details: { pagina: MENSAJE_PAGINA_CATALOGO } },
    });
  }
  assert.deepEqual(llamadas, []);
});

test('US-96 CA17: 1 y 10000 se aceptan; pagina vacía o parámetros desconocidos equivalen a no enviarlos', async () => {
  assert.equal((await catalogo('?pagina=10000')).status, 200);
  assert.equal((await catalogo('?pagina=1')).status, 200);
  assert.equal((await catalogo('?pagina=&no_existe=1')).status, 200);
  assert.deepEqual(llamadas.map((llamada) => llamada.pagina), [10000, 1, 1]);
});

test('US-96 CA23: sin token → 401 NO_AUTENTICADO; con email sin confirmar → 403 EMAIL_NO_CONFIRMADO', async () => {
  const sinToken = await catalogo('', null);
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await catalogo('', 'token-sin-confirmar');
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');
  assert.deepEqual(llamadas, []);
});

test('GET /api/catalogo con otro método → 405 con Allow: GET', async () => {
  const response = await fetch(`${api.baseUrl}/api/catalogo`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-b' },
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});

test('GET /api/catalogo con la base de datos caída → 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  caida = true;
  const response = await catalogo();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
});

// ---------------------------------------------------------------- validación

test('validarConsultaCatalogo: pagina por defecto 1; el parámetro repetido se rechaza', () => {
  assert.deepEqual(validarConsultaCatalogo({}), { pagina: 1 });
  assert.deepEqual(validarConsultaCatalogo({ pagina: '3' }), { pagina: 3 });
  assert.throws(() => validarConsultaCatalogo({ pagina: ['1', '2'] }), (error) => error.details?.pagina === MENSAJE_PAGINA_CATALOGO);
});

// ---------------------------------------------------------------- repositorio

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

const filaConsulta = (n) => ({
  ...crearFila('centro-a', n),
  centro_nombre: 'CE Montjuïc',
  centro_localidad: 'Barcelona',
});

test('US-96 CA4/CA5/CA24: listarCatalogo filtra visibles de otros centros y ordena por publicado_en e id', async () => {
  const database = fakeDatabase([[{ total: 45 }], [filaConsulta(7)], []]);
  const resultado = await createAnunciosRepository(database).listarCatalogo('u1', { pagina: 2 });

  assert.deepEqual(resultado, {
    anuncios: [aTarjetaCatalogo(filaConsulta(7))],
    pagina: 2,
    por_pagina: 20,
    total: 45,
    total_paginas: 3,
  });
  const [conteo, pagina] = database.log;
  const filtro = "a.estado IN ('activo', 'reservado') AND a.unidades_disponibles > 0 "
    + 'AND a.centro_id IS DISTINCT FROM (SELECT c.id FROM public.centros c WHERE c.usuario_id = $1)';
  assert.ok(conteo.sql.endsWith(`WHERE ${filtro}`), conteo.sql);
  assert.deepEqual(conteo.values, ['u1']);
  assert.ok(pagina.sql.includes(`WHERE ${filtro} ORDER BY a.publicado_en DESC, a.id ASC LIMIT $2 OFFSET $3`), pagina.sql);
  assert.deepEqual(pagina.values, ['u1', 20, 20]);
});

test('US-96 CA20: foto_principal_url es la URL de la foto principal; sin fotos, null', async () => {
  const conFoto = filaConsulta(1);
  const sinFoto = filaConsulta(2);
  const database = fakeDatabase([
    [{ total: 2 }],
    [conFoto, sinFoto],
    [
      { id: 'f1', anuncio_id: conFoto.id, ruta: 'c/a/1.jpg', orden: 1, es_principal: false },
      { id: 'f2', anuncio_id: conFoto.id, ruta: 'c/a/2.jpg', orden: 2, es_principal: true },
    ],
  ]);
  const urlFoto = (ruta) => `https://storage.test/${ruta}`;
  const { anuncios } = await createAnunciosRepository(database, { urlFoto }).listarCatalogo('u1', { pagina: 1 });

  assert.equal(anuncios[0].foto_principal_url, 'https://storage.test/c/a/2.jpg');
  assert.equal(anuncios[1].foto_principal_url, null);
});

test('US-96 CA19: listarCatalogo sin anuncios no consulta las fotos y devuelve total_paginas 0', async () => {
  const database = fakeDatabase([[{ total: 0 }], []]);
  const resultado = await createAnunciosRepository(database).listarCatalogo('u1', { pagina: 1 });

  assert.deepEqual(resultado, { anuncios: [], pagina: 1, por_pagina: 20, total: 0, total_paginas: 0 });
  assert.equal(database.log.length, 2);
});

test('listarCatalogo con PostgreSQL caído → 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  const database = fakeDatabase([Object.assign(new Error('caída'), { code: 'ECONNREFUSED' })]);
  await assert.rejects(
    createAnunciosRepository(database).listarCatalogo('u1', { pagina: 1 }),
    (error) => error.status === 503 && error.code === 'BASE_DATOS_NO_DISPONIBLE',
  );
});
