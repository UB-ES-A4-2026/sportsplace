import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearAnuncio, obtenerAnuncio, pausarAnuncio, reactivarAnuncio } from './anuncios.js';

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

const ID = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';

for (const [nombre, llamar, accion, estado] of [
  ['pausarAnuncio', pausarAnuncio, 'pausar', 'pausado'],
  ['reactivarAnuncio', reactivarAnuncio, 'reactivar', 'activo'],
]) {
  test(`${nombre} hace POST /anuncios/:id/${accion} sin cuerpo y devuelve el anuncio (US-16 CA6, CA7)`, async () => {
    const llamadas = [];
    const anuncio = await llamar(ID, async (...args) => {
      llamadas.push(args);
      return { anuncio: { id: ID, estado } };
    });
    assert.deepEqual(llamadas, [[`/anuncios/${ID}/${accion}`, { method: 'POST' }]]);
    assert.deepEqual(anuncio, { id: ID, estado });
  });

  test(`${nombre} codifica el id en la ruta`, async () => {
    let ruta;
    await llamar('a/b?c', async (r) => {
      ruta = r;
      return { anuncio: {} };
    });
    assert.equal(ruta, `/anuncios/a%2Fb%3Fc/${accion}`);
  });

  test(`${nombre} deja pasar el error de la API`, async () => {
    const fallo = new Error('409');
    await assert.rejects(llamar('x', async () => { throw fallo; }), fallo);
  });
}
