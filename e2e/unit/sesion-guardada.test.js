import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearAlmacen, MARGEN_CADUCIDAD, sesionReutilizable } from '../sesion-guardada.js';

const ahora = Math.floor(Date.now() / 1000);
const sesion = (expira = ahora + 3600) => ({ access_token: 'a', refresh_token: 'r', expires_at: expira });

test('una sesión con más de 5 min por delante se reutiliza', () => {
  assert.equal(sesionReutilizable(sesion(), ahora), true);
  assert.equal(sesionReutilizable(sesion(ahora + MARGEN_CADUCIDAD + 1), ahora), true);
});

test('una sesión a punto de caducar o caducada no se reutiliza (la web la renovaría)', () => {
  assert.equal(sesionReutilizable(sesion(ahora + MARGEN_CADUCIDAD), ahora), false);
  assert.equal(sesionReutilizable(sesion(ahora - 1), ahora), false);
});

test('una sesión incompleta o vacía no se reutiliza', () => {
  assert.equal(sesionReutilizable(null, ahora), false);
  assert.equal(sesionReutilizable({ access_token: 'a', expires_at: ahora + 3600 }, ahora), false);
  assert.equal(sesionReutilizable({ ...sesion(), expires_at: undefined }, ahora), false);
});

test('el almacén guarda por cuenta y olvida la sesión que ya no vale', () => {
  const almacen = crearAlmacen();
  assert.equal(almacen.leer('a@x'), null);
  almacen.guardar('a@x', sesion());
  assert.deepEqual(almacen.leer('a@x'), sesion());
  assert.equal(almacen.leer('b@x'), null);
  almacen.guardar('a@x', sesion(ahora - 1));
  assert.equal(almacen.leer('a@x'), null);
  almacen.guardar('b@x', sesion());
  almacen.olvidar('b@x');
  assert.equal(almacen.leer('b@x'), null);
});
