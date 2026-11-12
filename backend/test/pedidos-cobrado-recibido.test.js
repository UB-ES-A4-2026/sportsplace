import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPedidosRepository } from '../src/repositories/pedidos.js';
import { aPedido } from '../src/services/serializar-pedido.js';
import { comprobarTransicion } from '../src/services/transiciones-pedido.js';
import { postJson, startApi } from './helpers.js';

// T42-1 (#247): US-80 (marcar como cobrado) y US-42 (confirmar la recepción).
// Las acciones con el serializador y la API con un doble de la base de datos.
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';
const PEDIDO = '9d3c2b1a-0000-4000-8000-000000000099';
const PAGADO_EN = '2026-11-12T10:00:00.000Z';
const RECIBIDO_EN = '2026-11-12T11:10:00.000Z';

const usuarios = {
  'token-gracia': { id: 'usuario-gracia', email: 'gracia@example.com', email_confirmado: true },
  'token-lescorts': { id: 'usuario-lescorts', email: 'lescorts@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-x', email: 'x@example.com', email_confirmado: false },
};
const auth = { getUser: async (token) => usuarios[token] ?? null };
const comprador = { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona', email: 'gracia@example.com' };
const vendedor = { id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona', email: 'lescorts@example.com' };
const anuncio = { id: 'a1', estado: 'reservado', unidades_disponibles: 8 };

// Pedido de E2E-1 de US-80: 4 balones de A1 a 8,50 € por transferencia, aceptado.
function fila(cambios = {}) {
  return {
    id: PEDIDO, titulo_anuncio: 'Balones de baloncesto talla 7', unidades: 4, modalidad: 'venta',
    precio_unitario_centimos: 850, total_centimos: 3400, metodo_pago: 'transferencia',
    metodo_entrega: 'recogida', mensaje: null, estado: 'aceptado', creado_en: '2026-10-21T08:30:00Z',
    ...cambios,
  };
}

const pedidoDe = (cambios, centroId) => aPedido({ fila: fila(cambios), anuncio, comprador, vendedor }, centroId);
const donacion = { modalidad: 'donacion', precio_unitario_centimos: null, total_centimos: 0, metodo_pago: null };

// Fila de SELECT_DETALLE tal y como la devuelve PostgreSQL para el centro de la sesión.
const detalle = (cambios, centroId) => ({ fila: fila(cambios), anuncio, comprador, vendedor, centro_id: centroId });

// Doble de la base de datos: responde en orden y aplica la regla del JOIN
// (solo comprador o vendedor). Guarda cada consulta para comprobar el SQL.
async function escenario(t, ...respuestas) {
  const consultas = [];
  const database = {
    async transaction(trabajo) {
      return trabajo({
        async query(sql, valores) {
          consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), valores });
          assert.ok(respuestas.length, 'consulta no prevista');
          return { rows: respuestas.shift() };
        },
      });
    },
  };
  const api = await startApi({ auth, pedidos: createPedidosRepository(database) });
  t.after(() => api.close());
  const llamar = (accion, token, id = PEDIDO) => postJson(
    `${api.baseUrl}/api/pedidos/${id}/${accion}`,
    {},
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  return { consultas, llamar, baseUrl: api.baseUrl };
}

async function comprobarError(respuesta, status, code, message) {
  assert.equal(respuesta.status, status);
  const { error } = await respuesta.json();
  assert.equal(error.code, code);
  if (message) assert.equal(error.message, message);
}

test('US-80 CA1: marcar_pagado solo para el vendedor de una venta aceptada o recibida sin pagar', () => {
  assert.deepEqual(pedidoDe({}, LES_CORTS).acciones, ['marcar_pagado']);
  assert.deepEqual(pedidoDe({ estado: 'recibido', recibido_en: RECIBIDO_EN }, LES_CORTS).acciones, ['marcar_pagado']);
  assert.ok(!pedidoDe({}, GRACIA).acciones.includes('marcar_pagado'));
  assert.deepEqual(pedidoDe({ pagado_en: PAGADO_EN }, LES_CORTS).acciones, []);
  assert.deepEqual(pedidoDe(donacion, LES_CORTS).acciones, []);
  for (const estado of ['pendiente', 'rechazado', 'cancelado']) {
    assert.ok(!pedidoDe({ estado }, LES_CORTS).acciones.includes('marcar_pagado'), estado);
  }
});

test('US-42 CA1 y CA6: recibir solo para el comprador de un pedido aceptado sin incidencia abierta', () => {
  assert.deepEqual(pedidoDe({}, GRACIA).acciones, ['recibir']);
  assert.deepEqual(pedidoDe(donacion, GRACIA).acciones, ['recibir']);
  assert.ok(!pedidoDe({}, LES_CORTS).acciones.includes('recibir'));
  assert.deepEqual(pedidoDe({ incidencia_abierta: true }, GRACIA).acciones, []);
  for (const estado of ['pendiente', 'rechazado', 'cancelado', 'recibido']) {
    assert.deepEqual(pedidoDe({ estado }, GRACIA).acciones, [], estado);
  }
});

