import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarPedidosPendientes, listarPedidos } from './pedidos.js';

function dobleApi(respuesta) {
  const llamadas = [];
  const llamarApi = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    return respuesta;
  };
  return { llamadas, llamarApi };
}

test('US-109 · CA10 · listarPedidos pide el rol y la página', async () => {
  const lista = { pedidos: [], pagina: 2, total: 21, por_pagina: 20 };
  const { llamadas, llamarApi } = dobleApi(lista);
  const control = new AbortController();
  assert.deepEqual(await listarPedidos({ rol: 'realizados', pagina: 2 }, { signal: control.signal }, llamarApi), lista);
  assert.equal(llamadas[0].ruta, '/pedidos?rol=realizados&pagina=2');
  assert.equal(llamadas[0].opciones.signal, control.signal);
});

test('US-109 · CA10 · por defecto, página 1', async () => {
  const { llamadas, llamarApi } = dobleApi({ pedidos: [] });
  await listarPedidos({ rol: 'recibidos' }, {}, llamarApi);
  assert.equal(llamadas[0].ruta, '/pedidos?rol=recibidos&pagina=1');
});

test('US-109 · CA12 · contarPedidosPendientes devuelve recibidos_pendientes', async () => {
  const { llamadas, llamarApi } = dobleApi({ recibidos_pendientes: 3 });
  assert.equal(await contarPedidosPendientes({}, llamarApi), 3);
  assert.equal(llamadas[0].ruta, '/pedidos/contador');
});
