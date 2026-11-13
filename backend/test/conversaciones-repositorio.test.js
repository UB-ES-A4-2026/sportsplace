import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aConversacion, aMensaje, createConversacionesRepository, LIMITE_MENSAJES_POR_MINUTO,
} from '../src/repositories/conversaciones.js';

// US-28 (T28-2): repositorio de conversaciones con un doble de la base de datos.
// `responder(sql, values)` devuelve las filas de cada consulta según su SQL.
const CENTRO_B = 'centro-b';
const CENTRO_A = 'centro-a';
const ANUNCIO = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const CONVERSACION = '0f4e5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b';
const urlFoto = (ruta) => `https://proyecto.supabase.co/storage/v1/object/public/anuncios/${ruta}`;

const filaConversacion = {
  id: CONVERSACION,
  creada_en: new Date('2026-11-13T11:00:00Z'),
  centro_comprador_id: CENTRO_B,
  centro_vendedor_id: CENTRO_A,
  anuncio_id: ANUNCIO,
  titulo: 'Balones de baloncesto Molten talla 7',
  modalidad: 'venta',
  precio_unitario_centimos: 1200,
  estado: 'activo',
  foto_ruta: 'centro-a/anuncio/foto.jpg',
  otro_centro_id: CENTRO_A,
  otro_centro_nombre: 'Club Natació Sabadell',
};
const filaMensaje = (n, autor = CENTRO_B) => ({
  id: `mensaje-${n}`,
  centro_autor_id: autor,
  tipo: 'texto',
  texto: `Mensaje ${n}`,
  creado_en: new Date(Date.UTC(2026, 10, 13, 11, 0, n)),
});

function fakeDatabase(responder, { error } = {}) {
  const log = [];
  const db = { log };
  db.query = async (sql, values) => {
    const limpio = sql.replace(/\s+/g, ' ').trim();
    log.push({ sql: limpio, values });
    if (error) throw error;
    const rows = responder(limpio, values) ?? [];
    return { rows, rowCount: rows.length };
  };
  // El cliente de la transacción usa db.query, para que un test pueda sustituirla.
  return Object.assign(db, {
    async transaction(callback) {
      log.push({ sql: 'BEGIN' });
      try {
        const resultado = await callback({ query: (sql, values) => db.query(sql, values) });
        log.push({ sql: 'COMMIT' });
        return resultado;
      } catch (excepcion) {
        log.push({ sql: 'ROLLBACK' });
        throw excepcion;
      }
    },
  });
}

// Respuestas por defecto de un camino feliz; `cambios` sustituye las que haga
// falta. `existente` es la lista de respuestas sucesivas a la búsqueda de la
// conversación del par (anuncio, comprador).
function base(cambios = {}) {
  const respuestas = {
    centro: [{ id: CENTRO_B }],
    anuncio: [{ id: ANUNCIO, centro_id: CENTRO_A, estado: 'activo' }],
    recientes: [{ recientes: 0 }],
    existente: [[]],
    insertarConversacion: [{ id: CONVERSACION }],
    insertarMensaje: [filaMensaje(1)],
    conversacion: [filaConversacion],
    ...cambios,
  };
  return (sql) => {
    if (sql.startsWith('SELECT id FROM public.centros')) return respuestas.centro;
    if (sql.startsWith('SELECT id, centro_id, estado FROM public.anuncios')) return respuestas.anuncio;
    if (sql.includes('pg_advisory_xact_lock')) return [{}];
    if (sql.includes('AS recientes')) return respuestas.recientes;
    if (sql.startsWith('SELECT id FROM public.conversaciones')) {
      return respuestas.existente.length > 1 ? respuestas.existente.shift() : respuestas.existente[0];
    }
    if (sql.startsWith('INSERT INTO public.conversaciones')) return respuestas.insertarConversacion;
    if (sql.startsWith('INSERT INTO public.mensajes')) return respuestas.insertarMensaje;
    if (sql.startsWith('SELECT c.id, c.creada_en')) return respuestas.conversacion;
    return respuestas.otras?.(sql) ?? [];
  };
}

