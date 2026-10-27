import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import {
  aAnuncio, anuncioNoEditable, anuncioNoEncontrado, createAnunciosRepository,
} from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { storageUnavailable } from '../src/services/storage-fotos.js';
import { fotosNoPertenecen } from '../src/validation/fotos.js';
import { fotoJpg, fotoPng, formularioAnuncio, startApi } from './helpers.js';

// US-15: PATCH /api/anuncios/:id en multipart (CA5, CA7-CA17, CA20). El doble
// de la API simula la tabla anuncios con sus fotos y su propiedad; el de
// Storage, el bucket; el del repositorio, la base de datos. `datos` lleva la
// modalidad y el precio de US-14 (CA5, CA19).
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-b': { id: 'usuario-b', email: 'b@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const CENTRO_A = '11111111-1111-4111-8111-111111111111';
const centroDe = { 'usuario-a': CENTRO_A, 'usuario-b': '22222222-2222-4222-8222-222222222222' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

const ID = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const F1 = 'f1f1f1f1-0000-4000-8000-000000000001';
const F2 = 'f2f2f2f2-0000-4000-8000-000000000002';
const AJENA = 'f9f9f9f9-0000-4000-8000-000000000009';
const PUBLICADO = '2026-11-03T10:15:00.000Z';
const AHORA = '2026-11-04T09:00:00.000Z';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const rutaDe = (fotoId, ext = 'jpg') => `${CENTRO_A}/${ID}/${fotoId}.${ext}`;

let filas;
let ediciones;
let caida;
let falloEditar;
let entregarAlEditar;
function propia(usuarioId, id) {
  const fila = filas.find((f) => f.id === id && f.centro_id === centroDe[usuarioId] && f.estado !== 'retirado');
  if (!fila) throw anuncioNoEncontrado();
  if (fila.estado === 'entregado') throw anuncioNoEditable();
  return fila;
}
const fakeAnuncios = {
  async paraEditar(usuarioId, id) {
    if (caida) throw databaseUnavailable();
    const fila = propia(usuarioId, id);
    return { centroId: fila.centro_id, fotoIds: fila.fotos.map((foto) => foto.id) };
  },
  async editar(usuarioId, id, { datos, fotos }) {
    if (entregarAlEditar) filas[0].estado = 'entregado';
    if (falloEditar) throw falloEditar;
    const fila = propia(usuarioId, id);
    ediciones.push({ usuarioId, id, datos, fotos });
    const anteriores = new Map(fila.fotos.map((foto) => [foto.id, foto]));
    const finales = fotos.map((foto) => ({
      id: foto.id, ruta: foto.ruta ?? anteriores.get(foto.id).ruta, orden: foto.orden, es_principal: foto.es_principal,
    }));
    const quedan = new Set(finales.map((foto) => foto.id));
    const rutasQuitadas = fila.fotos.filter((foto) => !quedan.has(foto.id)).map((foto) => foto.ruta);
    Object.assign(fila, datos, { fotos: finales, actualizado_en: AHORA });
    const fotosApi = finales.map(({ id: fotoId, ruta, orden, es_principal }) => ({
      id: fotoId, url: `https://storage.test/${ruta}`, orden, es_principal,
    }));
    return { anuncio: { ...fila, fotos: fotosApi }, rutasQuitadas };
  },
};

let objetos; // ruta → contenido
let subidas;
let borrados;
let falloSubida;
const fakeFotos = {
  async subir(ruta, contenido) {
    if (falloSubida) throw storageUnavailable();
    subidas.push(ruta);
    objetos.set(ruta, contenido);
  },
  async borrar(rutas) {
    borrados.push(...rutas);
    for (const ruta of rutas) objetos.delete(ruta);
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios, fotos: fakeFotos }); });
after(() => api.close());
beforeEach(() => {
  filas = [{
    id: ID,
    centro_id: CENTRO_A,
    titulo: 'Balones de fútbol talla 5',
    descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
    categoria: 'balones',
    deporte: 'futbol',
    unidades_disponibles: 12,
    estado_material: 'buen_estado',
    modalidad: 'venta',
    precio_unitario_centimos: 850,
    estado: 'activo',
    fotos: [
      { id: F1, ruta: rutaDe(F1), orden: 1, es_principal: true },
      { id: F2, ruta: rutaDe(F2, 'png'), orden: 2, es_principal: false },
    ],
    publicado_en: PUBLICADO,
    creado_en: PUBLICADO,
    actualizado_en: PUBLICADO,
  }];
  ediciones = [];
  caida = false;
  falloEditar = null;
  entregarAlEditar = false;
  objetos = new Map([[rutaDe(F1), fotoJpg], [rutaDe(F2, 'png'), fotoPng]]);
  subidas = [];
  borrados = [];
  falloSubida = false;
});

