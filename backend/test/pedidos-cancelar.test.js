import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPedidosRepository } from '../src/repositories/pedidos.js';
import { postJson, startApi } from './helpers.js';

// T39-1 (#408): US-39, POST /api/pedidos/:id/cancelar con un doble de la base de datos que
// responde en orden (las reglas y la validación tienen sus propios archivos de test).
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';
const PEDIDO = '9d3c2b1a-0000-4000-8000-000000000099';
const A1 = 'a0000000-0000-4000-8000-000000000001';
const CANCELADO_EN = '2026-11-27T10:00:00.000Z';
const PAGADO = 'No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.';

const usuarios = {
  'token-gracia': { id: 'usuario-gracia', email: 'gracia@example.com', email_confirmado: true },
  'token-lescorts': { id: 'usuario-lescorts', email: 'lescorts@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-x', email: 'x@example.com', email_confirmado: false },
};
const auth = { getUser: async (token) => usuarios[token] ?? null };
const comprador = { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' };
const vendedor = { id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' };
const anuncio = { id: A1, estado: 'activo', unidades_disponibles: 8 };

// Pedido de E2E-2 de US-39: 4 balones de A1 a 8,50 €, de Gràcia (comprador) a Les Corts (vendedor).
function fila(cambios = {}) {
  return {
    id: PEDIDO, titulo_anuncio: 'Balones de baloncesto talla 7', unidades: 4, modalidad: 'venta',
    precio_unitario_centimos: 850, total_centimos: 3400, metodo_pago: 'transferencia',
    metodo_entrega: 'recogida', mensaje: null, estado: 'pendiente', creado_en: '2026-10-21T08:30:00Z',
    ...cambios,
  };
}

// Filas de las consultas de cancelar() en su orden: el pedido de la sesión, el anuncio
// bloqueado, el pedido bloqueado, los UPDATE y el detalle final (SELECT_DETALLE).
const encontrado = [{ anuncio_id: A1 }];
const anuncioBloqueado = (estado = 'activo') => [{ estado }];
const bloqueado = (centroId, cambios = {}) => [{
  estado: 'pendiente', unidades: 4, comprador_centro_id: GRACIA, vendedor_centro_id: LES_CORTS,
  pagado_en: null, incidencia_abierta: null, centro_id: centroId, ...cambios,
}];
const actualizado = { rows: [], rowCount: 1 };
const detalle = (cambios, centroId) => [{ fila: fila(cambios), anuncio, comprador, vendedor, centro_id: centroId }];

async function escenario(t, ...respuestas) {
  const consultas = [];
  const database = {
    async transaction(trabajo) {
      return trabajo({
        async query(sql, valores) {
          consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), valores });
          assert.ok(respuestas.length, `consulta no prevista: ${sql}`);
          const respuesta = respuestas.shift();
          if (respuesta instanceof Error) throw respuesta;
          return Array.isArray(respuesta) ? { rows: respuesta, rowCount: respuesta.length } : respuesta;
        },
      });
    },
  };
  const api = await startApi({ auth, pedidos: createPedidosRepository(database) });
  t.after(() => api.close());
  const cancelar = (token, cuerpo, id = PEDIDO) => postJson(
    `${api.baseUrl}/api/pedidos/${id}/cancelar`,
    cuerpo,
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  return { consultas, cancelar, baseUrl: api.baseUrl, pendientes: () => respuestas.length };
}

async function comprobarError(respuesta, status, code, message) {
  assert.equal(respuesta.status, status);
  const { error } = await respuesta.json();
  assert.equal(error.code, code);
  if (message) assert.equal(error.message, message);
  return error;
}

// ---------------------------------------------------------------- API

