import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearAnuncio, listarMisAnuncios, obtenerAnuncio, retirarAnuncio } from './anuncios.js';

describe('crearAnuncio', () => {
  const fotos = {
    fotos: [
      { id: 'a', archivo: new File(['uno'], 'balones1.jpg', { type: 'image/jpeg' }) },
      { id: 'b', archivo: new File(['dos'], 'balones2.png', { type: 'image/png' }) },
    ],
    principalId: 'b',
  };

  test('CA15-CA16 y US-13 CA12: POST /anuncios en multipart y devuelve el `anuncio` de la respuesta', async () => {
    const llamadas = [];
    const anuncio = { id: '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10', estado: 'activo' };
    const cuerpo = { titulo: 'Balones de fútbol talla 5' };

    const resultado = await crearAnuncio(cuerpo, fotos, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { anuncio };
    });

    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].ruta, '/anuncios');
    assert.equal(llamadas[0].opciones.method, 'POST');
    const formulario = llamadas[0].opciones.body;
    assert.ok(formulario instanceof FormData);
    assert.deepEqual(JSON.parse(formulario.get('datos')), cuerpo);
    assert.deepEqual(formulario.getAll('fotos').map((f) => f.name), ['balones1.jpg', 'balones2.png']);
    assert.equal(formulario.get('foto_principal'), '2');
    assert.equal(resultado, anuncio);
  });

  test('si la API falla, el error llega al formulario', async () => {
    const error = new Error('fallo');
    await assert.rejects(crearAnuncio({}, fotos, async () => { throw error; }), error);
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

describe('listarMisAnuncios', () => {
  test('CA11: GET /anuncios/mios con pagina y por_pagina, y devuelve la respuesta entera', async () => {
    const llamadas = [];
    const respuesta = { anuncios: [], total: 0, pagina: 2, por_pagina: 20 };
    const signal = new AbortController().signal;

    const resultado = await listarMisAnuncios({ pagina: 2, porPagina: 20 }, { signal }, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return respuesta;
    });

    assert.deepEqual(llamadas, [{ ruta: '/anuncios/mios?pagina=2&por_pagina=20', opciones: { signal } }]);
    assert.equal(resultado, respuesta);
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
