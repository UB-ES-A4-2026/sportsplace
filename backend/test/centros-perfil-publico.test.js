import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createAnunciosRepository } from '../src/repositories/anuncios.js';
import { createCentrosRepository, databaseUnavailable } from '../src/repositories/centros.js';
import { startApi, usuarioConfirmado } from './helpers.js';

// US-10 (T10-1): perfil de otro centro y sus anuncios activos. Los dobles
// simulan Supabase Auth y las tablas centros y anuncios.
const CLUB = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const usuarios = {
  'token-confirmado': usuarioConfirmado,
  'token-club': { id: 'u-club', email: 'piscina@clubnatacio.cat', email_confirmado: true },
  'token-sin-confirmar': { id: 'u2', email: 'nuevo@example.com', email_confirmado: false },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

// Fila completa de la tabla: incluye los campos privados que nunca deben salir (CA14).
const filaClub = {
  id: CLUB,
  usuario_id: 'u-club',
  nombre: 'Club Natació Exemple',
  email: 'piscina@clubnatacio.cat',
  localidad: 'Barcelona',
  provincia: 'Barcelona',
  direccion: 'Carrer de la Piscina 12',
  codigo_postal: '08001',
  latitud: 41.3888,
  longitud: 2.159,
  descripcion: 'Club de natación del barrio.',
  telefono: '+34 931 234 567',
  email_contacto: 'material@clubnatacio.cat',
  web: 'https://clubnatacio.cat',
  politica_privacidad_aceptada: true,
  email_confirmado_en: '2026-10-09T10:05:00.000Z',
  creado_en: '2026-10-09T10:00:00.000Z',
};
const PUBLICOS = ['id', 'nombre', 'localidad', 'provincia', 'descripcion', 'telefono', 'email_contacto', 'web', 'creado_en'];
const PRIVADOS = [
  'email', 'usuario_id', 'direccion', 'codigo_postal', 'latitud', 'longitud',
  'politica_privacidad_aceptada', 'email_confirmado_en', 'miembros',
];

const anuncio = (n, estado = 'activo') => ({
  id: `a${n}`, titulo: `Anuncio ${n}`, categoria: 'balones', deporte: 'futbol', unidades_disponibles: 1,
  modalidad: 'donacion', precio_unitario_centimos: null, estado, foto_principal_url: null,
  publicado_en: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString(), actualizado_en: '2026-11-01T00:00:00.000Z',
});

let anunciosDelClub;
let caida;
let llamadas;
const fakeCentros = {
  async perfilPublico(id, usuarioId) {
    if (caida) throw databaseUnavailable();
    llamadas.push({ id, usuarioId });
    if (id !== CLUB) return null;
    const publico = Object.fromEntries(PUBLICOS.map((campo) => [campo, filaClub[campo]]));
    return { ...publico, es_mio: filaClub.usuario_id === usuarioId };
  },
};
// Simula el filtro y el orden de listarDeCentro sobre la «tabla».
const fakeAnuncios = {
  async listarDeCentro(centroId, { pagina, porPagina }) {
    const visibles = anunciosDelClub
      .filter((a) => centroId === CLUB && ['activo', 'reservado'].includes(a.estado))
      .sort((a, b) => b.publicado_en.localeCompare(a.publicado_en));
    const inicio = (pagina - 1) * porPagina;
    return { anuncios: visibles.slice(inicio, inicio + porPagina), pagina, total: visibles.length };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, centros: fakeCentros, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => {
  anunciosDelClub = [anuncio(1), anuncio(2, 'reservado'), anuncio(3), anuncio(4, 'pausado'), anuncio(5, 'entregado'),
    anuncio(6, 'retirado')];
  caida = false;
  llamadas = [];
});

const pedir = (ruta, token = 'token-confirmado', method = 'GET') => fetch(`${api.baseUrl}/api/centros/${ruta}`, {
  method,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const codigo = async (response) => (await response.json()).error.code;

// CA11
test('US-10 CA11: GET /api/centros/:id devuelve el perfil público con es_mio false', async () => {
  const response = await pedir(CLUB);

  assert.equal(response.status, 200);
  const { centro } = await response.json();
  assert.deepEqual(Object.keys(centro).sort(), [...PUBLICOS, 'es_mio'].sort());
  assert.equal(centro.nombre, 'Club Natació Exemple');
  assert.equal(centro.creado_en, '2026-10-09T10:00:00.000Z');
  assert.equal(centro.es_mio, false);
  assert.deepEqual(llamadas, [{ id: CLUB, usuarioId: 'u1' }]);
});

test('US-10 CA11 y E2E-5: al consultar mi propio centro, es_mio es true', async () => {
  const response = await pedir(CLUB, 'token-club');

  assert.equal(response.status, 200);
  assert.equal((await response.json()).centro.es_mio, true);
});

// CA14 y E2E-2
test('US-10 CA14: la respuesta no contiene el email de acceso, la dirección ni otros datos privados', async () => {
  const texto = await (await pedir(CLUB)).text();

  assert.ok(!texto.includes('piscina@clubnatacio.cat'));
  assert.ok(!texto.includes('Carrer de la Piscina 12'));
  const { centro } = JSON.parse(texto);
  for (const campo of PRIVADOS) assert.ok(!(campo in centro), `no debe salir ${campo}`);
});

// CA13
test('US-10 CA13: centro inexistente → 404 NO_ENCONTRADO', async () => {
  const response = await pedir(INEXISTENTE);

  assert.equal(response.status, 404);
  assert.equal(await codigo(response), 'NO_ENCONTRADO');
});

test('US-10 CA13: un id que no es un UUID → 404 sin consultar la base de datos', async () => {
  for (const id of ['abc', '123', `${CLUB}x`]) {
    const response = await pedir(id);
    assert.equal(response.status, 404, id);
    assert.equal(await codigo(response), 'NO_ENCONTRADO');
  }
  const anuncios = await pedir('abc/anuncios');
  assert.equal(anuncios.status, 404);
  assert.deepEqual(llamadas, []);
});

test('US-10 CA13: sin sesión → 401 NO_AUTENTICADO en las dos rutas', async () => {
  for (const ruta of [CLUB, `${CLUB}/anuncios`]) {
    const response = await pedir(ruta, null);
    assert.equal(response.status, 401, ruta);
    assert.equal(await codigo(response), 'NO_AUTENTICADO');
  }
});

test('US-10 CA13: email sin confirmar → 403 EMAIL_NO_CONFIRMADO en las dos rutas', async () => {
  for (const ruta of [CLUB, `${CLUB}/anuncios`]) {
    const response = await pedir(ruta, 'token-sin-confirmar');
    assert.equal(response.status, 403, ruta);
    assert.equal(await codigo(response), 'EMAIL_NO_CONFIRMADO');
  }
});

test('US-10 CA13: base de datos caída → 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  caida = true;
  for (const ruta of [CLUB, `${CLUB}/anuncios`]) {
    const response = await pedir(ruta);
    assert.equal(response.status, 503, ruta);
    assert.equal(await codigo(response), 'BASE_DATOS_NO_DISPONIBLE');
  }
});

test('US-10: /mio sigue siendo mi centro y no se toma como un id', async () => {
  const response = await pedir('mio', 'token-confirmado', 'DELETE');

  assert.equal(response.status, 405);
});

test('US-10: otros métodos sobre /anuncios → 405; sobre /:id, 404 (US-07 CA22: no se edita otro centro)', async () => {
  assert.equal((await pedir(`${CLUB}/anuncios`, 'token-confirmado', 'POST')).status, 405);
  for (const method of ['PATCH', 'PUT', 'DELETE']) {
    assert.equal((await pedir(CLUB, 'token-confirmado', method)).status, 404, method);
  }
});

// CA6, CA12 y CA15
test('US-10 CA6 y CA15: solo anuncios activos y reservados, del más reciente al más antiguo', async () => {
  const response = await pedir(`${CLUB}/anuncios`);

  assert.equal(response.status, 200);
  const cuerpo = await response.json();
  assert.equal(cuerpo.pagina, 1);
  assert.equal(cuerpo.total, 3);
  assert.deepEqual(cuerpo.anuncios.map((a) => a.id), ['a3', 'a2', 'a1']);
});

test('US-10 CA15: tampoco se listan pausados ni entregados al consultar mi propio centro', async () => {
  const cuerpo = await (await pedir(`${CLUB}/anuncios`, 'token-club')).json();

  assert.ok(cuerpo.anuncios.every((a) => ['activo', 'reservado'].includes(a.estado)));
});

test('US-10 CA12 y CA17: 21 anuncios activos → 20 en la página 1 y 1 en la 2; la 3, vacía', async () => {
  anunciosDelClub = Array.from({ length: 21 }, (_, n) => anuncio(n + 1));

  const primera = await (await pedir(`${CLUB}/anuncios`)).json();
  const segunda = await (await pedir(`${CLUB}/anuncios?pagina=2`)).json();
  const tercera = await (await pedir(`${CLUB}/anuncios?pagina=3`)).json();

  assert.deepEqual([primera.anuncios.length, primera.pagina, primera.total], [20, 1, 21]);
  assert.deepEqual([segunda.anuncios.length, segunda.pagina, segunda.total], [1, 2, 21]);
  assert.deepEqual([tercera.anuncios, tercera.pagina, tercera.total], [[], 3, 21]);
});

test('US-10 CA12: el tamaño de página es fijo (20) aunque llegue por_pagina', async () => {
  anunciosDelClub = Array.from({ length: 21 }, (_, n) => anuncio(n + 1));

  const cuerpo = await (await pedir(`${CLUB}/anuncios?por_pagina=50`)).json();

  assert.equal(cuerpo.anuncios.length, 20);
});

test('US-10 CA12: pagina=0, abc, 2.5 o repetida → 400 DATOS_INVALIDOS', async () => {
  for (const query of ['pagina=0', 'pagina=abc', 'pagina=2.5', 'pagina=-1', 'pagina=1&pagina=2']) {
    const response = await pedir(`${CLUB}/anuncios?${query}`);
    assert.equal(response.status, 400, query);
    const { error } = await response.json();
    assert.equal(error.code, 'DATOS_INVALIDOS');
    assert.equal(error.details.pagina, 'Debe ser un número entero mayor que 0.');
  }
});

test('US-10 CA13: anuncios de un centro inexistente → 404 NO_ENCONTRADO', async () => {
  const response = await pedir(`${INEXISTENTE}/anuncios`);

  assert.equal(response.status, 404);
  assert.equal(await codigo(response), 'NO_ENCONTRADO');
});

// Repositorios con un doble de la base de datos: la consulta que se envía.
function fakeDatabase(resultados) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      return { rows: resultados.shift() ?? [] };
    },
  };
}

