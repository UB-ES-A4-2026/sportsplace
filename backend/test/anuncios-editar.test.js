import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  aAnuncio, anuncioNoEditable, anuncioNoEncontrado, createAnunciosRepository,
} from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { startApi } from './helpers.js';

// US-15: PATCH /api/anuncios/:id (CA7, CA9, CA14, CA15, CA17, CA20). El doble
// de la API simula la tabla anuncios con su propiedad; el del repositorio, la
// base de datos. Mientras US-13 y US-14 no estén en dev, el cuerpo es JSON y
// sin fotos ni precio (US-12, CA30).
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-a': 'centro-a', 'usuario-b': 'centro-b' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

const ID = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const PUBLICADO = '2026-11-03T10:15:00.000Z';
const AHORA = '2026-11-04T09:00:00.000Z';

let filas;
let ediciones;
let caida;
const fakeAnuncios = {
  async editar(usuarioId, id, datos) {
    if (caida) throw databaseUnavailable();
    ediciones.push({ usuarioId, id, datos });
    const fila = filas.find((f) => f.id === id && f.centro_id === centroDe[usuarioId] && f.estado !== 'retirado');
    if (!fila) throw anuncioNoEncontrado();
    if (fila.estado === 'entregado') throw anuncioNoEditable();
    Object.assign(fila, datos, { actualizado_en: AHORA });
    return { ...fila };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => {
  filas = [{
    id: ID,
    centro_id: 'centro-a',
    titulo: 'Balones de fútbol talla 5',
    descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
    categoria: 'balones',
    deporte: 'futbol',
    unidades_disponibles: 12,
    estado_material: 'buen_estado',
    modalidad: 'donacion',
    precio_unitario_centimos: null,
    estado: 'activo',
    fotos: [],
    publicado_en: PUBLICADO,
    creado_en: PUBLICADO,
    actualizado_en: PUBLICADO,
  }];
  ediciones = [];
  caida = false;
});

const valido = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 10,
  estado_material: 'buen_estado',
};

const editar = (cuerpo, { id = ID, token = 'token-a' } = {}) => fetch(`${api.baseUrl}/api/anuncios/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
});

test('US-15 CA14/E2E-1: cambiar las unidades responde 200 con el anuncio actualizado', async () => {
  const response = await editar(valido);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { anuncio } = await response.json();
  assert.equal(anuncio.unidades_disponibles, 10);
  assert.equal(anuncio.estado, 'activo');
  assert.equal(anuncio.publicado_en, PUBLICADO);
  assert.equal(anuncio.actualizado_en, AHORA);
  assert.deepEqual(ediciones, [{ usuarioId: 'usuario-a', id: ID, datos: valido }]);
});

test('US-15 CA5/E2E-2: con campos incorrectos responde 400 con todos los errores y no modifica nada', async () => {
  const response = await editar({ ...valido, titulo: '', unidades_disponibles: 0 });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: {
        titulo: 'El título es obligatorio.',
        unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
      },
    },
  });
  assert.deepEqual(ediciones, []);
});

test('US-15 CA5: el cuerpo es el anuncio completo, no un parche parcial', async () => {
  const response = await editar({ unidades_disponibles: 10 });

  assert.equal(response.status, 400);
  const { error } = await response.json();
  assert.deepEqual(Object.keys(error.details).sort(), [
    'categoria', 'deporte', 'descripcion', 'estado_material', 'titulo',
  ]);
  assert.deepEqual(ediciones, []);
});

test('US-15 CA7: `estado`, `publicado_en` y otras claves del cuerpo se ignoran', async () => {
  const response = await editar({
    ...valido, estado: 'entregado', publicado_en: '2020-01-01T00:00:00.000Z', centro_id: 'centro-b', id: 'otro',
  });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  assert.equal(anuncio.estado, 'activo');
  assert.equal(anuncio.publicado_en, PUBLICADO);
  assert.equal(anuncio.centro_id, 'centro-a');
  assert.deepEqual(ediciones[0].datos, valido);
});

test('US-15 E2E-3: un anuncio pausado se edita y sigue pausado', async () => {
  filas[0].estado = 'pausado';
  const response = await editar({ ...valido, titulo: 'Balones de fútbol talla 4' });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  assert.equal(anuncio.titulo, 'Balones de fútbol talla 4');
  assert.equal(anuncio.estado, 'pausado');
});

test('US-15 CA15/CA20/E2E-4: un anuncio entregado responde 409 ANUNCIO_NO_EDITABLE', async () => {
  filas[0].estado = 'entregado';
  const response = await editar(valido);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: 'ANUNCIO_NO_EDITABLE', message: 'Este anuncio ya no se puede editar.' },
  });
  assert.equal(filas[0].unidades_disponibles, 12);
});

test('US-15 CA17/E2E-6: otro centro recibe 404 NO_ENCONTRADO y el anuncio no cambia', async () => {
  const response = await editar(valido, { token: 'token-b' });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
  });
  assert.equal(filas[0].unidades_disponibles, 12);
});

test('US-15 CA15: inexistente, retirado o id que no es UUID responden el mismo 404', async () => {
  const respuestas = [];
  respuestas.push(await editar(valido, { id: '00000000-0000-4000-8000-000000000000' }));
  filas[0].estado = 'retirado';
  respuestas.push(await editar(valido));
  respuestas.push(await editar(valido, { id: 'no-es-un-uuid' }));
  respuestas.push(await editar({}, { id: 'no-es-un-uuid' }));

  for (const response of respuestas) {
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
    });
  }
});

test('US-15 CA15: sin sesión 401, sin email confirmado 403 y sin base de datos 503', async () => {
  const sinToken = await fetch(`${api.baseUrl}/api/anuncios/${ID}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valido),
  });
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await editar(valido, { token: 'token-sin-confirmar' });
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');

  caida = true;
  const sinBase = await editar(valido);
  assert.equal(sinBase.status, 503);
  assert.equal((await sinBase.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-15: un cuerpo que no es JSON responde 400 JSON_INVALIDO', async () => {
  const response = await editar('{"titulo":');

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'JSON_INVALIDO');
});