test('US-39 CA5 y E2E-1: el comprador cancela un pendiente → 200, cancelado por el comprador y el anuncio intacto', async (t) => {
  const final = { estado: 'cancelado', cancelado_en: CANCELADO_EN, cerrado_por: 'comprador', motivo_codigo: 'otra_opcion' };
  const { cancelar, consultas, pendientes } = await escenario(
    t, encontrado, anuncioBloqueado(), bloqueado(GRACIA), actualizado, detalle(final, GRACIA),
  );
  const respuesta = await cancelar('token-gracia', { motivo_codigo: 'otra_opcion' });
  assert.equal(respuesta.status, 200);
  const { pedido } = await respuesta.json();
  assert.equal(pedido.estado, 'cancelado');
  assert.equal(pedido.cancelado_en, CANCELADO_EN);
  assert.equal(pedido.cerrado_por, 'comprador');
  assert.deepEqual(pedido.acciones, []);
  assert.equal(pendientes(), 0);

  // Orden de bloqueo de aceptarPedido: primero el anuncio y luego el pedido.
  assert.match(consultas[1].sql, /FROM public\.anuncios WHERE id = \$1 FOR UPDATE/);
  assert.match(consultas[2].sql, /FOR UPDATE OF p/);
  // El UPDATE guarda motivo, papel y fecha, y solo cambia un pendiente o aceptado sin cobrar.
  assert.match(consultas[3].sql, /SET estado = 'cancelado'.*cancelado_en = now\(\)/);
  assert.match(consultas[3].sql, /estado IN \('pendiente', 'aceptado'\) AND pagado_en IS NULL/);
  assert.deepEqual(consultas[3].valores, [PEDIDO, 'otra_opcion', null, 'comprador']);
  // CA9: un pendiente no toca el anuncio.
  assert.ok(!consultas.some((consulta) => consulta.sql.startsWith('UPDATE public.anuncios')));
});

test('US-39 CA9 y E2E-2: el vendedor cancela un aceptado y las unidades vuelven al anuncio', async (t) => {
  const final = {
    estado: 'cancelado', cancelado_en: CANCELADO_EN, cerrado_por: 'vendedor',
    motivo_codigo: 'sin_acuerdo_entrega', motivo_texto: 'No coincidimos en horarios.',
  };
  const { cancelar, consultas, pendientes } = await escenario(
    t, encontrado, anuncioBloqueado('reservado'), bloqueado(LES_CORTS, { estado: 'aceptado' }),
    actualizado, actualizado, detalle(final, LES_CORTS),
  );
  const respuesta = await cancelar('token-lescorts', {
    motivo_codigo: 'sin_acuerdo_entrega', motivo_texto: 'No coincidimos en horarios.',
  });
  assert.equal(respuesta.status, 200);
  const { pedido } = await respuesta.json();
  assert.equal(pedido.cerrado_por, 'vendedor');
  assert.equal(pedido.motivo_texto, 'No coincidimos en horarios.');
  assert.equal(pendientes(), 0);

  assert.deepEqual(consultas[3].valores, [PEDIDO, 'sin_acuerdo_entrega', 'No coincidimos en horarios.', 'vendedor']);
  // US-34 CA6: suma las unidades y, si estaba reservado, vuelve a activo, en la misma transacción.
  assert.match(consultas[4].sql, /UPDATE public\.anuncios SET unidades_disponibles = unidades_disponibles \+ \$2/);
  assert.match(consultas[4].sql, /CASE WHEN estado = 'reservado' THEN 'activo' ELSE estado END/);
  assert.deepEqual(consultas[4].valores, [A1, 4]);
});

test('US-39 CA6 y E2E-4: un motivo del otro papel o un texto que no cumple → 400 sin tocar nada', async (t) => {
  const { cancelar, consultas } = await escenario(t, encontrado, anuncioBloqueado(), bloqueado(GRACIA));
  const error = await comprobarError(
    await cancelar('token-gracia', { motivo_codigo: 'material_no_disponible' }), 400, 'DATOS_INVALIDOS',
  );
  assert.deepEqual(error.details, { motivo_codigo: 'Elige un motivo.' });
  assert.ok(!consultas.some((consulta) => consulta.sql.startsWith('UPDATE')));

  // El cuerpo se valida antes de leer el pedido: «Otro motivo» con menos de 10 caracteres.
  const corto = await comprobarError(
    await cancelar('token-gracia', { motivo_codigo: 'otro', motivo_texto: 'No.' }), 400, 'DATOS_INVALIDOS',
  );
  assert.deepEqual(corto.details, { motivo_texto: 'Explica el motivo (entre 10 y 300 caracteres).' });
  assert.equal(consultas.length, 3);
});

