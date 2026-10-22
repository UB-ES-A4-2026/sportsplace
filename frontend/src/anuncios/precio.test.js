import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precioDelAnuncio } from './precio.js';

test('una venta muestra el precio por unidad con formato español (CA6)', () => {
  assert.deepEqual(precioDelAnuncio({ modalidad: 'venta', precio_unitario_centimos: 850 }), {
    donacion: false,
    texto: '8,50 € / unidad',
  });
  assert.equal(precioDelAnuncio({ modalidad: 'venta', precio_unitario_centimos: 123450 }).texto, '1.234,50 € / unidad');
  assert.equal(precioDelAnuncio({ modalidad: 'venta', precio_unitario_centimos: 9999999 }).texto, '99.999,99 € / unidad');
  assert.equal(precioDelAnuncio({ modalidad: 'venta', precio_unitario_centimos: 1 }).texto, '0,01 € / unidad');
});

test('una donación muestra «Donación · Gratis» (CA7)', () => {
  assert.deepEqual(precioDelAnuncio({ modalidad: 'donacion', precio_unitario_centimos: null }), {
    donacion: true,
    texto: 'Donación · Gratis',
  });
});

test('sirve con el resumen de «Mis anuncios», que trae más claves', () => {
  const resumen = {
    id: '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10',
    titulo: 'Balones de fútbol talla 5',
    unidades_disponibles: 12,
    modalidad: 'venta',
    precio_unitario_centimos: 850,
    estado: 'activo',
  };
  assert.equal(precioDelAnuncio(resumen).texto, '8,50 € / unidad');
});
