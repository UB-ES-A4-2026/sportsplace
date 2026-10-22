import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pausarAnuncio, reactivarAnuncio } from './anuncios.js';

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
