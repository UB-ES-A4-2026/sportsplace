import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearAnuncio, obtenerAnuncio, retirarAnuncio } from './anuncios.js';

describe('crearAnuncio', () => {
  test('CA15-CA16: POST /anuncios con el cuerpo en JSON y devuelve el `anuncio` de la respuesta', async () => {
    const llamadas = [];
    const anuncio = { id: '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10', estado: 'activo' };
    const cuerpo = { titulo: 'Balones de fútbol talla 5' };

    const resultado = await crearAnuncio(cuerpo, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { anuncio };
    });

    assert.deepEqual(llamadas, [{ ruta: '/anuncios', opciones: { method: 'POST', body: cuerpo } }]);
    assert.equal(resultado, anuncio);
  });

  test('si la API falla, el error llega al formulario', async () => {
    const error = new Error('fallo');
    await assert.rejects(crearAnuncio({}, async () => { throw error; }), error);
  });
});

describe('obtenerAnuncio', () => {
  test('CA20: GET /anuncios/:id (id escapado) y devuelve el `anuncio`', async () => {
    const llamadas = [];
    const anuncio = { id: 'x' };
    const signal = new AbortController().signal;
    const resultado = await obtenerAnuncio('no es/uuid', { signal }, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { anuncio };
    });
    assert.deepEqual(llamadas, [{ ruta: '/anuncios/no%20es%2Fuuid', opciones: { signal } }]);
    assert.equal(resultado, anuncio);
  });
});


test('retirarAnuncio hace DELETE /anuncios/:id sin cuerpo (US-70 CA7)', async () => {
  const llamadas = [];
  await retirarAnuncio('6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10', async (...args) => {
    llamadas.push(args);
    return null;
  });
  assert.deepEqual(llamadas, [['/anuncios/6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10', { method: 'DELETE' }]]);
});

test('retirarAnuncio codifica el id en la ruta', async () => {
  let ruta;
  await retirarAnuncio('a/b?c', async (r) => { ruta = r; });
  assert.equal(ruta, '/anuncios/a%2Fb%3Fc');
});

test('retirarAnuncio deja pasar el error de la API', async () => {
  const fallo = new Error('409');
  await assert.rejects(retirarAnuncio('x', async () => { throw fallo; }), fallo);
});
