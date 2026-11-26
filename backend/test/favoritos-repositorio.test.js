import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnunciosRepository } from '../src/repositories/anuncios.js';

// T25-1 (#405): consultas de US-25 con un doble de PostgreSQL.
const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const plano = (sql) => sql.replace(/\s+/g, ' ').trim();
function databaseCon(resultados, { falloEn } = {}) {
  const consultas = [];
  const transacciones = [];
  const query = async (sql, values) => {
    consultas.push({ sql: plano(sql), values });
    if (falloEn !== undefined && consultas.length === falloEn) throw Object.assign(new Error('fallo'), { code: '08006' });
    return { rows: resultados.shift() ?? [] };
  };
  return {
    consultas,
    transacciones,
    query,
    async transaction(callback) {
      const inicio = consultas.length;
      try {
        const resultado = await callback({ query });
        transacciones.push({ desde: inicio, hasta: consultas.length, confirmada: true });
        return resultado;
      } catch (error) {
        transacciones.push({ desde: inicio, hasta: consultas.length, confirmada: false });
        throw error;
      }
    },
  };
}
const yo = [{ id: 'centro-b' }];
const visible = (extra = {}) => [{ centro_id: 'centro-a', es_favorito: false, total: 0, ...extra }];
const silenciar = async (t) => t.mock.method(console, 'error', () => {});

test('US-25 CA13/CA18: guarda el favorito del centro de la sesión en una transacción con el centro bloqueado', async () => {
  const database = databaseCon([yo, visible(), []]);
  await createAnunciosRepository(database).guardarFavorito('usuario-b', id);
  const [centro, anuncio, insercion] = database.consultas;
  assert.equal(centro.sql, 'SELECT id FROM public.centros WHERE usuario_id = $1 FOR UPDATE');
  assert.deepEqual(centro.values, ['usuario-b']);
  assert.deepEqual(anuncio.values, ['centro-b', id]);
  assert.match(anuncio.sql, /WHERE a\.id = \$2 AND a\.estado IN \('activo', 'reservado'\) AND a\.unidades_disponibles > 0$/);
  assert.match(insercion.sql, /^INSERT INTO public\.favoritos \(centro_id, anuncio_id\) VALUES \(\$1, \$2\) ON CONFLICT/);
  assert.deepEqual(insercion.values, ['centro-b', id]);
  assert.deepEqual(database.transacciones, [{ desde: 0, hasta: 3, confirmada: true }]);
});

test('US-25 CA13: guardar uno que ya está en favoritos no inserta ni comprueba el máximo', async () => {
  const database = databaseCon([yo, visible({ es_favorito: true, total: 500 })]);
  await createAnunciosRepository(database).guardarFavorito('usuario-b', id);
  assert.equal(database.consultas.length, 2);
});

