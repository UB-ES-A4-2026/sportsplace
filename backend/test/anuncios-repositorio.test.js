import assert from 'node:assert/strict';
import test from 'node:test';
import { aAnuncio, createAnunciosRepository } from '../src/repositories/anuncios.js';

// US-12: repositorio de anuncios con un doble de la base de datos.
const fila = {
  id: '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10',
  centro_id: 'c1',
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  modalidad: 'venta',
  precio_unitario_centimos: 850,
  estado: 'activo',
  publicado_en: new Date('2026-11-03T10:15:00Z'),
  creado_en: new Date('2026-11-03T10:15:00Z'),
  actualizado_en: new Date('2026-11-03T10:15:00Z'),
};

function fakeDatabase({ rows = [fila], error } = {}) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      if (error) throw error;
      return { rows };
    },
  };
}

const datos = {
  titulo: fila.titulo, descripcion: fila.descripcion, categoria: 'balones', deporte: 'futbol',
  unidades_disponibles: 12, estado_material: 'buen_estado', modalidad: 'venta', precio_unitario_centimos: 850,
};

test('US-12/US-14 «Objeto anuncio»: la fila se devuelve con fechas ISO, su modalidad y precio, y sin fotos (CA30)', () => {
  assert.deepEqual(aAnuncio(fila), {
    id: fila.id,
    centro_id: 'c1',
    titulo: 'Balones de fútbol talla 5',
    descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
    categoria: 'balones',
    deporte: 'futbol',
    unidades_disponibles: 12,
    estado_material: 'buen_estado',
    modalidad: 'venta',
    precio_unitario_centimos: 850,
    estado: 'activo',
    fotos: [],
    publicado_en: '2026-11-03T10:15:00.000Z',
    creado_en: '2026-11-03T10:15:00.000Z',
    actualizado_en: '2026-11-03T10:15:00.000Z',
  });
});

test('US-12 CA13/CA22 y US-14 CA11: crear inserta en el centro del usuario, activo, con modalidad y precio en céntimos', async () => {
  const database = fakeDatabase();
  const anuncio = await createAnunciosRepository(database).crear('u1', datos);

  assert.equal(anuncio.id, fila.id);
  const [{ sql, values }] = database.log;
  assert.match(sql, /^INSERT INTO public\.anuncios \(.*\) SELECT c\.id, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, 'activo', now\(\) FROM public\.centros c WHERE c\.usuario_id = \$1 RETURNING/);
  assert.deepEqual(values, ['u1', fila.titulo, fila.descripcion, 'balones', 'futbol', 12, 'buen_estado', 'venta', 850]);
});

test('US-12: si la cuenta no tiene centro, crear falla en lugar de inventarlo', async () => {
  await assert.rejects(
    createAnunciosRepository(fakeDatabase({ rows: [] })).crear('u1', datos),
    /no tiene centro/,
  );
});

test('US-12 CA20/CA24: obtener filtra por id, centro del usuario y anuncios no retirados', async () => {
  const database = fakeDatabase();
  await createAnunciosRepository(database).obtener('u1', fila.id);

  const [{ sql, values }] = database.log;
  assert.match(sql, /WHERE a\.id = \$2 AND c\.usuario_id = \$1 AND a\.estado <> 'retirado'$/);
  assert.deepEqual(values, ['u1', fila.id]);
});

test('US-12 «Propiedad»: sin fila o con un id que no es UUID responde 404 sin consultar', async () => {
  await assert.rejects(
    createAnunciosRepository(fakeDatabase({ rows: [] })).obtener('u1', fila.id),
    { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
  );

  const database = fakeDatabase();
  await assert.rejects(createAnunciosRepository(database).obtener('u1', 'no-es-un-uuid'), { status: 404 });
  assert.deepEqual(database.log, []);
});

test('US-12 CA19: los errores de PostgreSQL se ocultan como 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  const database = fakeDatabase({ error: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }) });
  const repositorio = createAnunciosRepository(database);

  await assert.rejects(repositorio.crear('u1', datos), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
  await assert.rejects(repositorio.obtener('u1', fila.id), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
});
