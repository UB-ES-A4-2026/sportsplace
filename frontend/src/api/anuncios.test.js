import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambiarReservaOEntrega, retirarAnuncio } from './anuncios.js';

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

for (const [accion, estado] of [['reservar', 'reservado'], ['quitar-reserva', 'activo'], ['entregar', 'entregado']]) {
  test(`cambiarReservaOEntrega hace POST /anuncios/:id/${accion} sin cuerpo y devuelve el anuncio (US-17 CA7)`, async () => {
    const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
    const llamadas = [];
    const anuncio = await cambiarReservaOEntrega(id, accion, async (...args) => {
      llamadas.push(args);
      return { anuncio: { id, estado } };
    });
    assert.deepEqual(llamadas, [[`/anuncios/${id}/${accion}`, { method: 'POST' }]]);
    assert.deepEqual(anuncio, { id, estado });
  });
}

test('cambiarReservaOEntrega codifica el id en la ruta', async () => {
  let ruta;
  await cambiarReservaOEntrega('a/b?c', 'reservar', async (r) => {
    ruta = r;
    return { anuncio: {} };
  });
  assert.equal(ruta, '/anuncios/a%2Fb%3Fc/reservar');
});

test('cambiarReservaOEntrega deja pasar el error de la API', async () => {
  const fallo = new Error('409');
  await assert.rejects(cambiarReservaOEntrega('x', 'entregar', async () => { throw fallo; }), fallo);
});
