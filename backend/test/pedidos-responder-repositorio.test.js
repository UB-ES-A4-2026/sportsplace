import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.js';
import { createPedidosRepository } from '../src/repositories/pedidos.js';

// T33-6 (QA de US-33, US-79 y US-34): aceptar y rechazar en el repositorio, con
// un doble de la base de datos y la tabla de transiciones real.
const PEDIDO = '9d3c2b1a-0000-4000-8000-000000000099';
const ANUNCIO = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';
const VENDEDOR = 'usuario-lescorts';
const COMPRADOR = 'usuario-gracia';
const motivo = { motivo_codigo: 'entrega_inviable', motivo_texto: 'Solo entregamos en Barcelona.' };

// Cada consulta, dentro o fuera de la transacción, recibe la siguiente
// respuesta de la lista: un array de filas, { rows, rowCount } o un Error.
function fakeDatabase(respuestas) {
  const log = [];
  const estado = { transacciones: 0, commit: false, rollback: false };
  async function query(sql, values) {
    log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    const respuesta = respuestas.shift();
    if (respuesta instanceof Error) throw respuesta;
    if (Array.isArray(respuesta)) return { rows: respuesta, rowCount: respuesta.length };
    return respuesta ?? { rows: [], rowCount: 0 };
  }
  return {
    log,
    estado,
    query,
    async transaction(callback) {
      estado.transacciones += 1;
      try {
        const resultado = await callback({ query });
        estado.commit = true;
        return resultado;
      } catch (error) {
        estado.rollback = true;
        throw error;
      }
    },
  };
}

const filaBloqueada = (estado = 'pendiente') => ({
  estado, comprador_centro_id: GRACIA, vendedor_centro_id: LES_CORTS, centro_id: LES_CORTS,
});

