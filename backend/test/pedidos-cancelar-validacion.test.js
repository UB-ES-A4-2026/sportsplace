import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOTIVOS_CANCELACION, motivoDelPapel, validarCancelacionPedido } from '../src/validation/cancelar-pedido.js';

// T39-1 (#408): US-39, motivos de cancelación por papel y texto del motivo (CA2 y CA6).

test('US-39 CA2 y CA6: motivos de cancelación por papel (E06 «Listas fijas de motivos»)', () => {
  const de = (papel) => Object.keys(MOTIVOS_CANCELACION).filter((motivo) => MOTIVOS_CANCELACION[motivo].includes(papel));
  assert.deepEqual(de('comprador'), ['ya_no_necesario', 'otra_opcion', 'sin_acuerdo_entrega', 'sin_respuesta', 'error_pedido', 'otro']);
  assert.deepEqual(de('vendedor'), ['material_no_disponible', 'sin_acuerdo_entrega', 'sin_respuesta', 'error_pedido', 'otro']);
  assert.throws(() => motivoDelPapel('material_no_disponible', 'comprador'), {
    status: 400, code: 'DATOS_INVALIDOS', details: { motivo_codigo: 'Elige un motivo.' },
  });
  assert.throws(() => motivoDelPapel('ya_no_necesario', 'vendedor'), { status: 400 });
  assert.doesNotThrow(() => motivoDelPapel('sin_respuesta', 'vendedor'));
});

test('US-39 CA2 y CA6: validación del motivo y del texto', () => {
  assert.deepEqual(validarCancelacionPedido({ motivo_codigo: 'otra_opcion' }), { motivo_codigo: 'otra_opcion', motivo_texto: null });
  assert.deepEqual(
    validarCancelacionPedido({ motivo_codigo: 'sin_acuerdo_entrega', motivo_texto: '  No coincidimos en horarios.  ' }),
    { motivo_codigo: 'sin_acuerdo_entrega', motivo_texto: 'No coincidimos en horarios.' },
  );
  const invalido = (cuerpo, detalles) => assert.throws(() => validarCancelacionPedido(cuerpo), {
    status: 400, code: 'DATOS_INVALIDOS', details: detalles,
  });
  invalido({}, { motivo_codigo: 'Elige un motivo.' });
  invalido({ motivo_codigo: 'sin_unidades' }, { motivo_codigo: 'Elige un motivo.' }); // motivo de rechazo
  invalido({ motivo_codigo: 'anuncio_sin_stock' }, { motivo_codigo: 'Elige un motivo.' });
  invalido({ motivo_codigo: 'toString' }, { motivo_codigo: 'Elige un motivo.' });
  invalido({ motivo_codigo: 'otro', motivo_texto: '123456789' }, { motivo_texto: 'Explica el motivo (entre 10 y 300 caracteres).' });
  assert.equal(validarCancelacionPedido({ motivo_codigo: 'otro', motivo_texto: '1234567890' }).motivo_texto, '1234567890');
  assert.equal(validarCancelacionPedido({ motivo_codigo: 'otro', motivo_texto: 'a'.repeat(300) }).motivo_texto.length, 300);
  invalido({ motivo_codigo: 'sin_respuesta', motivo_texto: 'a'.repeat(301) }, { motivo_texto: 'El texto no puede superar 300 caracteres.' });
  invalido({ motivo_codigo: 'sin_respuesta', motivo_texto: 42 }, { motivo_texto: 'El texto no puede superar 300 caracteres.' });
});