test('US-80 CA3: el comprador ve pagado_en y no tiene ninguna acción de pago', () => {
  const pedido = pedidoDe({ pagado_en: PAGADO_EN }, GRACIA);
  assert.equal(pedido.pagado_en, PAGADO_EN);
  assert.deepEqual(pedido.acciones, ['recibir']);
});

test('US-80 CA5 y US-42 CA12: comprobarTransicion da el error propio de cada caso', () => {
  const casos = [
    [{}, GRACIA, 'marcar_pagado', 403, 'SIN_PERMISO'],
    [{ estado: 'pendiente' }, LES_CORTS, 'marcar_pagado', 409, 'TRANSICION_NO_PERMITIDA'],
    [donacion, LES_CORTS, 'marcar_pagado', 409, 'PEDIDO_DONACION'],
    [{ pagado_en: PAGADO_EN }, LES_CORTS, 'marcar_pagado', 409, 'YA_PAGADO'],
    [{}, LES_CORTS, 'recibir', 403, 'SIN_PERMISO'],
    [{ estado: 'recibido' }, GRACIA, 'recibir', 409, 'TRANSICION_NO_PERMITIDA'],
    [{ incidencia_abierta: true }, GRACIA, 'recibir', 409, 'INCIDENCIA_ABIERTA'],
  ];
  for (const [cambios, centro, accion, status, code] of casos) {
    const pedido = { ...pedidoDe(cambios, centro), incidencia_abierta: cambios.incidencia_abierta };
    assert.throws(() => comprobarTransicion(pedido, centro, accion), { status, code }, `${accion} ${code}`);
  }
});

test('US-80 CA4: el vendedor marca la venta como cobrada → 200 { pedido } con pagado_en', async (t) => {
  const { llamar, consultas } = await escenario(
    t,
    [detalle({}, LES_CORTS)],
    [{ id: PEDIDO }],
    [detalle({ pagado_en: PAGADO_EN }, LES_CORTS)],
  );
  const respuesta = await llamar('marcar-pagado', 'token-lescorts');
  assert.equal(respuesta.status, 200);
  const { pedido } = await respuesta.json();
  assert.equal(pedido.pagado_en, PAGADO_EN);
  assert.equal(pedido.estado, 'aceptado');
  assert.deepEqual(pedido.acciones, []);
  assert.equal(consultas.length, 3);
  assert.deepEqual(consultas[0].valores, ['usuario-lescorts', PEDIDO]);
  assert.match(consultas[0].sql, /FOR UPDATE OF p$/);
  assert.match(consultas[1].sql, /^UPDATE public\.pedidos SET pagado_en = now\(\)/);
  assert.match(consultas[1].sql, /AND pagado_en IS NULL/);
  assert.deepEqual(consultas[1].valores, [PEDIDO]);
});

test('US-80 E2E-2 y E2E-3: ya pagado, comprador, pendiente y donación sin tocar la base de datos', async (t) => {
  const casos = [
    [{ pagado_en: PAGADO_EN }, LES_CORTS, 'token-lescorts', 409, 'YA_PAGADO', 'Este pedido ya consta como cobrado.'],
    [{}, GRACIA, 'token-gracia', 403, 'SIN_PERMISO', 'No puedes realizar esta acción en este pedido.'],
    [{ estado: 'pendiente' }, LES_CORTS, 'token-lescorts', 409, 'TRANSICION_NO_PERMITIDA'],
    [donacion, LES_CORTS, 'token-lescorts', 409, 'PEDIDO_DONACION', 'Las donaciones no se cobran.'],
  ];
  const { llamar, consultas } = await escenario(t, ...casos.map(([cambios, centro]) => [detalle(cambios, centro)]));
  for (const [, , token, status, code, message] of casos) {
    await comprobarError(await llamar('marcar-pagado', token), status, code, message);
  }
  assert.equal(consultas.length, casos.length);
  assert.ok(consultas.every(({ sql }) => sql.startsWith('SELECT')));
});

test('US-42 CA4 y CA11: el comprador confirma la recepción → 200 con estado recibido y recibido_en', async (t) => {
  const { llamar, consultas } = await escenario(
    t,
    [detalle({}, GRACIA)],
    [{ id: PEDIDO }],
    [detalle({ estado: 'recibido', recibido_en: RECIBIDO_EN }, GRACIA)],
  );
  const respuesta = await llamar('recibir', 'token-gracia');
  assert.equal(respuesta.status, 200);
  const { pedido } = await respuesta.json();
  assert.equal(pedido.id, PEDIDO);
  assert.equal(pedido.estado, 'recibido');
  assert.equal(pedido.recibido_en, RECIBIDO_EN);
  assert.deepEqual(pedido.acciones, []); // CA6: nada para volver a aceptado
  assert.equal(pedido.anuncio.unidades_disponibles, 8); // CA7: el stock no cambia
  assert.match(consultas[1].sql, /SET estado = 'recibido', recibido_en = now\(\)/);
  assert.match(consultas[1].sql, /WHERE id = \$1 AND estado = 'aceptado'/);
  assert.doesNotMatch(consultas[1].sql, /anuncios/);
});

