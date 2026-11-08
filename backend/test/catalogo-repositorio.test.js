import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnunciosRepository } from '../src/repositories/anuncios.js';

const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const fila = {
  id,
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Primera línea.\n<script>alert(1)</script>',
  categoria: 'balones', deporte: 'futbol', estado_material: 'buen_estado',
  unidades_disponibles: 12, modalidad: 'venta', precio_unitario_centimos: 1250,
  estado: 'activo', publicado_en: new Date('2026-11-08T10:00:00Z'),
  centro_id: 'centro-a', centro_nombre: 'CE Montjuïc', centro_localidad: 'Barcelona',
  distancia_km: 12.4, es_propio: false,
};
const foto = (orden, es_principal = false) => ({
  id: `foto-${orden}`, anuncio_id: id, ruta: `centro-a/${id}/${orden}.jpg`, orden, es_principal,
});
function databaseCon(resultados) {
  const consultas = [];
  return {
    consultas,
    async query(sql, values) {
      consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      return { rows: resultados.shift() ?? [] };
    },
  };
}
const urlFoto = (ruta) => `https://storage.test/${ruta}`;

test('US-24 CA12/CA15: DTO explícito, fotos públicas principal primero y descripción sin transformar', async () => {
  const database = databaseCon([[
    { ...fila, email: 'privado@example.com', telefono: 'privado', direccion: 'privada', latitud: 41, longitud: 2 },
  ], [foto(3), foto(1), foto(2, true)]]);
  const anuncio = await createAnunciosRepository(database, { urlFoto }).obtenerCatalogo('usuario-b', id);
  assert.deepEqual(anuncio, {
    id, titulo: fila.titulo, descripcion: fila.descripcion,
    categoria: 'balones', deporte: 'futbol', estado_material: 'buen_estado',
    unidades_disponibles: 12, modalidad: 'venta', precio_unitario_centimos: 1250,
    estado: 'activo', publicado_en: '2026-11-08T10:00:00.000Z',
    fotos: [2, 1, 3].map((orden) => ({ url: urlFoto(foto(orden).ruta), orden, es_principal: orden === 2 })),
    centro: { id: 'centro-a', nombre: 'CE Montjuïc', localidad: 'Barcelona' },
    distancia_km: 12.4, es_favorito: false, es_propio: false,
  });
  assert.deepEqual(database.consultas[1].values, [[id]]);
});

test('US-24 CA12/CA13: consulta parametrizada con los dos estados visibles y stock positivo', async () => {
  const database = databaseCon([[fila], []]);
  await createAnunciosRepository(database).obtenerCatalogo('usuario-b', id);
  const { sql, values } = database.consultas[0];
  assert.deepEqual(values, ['usuario-b', id]);
  assert.match(sql, /JOIN public\.centros c ON c\.id = a\.centro_id/);
  assert.match(sql, /JOIN public\.centros yo ON yo\.usuario_id = \$1/);
  assert.match(sql, /WHERE a\.id = \$2 AND a\.estado IN \('activo', 'reservado'\) AND a\.unidades_disponibles > 0$/);
  assert.doesNotMatch(sql, /c\.id <> yo\.id/);
});

test('US-24 CA12 y base E04: distancia Haversine SQL, radio 6371 y null si falta cualquier coordenada', async () => {
  const database = databaseCon([[{ ...fila, distancia_km: null }], []]);
  const anuncio = await createAnunciosRepository(database).obtenerCatalogo('usuario-b', id);
  const { sql } = database.consultas[0];
  assert.match(sql, /WHEN c\.latitud IS NULL OR c\.longitud IS NULL OR yo\.latitud IS NULL OR yo\.longitud IS NULL THEN NULL/);
  assert.match(sql, /ROUND\(\(6371 \* 2 \* asin\(sqrt\(LEAST\(1\.0, GREATEST\(0\.0,/);
  assert.match(sql, /::numeric, 1\)::double precision/);
  assert.equal(anuncio.distancia_km, null);
  assert.deepEqual(anuncio.fotos, []);
});

test('US-24 CA13: UUID inválido y no encontrado no consultan fotos ni revelan otro error', async () => {
  const database = databaseCon([]);
  const anuncios = createAnunciosRepository(database);
  for (const invalido of [undefined, null, 12, '1234', `${id}x`]) {
    await assert.rejects(anuncios.obtenerCatalogo('usuario-b', invalido), { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
  }
  assert.deepEqual(database.consultas, []);
  await assert.rejects(anuncios.obtenerCatalogo('usuario-b', id), { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
  assert.equal(database.consultas.length, 1);
});

test('US-24 CA14: el detalle propio conserva es_propio y distancia cero', async () => {
  const database = databaseCon([[{ ...fila, es_propio: true, distancia_km: 0 }], []]);
  const anuncio = await createAnunciosRepository(database).obtenerCatalogo('usuario-a', id);
  assert.equal(anuncio.es_propio, true);
  assert.equal(anuncio.distancia_km, 0);
});

test('US-24 CA11: fallo de consulta de anuncio o fotos se traduce a 503', async () => {
  for (const consultaQueFalla of [1, 2]) {
    let llamadas = 0;
    const database = {
      async query() {
        if (++llamadas === consultaQueFalla) throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
        return { rows: [fila] };
      },
    };
    await assert.rejects(createAnunciosRepository(database).obtenerCatalogo('usuario-b', id), {
      status: 503, code: 'BASE_DATOS_NO_DISPONIBLE',
    });
  }
});
