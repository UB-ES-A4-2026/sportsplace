import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marcarPedidoPagado, recibirPedido } from './cierrePedido.js';

test('US-80 CA4: marcarPedidoPagado hace POST /pedidos/:id/marcar-pagado sin cuerpo y devuelve el pedido', async () => {
  const llamadas = [];
  const pedido = await marcarPedidoPagado('p/1', async (...args) => {
    llamadas.push(args);
    return { pedido: { id: 'p/1', pagado_en: '2026-11-16T12:00:00Z' } };
  });
  assert.deepEqual(llamadas, [['/pedidos/p%2F1/marcar-pagado', { method: 'POST' }]]);
  assert.equal(pedido.pagado_en, '2026-11-16T12:00:00Z');
});

test('US-42 CA11: recibirPedido hace POST /pedidos/:id/recibir sin cuerpo y devuelve el pedido', async () => {
  const llamadas = [];
  const pedido = await recibirPedido('p1', async (...args) => {
    llamadas.push(args);
    return { pedido: { id: 'p1', estado: 'recibido' } };
  });
  assert.deepEqual(llamadas, [['/pedidos/p1/recibir', { method: 'POST' }]]);
  assert.equal(pedido.estado, 'recibido');
});

test('las dos dejan pasar el error de la API', async () => {
  const fallo = new Error('409');
  await assert.rejects(marcarPedidoPagado('x', async () => { throw fallo; }), fallo);
  await assert.rejects(recibirPedido('x', async () => { throw fallo; }), fallo);
});