const valido = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 10,
  estado_material: 'buen_estado',
  modalidad: 'venta',
  precio_unitario_centimos: 700,
};
const conTodas = { ...valido, fotos_conservar: [F1, F2] };
const nueva = { contenido: fotoJpg, tipo: 'image/jpeg', nombre: 'nueva.jpg' };

// Por defecto conserva F1 y F2 con F1 como principal. `datos: null` no envía la parte.
const editar = (
  { datos = conTodas, fotos = [], fotoPrincipal = `existente:${F1}` } = {},
  { id = ID, token = 'token-a' } = {},
) => fetch(`${api.baseUrl}/api/anuncios/${id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}` },
  body: formularioAnuncio({ datos: datos ?? undefined, fotos, fotoPrincipal }),
});

async function detallesDe(response) {
  assert.equal(response.status, 400);
  const { error } = await response.json();
  assert.equal(error.code, 'DATOS_INVALIDOS');
  assert.equal(error.message, 'Revisa los campos marcados.');
  return error.details;
}

function sinCambios() {
  assert.deepEqual(ediciones, []);
  assert.equal(filas[0].unidades_disponibles, 12);
  assert.equal(filas[0].precio_unitario_centimos, 850);
  assert.deepEqual(subidas, []);
  assert.deepEqual([...objetos.keys()], [rutaDe(F1), rutaDe(F2, 'png')]);
}

const resumen = (fotos) => fotos.map(({ id, orden, es_principal }) => ({ id, orden, es_principal }));

test('US-15 CA14/CA9: cambiar las unidades sin tocar las fotos responde 200 con el anuncio actualizado', async () => {
  const response = await editar();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { anuncio } = await response.json();
  assert.equal(anuncio.unidades_disponibles, 10);
  assert.equal(anuncio.estado, 'activo');
  assert.equal(anuncio.publicado_en, PUBLICADO);
  assert.equal(anuncio.actualizado_en, AHORA);
  assert.deepEqual(resumen(anuncio.fotos), [
    { id: F1, orden: 1, es_principal: true },
    { id: F2, orden: 2, es_principal: false },
  ]);
  assert.deepEqual(ediciones, [{
    usuarioId: 'usuario-a',
    id: ID,
    datos: valido,
    fotos: [{ id: F1, es_principal: true, orden: 1 }, { id: F2, es_principal: false, orden: 2 }],
  }]);
  assert.deepEqual(subidas, []);
  assert.deepEqual(borrados, []);
});

test('US-15 CA8/CA12/E2E-1: quitar F1 y añadir una nueva como principal', async () => {
  const response = await editar({
    datos: { ...valido, fotos_conservar: [F2] }, fotos: [nueva], fotoPrincipal: 'nueva:1',
  });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  const [{ fotos }] = ediciones;
  const nuevaId = fotos[1].id;
  assert.match(nuevaId, new RegExp(`^${UUID}$`));
  assert.deepEqual(resumen(anuncio.fotos), [
    { id: F2, orden: 1, es_principal: false },
    { id: nuevaId, orden: 2, es_principal: true },
  ]);
  // F2 conserva su id y su URL; la nueva va a <centro>/<anuncio>/<foto>.jpg.
  assert.equal(anuncio.fotos[0].url, `https://storage.test/${rutaDe(F2, 'png')}`);
  assert.equal(fotos[1].ruta, rutaDe(nuevaId));
  assert.equal(fotos[1].tipo_mime, 'image/jpeg');
  assert.equal(fotos[1].bytes, fotoJpg.length);
  assert.ok(!JSON.stringify(fotos).includes('nueva.jpg'));
  assert.deepEqual(subidas, [rutaDe(nuevaId)]);
  // CA16: F1 se borra de Storage después de guardar.
  assert.deepEqual(borrados, [rutaDe(F1)]);
  assert.deepEqual([...objetos.keys()].sort(), [rutaDe(F2, 'png'), rutaDe(nuevaId)].sort());
});

