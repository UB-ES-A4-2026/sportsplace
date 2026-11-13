import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.js';
import { createAceptarPedido } from '../src/repositories/aceptar-pedido.js';

// US-34 (T33-3): transacción de aceptar con reserva de unidades, con un doble
// de la base de datos. La concurrencia real se prueba en la QA (T33-6, E2E-5).
const pedidoId = '0d3c9a52-6c1e-4f0b-9a7e-2f4b1c8d5e61';
const anuncioId = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const lesCorts = 'a1111111-1111-4111-8111-111111111111';
const gracia = 'b2222222-2222-4222-8222-222222222222';

// Cada consulta de la transacción recibe la siguiente respuesta de la lista:
// un array de filas, { rows, rowCount } o un Error.
function fakeDatabase(respuestas) {
  const log = [];
  const estado = { commit: false, rollback: false };
  return {
    log,
    estado,
    async transaction(callback) {
      const client = {
        async query(sql, values) {
          log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
          const respuesta = respuestas.shift();
          if (respuesta instanceof Error) throw respuesta;
          if (Array.isArray(respuesta)) return { rows: respuesta, rowCount: respuesta.length };
          return respuesta ?? { rows: [], rowCount: 0 };
        },
      };
      try {
        const resultado = await callback(client);
        estado.commit = true;
        return resultado;
      } catch (error) {
        estado.rollback = true;
        throw error;
      }
    },
  };
}

const pedido = (cambios = {}) => ({
  id: pedidoId,
  estado: 'pendiente',
  unidades: 4,
  comprador_centro_id: gracia,
  vendedor_centro_id: lesCorts,
  ...cambios,
});

// Respuestas de una aceptación que llega hasta el final.
function aceptacion({ anuncio = { estado: 'activo', unidades_disponibles: 12 }, fila = pedido(), quedan, estadoFinal = anuncio.estado, rechazados = [] } = {}) {
  return [
    [{ anuncio_id: anuncioId }],
    [anuncio],
    [fila],
    [{ id: anuncioId, estado: estadoFinal, unidades_disponibles: quedan ?? anuncio.unidades_disponibles - fila.unidades }],
    { rows: [], rowCount: 1 },
    rechazados.map((id) => ({ id })),
  ];
}

const sinComprobar = () => {};

async function rechaza(promesa, status, code) {
  await assert.rejects(promesa, (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

test('US-33: si el UPDATE condicional no cambia el pedido, se revierte la reserva', async () => {
  const respuestas = aceptacion().slice(0, 5);
  respuestas[4] = { rows: [], rowCount: 0 };
  const database = fakeDatabase(respuestas);
  await rechaza(createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar }),
    409, 'TRANSICION_NO_PERMITIDA');
  assert.deepEqual(database.estado, { commit: false, rollback: true });
  assert.equal(database.log.length, 5);
});

test('US-34 CA1: aceptar resta las unidades del anuncio en la misma transacción que el cambio a aceptado', async () => {
  const database = fakeDatabase(aceptacion());
  const resultado = await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });

  assert.deepEqual(resultado, {
    pedidoId,
    anuncio: { id: anuncioId, estado: 'activo', unidades_disponibles: 8 },
    rechazados: [],
  });
  assert.equal(database.estado.commit, true);
  const restar = database.log[3];
  assert.match(restar.sql, /^UPDATE public\.anuncios SET unidades_disponibles = unidades_disponibles - \$2,/);
  assert.deepEqual(restar.values, [anuncioId, 4]);
  const aceptar = database.log[4];
  assert.match(aceptar.sql, /^UPDATE public\.pedidos SET estado = 'aceptado', respondido_en = now\(\), actualizado_en = now\(\) WHERE id = \$1 AND estado = 'pendiente'$/);
  assert.deepEqual(aceptar.values, [pedidoId]);
});

