import assert from 'node:assert/strict';
import test from 'node:test';
import { validarMetodoPago, validarPedido } from '../src/validation/pedidos.js';

const anuncioId = '2ae56a32-c1c9-4cd1-b6e4-68361bf43aa5';
const valido = { anuncio_id: anuncioId, unidades: 4 };

function comprobarError(accion, details) {
  assert.throws(accion, { status: 400, code: 'DATOS_INVALIDOS', details });
}

test('US-32 CA17: un cuerpo ausente o inválido informa de ambos campos obligatorios', () => {
  for (const cuerpo of [undefined, null, [], 'texto', {}, { anuncio_id: 'no-es-uuid', unidades: 0 }]) {
    comprobarError(() => validarPedido(cuerpo), {
      anuncio_id: 'Anuncio no válido.',
      unidades: 'Indica al menos 1 unidad.',
    });
  }
});

test('US-32 CA17: unidades exige un entero positivo seguro sin coerción', () => {
  for (const unidades of ['4', 2.5, 0, -1, null, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    comprobarError(() => validarPedido({ ...valido, unidades }), { unidades: 'Indica al menos 1 unidad.' });
  }
  assert.equal(validarPedido({ ...valido, unidades: 1 }).unidades, 1);
});

test('US-32 CA17 y CA25: el mensaje se recorta, mide en caracteres Unicode y normaliza vacío a null', () => {
  assert.equal(validarPedido(valido).mensaje, null);
  for (const mensaje of [null, '', ' \t\n ']) assert.equal(validarPedido({ ...valido, mensaje }).mensaje, null);

  const limite = '😀'.repeat(500);
  assert.equal(validarPedido({ ...valido, mensaje: ` ${limite} ` }).mensaje, limite);
  comprobarError(() => validarPedido({ ...valido, mensaje: `${limite}😀` }), {
    mensaje: 'El mensaje no puede superar 500 caracteres.',
  });
  for (const mensaje of [42, {}, 'texto\0']) {
    comprobarError(() => validarPedido({ ...valido, mensaje }), { mensaje: 'El mensaje debe ser un texto válido.' });
  }
});

test('US-32 CA26: ignora el comprador, el precio, el total, el estado y la modalidad enviados por el cliente', () => {
  const pedido = validarPedido({
    ...valido,
    comprador_centro_id: 'otro-centro',
    precio_unitario_centimos: 1,
    total_centimos: 4,
    estado: 'aceptado',
    modalidad: 'donacion',
    metodo_pago: 'transferencia',
  });
  assert.deepEqual(pedido, { ...valido, mensaje: null, metodo_pago: 'transferencia' });
  assert.equal(validarMetodoPago(pedido, 'venta'), 'transferencia');
});

test('US-35 CA3: en venta solo se permiten transferencia y efectivo al recoger', () => {
  for (const metodo_pago of ['transferencia', 'efectivo_recogida']) {
    assert.equal(validarMetodoPago(validarPedido({ ...valido, metodo_pago }), 'venta'), metodo_pago);
  }
  for (const datos of [valido, { ...valido, metodo_pago: null }, { ...valido, metodo_pago: 'tarjeta' }]) {
    comprobarError(() => validarMetodoPago(validarPedido(datos), 'venta'), { metodo_pago: 'Elige una forma de pago.' });
  }
});

test('US-35 CA4: una donación rechaza cualquier método enviado, incluso null', () => {
  assert.equal(validarMetodoPago(validarPedido(valido), 'donacion'), null);
  for (const metodo_pago of ['transferencia', 'efectivo_recogida', '', null]) {
    comprobarError(() => validarMetodoPago(validarPedido({ ...valido, metodo_pago }), 'donacion'), {
      metodo_pago: 'Las donaciones no tienen forma de pago.',
    });
  }
});
