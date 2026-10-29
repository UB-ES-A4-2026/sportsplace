import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { storageUnavailable } from '../src/services/storage-fotos.js';
import { fotoJpg, fotoPng, fotoWebp, formularioAnuncio, startApi } from './helpers.js';

// US-13: POST /api/anuncios en multipart con fotos (CA12-CA22, E2E-6).
// Los dobles simulan Supabase Auth, el repositorio de anuncios y el bucket.
const MB5 = 5_242_880;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const usuarios = {
  'token-a': { id: 'usuario-a', email: 'a@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-c', email: 'c@example.com', email_confirmado: false },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };
const CENTRO = '11111111-1111-4111-8111-111111111111';

let creaciones;
let falloBase;
const fakeAnuncios = {
  async centroDe() { return CENTRO; },
  async crear({ id, centroId, datos, fotos }) {
    if (falloBase) throw falloBase;
    creaciones.push({ id, centroId, datos, fotos });
    return {
      id, centro_id: centroId, ...datos, estado: 'activo',
      fotos: fotos.map((foto) => ({ id: foto.id, url: `https://storage.test/${foto.ruta}`, orden: foto.orden, es_principal: foto.es_principal })),
    };
  },
};

let objetos; // ruta → { contenido, tipoMime }
let borrados;
let falloSubida;
const fakeFotos = {
  async subir(ruta, contenido, tipoMime) {
    if (falloSubida?.(ruta)) throw storageUnavailable();
    objetos.set(ruta, { contenido, tipoMime });
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
  creaciones = [];
  objetos = new Map();
  borrados = [];
  falloBase = null;
  falloSubida = null;
});

const datos = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  modalidad: 'donacion',
};
const jpg = { contenido: fotoJpg, tipo: 'image/jpeg', nombre: 'balones1.jpg' };
const png = { contenido: fotoPng, tipo: 'image/png', nombre: 'balones2.png' };
const webp = { contenido: fotoWebp, tipo: 'image/webp', nombre: 'ok.webp' };

const publicar = (partes, token = 'token-a') => fetch(`${api.baseUrl}/api/anuncios`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formularioAnuncio(partes),
});

async function detallesDe(response) {
  assert.equal(response.status, 400);
  const { error } = await response.json();
  assert.equal(error.code, 'DATOS_INVALIDOS');
  assert.equal(error.message, 'Revisa los campos marcados.');
  return error.details;
}

function sinCambios() {
  assert.deepEqual(creaciones, []);
  assert.equal(objetos.size, 0);
}

test('US-13 CA12/CA17/CA18/E2E-1: dos fotos con la segunda como principal → 201 con fotos en orden', async () => {
  const response = await publicar({ datos, fotos: [jpg, png], fotoPrincipal: 2 });

  assert.equal(response.status, 201);
  const { anuncio } = await response.json();
  assert.equal(response.headers.get('location'), `/api/anuncios/${anuncio.id}`);
  assert.deepEqual(anuncio.fotos.map(({ orden, es_principal }) => ({ orden, es_principal })), [
    { orden: 1, es_principal: false },
    { orden: 2, es_principal: true },
  ]);

  // CA18/CA21/CA22: ruta <centro_id>/<anuncio_id>/<foto_id>.<ext> con UUID, sin el nombre original.
  const [creado] = creaciones;
  assert.equal(creado.id, anuncio.id);
  assert.equal(creado.centroId, CENTRO);
  assert.deepEqual(creado.datos, { ...datos, precio_unitario_centimos: null });
  assert.deepEqual(creado.fotos.map(({ ruta, tipo_mime, bytes, orden, es_principal }) => ({ ruta, tipo_mime, bytes, orden, es_principal })), [
    { ruta: `${CENTRO}/${anuncio.id}/${creado.fotos[0].id}.jpg`, tipo_mime: 'image/jpeg', bytes: fotoJpg.length, orden: 1, es_principal: false },
    { ruta: `${CENTRO}/${anuncio.id}/${creado.fotos[1].id}.png`, tipo_mime: 'image/png', bytes: fotoPng.length, orden: 2, es_principal: true },
  ]);
  for (const foto of creado.fotos) assert.match(foto.ruta, new RegExp(`^${CENTRO}/${UUID}/${UUID}\\.(jpg|png)$`));
  assert.ok(!JSON.stringify(creado.fotos).includes('balones1'));

  // CA18: en Storage, el archivo tal cual con su tipo detectado.
  assert.deepEqual([...objetos.keys()].sort(), creado.fotos.map((foto) => foto.ruta).sort());
  assert.ok(objetos.get(creado.fotos[0].ruta).contenido.equals(fotoJpg));
  assert.equal(objetos.get(creado.fotos[1].ruta).tipoMime, 'image/png');
});