test('US-15 CA12: el orden final es el de fotos_conservar seguido de las nuevas', async () => {
  const response = await editar({
    datos: { ...valido, fotos_conservar: [F2, F1] }, fotos: [nueva, nueva], fotoPrincipal: `existente:${F1}`,
  });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  assert.deepEqual(anuncio.fotos.map(({ orden, es_principal }) => [orden, es_principal]), [
    [1, false], [2, true], [3, false], [4, false],
  ]);
  assert.deepEqual(anuncio.fotos.slice(0, 2).map((foto) => foto.id), [F2, F1]);
  assert.equal(subidas.length, 2);
  assert.deepEqual(borrados, []);
});

test('US-15 CA12: cambiar todas las fotos (fotos_conservar vacío) sube las nuevas y borra las anteriores', async () => {
  const response = await editar({ datos: { ...valido, fotos_conservar: [] }, fotos: [nueva], fotoPrincipal: 'nueva:1' });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  assert.equal(anuncio.fotos.length, 1);
  assert.deepEqual(borrados.sort(), [rutaDe(F1), rutaDe(F2, 'png')].sort());
});

test('US-15 CA12/CA18: 0 fotos finales → «Añade al menos una foto.»; 9 → «Puedes añadir 8 fotos como máximo.»', async () => {
  const ninguna = await detallesDe(await editar({ datos: { ...valido, fotos_conservar: [] }, fotoPrincipal: 'nueva:1' }));
  assert.equal(ninguna.fotos, 'Añade al menos una foto.');

  const nueve = await detallesDe(await editar({
    datos: conTodas, fotos: Array(7).fill(nueva), fotoPrincipal: 'nueva:1',
  }));
  assert.deepEqual(nueve, { fotos: 'Puedes añadir 8 fotos como máximo.' });

  const ocho = await editar({ datos: conTodas, fotos: Array(6).fill(nueva), fotoPrincipal: 'nueva:6' });
  assert.equal(ocho.status, 200);
  assert.equal((await ocho.json()).anuncio.fotos.length, 8);
});

test('US-15 CA5: las fotos nuevas siguen las reglas de US-13 (tipo por cabecera y 5 MB)', async () => {
  const texto = { contenido: Buffer.from('no soy una foto'), tipo: 'image/jpeg', nombre: 'falsa.jpg' };
  assert.deepEqual(await detallesDe(await editar({ fotos: [texto] })), { fotos: 'Solo se admiten fotos JPG, PNG o WebP.' });

  const grande = { contenido: Buffer.concat([fotoJpg, Buffer.alloc(5_242_881 - fotoJpg.length)]), tipo: 'image/jpeg' };
  assert.deepEqual(await detallesDe(await editar({ fotos: [grande] })), { fotos: 'Cada foto debe pesar 5 MB como máximo.' });
  sinCambios();
});

test('US-15 CA13: un id de fotos_conservar que no es de este anuncio → details.fotos_conservar y nada cambia', async () => {
  const response = await editar({ datos: { ...valido, fotos_conservar: [F1, AJENA] }, fotos: [nueva] });

  assert.deepEqual(await detallesDe(response), { fotos_conservar: 'Alguna foto no pertenece a este anuncio.' });
  sinCambios();
});

test('US-15 CA13: fotos_conservar ausente, que no es un array, con ids repetidos o que no son UUID', async () => {
  const casos = [valido, { ...valido, fotos_conservar: F1 }, { ...valido, fotos_conservar: [F1, F1] }, { ...valido, fotos_conservar: ['1'] }];
  for (const datos of casos) {
    const details = await detallesDe(await editar({ datos, fotos: [nueva], fotoPrincipal: 'nueva:1' }));
    assert.deepEqual(details, { fotos_conservar: 'Alguna foto no pertenece a este anuncio.' });
  }
  sinCambios();
});

