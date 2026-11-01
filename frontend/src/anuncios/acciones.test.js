import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorApi } from '../api/cliente.js';
import {
  MENSAJE_ERROR_GENERICO,
  MENSAJE_TRANSICION_NO_PERMITIDA,
  accionesDeReservaYEntrega,
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

const textos = (estado) => accionesDeReservaYEntrega(estado).map((a) => a.texto);

test('un anuncio activo ofrece «Marcar como reservado» y «Marcar como entregado» (US-17 CA1)', () => {
  assert.deepEqual(textos('activo'), ['Marcar como reservado', 'Marcar como entregado']);
});

test('un anuncio reservado ofrece «Quitar reserva» y «Marcar como entregado» (US-17 CA1)', () => {
  assert.deepEqual(textos('reservado'), ['Quitar reserva', 'Marcar como entregado']);
});

test('pausado, borrador, entregado y retirado no ofrecen reservar ni entregar (US-17 CA1, CA6)', () => {
  for (const estado of ['pausado', 'borrador', 'entregado', 'retirado', undefined, 'Activo', 'toString']) {
    assert.deepEqual(accionesDeReservaYEntrega(estado), [], String(estado));
  }
});

test('un anuncio entregado no ofrece tampoco «Retirar anuncio» (US-17 CA6)', () => {
  assert.equal(puedeRetirar('entregado'), false);
});

test('textos durante la petición y avisos de cada acción (US-17 CA2, CA4)', () => {
  const porAccion = Object.fromEntries(
    [...accionesDeReservaYEntrega('activo'), ...accionesDeReservaYEntrega('reservado')]
      .map(({ accion, textoEnviando, aviso }) => [accion, [textoEnviando, aviso]]),
  );
  assert.deepEqual(porAccion, {
    reservar: ['Reservando…', 'Anuncio reservado.'],
    'quitar-reserva': ['Quitando reserva…', 'Reserva quitada.'],
    entregar: ['Marcando…', 'Anuncio entregado.'],
  });
});

test('solo «Marcar como entregado» pide confirmación, con el diálogo de US-17 CA3', () => {
  for (const estado of ['activo', 'reservado']) {
    const [inmediata, entregar] = accionesDeReservaYEntrega(estado);
    assert.equal(inmediata.confirmacion, undefined, estado);
    assert.deepEqual(entregar.confirmacion, {
      titulo: '¿Marcar como entregado?',
      texto: 'Ya no podrás editarlo ni cambiar su estado.',
      textoConfirmar: 'Marcar como entregado',
    });
  }
});

test('un 409 al reservar o entregar da el aviso rojo y pide recargar el anuncio (US-17 CA4)', () => {
  const fallo = new ErrorApi(409, { code: 'TRANSICION_NO_PERMITIDA', details: { estado_actual: 'pausado' } });
  assert.deepEqual(resultadoDelFallo(fallo), { mensaje: MENSAJE_TRANSICION_NO_PERMITIDA, recargar: true });
});