test('US-13 CA12: sin `foto_principal` la principal es la 1', async () => {
  const response = await publicar({ datos, fotos: [png, webp] });

  assert.equal(response.status, 201);
  assert.deepEqual(creaciones[0].fotos.map((foto) => [foto.tipo_mime, foto.es_principal]), [
    ['image/png', true], ['image/webp', false],
  ]);
});

test('US-13 CA5/CA24: una sola foto (PNG de 1×1) y 8 fotos se aceptan', async () => {
  assert.equal((await publicar({ datos, fotos: [png] })).status, 201);
  const ocho = await publicar({ datos, fotos: Array(8).fill(jpg), fotoPrincipal: 8 });
  assert.equal(ocho.status, 201);
  assert.deepEqual(creaciones[1].fotos.map((foto) => foto.orden), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(objetos.size, 9);
});

test('US-13 CA14: 0 fotos → «Añade al menos una foto.»; 9 → «Puedes añadir 8 fotos como máximo.»', async () => {
  assert.deepEqual(await detallesDe(await publicar({ datos })), { fotos: 'Añade al menos una foto.' });
  assert.deepEqual(await detallesDe(await publicar({ datos, fotos: Array(9).fill(jpg) })), {
    fotos: 'Puedes añadir 8 fotos como máximo.',
  });
  sinCambios();
});

test('US-13 CA13/E2E-6: un .txt enviado como image/jpeg se rechaza por su contenido', async () => {
  const falso = { contenido: Buffer.from('esto no es una foto'), tipo: 'image/jpeg', nombre: 'balones.jpg' };
  assert.deepEqual(await detallesDe(await publicar({ datos, fotos: [jpg, falso] })), {
    fotos: 'Solo se admiten fotos JPG, PNG o WebP.',
  });

  const gif = { contenido: Buffer.from('GIF89a\x01\x00\x01\x00'), tipo: 'image/gif', nombre: 'logo.gif' };
  assert.deepEqual(await detallesDe(await publicar({ datos, fotos: [gif] })), {
    fotos: 'Solo se admiten fotos JPG, PNG o WebP.',
  });
  sinCambios();
});

test('US-13 CA13: el tipo se toma de la cabecera binaria aunque el nombre o el Content-Type digan otra cosa', async () => {
  const pngComoJpg = { contenido: fotoPng, tipo: 'image/jpeg', nombre: 'foto.jpg' };
  assert.equal((await publicar({ datos, fotos: [pngComoJpg] })).status, 201);
  assert.equal(creaciones[0].fotos[0].tipo_mime, 'image/png');
  assert.match(creaciones[0].fotos[0].ruta, /\.png$/);
});

test('US-13 CA5/CA14: 5.242.880 bytes se acepta y 5.242.881 se rechaza', async () => {
  const limite = Buffer.concat([fotoJpg, Buffer.alloc(MB5 - fotoJpg.length)]);
  const aceptada = await publicar({ datos, fotos: [{ contenido: limite }] });
  assert.equal(aceptada.status, 201);
  assert.equal(creaciones[0].fotos[0].bytes, MB5);
  creaciones = [];
  objetos.clear();

  const grande = Buffer.concat([limite, Buffer.alloc(1)]);
  assert.deepEqual(await detallesDe(await publicar({ datos, fotos: [jpg, { contenido: grande }] })), {
    fotos: 'Cada foto debe pesar 5 MB como máximo.',
  });
  sinCambios();
});

test('US-13 CA14: `foto_principal` fuera de 1..n o no numérico → details.foto_principal', async () => {
  for (const valor of ['0', '3', 'abc', '1.5', '-1', '']) {
    assert.deepEqual(await detallesDe(await publicar({ datos, fotos: [jpg, png], fotoPrincipal: valor })), {
      foto_principal: 'La foto principal no es válida.',
    }, `foto_principal = ${JSON.stringify(valor)}`);
  }
  sinCambios();
});

test('US-13 CA14: los errores de fotos se devuelven junto con los del resto de campos', async () => {
  const details = await detallesDe(await publicar({
    datos: { ...datos, titulo: 'Bola', unidades_disponibles: 0 },
    fotos: [{ contenido: Buffer.from('texto') }],
    fotoPrincipal: 'x',
  }));
  assert.deepEqual(details, {
    titulo: 'El título debe tener entre 5 y 80 caracteres.',
    unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
    fotos: 'Solo se admiten fotos JPG, PNG o WebP.',
    foto_principal: 'La foto principal no es válida.',
  });
  sinCambios();
});

test('US-13 CA15: sin la parte `datos`, o con un cuerpo JSON en lugar de multipart, faltan los datos', async () => {
  assert.deepEqual(await detallesDe(await publicar({ fotos: [jpg] })), { datos: 'Faltan los datos del anuncio.' });

  const json = await fetch(`${api.baseUrl}/api/anuncios`, {
    method: 'POST',
    headers: { Authorization: 'Bearer token-a', 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  assert.deepEqual(await detallesDe(json), {
    datos: 'Faltan los datos del anuncio.',
    fotos: 'Añade al menos una foto.',
  });
  sinCambios();
});

// Envía la petición con node:http para controlar las cabeceras y el cuerpo.
function enviarCrudo({ headers, escribir }) {
  return new Promise((resolve, reject) => {
    const peticion = httpRequest(`${api.baseUrl}/api/anuncios`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-a', ...headers },
    }, (respuesta) => {
      let cuerpo = '';
      respuesta.setEncoding('utf8');
      respuesta.on('data', (trozo) => { cuerpo += trozo; });
      respuesta.on('end', () => resolve({ status: respuesta.statusCode, headers: respuesta.headers, cuerpo: JSON.parse(cuerpo) }));
    });
    // El servidor puede cortar la conexión antes de recibir todo el cuerpo.
    peticion.on('error', (error) => (error.code === 'EPIPE' || error.code === 'ECONNRESET' ? null : reject(error)));
    escribir(peticion);
  });
}

test('US-13 CA16: una petición multipart de más de 40 MB → 413 PETICION_DEMASIADO_GRANDE', async () => {
  const declarada = await enviarCrudo({
    headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(41_943_041) },
    escribir: (peticion) => peticion.write('--x\r\n'),
  });
  assert.equal(declarada.status, 413);
  assert.equal(declarada.headers.connection, 'close');
  assert.deepEqual(declarada.cuerpo, {
    error: { code: 'PETICION_DEMASIADO_GRANDE', message: 'La petición es demasiado grande.' },
  });

  // Sin Content-Length (por trozos) el total se cuenta mientras llega.
  const porTrozos = await enviarCrudo({
    headers: { 'Content-Type': 'multipart/form-data; boundary=x', 'Transfer-Encoding': 'chunked' },
    escribir: (peticion) => {
      peticion.write('--x\r\nContent-Disposition: form-data; name="fotos"; filename="a.jpg"\r\n\r\n');
      const trozo = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < 41; i += 1) peticion.write(trozo);
      peticion.end();
    },
  });
  assert.equal(porTrozos.status, 413);
  assert.equal(porTrozos.cuerpo.error.code, 'PETICION_DEMASIADO_GRANDE');
  sinCambios();
});

test('US-13 CA16: 8 fotos de 5 MB (40 MB de archivos más las cabeceras) superan el total', async () => {
  const foto = { contenido: Buffer.concat([fotoJpg, Buffer.alloc(MB5 - fotoJpg.length)]) };
  const response = await publicar({ datos, fotos: Array(8).fill(foto) });
  assert.equal(response.status, 413);
  sinCambios();
});

test('US-13 CA16: el límite de 100 kB sigue igual para los cuerpos JSON', async () => {
  const response = await fetch(`${api.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a'.repeat(110 * 1024) }),
  });
  assert.equal(response.status, 413);
});

test('US-13 CA20: si falla la subida de una foto, se borran las subidas y no se crea el anuncio (503)', async () => {
  falloSubida = (ruta) => ruta.endsWith('.png');
  const response = await publicar({ datos, fotos: [jpg, png, webp] });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'ALMACENAMIENTO_NO_DISPONIBLE');
  assert.equal(borrados.length, 3);
  sinCambios();
});

test('US-13 CA20: si falla la base de datos, se borran las fotos ya subidas (503 o 500 según la causa)', async () => {
  falloBase = databaseUnavailable();
  const caida = await publicar({ datos, fotos: [jpg, png] });
  assert.equal(caida.status, 503);
  assert.equal((await caida.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  assert.equal(borrados.length, 2);
  sinCambios();

  falloBase = new Error('fallo inesperado');
  const interno = await publicar({ datos, fotos: [jpg] });
  assert.equal(interno.status, 500);
  assert.equal((await interno.json()).error.code, 'ERROR_INTERNO');
  assert.equal(borrados.length, 3);
  sinCambios();
});

test('US-13 CA18: sin la clave de servicio configurada no se publica (503) y no se crea nada', async () => {
  const sinStorage = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios });
  try {
    const response = await fetch(`${sinStorage.baseUrl}/api/anuncios`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-a' },
      body: formularioAnuncio({ datos, fotos: [jpg] }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'ALMACENAMIENTO_NO_DISPONIBLE');
  } finally {
    await sinStorage.close();
  }
  assert.deepEqual(creaciones, []);
});

test('US-13: sin sesión o sin confirmar el email no se lee ni se sube nada', async () => {
  assert.equal((await publicar({ datos, fotos: [jpg] }, 'token-caducado')).status, 401);
  assert.equal((await publicar({ datos, fotos: [jpg] }, 'token-sin-confirmar')).status, 403);
  sinCambios();
});