test('US-10 CA11 y CA14: perfilPublico solo selecciona columnas públicas y calcula es_mio', async () => {
  const database = fakeDatabase([[{ id: CLUB, es_mio: false }]]);

  const centro = await createCentrosRepository(database).perfilPublico(CLUB, 'u1');

  assert.deepEqual(centro, { id: CLUB, es_mio: false });
  const [{ sql, values }] = database.log;
  assert.deepEqual(values, [CLUB, 'u1']);
  const columnas = sql.slice(sql.indexOf('SELECT') + 6, sql.indexOf(' FROM public'));
  for (const campo of PUBLICOS) assert.ok(columnas.includes(`c.${campo}`), campo);
  for (const campo of PRIVADOS.filter((c) => c !== 'usuario_id')) {
    assert.ok(!new RegExp(`\\bc\\.${campo}\\b`).test(columnas), `no debe seleccionar ${campo}`);
  }
  assert.match(columnas, /c\.usuario_id IS NOT DISTINCT FROM \$2::uuid\) AS es_mio/);
});

test('US-10 CA13: perfilPublico devuelve null si el centro no existe y 503 si la base de datos falla', async () => {
  assert.equal(await createCentrosRepository(fakeDatabase([[]])).perfilPublico(INEXISTENTE, 'u1'), null);

  const rota = { query: async () => { throw Object.assign(new Error('caída'), { code: '57P01' }); } };
  await assert.rejects(
    createCentrosRepository(rota).perfilPublico(CLUB, 'u1'),
    (error) => error.status === 503 && error.code === 'BASE_DATOS_NO_DISPONIBLE',
  );
});