test('US-42 CA3: se confirma igual con la venta cobrada o sin cobrar y en una donación', async (t) => {
  const casos = [{ pagado_en: PAGADO_EN }, {}, donacion];
  const { llamar } = await escenario(t, ...casos.flatMap((cambios) => [
    [detalle(cambios, GRACIA)], [{ id: PEDIDO }],
    [detalle({ ...cambios, estado: 'recibido', recibido_en: RECIBIDO_EN }, GRACIA)],
  ]));
  for (const cambios of casos) {
    const respuesta = await llamar('recibir', 'token-gracia');
    assert.equal(respuesta.status, 200, JSON.stringify(cambios));
  }
});

test('US-42 CA12: vendedor, estado distinto de aceptado e incidencia abierta', async (t) => {
  const casos = [
    [{}, LES_CORTS, 'token-lescorts', 403, 'SIN_PERMISO'],
    [{ estado: 'recibido', recibido_en: RECIBIDO_EN }, GRACIA, 'token-gracia', 409, 'TRANSICION_NO_PERMITIDA'],
    [{ estado: 'pendiente' }, GRACIA, 'token-gracia', 409, 'TRANSICION_NO_PERMITIDA'],
    [{ incidencia_abierta: true }, GRACIA, 'token-gracia', 409, 'INCIDENCIA_ABIERTA',
      'Cierra la incidencia antes de confirmar la recepción.'],
  ];
  const { llamar, consultas } = await escenario(t, ...casos.map(([cambios, centro]) => [detalle(cambios, centro)]));
  for (const [, , token, status, code, message] of casos) {
    await comprobarError(await llamar('recibir', token), status, code, message);
  }
  assert.equal(consultas.length, casos.length);
});

test('US-42 CA14: si el UPDATE no cambia ninguna fila se responde 409 TRANSICION_NO_PERMITIDA', async (t) => {
  const { llamar, consultas } = await escenario(t, [detalle({}, GRACIA)], []);
  const respuesta = await llamar('recibir', 'token-gracia');
  assert.equal(respuesta.status, 409);
  const { error } = await respuesta.json();
  assert.equal(error.code, 'TRANSICION_NO_PERMITIDA');
  assert.deepEqual(error.details, { estado_actual: 'aceptado' });
  assert.equal(consultas.length, 2);
});

test('Reglas comunes: 401, 403 EMAIL_NO_CONFIRMADO y 404 para ajeno o id inválido', async (t) => {
  const { llamar, consultas } = await escenario(t, [], []);
  for (const accion of ['marcar-pagado', 'recibir']) {
    await comprobarError(await llamar(accion), 401, 'NO_AUTENTICADO');
    await comprobarError(await llamar(accion, 'token-sin-confirmar'), 403, 'EMAIL_NO_CONFIRMADO');
    await comprobarError(await llamar(accion, 'token-gracia', 'no-es-uuid'), 404, 'NO_ENCONTRADO');
    await comprobarError(await llamar(accion, 'token-gracia'), 404, 'NO_ENCONTRADO');
  }
  assert.equal(consultas.length, 2);
});

test('Un error de la base de datos responde 503 BASE_DATOS_NO_DISPONIBLE', async (t) => {
  const database = { async transaction() { throw Object.assign(new Error('caída'), { code: 'ECONNREFUSED' }); } };
  const api = await startApi({ auth, pedidos: createPedidosRepository(database) });
  t.after(() => api.close());
  const respuesta = await postJson(`${api.baseUrl}/api/pedidos/${PEDIDO}/recibir`, {}, { Authorization: 'Bearer token-gracia' });
  await comprobarError(respuesta, 503, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-80 CA6: no hay forma de quitar la marca; otros métodos responden 405 con Allow: POST', async (t) => {
  const { baseUrl } = await escenario(t);
  for (const accion of ['marcar-pagado', 'recibir']) {
    for (const method of ['GET', 'DELETE', 'PATCH']) {
      const respuesta = await fetch(`${baseUrl}/api/pedidos/${PEDIDO}/${accion}`, {
        method, headers: { Authorization: 'Bearer token-lescorts' },
      });
      assert.equal(respuesta.status, 405, `${method} ${accion}`);
      assert.equal(respuesta.headers.get('allow'), 'POST');
    }
  }
});
