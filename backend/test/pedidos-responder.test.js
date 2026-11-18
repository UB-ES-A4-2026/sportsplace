import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { anuncioNoDisponible, unidadesInsuficientes } from '../src/repositories/aceptar-pedido.js';
import { pedidoNoEncontrado } from '../src/repositories/pedidos.js';
import { sinPermiso, transicionNoPermitida } from '../src/services/transiciones-pedido.js';
import { startApi } from './helpers.js';

const pedidoId = '9d3c2b1a-0000-4000-8000-000000000099';
const respondidoEn = '2026-11-10T09:30:00.000Z';
const acciones = ['aceptar', 'rechazar'];
const motivoValido = { motivo_codigo: 'entrega_inviable', motivo_texto: 'Solo entregamos en Barcelona.' };
const usuarios = {
  vendedor: { id: 'usuario-vendedor', email_confirmado: true },
  comprador: { id: 'usuario-comprador', email_confirmado: true },
  tercero: { id: 'usuario-tercero', email_confirmado: true },
  pendiente: { id: 'usuario-pendiente', email_confirmado: false },
};
const auth = { getUser: async (token) => usuarios[token] ?? null };

let api;
let llamadas;
let errorAceptar;
let errorRechazar;

function comprobarAcceso(usuarioId, id) {
  if (id !== pedidoId || usuarioId === usuarios.tercero.id) throw pedidoNoEncontrado();
  if (usuarioId === usuarios.comprador.id) throw sinPermiso();
}

const pedidos = {
  async aceptar(usuarioId, id) {
    llamadas.push({ accion: 'aceptar', usuarioId, id });
    comprobarAcceso(usuarioId, id);
    if (errorAceptar) throw errorAceptar;
    return { id, estado: 'aceptado', respondido_en: respondidoEn, acciones: [] };
  },
  async rechazar(usuarioId, id, datos) {
    llamadas.push({ accion: 'rechazar', usuarioId, id, datos });
    comprobarAcceso(usuarioId, id);
    if (errorRechazar) throw errorRechazar;
    return { id, estado: 'rechazado', respondido_en: respondidoEn, cerrado_por: 'vendedor', ...datos, acciones: [] };
  },
};

before(async () => { api = await startApi({ auth, pedidos }); });
after(() => api.close());
beforeEach(() => {
  llamadas = [];
  errorAceptar = null;
  errorRechazar = null;
});