test('US-15: /api/anuncios/:id admite GET y PATCH; el resto responde 405', async () => {
  const response = await fetch(`${api.baseUrl}/api/anuncios/${ID}`, {
    method: 'PUT', headers: { Authorization: 'Bearer token-a' },
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, PATCH');
});

// Repositorio con un doble de la base de datos: cada consulta devuelve la
// siguiente respuesta preparada.
const fila = {
  id: ID,
  centro_id: 'c1',
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 10,
  estado_material: 'buen_estado',
  estado: 'reservado',
  publicado_en: new Date(PUBLICADO),
  creado_en: new Date(PUBLICADO),
  actualizado_en: new Date(AHORA),
};

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

test('US-15 CA7/CA9: editar actualiza los datos y actualizado_en, sin tocar estado ni publicado_en', async () => {
  const database = fakeDatabase([[fila]]);
  const anuncio = await createAnunciosRepository(database).editar('u1', ID, valido);

  assert.deepEqual(anuncio, aAnuncio(fila));
  assert.equal(database.log.length, 1);
  const [{ sql, values }] = database.log;
  assert.match(sql, /^UPDATE public\.anuncios a SET titulo = \$3, descripcion = \$4, categoria = \$5, deporte = \$6, unidades_disponibles = \$7, estado_material = \$8, actualizado_en = now\(\) WHERE/);
  assert.doesNotMatch(sql, /SET[^]*\b(estado|publicado_en) =/);
  assert.match(sql, /c\.usuario_id = \$1/);
  assert.match(sql, /a\.estado <> 'retirado'/);
  assert.match(sql, /a\.estado <> 'entregado'/);
  assert.deepEqual(values, [
    'u1', ID, valido.titulo, valido.descripcion, 'balones', 'futbol', 10, 'buen_estado',
  ]);
});

test('US-15 CA15/CA17: si no se actualiza nada y el anuncio no es del centro, 404', async () => {
  const database = fakeDatabase([[], []]);

  await assert.rejects(
    createAnunciosRepository(database).editar('u1', ID, valido),
    { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
  );
  assert.match(database.log[1].sql, /^SELECT a\.estado FROM public\.anuncios a WHERE/);
  assert.deepEqual(database.log[1].values, ['u1', ID]);
});

test('US-15 CA15/CA20: si no se actualiza nada y el anuncio sigue siendo del centro, está entregado: 409', async () => {
  const database = fakeDatabase([[], [{ estado: 'entregado' }]]);

  await assert.rejects(
    createAnunciosRepository(database).editar('u1', ID, valido),
    { status: 409, code: 'ANUNCIO_NO_EDITABLE', message: 'Este anuncio ya no se puede editar.' },
  );
});

test('US-15: un id que no es UUID responde 404 sin consultar la base de datos', async () => {
  const database = fakeDatabase([]);

  await assert.rejects(
    createAnunciosRepository(database).editar('u1', 'abc', valido),
    { status: 404, code: 'NO_ENCONTRADO' },
  );
  assert.equal(database.log.length, 0);
});

test('US-15: un error de PostgreSQL se convierte en 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  const database = fakeDatabase([Object.assign(new Error('caída'), { code: '57P01' })]);
  const consola = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      createAnunciosRepository(database).editar('u1', ID, valido),
      { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' },
    );
  } finally {
    console.error = consola;
  }
});
