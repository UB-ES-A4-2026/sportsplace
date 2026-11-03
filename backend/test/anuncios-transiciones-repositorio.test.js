import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnunciosRepository } from '../src/repositories/anuncios.js';
import { ACCIONES } from '../src/services/transiciones-anuncio.js';

// US-16: `transicionar` del repositorio con un doble de la base de datos.
const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const fila = {
  id,
  centro_id: 'c1',
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  estado: 'pausado',
  publicado_en: new Date('2026-11-03T10:15:00Z'),
  creado_en: new Date('2026-11-03T10:15:00Z'),
  actualizado_en: new Date('2026-11-04T09:00:00Z'),
};

// Cada consulta recibe la siguiente respuesta de la lista.
function fakeDatabase(respuestas) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      const respuesta = respuestas.shift();
      if (respuesta instanceof Error) throw respuesta;
      return { rows: respuesta ?? [] };
    },
  };
}

test('US-16 CA6/CA10: un único UPDATE condicionado al estado actual y al centro de la sesión', async () => {
  const database = fakeDatabase([[fila]]);
  const anuncio = await createAnunciosRepository(database).transicionar('u1', id, ACCIONES.pausar);

  assert.equal(anuncio.estado, 'pausado');
  assert.equal(anuncio.actualizado_en, '2026-11-04T09:00:00.000Z');
  // La segunda consulta solo lee las fotos del anuncio (US-13): el cambio de estado es un único UPDATE.
  assert.equal(database.log.filter((consulta) => /^UPDATE/.test(consulta.sql)).length, 1);
  const [{ sql, values }] = database.log;
  assert.match(sql, /^UPDATE public\.anuncios SET estado = \$3::text, actualizado_en = now\(\),/);
  assert.match(sql, /WHERE id = \$2 AND centro_id = \(SELECT c\.id FROM public\.centros c WHERE c\.usuario_id = \$1\) AND estado = ANY\(\$4::text\[\]\) RETURNING/);
  assert.deepEqual(values, ['u1', id, 'pausado', ['activo']]);
});

test('US-16 y US-13 CA17: el anuncio que devuelve la transición lleva sus fotos', async () => {
  const fotos = [{ id: 'f1', anuncio_id: id, ruta: `c1/${id}/1.jpg`, orden: 1, es_principal: true }];
  const database = fakeDatabase([[fila], fotos]);
  const urlFoto = (ruta) => `https://storage.example/${ruta}`;
  const anuncio = await createAnunciosRepository(database, { urlFoto }).transicionar('u1', id, ACCIONES.pausar);

  assert.deepEqual(anuncio.fotos, [{ id: 'f1', url: `https://storage.example/c1/${id}/1.jpg`, orden: 1, es_principal: true }]);
  assert.match(database.log[1].sql, /FROM public\.anuncio_fotos/);
  assert.deepEqual(database.log[1].values, [[id]]);
});

test('US-16 CA5: el UPDATE solo toca estado, actualizado_en y las fechas de entregado/retirado', async () => {
  const database = fakeDatabase([[fila]]);
  await createAnunciosRepository(database).transicionar('u1', id, ACCIONES.reactivar);

  const set = database.log[0].sql.match(/SET (.*) WHERE/)[1];
  const columnas = set.split(/,\s*(?=\w+ =)/).map((asignacion) => asignacion.split(' = ')[0].trim());
  assert.deepEqual(columnas, ['estado', 'actualizado_en', 'entregado_en', 'retirado_en']);
  assert.doesNotMatch(set, /publicado_en/);
  assert.deepEqual(database.log[0].values, ['u1', id, 'activo', ['pausado']]);
});

test('US-16 CA8: si no cambia nada y el anuncio es del centro, 409 con su estado actual', async () => {
  const database = fakeDatabase([[], [{ estado: 'reservado' }]]);

  await assert.rejects(
    createAnunciosRepository(database).transicionar('u1', id, ACCIONES.pausar),
    {
      status: 409,
      code: 'TRANSICION_NO_PERMITIDA',
      message: 'Esta acción no está disponible en el estado actual del anuncio.',
      details: { estado_actual: 'reservado' },
    },
  );
  assert.match(database.log[1].sql, /^SELECT estado FROM public\.anuncios WHERE id = \$2 AND centro_id = \(.*\) AND estado <> 'retirado'$/);
  assert.deepEqual(database.log[1].values, ['u1', id]);
});

test('US-16 CA9: si no es un anuncio visible del centro (otro, inexistente o retirado), 404', async () => {
  await assert.rejects(
    createAnunciosRepository(fakeDatabase([[], []])).transicionar('u1', id, ACCIONES.pausar),
    { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
  );
});

test('US-16 CA9: un id que no es UUID da 404 sin consultar', async () => {
  const database = fakeDatabase([]);
  await assert.rejects(
    createAnunciosRepository(database).transicionar('u1', 'no-es-un-uuid', ACCIONES.pausar),
    { status: 404 },
  );
  assert.deepEqual(database.log, []);
});

test('US-16: los errores de PostgreSQL se ocultan como 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  const caida = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  await assert.rejects(
    createAnunciosRepository(fakeDatabase([caida])).transicionar('u1', id, ACCIONES.pausar),
    { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' },
  );
  await assert.rejects(
    createAnunciosRepository(fakeDatabase([[], caida])).transicionar('u1', id, ACCIONES.pausar),
    { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' },
  );
});
