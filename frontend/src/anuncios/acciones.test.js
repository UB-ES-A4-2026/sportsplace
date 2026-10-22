import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorApi } from '../api/cliente.js';
import {
  MENSAJE_ERROR_GENERICO,
  MENSAJE_TRANSICION_NO_PERMITIDA,
  accionDePausa,
  resultadoDelFallo,
} from './acciones.js';

test('un anuncio activo ofrece «Pausar» con «Pausando…» y el aviso «Anuncio pausado.» (US-16 CA1, CA2, CA4)', () => {
  assert.deepEqual(accionDePausa('activo'), {
    accion: 'pausar',
    texto: 'Pausar',
    textoEnviando: 'Pausando…',
    aviso: 'Anuncio pausado.',
  });
});

test('un anuncio pausado ofrece «Reactivar» con «Reactivando…» y el aviso «Anuncio reactivado.» (US-16 CA1, CA2, CA4)', () => {
  assert.deepEqual(accionDePausa('pausado'), {
    accion: 'reactivar',
    texto: 'Reactivar',
    textoEnviando: 'Reactivando…',
    aviso: 'Anuncio reactivado.',
  });
});

test('en borrador, reservado, entregado y retirado no hay ni «Pausar» ni «Reactivar» (US-16 CA1)', () => {
  for (const estado of ['borrador', 'reservado', 'entregado', 'retirado', undefined, 'Activo', 'toString']) {
    assert.equal(accionDePausa(estado), null, String(estado));
  }
});

test('un 409 da el aviso de transición y pide recargar el anuncio (US-16 CA4)', () => {
  const fallo = new ErrorApi(409, { code: 'TRANSICION_NO_PERMITIDA', message: 'otro texto', details: { estado_actual: 'pausado' } });
  assert.deepEqual(resultadoDelFallo(fallo), { mensaje: MENSAJE_TRANSICION_NO_PERMITIDA, recargar: true });
  assert.equal(MENSAJE_TRANSICION_NO_PERMITIDA, 'Esta acción no está disponible en el estado actual del anuncio.');
});

test('500, 503 y sin conexión dan el aviso genérico', () => {
  for (const status of [500, 503, 0]) {
    assert.deepEqual(resultadoDelFallo(new ErrorApi(status)), { mensaje: MENSAJE_ERROR_GENERICO }, String(status));
  }
});

test('un 404 lleva a la pantalla «Anuncio no encontrado»', () => {
  assert.deepEqual(resultadoDelFallo(new ErrorApi(404, { code: 'NO_ENCONTRADO' })), { noEncontrado: true });
});

test('un 403 EMAIL_NO_CONFIRMADO muestra el mensaje de la API', () => {
  const fallo = new ErrorApi(403, { code: 'EMAIL_NO_CONFIRMADO', message: 'Confirma tu email para continuar.' });
  assert.deepEqual(resultadoDelFallo(fallo), { mensaje: 'Confirma tu email para continuar.' });
});
