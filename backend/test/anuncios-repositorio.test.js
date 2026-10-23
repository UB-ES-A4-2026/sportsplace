import assert from 'node:assert/strict';
import test from 'node:test';
import { aAnuncio, createAnunciosRepository } from '../src/repositories/anuncios.js';

// US-12 y US-13: repositorio de anuncios con un doble de la base de datos.
const fila = {
  id: '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10',
  centro_id: 'c1',
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  estado: 'activo',
  publicado_en: new Date('2026-11-03T10:15:00Z'),
  creado_en: new Date('2026-11-03T10:15:00Z'),
  actualizado_en: new Date('2026-11-03T10:15:00Z'),
};

// `rows` puede ser una lista de resultados, uno por consulta y en orden.
function fakeDatabase({ rows = [fila], error } = {}) {
  const log = [];
  const resultados = Array.isArray(rows[0]) ? [...rows] : null;
  const query = async (sql, values) => {
    log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    if (error) throw error;
    return { rows: resultados ? resultados.shift() ?? [] : rows };
  };
  return {
    log,
    query,
    async transaction(callback) {
      log.push({ sql: 'BEGIN' });
      try {
        const resultado = await callback({ query });
        log.push({ sql: 'COMMIT' });
        return resultado;
      } catch (excepcion) {
        log.push({ sql: 'ROLLBACK' });
        throw excepcion;
      }
    },
  };
}

const urlFoto = (ruta) => `https://proyecto.supabase.co/storage/v1/object/public/anuncios/${ruta}`;
const filaFoto = (orden, es_principal) => ({
  id: `foto-${orden}`, anuncio_id: fila.id, ruta: `c1/${fila.id}/foto-${orden}.jpg`, orden, es_principal,
});
const fotoPreparada = (orden, es_principal) => ({
  id: `foto-${orden}`, ruta: `c1/${fila.id}/foto-${orden}.jpg`, tipo_mime: 'image/jpeg', bytes: 1000 * orden, orden, es_principal,
});

const datos = {
  titulo: fila.titulo, descripcion: fila.descripcion, categoria: 'balones', deporte: 'futbol',
  unidades_disponibles: 12, estado_material: 'buen_estado',
};

test('US-12 «Objeto anuncio»: la fila se devuelve con fechas ISO y, en esta rama, como donación (CA30)', () => {
  assert.deepEqual(aAnuncio(fila), {
    id: fila.id,
    centro_id: 'c1',
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
    publicado_en: '2026-11-03T10:15:00.000Z',
    creado_en: '2026-11-03T10:15:00.000Z',
    actualizado_en: '2026-11-03T10:15:00.000Z',
  });
});

test('US-13 CA17: aAnuncio incluye las fotos que recibe', () => {
  const fotos = [{ id: 'f1', url: 'https://x/f1.jpg', orden: 1, es_principal: true }];
  assert.deepEqual(aAnuncio(fila, fotos).fotos, fotos);
});

test('US-13: centroDe busca el centro por usuario_id y falla si la cuenta no tiene centro', async () => {
  const database = fakeDatabase({ rows: [{ id: 'c1' }] });
  assert.equal(await createAnunciosRepository(database).centroDe('u1'), 'c1');
  assert.deepEqual(database.log, [{ sql: 'SELECT id FROM public.centros WHERE usuario_id = $1', values: ['u1'] }]);

  await assert.rejects(createAnunciosRepository(fakeDatabase({ rows: [] })).centroDe('u1'), /no tiene centro/);
});

