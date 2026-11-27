import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aceptarPedido, cancelarPedido, rechazarPedido } from './accionesPedido.js';

test('US-33 CA6: aceptarPedido hace POST /pedidos/:id/aceptar sin cuerpo y devuelve el pedido', async () => {
  const llamadas = [];
  const pedido = await aceptarPedido('p/1', async (...args) => {
    llamadas.push(args);
    return { pedido: { id: 'p/1', estado: 'aceptado' } };
  });
  assert.deepEqual(llamadas, [['/pedidos/p%2F1/aceptar', { method: 'POST' }]]);
  assert.deepEqual(pedido, { id: 'p/1', estado: 'aceptado' });
});

test('US-79 CA7: rechazarPedido hace POST /pedidos/:id/rechazar con el motivo y devuelve el pedido', async () => {
  const llamadas = [];
  const pedido = await rechazarPedido('p1', { motivoCodigo: 'entrega_inviable', motivoTexto: 'Solo entregamos en Barcelona.' },
    async (...args) => {
      llamadas.push(args);
      return { pedido: { id: 'p1', estado: 'rechazado' } };
    });
  assert.deepEqual(llamadas, [['/pedidos/p1/rechazar', {
    method: 'POST',
    body: { motivo_codigo: 'entrega_inviable', motivo_texto: 'Solo entregamos en Barcelona.' },
  }]]);
  assert.equal(pedido.estado, 'rechazado');
});

test('US-39 CA5: cancelarPedido hace POST /pedidos/:id/cancelar con el motivo y devuelve el pedido', async () => {
  const llamadas = [];
  const pedido = await cancelarPedido('p1', { motivoCodigo: 'otra_opcion', motivoTexto: null }, async (...args) => {
    llamadas.push(args);
    return { pedido: { id: 'p1', estado: 'cancelado' } };
  });
  assert.deepEqual(llamadas, [['/pedidos/p1/cancelar', {
    method: 'POST',
    body: { motivo_codigo: 'otra_opcion', motivo_texto: null },
  }]]);
  assert.equal(pedido.estado, 'cancelado');
});

test('las tres dejan pasar el error de la API', async () => {
  const fallo = new Error('409');
  await assert.rejects(aceptarPedido('x', async () => { throw fallo; }), fallo);
  await assert.rejects(rechazarPedido('x', { motivoCodigo: 'otro', motivoTexto: null }, async () => { throw fallo; }), fallo);
  await assert.rejects(cancelarPedido('x', { motivoCodigo: 'otro', motivoTexto: null }, async () => { throw fallo; }), fallo);
});