test('US-15 CA13: foto_principal que no apunta a una foto final → «La foto principal no es válida.»', async () => {
  const principales = [undefined, '', '1', `existente:${AJENA}`, 'nueva:1', 'nueva:0', 'nueva:x', `principal:${F1}`];
  for (const fotoPrincipal of principales) {
    const datos = { ...valido, fotos_conservar: [F2] };
    const details = await detallesDe(await editar({ datos, fotoPrincipal }));
    assert.deepEqual(details, { foto_principal: 'La foto principal no es válida.' }, String(fotoPrincipal));
  }
  // Una foto quitada no puede ser la principal.
  const quitada = await editar({ datos: { ...valido, fotos_conservar: [F2] }, fotoPrincipal: `existente:${F1}` });
  assert.deepEqual(await detallesDe(quitada), { foto_principal: 'La foto principal no es válida.' });
  sinCambios();
});

test('US-15 CA5/E2E-2: errores de campos y de fotos se devuelven juntos y no se modifica nada', async () => {
  const response = await editar({
    datos: { ...valido, titulo: '', unidades_disponibles: 0, fotos_conservar: [] },
    fotoPrincipal: 'nueva:1',
  });

  assert.deepEqual(await detallesDe(response), {
    titulo: 'El título es obligatorio.',
    unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
    fotos: 'Añade al menos una foto.',
    foto_principal: 'La foto principal no es válida.',
  });
  sinCambios();
});

test('US-15 CA5: `datos` es el anuncio completo, no un parche parcial', async () => {
  const response = await editar({ datos: { unidades_disponibles: 10, fotos_conservar: [F1] } });

  assert.deepEqual(Object.keys(await detallesDe(response)).sort(), [
    'categoria', 'deporte', 'descripcion', 'estado_material', 'modalidad', 'titulo',
  ]);
  sinCambios();
});