const detalle = (cambios = {}) => [{
  fila: {
    id: PEDIDO, anuncio_id: ANUNCIO, titulo_anuncio: 'Balones de baloncesto talla 7', unidades: 4,
    modalidad: 'venta', precio_unitario_centimos: 850, total_centimos: 3400, metodo_pago: 'transferencia',
    mensaje: null, estado: 'pendiente', creado_en: '2026-11-10T08:30:00Z', ...cambios,
  },
  anuncio: { id: ANUNCIO, estado: 'activo', unidades_disponibles: 12 },
  ruta_foto: null,
  comprador: { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona', email: 'gracia@example.com' },
  vendedor: { id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona', email: 'lescorts@example.com' },
  centro_id: LES_CORTS,
}];

async function rechaza(promesa, status, code) {
  let lanzado;
  await assert.rejects(promesa, (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    lanzado = error;
    return true;
  });
  return lanzado;
}

const escrituras = (log) => log.filter(({ sql }) => /^(UPDATE|INSERT|DELETE)/.test(sql));

test('US-79 CA6 y CA7 y US-34 CA6: rechazar cambia solo el pedido, con UPDATE condicional y sin tocar el anuncio', async () => {
  const database = fakeDatabase([
    [filaBloqueada()],
    { rows: [], rowCount: 1 },
    detalle({ estado: 'rechazado', ...motivo, cerrado_por: 'vendedor', respondido_en: '2026-11-17T10:00:00Z' }),
  ]);
  const pedido = await createPedidosRepository(database).rechazar(VENDEDOR, PEDIDO, motivo);

  assert.equal(pedido.estado, 'rechazado');
  assert.deepEqual(pedido.acciones, []);
  assert.deepEqual(database.estado, { transacciones: 1, commit: true, rollback: false });

  const [bloqueo, actualizar] = database.log;
  assert.match(bloqueo.sql, /FOR UPDATE OF p$/);
  assert.deepEqual(bloqueo.values, [VENDEDOR, PEDIDO]);
  assert.match(actualizar.sql, /^UPDATE public\.pedidos SET estado = 'rechazado'/);
  assert.match(actualizar.sql, /cerrado_por = 'vendedor'/);
  assert.match(actualizar.sql, /WHERE id = \$1 AND estado = 'pendiente'$/);
  assert.deepEqual(actualizar.values, [PEDIDO, motivo.motivo_codigo, motivo.motivo_texto]);

  // Las unidades y el estado del anuncio no cambian: la única escritura es la del pedido.
  assert.deepEqual(escrituras(database.log), [actualizar]);
  assert.equal(database.log.some(({ sql }) => /^(UPDATE|INSERT|DELETE)[^;]*public\.anuncios/.test(sql)), false);
});

test('US-79 CA9: rechazar responde 404 a un id no uuid o a un pedido ajeno y 403 al comprador', async () => {
  const sinConsultas = fakeDatabase([]);
  await rechaza(createPedidosRepository(sinConsultas).rechazar(VENDEDOR, 'no-es-uuid', motivo), 404, 'NO_ENCONTRADO');
  assert.equal(sinConsultas.log.length, 0);

  const ajeno = fakeDatabase([[]]);
  await rechaza(createPedidosRepository(ajeno).rechazar('usuario-sabadell', PEDIDO, motivo), 404, 'NO_ENCONTRADO');
  assert.equal(ajeno.estado.rollback, true);

  const comprador = fakeDatabase([[{ ...filaBloqueada(), centro_id: GRACIA }]]);
  await rechaza(createPedidosRepository(comprador).rechazar(COMPRADOR, PEDIDO, motivo), 403, 'SIN_PERMISO');
  assert.deepEqual(escrituras(comprador.log), []);
});

test('US-79 CA9: rechazar un pedido que ya no está pendiente da 409 con el estado real y no escribe', async () => {
  for (const estado of ['aceptado', 'rechazado', 'cancelado', 'recibido']) {
    const database = fakeDatabase([[filaBloqueada(estado)]]);
    const error = await rechaza(createPedidosRepository(database).rechazar(VENDEDOR, PEDIDO, motivo), 409, 'TRANSICION_NO_PERMITIDA');
    assert.deepEqual(error.details, { estado_actual: estado });
    assert.deepEqual(escrituras(database.log), [], estado);
    assert.equal(database.estado.rollback, true);
  }

  // Si el pedido cambia entre la lectura y el UPDATE, el WHERE no lo toca: 409 y se revierte.
  const carrera = fakeDatabase([[filaBloqueada()], { rows: [], rowCount: 0 }]);
  const error = await rechaza(createPedidosRepository(carrera).rechazar(VENDEDOR, PEDIDO, motivo), 409, 'TRANSICION_NO_PERMITIDA');
  assert.deepEqual(error.details, { estado_actual: 'pendiente' });
  assert.equal(carrera.estado.rollback, true);
});

test('US-79: un fallo de la base de datos al rechazar da 500 si es de integridad y 503 en otro caso', async () => {
  const integridad = fakeDatabase([[filaBloqueada()], Object.assign(new Error('check'), { code: '23514' })]);
  await rechaza(createPedidosRepository(integridad).rechazar(VENDEDOR, PEDIDO, motivo), 500, 'ERROR_INTERNO');

  const caida = fakeDatabase([Object.assign(new Error('caída'), { code: 'ECONNREFUSED' })]);
  await rechaza(createPedidosRepository(caida).rechazar(VENDEDOR, PEDIDO, motivo), 503, 'BASE_DATOS_NO_DISPONIBLE');
});

// aceptar: primero el centro de la sesión y después la transacción de aceptarPedido
// (buscar el anuncio, bloquear el anuncio, bloquear el pedido).
const lecturasAceptar = (filaPedido, anuncio = { estado: 'activo', unidades_disponibles: 12 }) => [
  [{ id: LES_CORTS }],
  [{ anuncio_id: ANUNCIO }],
  [anuncio],
  [{ id: PEDIDO, unidades: 4, comprador_centro_id: GRACIA, vendedor_centro_id: LES_CORTS, ...filaPedido }],
];

test('US-33 CA11: aceptar un pedido cancelado da 409 con estado_actual y no reserva unidades', async () => {
  for (const estado of ['cancelado', 'aceptado', 'rechazado']) {
    const database = fakeDatabase(lecturasAceptar({ estado }));
    const error = await rechaza(createPedidosRepository(database).aceptar(VENDEDOR, PEDIDO), 409, 'TRANSICION_NO_PERMITIDA');
    assert.deepEqual(error.details, { estado_actual: estado });
    assert.deepEqual(escrituras(database.log), [], estado);
    assert.equal(database.estado.rollback, true);
  }
});

test('US-33 CA7: aceptar sin centro o con un id no uuid da 404 sin abrir la transacción; el comprador recibe 403', async () => {
  const sinCentro = fakeDatabase([[]]);
  await rechaza(createPedidosRepository(sinCentro).aceptar('usuario-sin-centro', PEDIDO), 404, 'NO_ENCONTRADO');
  assert.equal(sinCentro.estado.transacciones, 0);

  const noUuid = fakeDatabase([]);
  await rechaza(createPedidosRepository(noUuid).aceptar(VENDEDOR, 'no-es-uuid'), 404, 'NO_ENCONTRADO');
  assert.equal(noUuid.log.length, 0);

  const comprador = fakeDatabase([[{ id: GRACIA }], ...lecturasAceptar({ estado: 'pendiente' }).slice(1)]);
  await rechaza(createPedidosRepository(comprador).aceptar(COMPRADOR, PEDIDO), 403, 'SIN_PERMISO');
  assert.deepEqual(escrituras(comprador.log), []);
});

test('US-34 CA8: la segunda aceptación relee el pedido ya rechazado por el sistema y responde 409 sin restar unidades', async () => {
  // La primera aceptación dejó el anuncio en 1 unidad y rechazó este pedido de 4.
  const database = fakeDatabase(lecturasAceptar(
    { estado: 'rechazado' },
    { estado: 'activo', unidades_disponibles: 1 },
  ));
  const error = await rechaza(createPedidosRepository(database).aceptar(VENDEDOR, PEDIDO), 409, 'TRANSICION_NO_PERMITIDA');
  assert.deepEqual(error.details, { estado_actual: 'rechazado' });
  assert.deepEqual(escrituras(database.log), []);
  assert.match(database.log[3].sql, /FROM public\.pedidos WHERE id = \$1 FOR UPDATE$/);
});