test('US-25 CA14: inexistente o no visible en el catálogo (pausado, entregado, retirado, sin unidades) → 404', async () => {
  const database = databaseCon([yo, []]);
  await assert.rejects(createAnunciosRepository(database).guardarFavorito('usuario-b', id),
    { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
  assert.equal(database.consultas.length, 2);
  assert.equal(database.transacciones[0].confirmada, false);
});

test('US-25 CA14: un id que no es UUID → 404 sin consultar', async () => {
  const database = databaseCon([]);
  for (const invalido of [undefined, '1234', `${id}x`]) {
    await assert.rejects(createAnunciosRepository(database).guardarFavorito('usuario-b', invalido), { status: 404 });
  }
  assert.deepEqual(database.consultas, []);
});

test('US-25 CA5/CA14: un anuncio propio → 400 ANUNCIO_PROPIO sin insertar', async () => {
  const database = databaseCon([yo, visible({ centro_id: 'centro-b' })]);
  await assert.rejects(createAnunciosRepository(database).guardarFavorito('usuario-b', id),
    { status: 400, code: 'ANUNCIO_PROPIO', message: 'No puedes guardar tus propios anuncios.' });
  assert.equal(database.consultas.length, 2);
});

test('US-25 CA11/CA14: con 500 favoritos el 501 → 409 LIMITE_FAVORITOS; con 499 se guarda', async () => {
  const lleno = databaseCon([yo, visible({ total: 500 })]);
  await assert.rejects(createAnunciosRepository(lleno).guardarFavorito('usuario-b', id),
    { status: 409, code: 'LIMITE_FAVORITOS', message: 'Has llegado al máximo de 500 favoritos. Quita alguno para guardar otro.' });
  assert.equal(lleno.consultas.length, 2);

  const casi = databaseCon([yo, visible({ total: 499 }), []]);
  await createAnunciosRepository(casi).guardarFavorito('usuario-b', id);
  assert.equal(casi.consultas.length, 3);
});

test('US-25: un fallo de PostgreSQL al guardar → 503, sin mostrar el error', async (t) => {
  await silenciar(t);
  const database = databaseCon([yo, visible()], { falloEn: 3 });
  await assert.rejects(createAnunciosRepository(database).guardarFavorito('usuario-b', id),
    { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
});

test('US-25 CA13/CA18: quitar borra solo el favorito del centro de la sesión; un id no UUID no consulta', async () => {
  const database = databaseCon([[]]);
  const anuncios = createAnunciosRepository(database);
  await anuncios.quitarFavorito('usuario-b', id);
  await anuncios.quitarFavorito('usuario-b', 'no-es-un-uuid');
  assert.equal(database.consultas.length, 1);
  const [{ sql, values }] = database.consultas;
  assert.equal(sql, 'DELETE FROM public.favoritos WHERE anuncio_id = $2 '
    + 'AND centro_id = (SELECT c.id FROM public.centros c WHERE c.usuario_id = $1)');
  assert.deepEqual(values, ['usuario-b', id]);
});

const filaFavorito = (extra = {}) => ({
  id, titulo: 'Balones de fútbol talla 5', modalidad: 'venta', precio_unitario_centimos: 1250,
  estado: 'activo', estado_material: 'buen_estado', unidades_disponibles: 12,
  publicado_en: new Date('2026-11-08T10:00:00Z'),
  centro_id: 'centro-a', centro_nombre: 'CE Montjuïc', centro_localidad: 'Barcelona', ...extra,
});

test('US-25 CA6/CA15/CA18: lista los favoritos del centro, del más reciente al más antiguo, 20 por página', async () => {
  const database = databaseCon([[{ total: 21 }], [filaFavorito()], [
    { id: 'f1', anuncio_id: id, ruta: 'centro-a/f1.jpg', orden: 1, es_principal: true },
  ]]);
  const pagina = await createAnunciosRepository(database, { urlFoto: (ruta) => `https://storage.test/${ruta}` })
    .listarFavoritos('usuario-b', { pagina: 2 });
  assert.deepEqual(pagina, {
    anuncios: [{
      id, titulo: 'Balones de fútbol talla 5', modalidad: 'venta', precio_unitario_centimos: 1250,
      estado: 'activo', estado_material: 'buen_estado', unidades_disponibles: 12,
      foto_principal_url: 'https://storage.test/centro-a/f1.jpg', publicado_en: '2026-11-08T10:00:00.000Z',
      centro: { id: 'centro-a', nombre: 'CE Montjuïc', localidad: 'Barcelona' },
      distancia_km: null, es_favorito: true, disponible: true,
    }],
    pagina: 2, por_pagina: 20, total: 21, total_paginas: 2,
  });
  const [total, listado] = database.consultas;
  const filtro = "f.centro_id = (SELECT c.id FROM public.centros c WHERE c.usuario_id = $1) AND a.estado <> 'retirado'";
  assert.ok(total.sql.endsWith(`WHERE ${filtro}`), total.sql);
  assert.ok(listado.sql.includes(`WHERE ${filtro} ORDER BY f.creado_en DESC, a.id ASC LIMIT $2 OFFSET $3`), listado.sql);
  assert.deepEqual(total.values, ['usuario-b']);
  assert.deepEqual(listado.values, ['usuario-b', 20, 20]);
});

test('US-25 CA7/CA8/CA9: `disponible` según el estado y las unidades; el corazón sigue lleno', async () => {
  const filas = [
    filaFavorito({ id: 'activo' }),
    filaFavorito({ id: 'reservado', estado: 'reservado' }),
    filaFavorito({ id: 'pausado', estado: 'pausado' }),
    filaFavorito({ id: 'entregado', estado: 'entregado' }),
    filaFavorito({ id: 'agotado', unidades_disponibles: 0 }),
  ];
  const database = databaseCon([[{ total: 5 }], filas, []]);
  const { anuncios } = await createAnunciosRepository(database).listarFavoritos('usuario-b', { pagina: 1 });
  assert.deepEqual(anuncios.map(({ id: anuncio, disponible, es_favorito: lleno }) => [anuncio, disponible, lleno]), [
    ['activo', true, true],
    ['reservado', true, true],
    ['pausado', false, true],
    ['entregado', false, true],
    ['agotado', false, true],
  ]);
});

test('US-25 CA12/CA15: sin favoritos, lista vacía con 0 páginas; una página de más responde vacía', async () => {
  const database = databaseCon([[{ total: 0 }], []]);
  assert.deepEqual(await createAnunciosRepository(database).listarFavoritos('usuario-b', { pagina: 3 }), {
    anuncios: [], pagina: 3, por_pagina: 20, total: 0, total_paginas: 0,
  });
  assert.equal(database.consultas.length, 2);
});

test('US-25 CA4/CA16: `es_favorito` del catálogo y del detalle sale de los favoritos del centro de la sesión', async () => {
  const lista = databaseCon([[{ total: 2 }], [
    { ...filaFavorito({ id: 'a1' }), es_favorito: true },
    { ...filaFavorito({ id: 'a2' }), es_favorito: false },
  ], []]);
  const catalogo = await createAnunciosRepository(lista).listarCatalogo('usuario-b', { pagina: 1 });
  assert.deepEqual(catalogo.anuncios.map((tarjeta) => tarjeta.es_favorito), [true, false]);
  assert.match(lista.consultas[1].sql,
    /LEFT JOIN public\.centros yo ON yo\.usuario_id = \$1 LEFT JOIN public\.favoritos f ON f\.centro_id = yo\.id AND f\.anuncio_id = a\.id/);
  assert.match(lista.consultas[1].sql, /f\.anuncio_id IS NOT NULL AS es_favorito/);

  const detalle = databaseCon([[{ ...filaFavorito(), descripcion: 'Doce balones.', categoria: 'balones', deporte: 'futbol', es_propio: false, es_favorito: true }], []]);
  const anuncio = await createAnunciosRepository(detalle).obtenerCatalogo('usuario-b', id);
  assert.equal(anuncio.es_favorito, true);
  assert.match(detalle.consultas[0].sql,
    /EXISTS \(SELECT 1 FROM public\.favoritos f WHERE f\.centro_id = yo\.id AND f\.anuncio_id = a\.id\) AS es_favorito/);
});