async function rechaza(promesa, status, code) {
  await assert.rejects(promesa, (error) => {
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

const sqls = (db) => db.log.map((entrada) => entrada.sql);

test('CA23 y CA24: objetos conversacion y mensaje', () => {
  assert.deepEqual(aConversacion(filaConversacion, CENTRO_B, urlFoto), {
    id: CONVERSACION,
    anuncio: {
      id: ANUNCIO,
      titulo: 'Balones de baloncesto Molten talla 7',
      foto_principal_url: urlFoto('centro-a/anuncio/foto.jpg'),
      modalidad: 'venta',
      precio_unitario_centimos: 1200,
      estado: 'activo',
    },
    otro_centro: { id: CENTRO_A, nombre: 'Club Natació Sabadell', eliminado: false },
    soy: 'comprador',
    puede_escribir: true,
    creada_en: '2026-11-13T11:00:00.000Z',
  });
  assert.equal(aConversacion({ ...filaConversacion, foto_ruta: null }, CENTRO_A, urlFoto).soy, 'vendedor');
  assert.equal(aConversacion({ ...filaConversacion, foto_ruta: null }, CENTRO_A, urlFoto).anuncio.foto_principal_url, null);
  assert.deepEqual(aMensaje(filaMensaje(1), CENTRO_B), {
    id: 'mensaje-1', texto: 'Mensaje 1', es_mio: true, tipo: 'texto', creado_en: '2026-11-13T11:00:01.000Z',
  });
  assert.equal(aMensaje(filaMensaje(1), CENTRO_A).es_mio, false);
});

test('CA20: crea la conversación con el vendedor del anuncio y el primer mensaje en una transacción', async () => {
  const db = fakeDatabase(base());
  const repositorio = createConversacionesRepository(db, { urlFoto });
  const { conversacion, mensaje } = await repositorio.crear('usuario-b', { anuncioId: ANUNCIO, texto: 'Hola' });
  assert.equal(conversacion.id, CONVERSACION);
  assert.equal(conversacion.soy, 'comprador');
  assert.equal(mensaje.es_mio, true);

  const log = sqls(db);
  assert.equal(log[0], 'BEGIN');
  assert.equal(log.at(-1), 'COMMIT');
  assert.match(log.find((sql) => sql.startsWith('SELECT id, centro_id, estado')), /estado <> 'retirado' FOR SHARE/);
  const insercion = db.log.find((entrada) => entrada.sql.startsWith('INSERT INTO public.conversaciones'));
  assert.match(insercion.sql, /ON CONFLICT \(anuncio_id, centro_comprador_id\) DO NOTHING/);
  assert.deepEqual(insercion.values, [ANUNCIO, CENTRO_B, CENTRO_A]);
  const mensajeSql = db.log.find((entrada) => entrada.sql.startsWith('INSERT INTO public.mensajes'));
  assert.deepEqual(mensajeSql.values, [CONVERSACION, CENTRO_B, 'usuario-b', 'Hola']);
  // CA26: el límite se comprueba con el bloqueo del centro antes de insertar.
  assert.ok(log.findIndex((sql) => sql.includes('pg_advisory_xact_lock')) < log.indexOf(mensajeSql.sql));
});

test('CA21 y CA33: anuncio inexistente o retirado (404), propio, pausado o entregado (409)', async () => {
  const crear = (cambios) => createConversacionesRepository(fakeDatabase(base(cambios)))
    .crear('usuario-b', { anuncioId: ANUNCIO, texto: 'Hola' });
  await rechaza(crear({ anuncio: [] }), 404, 'NO_ENCONTRADO');
  // CA32: el vendedor no inicia conversaciones.
  await rechaza(crear({ anuncio: [{ id: ANUNCIO, centro_id: CENTRO_B, estado: 'activo' }] }), 409, 'ANUNCIO_PROPIO');
  for (const estado of ['pausado', 'entregado']) {
    await rechaza(crear({ anuncio: [{ id: ANUNCIO, centro_id: CENTRO_A, estado }] }), 409, 'ANUNCIO_NO_DISPONIBLE');
  }
  // Reservado: se puede escribir.
  const { conversacion } = await crear({ anuncio: [{ id: ANUNCIO, centro_id: CENTRO_A, estado: 'reservado' }] });
  assert.equal(conversacion.id, CONVERSACION);
});

test('CA21 y CA36: si ya existe (antes o por una carrera), 409 con su id y sin insertar mensajes', async () => {
  let db = fakeDatabase(base({ existente: [[{ id: CONVERSACION }]] }));
  await assert.rejects(
    createConversacionesRepository(db).crear('usuario-b', { anuncioId: ANUNCIO, texto: 'Hola' }),
    (error) => error.code === 'CONVERSACION_YA_EXISTE' && error.details.conversacion_id === CONVERSACION,
  );
  assert.equal(sqls(db).at(-1), 'ROLLBACK');
  assert.ok(!sqls(db).some((sql) => sql.startsWith('INSERT')));

  // La otra petición la crea entre la comprobación y el INSERT: ON CONFLICT no
  // devuelve fila y se responde con la conversación ganadora.
  db = fakeDatabase(base({ existente: [[], [{ id: CONVERSACION }]], insertarConversacion: [] }));
  await assert.rejects(
    createConversacionesRepository(db).crear('usuario-b', { anuncioId: ANUNCIO, texto: 'Hola' }),
    (error) => error.code === 'CONVERSACION_YA_EXISTE' && error.details.conversacion_id === CONVERSACION,
  );
  assert.ok(!sqls(db).some((sql) => sql.startsWith('INSERT INTO public.mensajes')));
});

test('CA26: con 30 mensajes en el último minuto, el 31.º responde 429 al crear y al responder', async () => {
  const lleno = base({ recientes: [{ recientes: LIMITE_MENSAJES_POR_MINUTO }] });
  let db = fakeDatabase(lleno);
  await rechaza(createConversacionesRepository(db).crear('usuario-b', { anuncioId: ANUNCIO, texto: 'Hola' }), 429, 'DEMASIADOS_INTENTOS');
  assert.ok(!sqls(db).some((sql) => sql.startsWith('INSERT')));
  db = fakeDatabase(lleno);
  await rechaza(createConversacionesRepository(db).enviar('usuario-b', CONVERSACION, { texto: 'Hola' }), 429, 'DEMASIADOS_INTENTOS');
  // Cuenta los mensajes del centro (de todas sus conversaciones), no del usuario.
  const recuento = db.log.find((entrada) => entrada.sql.includes('AS recientes'));
  assert.match(recuento.sql, /centro_autor_id = \$1 AND creado_en > clock_timestamp\(\) - interval '1 minute'/);
  assert.deepEqual(recuento.values, [CENTRO_B]);

  db = fakeDatabase(base({ recientes: [{ recientes: LIMITE_MENSAJES_POR_MINUTO - 1 }] }));
  assert.equal((await createConversacionesRepository(db).enviar('usuario-b', CONVERSACION, { texto: 'Hola' })).id, 'mensaje-1');
});

test('CA25, CA31 y CA34: escriben los dos centros; una conversación ajena responde 404', async () => {
  let db = fakeDatabase(base({ conversacion: [{ ...filaConversacion, estado: 'retirado' }] }));
  const mensaje = await createConversacionesRepository(db).enviar('usuario-b', CONVERSACION, { texto: '¿Ya no lo tenéis?' });
  assert.equal(mensaje.es_mio, true);
  const pertenencia = db.log.find((entrada) => entrada.sql.startsWith('SELECT c.id, c.creada_en'));
  assert.match(pertenencia.sql, /\$2 IN \(c\.centro_comprador_id, c\.centro_vendedor_id\)/);
  assert.deepEqual(pertenencia.values, [CONVERSACION, CENTRO_B]);

  db = fakeDatabase(base({ conversacion: [] }));
  await rechaza(createConversacionesRepository(db).enviar('usuario-b', CONVERSACION, { texto: 'Hola' }), 404, 'NO_ENCONTRADO');
  assert.ok(!sqls(db).some((sql) => sql.startsWith('INSERT')));
  await rechaza(createConversacionesRepository(fakeDatabase(base({ conversacion: [] }))).obtener('usuario-b', CONVERSACION), 404, 'NO_ENCONTRADO');
});

test('CA22: los 50 más recientes en orden ascendente y hay_anteriores', async () => {
  // La consulta devuelve hasta 51 filas de la más nueva a la más antigua.
  const filas = Array.from({ length: 51 }, (_, i) => filaMensaje(60 - i, i % 2 ? CENTRO_A : CENTRO_B));
  let db = fakeDatabase(base({ otras: (sql) => (sql.includes('ORDER BY creado_en DESC') ? filas : []) }));
  let pagina = await createConversacionesRepository(db, { urlFoto }).obtener('usuario-b', CONVERSACION);
  assert.equal(pagina.mensajes.length, 50);
  assert.equal(pagina.hay_anteriores, true);
  assert.equal(pagina.mensajes[0].id, 'mensaje-11');
  assert.equal(pagina.mensajes.at(-1).id, 'mensaje-60');
  assert.equal(pagina.conversacion.soy, 'comprador');
  assert.match(sqls(db).find((sql) => sql.includes('ORDER BY creado_en DESC')), /LIMIT 51$/);

  db = fakeDatabase(base({ otras: (sql) => (sql.includes('ORDER BY creado_en DESC') ? filas.slice(0, 3) : []) }));
  pagina = await createConversacionesRepository(db).obtener('usuario-b', CONVERSACION);
  assert.deepEqual(pagina.mensajes.map((m) => m.id), ['mensaje-58', 'mensaje-59', 'mensaje-60']);
  assert.equal(pagina.hay_anteriores, false);
});

test('CA14 y CA22: antes y despues usan el mensaje como cursor de esta conversación', async () => {
  const responder = base({
    otras: (sql) => {
      if (sql.startsWith('SELECT 1 FROM public.mensajes')) return [{ '?column?': 1 }];
      if (sql.includes('> (SELECT creado_en, id')) return [filaMensaje(61, CENTRO_A)];
      if (sql.includes('< (SELECT creado_en, id')) return [filaMensaje(9), filaMensaje(8)];
      return [];
    },
  });
  let db = fakeDatabase(responder);
  let pagina = await createConversacionesRepository(db).obtener('usuario-b', CONVERSACION, { despues: 'mensaje-60' });
  assert.deepEqual(pagina.mensajes.map((m) => [m.id, m.es_mio]), [['mensaje-61', false]]);
  assert.match(sqls(db).find((sql) => sql.includes('> (SELECT')), /ORDER BY creado_en, id$/);

  db = fakeDatabase(responder);
  pagina = await createConversacionesRepository(db).obtener('usuario-b', CONVERSACION, { antes: 'mensaje-10' });
  assert.deepEqual(pagina.mensajes.map((m) => m.id), ['mensaje-8', 'mensaje-9']);
  assert.equal(pagina.hay_anteriores, false);

  // Un mensaje de otra conversación como cursor: 400 sin leer mensajes.
  db = fakeDatabase(base());
  await assert.rejects(
    createConversacionesRepository(db).obtener('usuario-b', CONVERSACION, { antes: 'mensaje-ajeno' }),
    (error) => error.code === 'DATOS_INVALIDOS' && error.details.antes === 'El mensaje no es de esta conversación.',
  );
});

test('CA19: conversación del centro como interesado sobre el anuncio, null o 404', async () => {
  let db = fakeDatabase(base({ otras: () => [{ id: CONVERSACION }] }));
  assert.deepEqual(await createConversacionesRepository(db).deAnuncio('usuario-b', ANUNCIO), { id: CONVERSACION });
  const consulta = db.log.at(-1);
  assert.match(consulta.sql, /c\.centro_comprador_id = \$2 WHERE a\.id = \$1 AND a\.estado <> 'retirado'/);
  assert.deepEqual(consulta.values, [ANUNCIO, CENTRO_B]);

  db = fakeDatabase(base({ otras: () => [{ id: null }] }));
  assert.equal(await createConversacionesRepository(db).deAnuncio('usuario-b', ANUNCIO), null);
  db = fakeDatabase(base({ otras: () => [] }));
  await rechaza(createConversacionesRepository(db).deAnuncio('usuario-b', ANUNCIO), 404, 'NO_ENCONTRADO');
});

test('fallos de PostgreSQL: 503 y, si una restricción rechaza datos ya validados, 500', async () => {
  const caida = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  await rechaza(createConversacionesRepository(fakeDatabase(base(), { error: caida })).obtener('usuario-b', CONVERSACION), 503, 'BASE_DATOS_NO_DISPONIBLE');
  const restriccion = Object.assign(new Error('check'), { code: '23514' });
  const db = fakeDatabase(base());
  const original = db.query;
  db.query = async (sql, values) => {
    if (sql.trim().startsWith('INSERT INTO public.mensajes')) throw restriccion;
    return original(sql, values);
  };
  await rechaza(createConversacionesRepository(db).enviar('usuario-b', CONVERSACION, { texto: 'Hola' }), 500, 'ERROR_INTERNO');
});