test('US-12 CA13/CA22 y US-13 CA19: crear guarda el anuncio activo y sus fotos en una transacción', async () => {
  const database = fakeDatabase({ rows: [[fila], [filaFoto(2, true), filaFoto(1, false)]] });
  const fotos = [fotoPreparada(1, false), fotoPreparada(2, true)];
  const anuncio = await createAnunciosRepository(database, { urlFoto }).crear({ id: fila.id, centroId: 'c1', datos, fotos });

  assert.deepEqual(database.log.map(({ sql }) => sql.split(' ')[0]), ['BEGIN', 'INSERT', 'INSERT', 'COMMIT']);
  const [, anuncioSql, fotosSql] = database.log;
  assert.match(anuncioSql.sql, /^INSERT INTO public\.anuncios \(.*\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, 'activo', now\(\)\) RETURNING/);
  assert.deepEqual(anuncioSql.values, [fila.id, 'c1', fila.titulo, fila.descripcion, 'balones', 'futbol', 12, 'buen_estado']);
  assert.match(fotosSql.sql, /^INSERT INTO public\.anuncio_fotos \(id, anuncio_id, ruta, tipo_mime, bytes, orden, es_principal\)/);
  assert.deepEqual(fotosSql.values, [
    fila.id,
    ['foto-1', 'foto-2'],
    [`c1/${fila.id}/foto-1.jpg`, `c1/${fila.id}/foto-2.jpg`],
    ['image/jpeg', 'image/jpeg'],
    [1000, 2000],
    [1, 2],
    [false, true],
  ]);

  assert.equal(anuncio.id, fila.id);
  assert.equal(anuncio.estado, 'activo');
  assert.deepEqual(anuncio.fotos, [
    { id: 'foto-1', url: urlFoto(`c1/${fila.id}/foto-1.jpg`), orden: 1, es_principal: false },
    { id: 'foto-2', url: urlFoto(`c1/${fila.id}/foto-2.jpg`), orden: 2, es_principal: true },
  ]);
});

test('US-13 CA20: si falla la base de datos al crear, se deshace todo y responde 503 o 500 según la causa', async () => {
  const nuevo = { id: fila.id, centroId: 'c1', datos, fotos: [fotoPreparada(1, true)] };
  const caida = fakeDatabase({ error: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }) });
  await assert.rejects(createAnunciosRepository(caida).crear(nuevo), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
  assert.equal(caida.log.at(-1).sql, 'ROLLBACK');

  const restriccion = fakeDatabase({ error: Object.assign(new Error('check violation'), { code: '23514' }) });
  await assert.rejects(createAnunciosRepository(restriccion).crear(nuevo), { status: 500, code: 'ERROR_INTERNO' });
  assert.equal(restriccion.log.at(-1).sql, 'ROLLBACK');
});

test('US-13: fotosDe agrupa las fotos de varios anuncios en orden y no consulta sin ids', async () => {
  const database = fakeDatabase({ rows: [filaFoto(1, true), filaFoto(2, false)] });
  const fotos = await createAnunciosRepository(database, { urlFoto }).fotosDe([fila.id, 'otro']);

  assert.match(database.log[0].sql, /FROM public\.anuncio_fotos WHERE anuncio_id = ANY\(\$1::uuid\[\]\) ORDER BY anuncio_id, orden$/);
  assert.deepEqual(fotos.get(fila.id).map((foto) => foto.orden), [1, 2]);
  assert.deepEqual(fotos.get('otro'), []);

  const vacia = fakeDatabase();
  assert.equal((await createAnunciosRepository(vacia).fotosDe([])).size, 0);
  assert.deepEqual(vacia.log, []);
});

test('US-12 CA20/CA24: obtener filtra por id, centro del usuario y anuncios no retirados', async () => {
  const database = fakeDatabase({ rows: [[fila], []] });
  await createAnunciosRepository(database).obtener('u1', fila.id);

  const [{ sql, values }] = database.log;
  assert.match(sql, /WHERE a\.id = \$2 AND c\.usuario_id = \$1 AND a\.estado <> 'retirado'$/);
  assert.deepEqual(values, ['u1', fila.id]);
});

test('US-13 CA17: obtener devuelve las fotos del anuncio en orden con su URL pública', async () => {
  const database = fakeDatabase({ rows: [[fila], [filaFoto(1, false), filaFoto(2, true)]] });
  const anuncio = await createAnunciosRepository(database, { urlFoto }).obtener('u1', fila.id);

  assert.deepEqual(database.log[1].values, [[fila.id]]);
  assert.deepEqual(anuncio.fotos, [
    { id: 'foto-1', url: urlFoto(`c1/${fila.id}/foto-1.jpg`), orden: 1, es_principal: false },
    { id: 'foto-2', url: urlFoto(`c1/${fila.id}/foto-2.jpg`), orden: 2, es_principal: true },
  ]);
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

  await assert.rejects(repositorio.centroDe('u1'), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
  await assert.rejects(repositorio.obtener('u1', fila.id), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
});
