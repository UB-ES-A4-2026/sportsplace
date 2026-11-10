import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPedidosRepository } from '../src/repositories/pedidos.js';
import { postJson, startApi, usuarioConfirmado } from './helpers.js';

const ANUNCIO = 'a0000000-0000-4000-8000-000000000001';
const PEDIDO = 'b0000000-0000-4000-8000-000000000002';
const COMPRADOR = 'c0000000-0000-4000-8000-000000000003';
const VENDEDOR = 'c0000000-0000-4000-8000-000000000004';
const TITULO = 'Balones de baloncesto talla 7';
const anuncio = {
  id: ANUNCIO, centro_id: VENDEDOR, comprador_id: COMPRADOR, titulo: TITULO, estado: 'activo',
  unidades_disponibles: 12, modalidad: 'venta', precio_unitario_centimos: 850,
};
const datos = {
  anuncio_id: ANUNCIO, unidades: 4, metodo_pago: 'transferencia', metodo_entrega: 'recogida',
};
const direccion = {
  destinatario: 'Centro comprador', calle_numero: 'Carrer de Verdi 12', codigo_postal: '08012',
  localidad: 'Barcelona', provincia: 'Barcelona', telefono_contacto: '612 345 678',
};
const cabecera = { Authorization: 'Bearer token-confirmado' };
const auth = {
  async getUser(token) {
    if (token === 'token-confirmado') return usuarioConfirmado;
    if (token === 'token-sin-confirmar') return { ...usuarioConfirmado, email_confirmado: false };
    return null;
  },
};

function detallePedido(cambios = {}) {
  return {
    fila: {
      id: PEDIDO, titulo_anuncio: TITULO, unidades: 4, modalidad: 'venta', precio_unitario_centimos: 850,
      total_centimos: 3400, metodo_pago: 'transferencia', metodo_entrega: 'recogida', mensaje: null,
      estado: 'pendiente', creado_en: '2026-11-10T08:30:00Z', ...cambios,
    },
    anuncio: { id: ANUNCIO, estado: 'activo', unidades_disponibles: 12 },
    comprador: { id: COMPRADOR, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
    vendedor: { id: VENDEDOR, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
    centro_id: COMPRADOR,
  };
}

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
  return { consultas, url: `${api.baseUrl}/api/pedidos` };
}

async function comprobarError(respuesta, status, code, details) {
  assert.equal(respuesta.status, status);
  const { error } = await respuesta.json();
  assert.equal(error.code, code);
  if (details !== undefined) assert.deepEqual(error.details, details);
  return error;
}

test('US-32 CA11, CA12 y CA26: crea un pendiente con el comprador del token y los datos del anuncio', async (t) => {
  const { url, consultas } = await escenario(t, [anuncio], [{ id: PEDIDO }], [detallePedido()]);
  const respuesta = await postJson(url, {
    ...datos, comprador_centro_id: VENDEDOR, precio_unitario_centimos: 1, total_centimos: 4,
    estado: 'aceptado', direccion_envio: { dato_que_no_debe_guardarse: true },
  }, cabecera);
  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.headers.get('location'), `/api/pedidos/${PEDIDO}`);
  const { pedido } = await respuesta.json();
  assert.equal(pedido.id, PEDIDO);
  assert.equal(pedido.estado, 'pendiente');
  assert.equal(pedido.mi_papel, 'comprador');
  assert.equal(pedido.total_centimos, 3400);
  assert.equal(pedido.anuncio.unidades_disponibles, 12);
  assert.deepEqual(pedido.entrega, { metodo: 'recogida', direccion_envio: null, direccion_recogida: null });
  assert.equal(consultas.length, 3);
  assert.deepEqual(consultas[0].valores, [usuarioConfirmado.id, ANUNCIO]);
  assert.match(consultas[0].sql, /FOR UPDATE OF a$/);
  assert.deepEqual(consultas[1].valores, [
    ANUNCIO, COMPRADOR, VENDEDOR, TITULO, 4, 'venta', 850, null, 'transferencia', 'recogida', null,
  ]);
  assert.deepEqual(consultas[2].valores, [usuarioConfirmado.id, PEDIDO]);
});

test('US-32 CA16: crear un pedido requiere sesión y correo confirmado', async (t) => {
  const { url, consultas } = await escenario(t);
  await comprobarError(await postJson(url, datos), 401, 'NO_AUTENTICADO');
  await comprobarError(await postJson(url, datos, { Authorization: 'Bearer invalido' }), 401, 'NO_AUTENTICADO');
  await comprobarError(
    await postJson(url, datos, { Authorization: 'Bearer token-sin-confirmar' }), 403, 'EMAIL_NO_CONFIRMADO',
  );
  assert.equal(consultas.length, 0);
});

test('US-32 CA17: un decimal JSON de valor entero se rechaza antes de consultar', async (t) => {
  const { url, consultas } = await escenario(t);
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { ...cabecera, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos).replace('"unidades":4', '"unidades":4.0'),
  });
  await comprobarError(respuesta, 400, 'DATOS_INVALIDOS', { unidades: 'Indica al menos 1 unidad.' });
  assert.equal(consultas.length, 0);
});

