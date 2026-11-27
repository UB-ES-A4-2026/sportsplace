import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MENSAJES_RECHAZO, textoDelMotivo } from './acciones.js';
import {
  AVISO_CANCELADO,
  cuerpoDeLaCancelacion,
  dialogoCancelar,
  motivosDeCancelacion,
  puedeCancelar,
  validarCancelacion,
} from './cancelar.js';

// Pedido de E06 (E2E-1 de US-39): Gràcia pide los petos a Les Corts.
const PEDIDO = {
  id: 'p1',
  anuncio: { id: 'a1', titulo: 'Petos de entrenamiento reversibles', estado: 'activo', unidades_disponibles: 30 },
  comprador: { id: 'c1', nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
  vendedor: { id: 'c2', nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
  mi_papel: 'comprador',
  unidades: 10,
  estado: 'pendiente',
  acciones: ['cancelar'],
};

describe('US-39 CA1: el botón depende de `acciones`', () => {
  test('con cancelar en acciones, sí; sin él o sin pedido, no', () => {
    assert.equal(puedeCancelar(PEDIDO), true);
    assert.equal(puedeCancelar({ ...PEDIDO, acciones: ['aceptar', 'rechazar'] }), false);
    assert.equal(puedeCancelar({ ...PEDIDO, acciones: [] }), false);
    assert.equal(puedeCancelar(null), false);
  });
});

describe('US-39 CA2: motivos por papel', () => {
  test('el comprador ve los suyos y los comunes, en el orden de E06', () => {
    assert.deepEqual(motivosDeCancelacion('comprador').map((motivo) => motivo.texto), [
      'Ya no necesitamos el material',
      'Hemos encontrado otra opción',
      'No hemos podido acordar la entrega',
      'La otra parte no responde',
      'El pedido tenía un error',
      'Otro motivo',
    ]);
  });

  test('el vendedor ve «El material ya no está disponible» y los comunes', () => {
    assert.deepEqual(motivosDeCancelacion('vendedor').map((motivo) => motivo.codigo), [
      'material_no_disponible', 'sin_acuerdo_entrega', 'sin_respuesta', 'error_pedido', 'otro',
    ]);
  });

  test('la sección «Motivo» traduce los motivos de cancelación (CA3, CA4)', () => {
    assert.equal(textoDelMotivo('otra_opcion'), 'Hemos encontrado otra opción');
    assert.equal(textoDelMotivo('material_no_disponible'), 'El material ya no está disponible');
    assert.equal(textoDelMotivo('otro'), 'Otro motivo');
  });
});

describe('US-39 CA2: validación', () => {
  test('motivo obligatorio y de mi papel', () => {
    assert.deepEqual(validarCancelacion({ motivoCodigo: '', motivoTexto: '' }, 'comprador'), {
      motivo_codigo: MENSAJES_RECHAZO.motivo,
    });
    assert.deepEqual(validarCancelacion({ motivoCodigo: 'material_no_disponible', motivoTexto: '' }, 'comprador'), {
      motivo_codigo: 'Elige un motivo.',
    });
    assert.deepEqual(validarCancelacion({ motivoCodigo: 'otra_opcion', motivoTexto: '' }, 'comprador'), {});
    assert.deepEqual(validarCancelacion({ motivoCodigo: 'material_no_disponible', motivoTexto: '' }, 'vendedor'), {});
  });

  test('explicación: 10-300 con «Otro motivo», 0-300 con el resto', () => {
    const otro = (texto) => validarCancelacion({ motivoCodigo: 'otro', motivoTexto: texto }, 'vendedor');
    assert.deepEqual(otro('123456789'), { motivo_texto: 'Explica el motivo (entre 10 y 300 caracteres).' });
    assert.deepEqual(otro('  123456789  '), { motivo_texto: 'Explica el motivo (entre 10 y 300 caracteres).' });
    assert.deepEqual(otro('1234567890'), {});
    assert.deepEqual(otro('a'.repeat(300)), {});
    assert.deepEqual(validarCancelacion({ motivoCodigo: 'sin_respuesta', motivoTexto: 'a'.repeat(301) }, 'vendedor'), {
      motivo_texto: 'El texto no puede superar 300 caracteres.',
    });
  });

  test('el cuerpo lleva la explicación recortada o null', () => {
    assert.deepEqual(cuerpoDeLaCancelacion({ motivoCodigo: 'sin_acuerdo_entrega', motivoTexto: '  No coincidimos en horarios.  ' }), {
      motivoCodigo: 'sin_acuerdo_entrega', motivoTexto: 'No coincidimos en horarios.',
    });
    assert.deepEqual(cuerpoDeLaCancelacion({ motivoCodigo: 'otra_opcion', motivoTexto: '   ' }), {
      motivoCodigo: 'otra_opcion', motivoTexto: null,
    });
  });
});

describe('US-39: textos del diálogo y del aviso', () => {
  test('pendiente: el otro centro verá el motivo', () => {
    assert.deepEqual(dialogoCancelar(PEDIDO), {
      titulo: 'Cancelar el pedido',
      texto: 'Club Esportiu Les Corts verá el motivo. No se puede deshacer.',
      textoConfirmar: 'Cancelar pedido',
      textoEnviando: 'Cancelando…',
      textoVolver: 'Volver',
    });
  });

  test('aceptado y visto por el vendedor: el comprador verá el motivo y las unidades vuelven (CA9)', () => {
    assert.equal(
      dialogoCancelar({ ...PEDIDO, mi_papel: 'vendedor', estado: 'aceptado' }).texto,
      'Escola de Bàsquet Gràcia verá el motivo. No se puede deshacer. Las unidades volverán a estar disponibles en el anuncio.',
    );
  });

  test('aviso verde exacto (CA3)', () => {
    assert.equal(AVISO_CANCELADO, 'Pedido cancelado.');
  });
});
