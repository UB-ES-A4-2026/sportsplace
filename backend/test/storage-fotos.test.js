import assert from 'node:assert/strict';
import test from 'node:test';
import { createFotosStorage, urlPublicaFoto } from '../src/services/storage-fotos.js';
import { tipoDeFoto } from '../src/validation/fotos.js';
import { fotoJpg, fotoPng, fotoWebp } from './helpers.js';

// US-13 CA13, CA18, CA20 y CA21: tipo por cabecera binaria y bucket `anuncios`.
function fakeClient({ errorSubida = null, errorBorrado = null, excepcion = null } = {}) {
  const llamadas = { creado: null, bucket: null, subidas: [], borrados: [] };
  const factory = (url, key, opciones) => {
    llamadas.creado = { url, key, opciones };
    return {
      storage: {
        from(bucket) {
          llamadas.bucket = bucket;
          return {
            async upload(ruta, contenido, opciones) {
              if (excepcion) throw excepcion;
              llamadas.subidas.push({ ruta, contenido, opciones });
              return { data: errorSubida ? null : { path: ruta }, error: errorSubida };
            },
            async remove(rutas) {
              llamadas.borrados.push(rutas);
              return { data: [], error: errorBorrado };
            },
          };
        },
      },
    };
  };
  return { llamadas, factory };
}

const entorno = { SUPABASE_URL: 'https://proyecto.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'clave-de-servicio' };

test('US-13 CA13: tipoDeFoto reconoce JPEG, PNG y WebP por su cabecera y nada más', () => {
  assert.deepEqual(tipoDeFoto(fotoJpg), { tipo_mime: 'image/jpeg', extension: 'jpg' });
  assert.deepEqual(tipoDeFoto(fotoPng), { tipo_mime: 'image/png', extension: 'png' });
  assert.deepEqual(tipoDeFoto(fotoWebp), { tipo_mime: 'image/webp', extension: 'webp' });

  const riffNoWebp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]);
  for (const contenido of [Buffer.alloc(0), Buffer.from([0xff, 0xd8]), Buffer.from('GIF89a'), riffNoWebp, Buffer.from('hola')]) {
    assert.equal(tipoDeFoto(contenido), null);
  }
});

test('US-13 CA18: sin SUPABASE_URL o sin la clave de servicio no hay Storage', () => {
  assert.equal(createFotosStorage({ environment: {} }), null);
  assert.equal(createFotosStorage({ environment: { SUPABASE_URL: entorno.SUPABASE_URL } }), null);
  assert.equal(createFotosStorage({ environment: { SUPABASE_SERVICE_ROLE_KEY: 'x' } }), null);
});

test('US-13 CA18: sube al bucket anuncios con la clave de servicio, su tipo y sin sobrescribir', async () => {
  const { llamadas, factory } = fakeClient();
  const storage = createFotosStorage({ environment: entorno, clientFactory: factory });

  await storage.subir('c1/a1/f1.png', fotoPng, 'image/png');

  assert.equal(llamadas.creado.url, entorno.SUPABASE_URL);
  assert.equal(llamadas.creado.key, 'clave-de-servicio');
  assert.equal(llamadas.bucket, 'anuncios');
  assert.deepEqual(llamadas.subidas, [
    { ruta: 'c1/a1/f1.png', contenido: fotoPng, opciones: { contentType: 'image/png', upsert: false } },
  ]);
});

test('US-13 CA20: un error de Storage al subir es 503 ALMACENAMIENTO_NO_DISPONIBLE', async () => {
  for (const opciones of [{ errorSubida: { statusCode: '500' } }, { excepcion: new TypeError('fetch failed') }]) {
    const { factory } = fakeClient(opciones);
    const storage = createFotosStorage({ environment: entorno, clientFactory: factory });
    await assert.rejects(storage.subir('c1/a1/f1.jpg', fotoJpg, 'image/jpeg'), {
      status: 503,
      code: 'ALMACENAMIENTO_NO_DISPONIBLE',
    });
  }
});

test('US-13 CA20: el borrado compensatorio borra las rutas y nunca lanza', async () => {
  const { llamadas, factory } = fakeClient();
  const storage = createFotosStorage({ environment: entorno, clientFactory: factory });
  await storage.borrar(['c1/a1/f1.jpg', 'c1/a1/f2.png']);
  await storage.borrar([]);
  assert.deepEqual(llamadas.borrados, [['c1/a1/f1.jpg', 'c1/a1/f2.png']]);

  const conError = fakeClient({ errorBorrado: { statusCode: '500' } });
  await createFotosStorage({ environment: entorno, clientFactory: conError.factory }).borrar(['c1/a1/f1.jpg']);
});

test('US-13 CA17/CA21: la URL pública es la del bucket público por ruta', () => {
  assert.equal(
    urlPublicaFoto('https://proyecto.supabase.co/', 'c1/a1/f1.jpg'),
    'https://proyecto.supabase.co/storage/v1/object/public/anuncios/c1/a1/f1.jpg',
  );
});