function responder(accion, { id = pedidoId, token = 'vendedor', cuerpo, method = 'POST' } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${api.baseUrl}/api/pedidos/${id}/${accion}`, {
    method,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

async function comprobarError(respuesta, status, code) {
  assert.equal(respuesta.status, status);
  const { error } = await respuesta.json();
  assert.equal(error.code, code);
  return error;
}

test('US-33 CA6: POST aceptar sin cuerpo usa el vendedor del token y devuelve el pedido', async () => {
  const respuesta = await responder('aceptar');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), {
    pedido: { id: pedidoId, estado: 'aceptado', respondido_en: respondidoEn, acciones: [] },
  });
  assert.deepEqual(llamadas, [{ accion: 'aceptar', usuarioId: usuarios.vendedor.id, id: pedidoId }]);
});

test('US-79 CA7: POST rechazar normaliza el texto y no acepta campos controlados por el servidor', async () => {
  const respuesta = await responder('rechazar', {
    cuerpo: { ...motivoValido, motivo_texto: ` ${motivoValido.motivo_texto} `, cerrado_por: 'sistema', estado: 'aceptado' },
  });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), {
    pedido: {
      id: pedidoId, estado: 'rechazado', respondido_en: respondidoEn, cerrado_por: 'vendedor', ...motivoValido, acciones: [],
    },
  });
  assert.deepEqual(llamadas, [{ accion: 'rechazar', usuarioId: usuarios.vendedor.id, id: pedidoId, datos: motivoValido }]);
});

test('US-33 CA7 y US-79 CA9: token obligatorio y email confirmado para ambas acciones', async () => {
  for (const accion of acciones) {
    await comprobarError(await responder(accion, { token: null }), 401, 'NO_AUTENTICADO');
    await comprobarError(await responder(accion, { token: 'pendiente' }), 403, 'EMAIL_NO_CONFIRMADO');
  }
  assert.deepEqual(llamadas, []);
});

test('US-33 CA7 y US-79 CA9: tercero o pedido inexistente reciben 404 y el comprador recibe 403', async () => {
  for (const accion of acciones) {
    const cuerpo = accion === 'rechazar' ? motivoValido : undefined;
    const tercero = await comprobarError(await responder(accion, { token: 'tercero', cuerpo }), 404, 'NO_ENCONTRADO');
    const inexistente = await comprobarError(await responder(accion, { id: '00000000-0000-0000-0000-000000000001', cuerpo }), 404, 'NO_ENCONTRADO');
    await comprobarError(await responder(accion, { id: 'no-es-uuid', cuerpo }), 404, 'NO_ENCONTRADO');
    assert.deepEqual(tercero, inexistente);
    await comprobarError(await responder(accion, { token: 'comprador', cuerpo }), 403, 'SIN_PERMISO');
  }
});

test('US-33 CA7 y CA11 y US-79 CA9: el 409 conserva el estado real del pedido', async () => {
  errorAceptar = transicionNoPermitida('cancelado');
  errorRechazar = transicionNoPermitida('aceptado');
  const aceptar = await comprobarError(await responder('aceptar'), 409, 'TRANSICION_NO_PERMITIDA');
  const rechazar = await comprobarError(await responder('rechazar', { cuerpo: motivoValido }), 409, 'TRANSICION_NO_PERMITIDA');
  assert.deepEqual(aceptar.details, { estado_actual: 'cancelado' });
  assert.deepEqual(rechazar.details, { estado_actual: 'aceptado' });
});

test('US-33 CA8 y US-34 CA2: aceptar conserva código, texto y unidades del conflicto', async () => {
  errorAceptar = anuncioNoDisponible();
  const noDisponible = await comprobarError(await responder('aceptar'), 409, 'ANUNCIO_NO_DISPONIBLE');
  assert.equal(noDisponible.message, 'Este anuncio ya no está disponible.');
  errorAceptar = unidadesInsuficientes(1);
  const insuficientes = await comprobarError(await responder('aceptar'), 409, 'UNIDADES_INSUFICIENTES');
  assert.equal(insuficientes.message, 'Solo quedan 1 unidades disponibles.');
  assert.deepEqual(insuficientes.details, { unidades_disponibles: 1 });
});

test('US-79 CA8: un motivo ausente, desconocido o reservado al sistema se rechaza antes de consultar el pedido', async () => {
  for (const cuerpo of [undefined, {}, [], { motivo_codigo: 'desconocido' }, { motivo_codigo: 'anuncio_sin_stock' }]) {
    const error = await comprobarError(await responder('rechazar', { cuerpo }), 400, 'DATOS_INVALIDOS');
    assert.equal(error.details.motivo_codigo, 'Elige un motivo.');
  }
  assert.deepEqual(llamadas, []);
});

test('US-79 CA3 y CA8: aplica los límites de la explicación tras recortar espacios', async () => {
  for (const motivo_texto of [undefined, ' 123456789 ']) {
    const respuesta = await responder('rechazar', { cuerpo: { motivo_codigo: 'otro', motivo_texto } });
    const error = await comprobarError(respuesta, 400, 'DATOS_INVALIDOS');
    assert.equal(error.details.motivo_texto, 'Explica el motivo (entre 10 y 300 caracteres).');
  }
  const otroLargo = await responder('rechazar', { cuerpo: { motivo_codigo: 'otro', motivo_texto: 'a'.repeat(301) } });
  const errorOtro = await comprobarError(otroLargo, 400, 'DATOS_INVALIDOS');
  assert.equal(errorOtro.details.motivo_texto, 'El texto no puede superar 300 caracteres.');
  for (const motivo_texto of ['a'.repeat(301), 42, 'Incluye\0un carácter no válido.']) {
    const respuesta = await responder('rechazar', { cuerpo: { ...motivoValido, motivo_texto } });
    const error = await comprobarError(respuesta, 400, 'DATOS_INVALIDOS');
    assert.equal(error.details.motivo_texto, 'El texto no puede superar 300 caracteres.');
  }
  assert.deepEqual(llamadas, []);

  for (const motivo_texto of ['1234567890', '😀'.repeat(300)]) {
    const valido = await responder('rechazar', { cuerpo: { motivo_codigo: 'otro', motivo_texto: ` ${motivo_texto} ` } });
    assert.equal(valido.status, 200);
    assert.equal((await valido.json()).pedido.motivo_texto, motivo_texto);
  }
  for (const motivo_codigo of ['sin_unidades', 'comprometido_otro_centro', 'entrega_inviable', 'condiciones_pago']) {
    const sinExplicacion = await responder('rechazar', { cuerpo: { motivo_codigo, motivo_texto: ' ' } });
    assert.equal(sinExplicacion.status, 200);
    const { pedido } = await sinExplicacion.json();
    assert.equal(pedido.motivo_codigo, motivo_codigo);
    assert.equal(pedido.motivo_texto, null);
  }
});

test('Las dos acciones admiten solo POST y devuelven 503 si la base de datos no está disponible', async () => {
  errorAceptar = databaseUnavailable();
  errorRechazar = databaseUnavailable();
  for (const accion of acciones) {
    const metodoIncorrecto = await responder(accion, { method: 'GET' });
    await comprobarError(metodoIncorrecto, 405, 'METODO_NO_PERMITIDO');
    assert.equal(metodoIncorrecto.headers.get('allow'), 'POST');
    const cuerpo = accion === 'rechazar' ? motivoValido : undefined;
    await comprobarError(await responder(accion, { cuerpo }), 503, 'BASE_DATOS_NO_DISPONIBLE');
  }
});