test('US-10 CA6, CA12 y CA15: listarDeCentro filtra activos y reservados, ordena y pagina', async () => {
  const fila = { ...anuncio(1), publicado_en: new Date('2026-11-01T00:01:00Z'), actualizado_en: new Date() };
  const foto = { id: 'f1', anuncio_id: 'a1', ruta: 'c/a1/f1.jpg', orden: 0, es_principal: true };
  const database = fakeDatabase([[{ total: 21 }], [fila], [foto]]);
  const repositorio = createAnunciosRepository(database, { urlFoto: (ruta) => `https://fotos/${ruta}` });

  const resultado = await repositorio.listarDeCentro(CLUB, { pagina: 2, porPagina: 20 });

  assert.equal(resultado.pagina, 2);
  assert.equal(resultado.total, 21);
  assert.equal(resultado.anuncios[0].foto_principal_url, 'https://fotos/c/a1/f1.jpg');
  const [conteo, lista] = database.log;
  for (const { sql } of [conteo, lista]) {
    assert.match(sql, /a\.centro_id = \$1 AND a\.estado IN \('activo', 'reservado'\)/);
  }
  assert.deepEqual(conteo.values, [CLUB]);
  assert.match(lista.sql, /ORDER BY a\.publicado_en DESC NULLS LAST, a\.id DESC LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(lista.values, [CLUB, 20, 20]);
});

test('US-10 CA7: listarDeCentro sin anuncios devuelve la lista vacía sin consultar las fotos', async () => {
  const database = fakeDatabase([[{ total: 0 }], []]);

  const resultado = await createAnunciosRepository(database).listarDeCentro(CLUB, { pagina: 1, porPagina: 20 });

  assert.deepEqual(resultado, { anuncios: [], pagina: 1, total: 0 });
  assert.equal(database.log.length, 2);
});
