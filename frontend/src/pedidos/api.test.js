import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { crearPedido } from './api.js';

describe('crearPedido', () => {
  test('CA16: POST /pedidos con el cuerpo tal cual y devuelve el `pedido` de la respuesta', async () => {
    const llamadas = [];
    const pedido = { id: 'p1', estado: 'pendiente' };
    const cuerpo = { anuncio_id: 'a1', unidades: 4, mensaje: '', metodo_pago: 'transferencia', metodo_entrega: 'recogida' };
    const resultado = await crearPedido(cuerpo, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { pedido };
    });
    assert.equal(resultado, pedido);
    assert.deepEqual(llamadas, [{ ruta: '/pedidos', opciones: { method: 'POST', body: cuerpo } }]);
  });

  test('los errores de la API llegan a la pantalla (CA17-CA22)', async () => {
    const fallo = Object.assign(new Error('Solo quedan 3 unidades disponibles.'), { status: 409, code: 'UNIDADES_INSUFICIENTES' });
    await assert.rejects(crearPedido({}, async () => { throw fallo; }), fallo);
  });
});
