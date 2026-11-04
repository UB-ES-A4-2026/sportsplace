import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosModalidadPrecio, precioACentimos, validarModalidadPrecio } from './modalidadPrecio.js';

const FORMATO = 'Escribe el precio con hasta 2 decimales, por ejemplo 12,50.';
const RANGO = 'El precio debe estar entre 0,01 € y 99.999,99 €.';

const errorPrecio = (precio) => validarModalidadPrecio({ modalidad: 'venta', precio }).precio_unitario_centimos;

test('convierte a céntimos sin coma flotante (CA3)', () => {
  assert.equal(precioACentimos('8,5'), 850);
  assert.equal(precioACentimos('8,05'), 805);
  assert.equal(precioACentimos('0,01'), 1);
  assert.equal(precioACentimos('99999,99'), 9999999);
  assert.equal(precioACentimos('0,29'), 29);
  assert.equal(precioACentimos('12'), 1200);
});

test('acepta punto decimal y espacios alrededor (CA12 y CA13)', () => {
  assert.equal(precioACentimos('8.50'), 850);
  assert.equal(precioACentimos('  8,50  '), 850);
  assert.equal(errorPrecio('8.50'), undefined);
  assert.equal(errorPrecio('  8,50  '), undefined);
});

test('devuelve null si el precio no es válido', () => {
  for (const precio of ['', '0', '0,00', '100000', '12,345', '1.234,50', 'abc', undefined]) {
    assert.equal(precioACentimos(precio), null, String(precio));
  }
});

test('límites y mensajes del precio (CA4)', () => {
  assert.equal(errorPrecio('0,01'), undefined);
  assert.equal(errorPrecio('99999,99'), undefined);
  assert.equal(errorPrecio('0'), RANGO);
  assert.equal(errorPrecio('0,00'), RANGO);
  assert.equal(errorPrecio('100000'), RANGO);
  for (const precio of ['12,345', '1.234,50', '12 €', '-5', 'abc', '8,', ',50']) {
    assert.equal(errorPrecio(precio), FORMATO, precio);
  }
  assert.equal(errorPrecio(''), 'Indica el precio por unidad.');
  assert.equal(errorPrecio('   '), 'Indica el precio por unidad.');
});

test('la modalidad es obligatoria y solo admite venta o donación (CA1)', () => {
  assert.deepEqual(validarModalidadPrecio({ modalidad: '', precio: '' }), { modalidad: 'Elige si es venta o donación.' });
  assert.deepEqual(validarModalidadPrecio({}), { modalidad: 'Elige si es venta o donación.' });
  assert.deepEqual(validarModalidadPrecio({ modalidad: 'regalo' }), { modalidad: 'La modalidad no es válida.' });
});

test('con «Donación» el precio no se valida aunque tenga texto (CA2 y CA5)', () => {
  assert.deepEqual(validarModalidadPrecio({ modalidad: 'donacion', precio: 'abc' }), {});
  assert.deepEqual(validarModalidadPrecio({ modalidad: 'venta', precio: '8,50' }), {});
});

test('cuerpo de la petición: el precio en céntimos solo con «Venta» (CA5 y CA8)', () => {
  assert.deepEqual(datosModalidadPrecio({ modalidad: 'venta', precio: '8,50' }), {
    modalidad: 'venta',
    precio_unitario_centimos: 850,
  });
  assert.deepEqual(datosModalidadPrecio({ modalidad: 'donacion', precio: '8,50' }), { modalidad: 'donacion' });
});
