import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearEuros } from './euros.js';

test('formatea los céntimos con coma decimal y punto de miles (CA6)', () => {
  assert.equal(formatearEuros(850), '8,50 €');
  assert.equal(formatearEuros(123450), '1.234,50 €');
  assert.equal(formatearEuros(9999999), '99.999,99 €');
});

test('completa los decimales a dos cifras', () => {
  assert.equal(formatearEuros(1), '0,01 €');
  assert.equal(formatearEuros(805), '8,05 €');
  assert.equal(formatearEuros(1000), '10,00 €');
  assert.equal(formatearEuros(100000), '1.000,00 €');
});