test('US-32 CA18 y CA20: inexistente o retirado es 404, otro estado no disponible es 409', async (t) => {
  const { url, consultas } = await escenario(t, [], ...[
    'retirado', 'pausado', 'reservado', 'entregado',
  ].map((estado) => [{ ...anuncio, estado }]));
  for (const estado of ['inexistente', 'retirado']) {
    const respuesta = await postJson(url, datos, cabecera);
    await comprobarError(respuesta, 404, 'NO_ENCONTRADO');
    assert.equal(consultas.length, estado === 'inexistente' ? 1 : 2);
  }
  for (const estado of ['pausado', 'reservado', 'entregado']) {
    await comprobarError(await postJson(url, datos, cabecera), 409, 'ANUNCIO_NO_DISPONIBLE');
    assert.ok(consultas.at(-1).sql.startsWith('SELECT'), estado);
  }
  assert.equal(consultas.length, 5);
});

test('US-32 CA19 y CA21: responde con el stock vigente y prohíbe pedir material propio', async (t) => {
  const { url, consultas } = await escenario(t, [{ ...anuncio, unidades_disponibles: 3 }], [{
    ...anuncio, comprador_id: VENDEDOR,
  }]);
  const error = await comprobarError(
    await postJson(url, datos, cabecera), 409, 'UNIDADES_INSUFICIENTES', { unidades_disponibles: 3 },
  );
  assert.equal(error.message, 'Solo quedan 3 unidades disponibles.');
  await comprobarError(await postJson(url, datos, cabecera), 403, 'PEDIDO_PROPIO');
  assert.equal(consultas.length, 2);
});

test('US-32 CA22 y CA24: un conflicto con el índice devuelve el pedido pendiente y nunca un 500', async (t) => {
  const { url, consultas } = await escenario(t, [anuncio], [], [{ id: PEDIDO }]);
  await comprobarError(await postJson(url, datos, cabecera), 409, 'PEDIDO_YA_PENDIENTE', { pedido_id: PEDIDO });
  assert.match(consultas[1].sql, /ON CONFLICT \(anuncio_id, comprador_centro_id\) WHERE estado = 'pendiente' DO NOTHING/);
  assert.deepEqual(consultas[2].valores, [ANUNCIO, COMPRADOR]);
});

test('US-35 CA3 y CA4: el pago se valida con la modalidad vigente del anuncio', async (t) => {
  const { url, consultas } = await escenario(t, [anuncio], [{
    ...anuncio, modalidad: 'donacion', precio_unitario_centimos: null,
  }]);
  await comprobarError(await postJson(url, { ...datos, metodo_pago: undefined }, cabecera), 400, 'DATOS_INVALIDOS', {
    metodo_pago: 'Elige una forma de pago.',
  });
  await comprobarError(await postJson(url, datos, cabecera), 400, 'DATOS_INVALIDOS', {
    metodo_pago: 'Las donaciones no tienen forma de pago.',
  });
  assert.equal(consultas.length, 2);
});

test('US-40 CA13 y CA19: guarda la dirección normalizada y la devuelve en entrega', async (t) => {
  const normalizada = { ...direccion, telefono_contacto: '612345678', piso_puerta: null, indicaciones: null };
  const { url, consultas } = await escenario(t, [anuncio], [{ id: PEDIDO }], [
    detallePedido({ metodo_entrega: 'envio', direccion_envio: normalizada }),
  ]);
  const respuesta = await postJson(url, { ...datos, metodo_entrega: 'envio', direccion_envio: direccion }, cabecera);
  assert.equal(respuesta.status, 201);
  const { pedido } = await respuesta.json();
  assert.deepEqual(pedido.entrega, { metodo: 'envio', direccion_envio: normalizada, direccion_recogida: null });
  assert.deepEqual(consultas[1].valores.slice(-2), ['envio', normalizada]);
});

test('US-40 CA19: método obligatorio y error de código postal con su clave de dirección', async (t) => {
  const { url, consultas } = await escenario(t);
  await comprobarError(await postJson(url, { ...datos, metodo_entrega: undefined }, cabecera), 400, 'DATOS_INVALIDOS', {
    metodo_entrega: 'Elige cómo quieres recibir el material.',
  });
  await comprobarError(await postJson(url, {
    ...datos, metodo_entrega: 'envio', direccion_envio: { ...direccion, provincia: 'Girona' },
  }, cabecera), 400, 'DATOS_INVALIDOS', {
    'direccion_envio.codigo_postal': 'El código postal no corresponde a la provincia elegida.',
  });
  assert.equal(consultas.length, 0);
});

test('La colección de pedidos rechaza métodos distintos de POST mientras no se añada la bandeja', async (t) => {
  const { url, consultas } = await escenario(t);
  const respuesta = await fetch(url, { headers: cabecera });
  await comprobarError(respuesta, 405, 'METODO_NO_PERMITIDO');
  assert.equal(respuesta.headers.get('allow'), 'POST');
  assert.equal(consultas.length, 0);
});