test('US-39 CA7: 401 sin sesión, 403 EMAIL_NO_CONFIRMADO y 404 para un tercero o un id inválido', async (t) => {
  const { cancelar } = await escenario(t, []);
  const cuerpo = { motivo_codigo: 'sin_respuesta' };
  await comprobarError(await cancelar(null, cuerpo), 401, 'NO_AUTENTICADO');
  await comprobarError(await cancelar('token-sin-confirmar', cuerpo), 403, 'EMAIL_NO_CONFIRMADO');
  await comprobarError(await cancelar('token-gracia', cuerpo), 404, 'NO_ENCONTRADO', 'Pedido no encontrado.');
  await comprobarError(await cancelar('token-gracia', cuerpo, 'no-es-un-uuid'), 404, 'NO_ENCONTRADO');
});

test('US-39 CA8 y E2E-3/E2E-4: rechazado → 409 TRANSICION_NO_PERMITIDA; cobrado → 409 PEDIDO_PAGADO', async (t) => {
  const { cancelar, consultas } = await escenario(
    t,
    encontrado, anuncioBloqueado(), bloqueado(GRACIA, { estado: 'rechazado' }),
    encontrado, anuncioBloqueado(), bloqueado(LES_CORTS, { estado: 'aceptado', pagado_en: '2026-11-12T10:00:00Z' }),
    encontrado, anuncioBloqueado(), bloqueado(GRACIA, { estado: 'aceptado', incidencia_abierta: true }),
  );
  const rechazado = await comprobarError(
    await cancelar('token-gracia', { motivo_codigo: 'sin_respuesta' }), 409, 'TRANSICION_NO_PERMITIDA',
  );
  assert.deepEqual(rechazado.details, { estado_actual: 'rechazado' });
  await comprobarError(
    await cancelar('token-lescorts', { motivo_codigo: 'sin_respuesta' }), 409, 'PEDIDO_PAGADO', PAGADO,
  );
  await comprobarError(await cancelar('token-gracia', { motivo_codigo: 'sin_respuesta' }), 409, 'INCIDENCIA_ABIERTA');
  assert.ok(!consultas.some((consulta) => consulta.sql.startsWith('UPDATE')));
});

test('US-39 CA10: si el UPDATE no cambia ninguna fila (otra petición ganó), 409 con el estado real', async (t) => {
  const { cancelar, consultas } = await escenario(
    t, encontrado, anuncioBloqueado(), bloqueado(GRACIA), { rows: [], rowCount: 0 }, [{ estado: 'aceptado' }],
  );
  const error = await comprobarError(
    await cancelar('token-gracia', { motivo_codigo: 'error_pedido' }), 409, 'TRANSICION_NO_PERMITIDA',
  );
  assert.deepEqual(error.details, { estado_actual: 'aceptado' });
  assert.ok(!consultas.some((consulta) => consulta.sql.startsWith('UPDATE public.anuncios')));
});

test('Un error de la base de datos responde 503 BASE_DATOS_NO_DISPONIBLE', async (t) => {
  const caida = Object.assign(new Error('conexión perdida'), { code: '08006' });
  const { cancelar } = await escenario(t, caida);
  await comprobarError(await cancelar('token-gracia', { motivo_codigo: 'sin_respuesta' }), 503, 'BASE_DATOS_NO_DISPONIBLE');
});

test('Otros métodos en /api/pedidos/:id/cancelar responden 405 con Allow: POST', async (t) => {
  const { baseUrl } = await escenario(t);
  const respuesta = await fetch(`${baseUrl}/api/pedidos/${PEDIDO}/cancelar`, { headers: { Authorization: 'Bearer token-gracia' } });
  assert.equal(respuesta.status, 405);
  assert.equal(respuesta.headers.get('allow'), 'POST');
});