test('US-15 CA11: sin `datos`, con `datos` que no es JSON o con cuerpo JSON → «Faltan los datos del anuncio.»', async () => {
  const sinDatos = await editar({ datos: null, fotos: [nueva], fotoPrincipal: 'nueva:1' });
  assert.deepEqual(await detallesDe(sinDatos), { datos: 'Faltan los datos del anuncio.' });

  const noJson = await editar({ datos: '{"titulo":' });
  assert.deepEqual(await detallesDe(noJson), { datos: 'Faltan los datos del anuncio.' });

  const json = await fetch(`${api.baseUrl}/api/anuncios/${ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-a' },
    body: JSON.stringify(conTodas),
  });
  assert.equal((await detallesDe(json)).datos, 'Faltan los datos del anuncio.');
  sinCambios();
});

test('US-15 CA7: `estado`, `publicado_en` y otras claves de `datos` se ignoran', async () => {
  const response = await editar({
    datos: { ...conTodas, estado: 'entregado', publicado_en: '2020-01-01T00:00:00.000Z', centro_id: 'otro', id: 'otro' },
  });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  assert.equal(anuncio.estado, 'activo');
  assert.equal(anuncio.publicado_en, PUBLICADO);
  assert.equal(anuncio.centro_id, CENTRO_A);
  assert.deepEqual(ediciones[0].datos, valido);
});

test('US-15 E2E-3: un anuncio pausado se edita y sigue pausado', async () => {
  filas[0].estado = 'pausado';
  const response = await editar({ datos: { ...conTodas, titulo: 'Balones de fútbol talla 4' } });

  assert.equal(response.status, 200);
  const { anuncio } = await response.json();
  assert.equal(anuncio.titulo, 'Balones de fútbol talla 4');
  assert.equal(anuncio.estado, 'pausado');
});

test('US-15 CA15/E2E-4: un anuncio entregado responde 409 ANUNCIO_NO_EDITABLE sin subir nada', async () => {
  filas[0].estado = 'entregado';
  const response = await editar({ fotos: [nueva] });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: 'ANUNCIO_NO_EDITABLE', message: 'Este anuncio ya no se puede editar.' },
  });
  sinCambios();
});

test('US-15 CA20: si otra persona lo entrega mientras se edita, 409 y se borran las fotos nuevas subidas', async () => {
  entregarAlEditar = true;
  const response = await editar({ fotos: [nueva] });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'ANUNCIO_NO_EDITABLE');
  assert.equal(subidas.length, 1);
  assert.deepEqual(borrados, subidas);
  assert.deepEqual([...objetos.keys()], [rutaDe(F1), rutaDe(F2, 'png')]);
});

test('US-15 CA17/E2E-6: otro centro recibe 404 NO_ENCONTRADO y el anuncio no cambia', async () => {
  const response = await editar({ fotos: [nueva] }, { token: 'token-b' });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
  });
  sinCambios();
});

test('US-15 CA15: inexistente, retirado o id que no es UUID responden el mismo 404', async () => {
  const respuestas = [];
  respuestas.push(await editar({}, { id: '00000000-0000-4000-8000-000000000000' }));
  filas[0].estado = 'retirado';
  respuestas.push(await editar());
  respuestas.push(await editar({}, { id: 'no-es-un-uuid' }));
  respuestas.push(await editar({ datos: null }, { id: 'no-es-un-uuid' }));

  for (const response of respuestas) {
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
    });
  }
});

test('US-15 CA16: si falla la subida de una foto nueva, 503 y el anuncio queda como estaba', async () => {
  falloSubida = true;
  const response = await editar({ datos: { ...valido, fotos_conservar: [F2] }, fotos: [nueva], fotoPrincipal: 'nueva:1' });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'ALMACENAMIENTO_NO_DISPONIBLE');
  assert.deepEqual(ediciones, []);
  // Se intenta borrar la nueva (por si llegó a guardarse), nunca F1.
  assert.equal(borrados.length, 1);
  assert.match(borrados[0], new RegExp(`^${CENTRO_A}/${ID}/${UUID}\\.jpg$`));
  assert.deepEqual([...objetos.keys()], [rutaDe(F1), rutaDe(F2, 'png')]);
});

test('US-15 CA16: si falla la base de datos, se borran las nuevas subidas y no se borra ninguna quitada', async () => {
  falloEditar = databaseUnavailable();
  const response = await editar({ datos: { ...valido, fotos_conservar: [F2] }, fotos: [nueva], fotoPrincipal: 'nueva:1' });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  assert.deepEqual(borrados, subidas);
  assert.deepEqual([...objetos.keys()], [rutaDe(F1), rutaDe(F2, 'png')]);
});

test('US-15 CA13: si las fotos cambian entre la comprobación y la transacción, 400 y se borran las nuevas', async () => {
  falloEditar = fotosNoPertenecen();
  const response = await editar({ fotos: [nueva] });

  assert.deepEqual(await detallesDe(response), { fotos_conservar: 'Alguna foto no pertenece a este anuncio.' });
  assert.deepEqual(borrados, subidas);
});

test('US-15 CA15: sin sesión 401, sin email confirmado 403 y sin base de datos 503', async () => {
  const sinToken = await fetch(`${api.baseUrl}/api/anuncios/${ID}`, {
    method: 'PATCH', body: formularioAnuncio({ datos: conTodas, fotoPrincipal: `existente:${F1}` }),
  });
  assert.equal(sinToken.status, 401);
  assert.equal((await sinToken.json()).error.code, 'NO_AUTENTICADO');

  const sinConfirmar = await editar({}, { token: 'token-sin-confirmar' });
  assert.equal(sinConfirmar.status, 403);
  assert.equal((await sinConfirmar.json()).error.code, 'EMAIL_NO_CONFIRMADO');

  caida = true;
  const sinBase = await editar();
  assert.equal(sinBase.status, 503);
  assert.equal((await sinBase.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-15 CA15: una petición multipart de más de 40 MB responde 413 sin tocar nada', async () => {
  const respuesta = await new Promise((resolve, reject) => {
    const peticion = httpRequest(`${api.baseUrl}/api/anuncios/${ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer token-a',
        'Content-Type': 'multipart/form-data; boundary=x',
        'Content-Length': String(41_943_041),
      },
    }, (recibida) => {
      let cuerpo = '';
      recibida.setEncoding('utf8');
      recibida.on('data', (trozo) => { cuerpo += trozo; });
      recibida.on('end', () => resolve({ status: recibida.statusCode, cuerpo: JSON.parse(cuerpo) }));
    });
    // El servidor puede cortar la conexión antes de recibir todo el cuerpo.
    peticion.on('error', (error) => (error.code === 'EPIPE' || error.code === 'ECONNRESET' ? null : reject(error)));
    peticion.write('--x\r\n');
  });

  assert.equal(respuesta.status, 413);
  assert.equal(respuesta.cuerpo.error.code, 'PETICION_DEMASIADO_GRANDE');
  sinCambios();
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
  modalidad: 'venta',
  precio_unitario_centimos: 700,
  estado: 'reservado',
  publicado_en: new Date(PUBLICADO),
  creado_en: new Date(PUBLICADO),
  actualizado_en: new Date(AHORA),
};

