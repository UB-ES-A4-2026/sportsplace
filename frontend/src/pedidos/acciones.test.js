import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import {
  AVISO_ACEPTADO,
  AVISO_RECHAZADO,
  botonesDelVendedor,
  cuerpoDelRechazo,
  dialogoAceptar,
  etiquetaExplicacion,
  MENSAJE_ERROR_GENERICO,
  MENSAJES_RECHAZO,
  MOTIVOS_RECHAZO,
  resultadoDelFallo,
  textoDelMotivo,
  validarRechazo,
} from './acciones.js';

// Pedido de E06 (E2E-1 de US-32): Gràcia pide 4 balones de A1 a Les Corts, que tiene 12.
const PEDIDO = {
  id: 'p1',
  anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7', estado: 'activo', unidades_disponibles: 12 },
  comprador: { id: 'c1', nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
  vendedor: { id: 'c2', nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
  mi_papel: 'vendedor',
  unidades: 4,
  estado: 'pendiente',
  acciones: ['aceptar', 'rechazar'],
};

describe('textos de US-33 y US-79', () => {
  test('avisos exactos', () => {
    assert.equal(AVISO_ACEPTADO, 'Pedido aceptado.');
    assert.equal(AVISO_RECHAZADO, 'Pedido rechazado.');
  });

  test('desplegable con los motivos del vendedor, sin anuncio_sin_stock (US-79 CA8)', () => {
    assert.deepEqual(MOTIVOS_RECHAZO.map((motivo) => motivo.texto), [
      'Ya no tengo unidades suficientes',
      'El material está comprometido con otro centro',
      'No puedo hacer la entrega que se pide',
      'No acepto las condiciones de pago',
      'Otro motivo',
    ]);
    assert.equal(MOTIVOS_RECHAZO.some((motivo) => motivo.codigo === 'anuncio_sin_stock'), false);
  });

  test('textoDelMotivo traduce también el motivo del sistema (US-34 CA5)', () => {
    assert.equal(textoDelMotivo('entrega_inviable'), 'No puedo hacer la entrega que se pide');
    assert.equal(textoDelMotivo('anuncio_sin_stock'), 'Se han agotado las unidades del anuncio');
    assert.equal(textoDelMotivo('desconocido'), null);
  });
});

describe('botonesDelVendedor (US-33 CA1, US-79 CA1, US-34 CA9)', () => {
  test('vendedor y pendiente con unidades: «Aceptar» y «Rechazar», sin aviso', () => {
    assert.deepEqual(botonesDelVendedor(PEDIDO), {
      aceptar: true, aceptarDeshabilitado: false, rechazar: true, avisoSinStock: null,
    });
  });

  test('sin aceptar ni rechazar en acciones (comprador, o ya respondido): ningún botón', () => {
    assert.deepEqual(botonesDelVendedor({ ...PEDIDO, mi_papel: 'comprador', acciones: ['cancelar'] }), {
      aceptar: false, aceptarDeshabilitado: false, rechazar: false, avisoSinStock: null,
    });
    assert.deepEqual(botonesDelVendedor({ ...PEDIDO, estado: 'aceptado', acciones: [] }).aceptar, false);
  });

  test('faltan unidades: «Aceptar» deshabilitado y aviso amarillo con las cifras', () => {
    const pedido = { ...PEDIDO, anuncio: { ...PEDIDO.anuncio, unidades_disponibles: 3 }, acciones: ['rechazar'] };
    assert.deepEqual(botonesDelVendedor(pedido), {
      aceptar: true,
      aceptarDeshabilitado: true,
      rechazar: true,
      avisoSinStock: 'Este pedido pide 4 unidades y solo te quedan 3.',
    });
  });

  test('sin `rechazar` no se pinta el «Aceptar» deshabilitado aunque falten unidades', () => {
    const pedido = { ...PEDIDO, anuncio: { ...PEDIDO.anuncio, unidades_disponibles: 3 }, acciones: [] };
    assert.equal(botonesDelVendedor(pedido).aceptar, false);
  });
});

describe('dialogoAceptar (US-33 y US-34)', () => {
  test('textos exactos con la línea de las unidades que quedarán', () => {
    assert.deepEqual(dialogoAceptar(PEDIDO), {
      titulo: '¿Aceptar el pedido?',
      texto: 'Te comprometes a entregar 4 unidades de «Balones de baloncesto talla 7» a Escola de Bàsquet Gràcia. '
        + 'Después tendréis que acordar la entrega y el pago. Quedarán 8 unidades disponibles en el anuncio.',
      textoConfirmar: 'Aceptar pedido',
      textoEnviando: 'Aceptando…',
    });
  });

  test('singular con 1 unidad; sin el dato de disponibles no se añade la línea', () => {
    const uno = { ...PEDIDO, unidades: 1, anuncio: { ...PEDIDO.anuncio, unidades_disponibles: 2 } };
    assert.match(dialogoAceptar(uno).texto, /entregar 1 unidad de .* Quedará 1 unidad disponible en el anuncio\.$/);
    const sinDato = { ...PEDIDO, anuncio: { id: 'a1', titulo: 'Balones' } };
    assert.doesNotMatch(dialogoAceptar(sinDato).texto, /Quedarán/);
  });
});

describe('validarRechazo (US-79 CA2 y CA3)', () => {
  const otro = (texto) => validarRechazo({ motivoCodigo: 'otro', motivoTexto: texto });

  test('sin motivo → «Elige un motivo.»', () => {
    assert.deepEqual(validarRechazo({ motivoCodigo: '', motivoTexto: '' }), { motivo_codigo: MENSAJES_RECHAZO.motivo });
    assert.deepEqual(validarRechazo({ motivoCodigo: 'anuncio_sin_stock', motivoTexto: '' }), { motivo_codigo: 'Elige un motivo.' });
  });

  test('«Otro motivo»: 9 caracteres se rechazan; 10 y 300 se aceptan; 301 se rechaza', () => {
    assert.deepEqual(otro('a'.repeat(9)), { motivo_texto: 'Explica el motivo (entre 10 y 300 caracteres).' });
    assert.deepEqual(otro('a'.repeat(10)), {});
    assert.deepEqual(otro('a'.repeat(300)), {});
    assert.deepEqual(otro('a'.repeat(301)), { motivo_texto: 'El texto no puede superar 300 caracteres.' });
  });

  test('E2E-2: «No sé» con «Otro motivo» → mensaje de la explicación; los espacios no cuentan', () => {
    assert.deepEqual(otro('No sé'), { motivo_texto: MENSAJES_RECHAZO.explicacionCorta });
    assert.deepEqual(otro('   No sé    '), { motivo_texto: MENSAJES_RECHAZO.explicacionCorta });
  });

  test('con otro motivo la explicación es opcional (0-300)', () => {
    assert.deepEqual(validarRechazo({ motivoCodigo: 'entrega_inviable', motivoTexto: '' }), {});
    assert.deepEqual(validarRechazo({ motivoCodigo: 'entrega_inviable', motivoTexto: 'x'.repeat(301) }),
      { motivo_texto: 'El texto no puede superar 300 caracteres.' });
  });

  test('cuenta caracteres, no unidades UTF-16 (300 emojis se aceptan)', () => {
    assert.deepEqual(otro('😀'.repeat(300)), {});
  });

  test('la etiqueta cambia a «Explicación (obligatoria)» con «Otro motivo»', () => {
    assert.equal(etiquetaExplicacion('otro'), 'Explicación (obligatoria)');
    assert.equal(etiquetaExplicacion('sin_unidades'), 'Explicación');
  });
});

test('cuerpoDelRechazo recorta la explicación y manda null si está vacía', () => {
  assert.deepEqual(cuerpoDelRechazo({ motivoCodigo: 'entrega_inviable', motivoTexto: '  Solo en Barcelona.  ' }),
    { motivoCodigo: 'entrega_inviable', motivoTexto: 'Solo en Barcelona.' });
  assert.deepEqual(cuerpoDelRechazo({ motivoCodigo: 'sin_unidades', motivoTexto: '   ' }),
    { motivoCodigo: 'sin_unidades', motivoTexto: null });
});

describe('resultadoDelFallo', () => {
  test('US-33 CA9: 409 → el message de la API en rojo y recargar', () => {
    for (const [code, message] of [
      ['TRANSICION_NO_PERMITIDA', 'El pedido ya no está en un estado que permita esta acción.'],
      ['ANUNCIO_NO_DISPONIBLE', 'Este anuncio ya no está disponible.'],
      ['UNIDADES_INSUFICIENTES', 'Solo quedan 3 unidades disponibles.'],
    ]) {
      assert.deepEqual(resultadoDelFallo(new ErrorApi(409, { code, message })), { mensaje: message, recargar: true });
    }
  });

  test('US-79 CA8: 400 con details → errores bajo cada campo del diálogo', () => {
    const fallo = new ErrorApi(400, {
      code: 'DATOS_INVALIDOS', message: 'Revisa los campos marcados.', details: { motivo_codigo: 'Elige un motivo.' },
    });
    assert.deepEqual(resultadoDelFallo(fallo), { errores: { motivo_codigo: 'Elige un motivo.' } });
  });

  test('404 → «no existe»; 403 → el message; red, 500 y 503 → aviso genérico', () => {
    assert.deepEqual(resultadoDelFallo(new ErrorApi(404, { code: 'NO_ENCONTRADO' })), { noEncontrado: true });
    assert.deepEqual(resultadoDelFallo(new ErrorApi(403, { code: 'SIN_PERMISO', message: 'No puedes realizar esta acción en este pedido.' })),
      { mensaje: 'No puedes realizar esta acción en este pedido.' });
    for (const status of [0, 500, 503]) {
      assert.deepEqual(resultadoDelFallo(new ErrorApi(status)), { mensaje: MENSAJE_ERROR_GENERICO });
    }
  });
});