test('US-34 CA2: el anuncio se bloquea (FOR UPDATE) antes que el pedido y antes de comprobar las unidades', async () => {
  const database = fakeDatabase(aceptacion());
  await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });

  const [buscar, anuncio, filaPedido] = database.log;
  assert.match(buscar.sql, /^SELECT anuncio_id FROM public\.pedidos WHERE id = \$1 AND \$2::uuid IN \(comprador_centro_id, vendedor_centro_id\)$/);
  assert.doesNotMatch(buscar.sql, /FOR UPDATE/);
  assert.deepEqual(buscar.values, [pedidoId, lesCorts]);
  assert.match(anuncio.sql, /FROM public\.anuncios WHERE id = \$1 FOR UPDATE$/);
  assert.deepEqual(anuncio.values, [anuncioId]);
  assert.match(filaPedido.sql, /FROM public\.pedidos WHERE id = \$1 FOR UPDATE$/);
});

test('US-34 CA2: si el pedido pide más de lo que queda, 409 UNIDADES_INSUFICIENTES y no cambia nada', async () => {
  const database = fakeDatabase([
    [{ anuncio_id: anuncioId }],
    [{ estado: 'activo', unidades_disponibles: 3 }],
    [pedido()],
  ]);
  await assert.rejects(
    createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'UNIDADES_INSUFICIENTES');
      assert.equal(error.message, 'Solo quedan 3 unidades disponibles.');
      assert.deepEqual(error.details, { unidades_disponibles: 3 });
      return true;
    },
  );
  assert.equal(database.estado.rollback, true);
  assert.equal(database.log.filter((consulta) => /^UPDATE/.test(consulta.sql)).length, 0);
});

test('US-34 CA2: aceptar exactamente las unidades que quedan está permitido', async () => {
  const database = fakeDatabase(aceptacion({
    anuncio: { estado: 'activo', unidades_disponibles: 4 },
    estadoFinal: 'reservado',
  }));
  const { anuncio } = await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });
  assert.deepEqual(anuncio, { id: anuncioId, estado: 'reservado', unidades_disponibles: 0 });
});

test('US-34 CA3: con 0 unidades el anuncio activo pasa a reservado; uno pausado sigue pausado', async () => {
  const database = fakeDatabase(aceptacion());
  await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });
  assert.match(
    database.log[3].sql,
    /estado = CASE WHEN estado = 'activo' AND unidades_disponibles - \$2 = 0 THEN 'reservado' ELSE estado END/,
  );
});

test('US-33 CA8: un anuncio pausado se puede aceptar', async () => {
  const database = fakeDatabase(aceptacion({ anuncio: { estado: 'pausado', unidades_disponibles: 12 } }));
  const { anuncio } = await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });
  assert.equal(anuncio.estado, 'pausado');
});

for (const estado of ['retirado', 'entregado']) {
  test(`US-33 CA8: anuncio ${estado} → 409 ANUNCIO_NO_DISPONIBLE sin cambiar nada`, async () => {
    const database = fakeDatabase([
      [{ anuncio_id: anuncioId }],
      [{ estado, unidades_disponibles: 12 }],
      [pedido()],
    ]);
    await rechaza(
      createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar }),
      409,
      'ANUNCIO_NO_DISPONIBLE',
    );
    assert.equal(database.log.filter((consulta) => /^UPDATE/.test(consulta.sql)).length, 0);
  });
}

test('US-34 CA4: los pendientes que ya no caben se rechazan por el sistema con anuncio_sin_stock', async () => {
  const otro = 'c3333333-3333-4333-8333-333333333333';
  const database = fakeDatabase(aceptacion({
    anuncio: { estado: 'activo', unidades_disponibles: 5 },
    rechazados: [otro],
  }));
  const resultado = await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });

  assert.deepEqual(resultado.rechazados, [otro]);
  assert.deepEqual(resultado.anuncio, { id: anuncioId, estado: 'activo', unidades_disponibles: 1 });
  const rechazar = database.log[5];
  assert.match(
    rechazar.sql,
    /^UPDATE public\.pedidos SET estado = 'rechazado', motivo_codigo = 'anuncio_sin_stock', cerrado_por = 'sistema', respondido_en = now\(\), actualizado_en = now\(\) WHERE anuncio_id = \$1 AND estado = 'pendiente' AND unidades > \$2 RETURNING id$/,
  );
  // Se compara con las disponibles que quedan tras la resta (1), no con las de antes.
  assert.deepEqual(rechazar.values, [anuncioId, 1]);
  assert.equal(database.estado.commit, true);
});