function fakeDatabase(respuestas) {
  const log = [];
  async function query(sql, values) {
    log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    const respuesta = respuestas.shift();
    if (respuesta instanceof Error) throw respuesta;
    return { rows: respuesta };
  }
  return {
    log,
    query,
    // Como database.transaction: BEGIN, callback y COMMIT, o ROLLBACK si falla.
    async transaction(callback) {
      log.push({ sql: 'BEGIN' });
      try {
        const resultado = await callback({ query });
        log.push({ sql: 'COMMIT' });
        return resultado;
      } catch (error) {
        log.push({ sql: 'ROLLBACK' });
        throw error;
      }
    },
  };
}

const NUEVA = 'f3f3f3f3-0000-4000-8000-000000000003';
const CREADA = new Date('2026-11-03T10:15:00.000Z');
const anteriores = [
  { id: F1, ruta: rutaDe(F1), tipo_mime: 'image/jpeg', bytes: 800, creado_en: CREADA },
  { id: F2, ruta: rutaDe(F2, 'png'), tipo_mime: 'image/png', bytes: 1200, creado_en: CREADA },
];
// E2E-1: se queda F2 y se añade una nueva como principal.
const fotosFinales = [
  { id: F2, es_principal: false, orden: 1 },
  { id: NUEVA, ruta: rutaDe(NUEVA), tipo_mime: 'image/jpeg', bytes: 64, es_principal: true, orden: 2 },
];
const urlFoto = (ruta) => `https://storage.test/${ruta}`;

test('US-15 CA15/CA17: paraEditar devuelve el centro y las fotos actuales del anuncio propio', async () => {
  const database = fakeDatabase([[{ centro_id: 'c1', estado: 'activo', foto_ids: [F1, F2] }]]);

  assert.deepEqual(await createAnunciosRepository(database).paraEditar('u1', ID), { centroId: 'c1', fotoIds: [F1, F2] });
  const [{ sql, values }] = database.log;
  assert.match(sql, /c\.usuario_id = \$1/);
  assert.match(sql, /a\.estado <> 'retirado'/);
  assert.deepEqual(values, ['u1', ID]);
});

