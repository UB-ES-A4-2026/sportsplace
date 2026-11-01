import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorApi } from '../api/cliente.js';
import {
  MENSAJE_ERROR_GENERICO,
  MENSAJE_TRANSICION_NO_PERMITIDA,
  puedeRetirar,
  resultadoDelFallo,
} from './acciones.js';

test('«Retirar anuncio» se ofrece en borrador, activo, pausado y reservado (US-70 CA1)', () => {
  for (const estado of ['borrador', 'activo', 'pausado', 'reservado']) assert.equal(puedeRetirar(estado), true, estado);
});

test('«Retirar anuncio» no se ofrece en entregado ni en retirado (US-70 CA1, US-17 CA6)', () => {
  for (const estado of ['entregado', 'retirado', undefined, 'Activo']) assert.equal(puedeRetirar(estado), false, estado);
});

test('un 409 da el aviso de transición y pide recargar el anuncio (US-70 CA6)', () => {
  const fallo = new ErrorApi(409, { code: 'TRANSICION_NO_PERMITIDA', message: 'otro texto', details: { estado_actual: 'entregado' } });
  assert.deepEqual(resultadoDelFallo(fallo), { mensaje: MENSAJE_TRANSICION_NO_PERMITIDA, recargar: true });
});

test('500, 503 y sin conexión dan el aviso genérico (US-70 CA6)', () => {
  for (const status of [500, 503, 0]) {
    assert.deepEqual(resultadoDelFallo(new ErrorApi(status)), { mensaje: MENSAJE_ERROR_GENERICO }, String(status));
  }
  assert.equal(MENSAJE_ERROR_GENERICO, 'No se ha podido completar la acción. Inténtalo de nuevo.');
});

test('un 404 lleva a la pantalla «Anuncio no encontrado»', () => {
  assert.deepEqual(resultadoDelFallo(new ErrorApi(404, { code: 'NO_ENCONTRADO' })), { noEncontrado: true });
});

test('un 403 EMAIL_NO_CONFIRMADO muestra el mensaje de la API', () => {
  const fallo = new ErrorApi(403, { code: 'EMAIL_NO_CONFIRMADO', message: 'Confirma tu email para continuar.' });
  assert.deepEqual(resultadoDelFallo(fallo), { mensaje: 'Confirma tu email para continuar.' });
});