test('US-34 CA4: el rechazo automático va después de aceptar, así el pedido aceptado nunca entra en él', async () => {
  const database = fakeDatabase(aceptacion());
  await createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar });
  const actualizaciones = database.log.map((consulta) => consulta.sql).filter((sql) => /^UPDATE/.test(sql));
  assert.equal(actualizaciones.length, 3);
  assert.match(actualizaciones[0], /^UPDATE public\.anuncios/);
  assert.match(actualizaciones[1], /SET estado = 'aceptado'/);
  assert.match(actualizaciones[2], /SET estado = 'rechazado'/);
});

test('US-33 CA7 y US-108 CA13: la transición la valida `comprobar` con el pedido y el anuncio ya bloqueados', async () => {
  const database = fakeDatabase(aceptacion({ anuncio: { estado: 'activo', unidades_disponibles: 12 } }));
  let recibido;
  await createAceptarPedido(database)({
    pedidoId,
    centroId: lesCorts,
    comprobar: (valor) => { recibido = valor; },
  });
  assert.deepEqual(recibido, {
    id: pedidoId,
    estado: 'pendiente',
    unidades: 4,
    comprador: { id: gracia },
    vendedor: { id: lesCorts },
    anuncio: { id: anuncioId, estado: 'activo', unidades_disponibles: 12 },
  });
});

test('US-33 CA7: el error de `comprobar` (403 o 409) se devuelve tal cual y no cambia nada', async () => {
  const database = fakeDatabase([
    [{ anuncio_id: anuncioId }],
    [{ estado: 'activo', unidades_disponibles: 12 }],
    [pedido({ estado: 'rechazado' })],
  ]);
  const error = new ApiError(409, 'TRANSICION_NO_PERMITIDA', 'El pedido ya no está en un estado que permita esta acción.', { estado_actual: 'rechazado' });
  await assert.rejects(
    createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: () => { throw error; } }),
    (recibido) => recibido === error,
  );
  assert.equal(database.estado.rollback, true);
  assert.equal(database.log.filter((consulta) => /^UPDATE/.test(consulta.sql)).length, 0);
});

test('US-108 CA11: id que no es uuid → 404 sin consultar la base de datos', async () => {
  const database = fakeDatabase([]);
  await rechaza(
    createAceptarPedido(database)({ pedidoId: 'no-es-un-uuid', centroId: lesCorts, comprobar: sinComprobar }),
    404,
    'NO_ENCONTRADO',
  );
  assert.equal(database.log.length, 0);
});

test('US-108 CA14: pedido inexistente o de otros centros → 404 NO_ENCONTRADO', async () => {
  const database = fakeDatabase([[]]);
  await rechaza(
    createAceptarPedido(database)({ pedidoId, centroId: lesCorts, comprobar: sinComprobar }),
    404,
    'NO_ENCONTRADO',
  );
  assert.equal(database.log.length, 1);
});

test('US-34 CA7: si una restricción rechaza los datos responde 500, y si la base de datos falla, 503', async () => {
  const restriccion = Object.assign(new Error('check'), { code: '23514' });
  await rechaza(
    createAceptarPedido(fakeDatabase([...aceptacion().slice(0, 3), restriccion]))({ pedidoId, centroId: lesCorts, comprobar: sinComprobar }),
    500,
    'ERROR_INTERNO',
  );
  const caida = Object.assign(new Error('caída'), { code: 'ECONNRESET' });
  await rechaza(
    createAceptarPedido(fakeDatabase([caida]))({ pedidoId, centroId: lesCorts, comprobar: sinComprobar }),
    503,
    'BASE_DATOS_NO_DISPONIBLE',
  );
});