test('US-15 CA15/CA17: paraEditar responde 404 si no es del centro y 409 si está entregado', async () => {
  await assert.rejects(
    createAnunciosRepository(fakeDatabase([[]])).paraEditar('u1', ID),
    { status: 404, code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' },
  );
  await assert.rejects(
    createAnunciosRepository(fakeDatabase([[{ centro_id: 'c1', estado: 'entregado', foto_ids: [] }]])).paraEditar('u1', ID),
    { status: 409, code: 'ANUNCIO_NO_EDITABLE', message: 'Este anuncio ya no se puede editar.' },
  );
});

test('US-15 CA7-CA9/CA16: editar actualiza datos y fotos en una transacción y devuelve las rutas quitadas', async () => {
  const database = fakeDatabase([
    [{ estado: 'reservado' }],
    [fila],
    anteriores,
    [
      { id: NUEVA, ruta: rutaDe(NUEVA), orden: 2, es_principal: true },
      { id: F2, ruta: rutaDe(F2, 'png'), orden: 1, es_principal: false },
    ],
  ]);
  const resultado = await createAnunciosRepository(database, { urlFoto }).editar('u1', ID, { datos: valido, fotos: fotosFinales });

  assert.deepEqual(resultado, {
    anuncio: aAnuncio(fila, [
      { id: F2, url: urlFoto(rutaDe(F2, 'png')), orden: 1, es_principal: false },
      { id: NUEVA, url: urlFoto(rutaDe(NUEVA)), orden: 2, es_principal: true },
    ]),
    rutasQuitadas: [rutaDe(F1)],
  });

  const sqls = database.log.map((entrada) => entrada.sql);
  assert.equal(sqls[0], 'BEGIN');
  assert.match(sqls[1], /^SELECT a\.estado FROM public\.anuncios a JOIN public\.centros c .* FOR UPDATE OF a$/);
  assert.match(sqls[1], /c\.usuario_id = \$1/);
  assert.match(sqls[1], /a\.estado <> 'retirado'/);
  assert.match(sqls[2], /^UPDATE public\.anuncios SET titulo = \$2, descripcion = \$3, categoria = \$4, deporte = \$5, unidades_disponibles = \$6, estado_material = \$7, actualizado_en = now\(\) WHERE id = \$1/);
  assert.doesNotMatch(sqls[2], /SET[^]*\b(estado|publicado_en) =/);
  assert.deepEqual(database.log[2].values, [ID, valido.titulo, valido.descripcion, 'balones', 'futbol', 10, 'buen_estado']);
  assert.match(sqls[3], /^DELETE FROM public\.anuncio_fotos WHERE anuncio_id = \$1/);
  assert.match(sqls[4], /^INSERT INTO public\.anuncio_fotos/);
  // CA8: F2 conserva id, ruta, tipo, bytes y creado_en; solo cambian orden y principal.
  assert.deepEqual(database.log[4].values, [
    ID,
    [F2, NUEVA],
    [rutaDe(F2, 'png'), rutaDe(NUEVA)],
    ['image/png', 'image/jpeg'],
    [1200, 64],
    [1, 2],
    [false, true],
    [CREADA, null],
  ]);
  assert.equal(sqls[5], 'COMMIT');
});

test('US-15 CA15/CA17/CA20: dentro de la transacción, 404 si no es del centro y 409 si se acaba de entregar', async () => {
  const ajeno = fakeDatabase([[]]);
  await assert.rejects(
    createAnunciosRepository(ajeno).editar('u1', ID, { datos: valido, fotos: fotosFinales }),
    { status: 404, code: 'NO_ENCONTRADO' },
  );
  assert.deepEqual(ajeno.log.map((entrada) => entrada.sql).at(-1), 'ROLLBACK');

  const entregado = fakeDatabase([[{ estado: 'entregado' }]]);
  await assert.rejects(
    createAnunciosRepository(entregado).editar('u1', ID, { datos: valido, fotos: fotosFinales }),
    { status: 409, code: 'ANUNCIO_NO_EDITABLE' },
  );
  assert.equal(entregado.log.length, 3);
});

test('US-15 CA13: si una foto conservada ya no es del anuncio, 400 y se deshace todo', async () => {
  const database = fakeDatabase([[{ estado: 'activo' }], [fila], [anteriores[0]]]);

  await assert.rejects(
    createAnunciosRepository(database).editar('u1', ID, { datos: valido, fotos: fotosFinales }),
    { status: 400, code: 'DATOS_INVALIDOS', details: { fotos_conservar: 'Alguna foto no pertenece a este anuncio.' } },
  );
  assert.equal(database.log.at(-1).sql, 'ROLLBACK');
  assert.ok(!database.log.some((entrada) => entrada.sql.startsWith('INSERT')));
});

test('US-15: si la base de datos rechaza las fotos ya validadas, 500 ERROR_INTERNO', async () => {
  const database = fakeDatabase([[{ estado: 'activo' }], [fila], anteriores, Object.assign(new Error('única'), { code: '23505' })]);
  const consola = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      createAnunciosRepository(database).editar('u1', ID, { datos: valido, fotos: fotosFinales }),
      { status: 500, code: 'ERROR_INTERNO' },
    );
  } finally {
    console.error = consola;
  }
});

test('US-15: un id que no es UUID responde 404 sin consultar la base de datos', async () => {
  const database = fakeDatabase([]);

  await assert.rejects(
    createAnunciosRepository(database).editar('u1', 'abc', { datos: valido, fotos: fotosFinales }),
    { status: 404, code: 'NO_ENCONTRADO' },
  );
  await assert.rejects(createAnunciosRepository(database).paraEditar('u1', 'abc'), { status: 404, code: 'NO_ENCONTRADO' });
  assert.equal(database.log.length, 0);
});

test('US-15: un error de PostgreSQL se convierte en 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  const database = fakeDatabase([Object.assign(new Error('caída'), { code: '57P01' })]);
  const consola = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      createAnunciosRepository(database).editar('u1', ID, { datos: valido, fotos: fotosFinales }),
      { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' },
    );
  } finally {
    console.error = consola;
  }
});
