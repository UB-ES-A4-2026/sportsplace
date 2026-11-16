import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import {
  ACCIONES_CIERRE,
  accionesDeCierre,
  estaPagado,
  lineaPagado,
  lineaRecibido,
  MENSAJE_ERROR_GENERICO,
  resultadoDelFallo,
} from './cierre.js';

// E2E-1 de US-80: pedido aceptado de 4 balones por transferencia (34,00 €) de Gràcia a Les Corts.
const PEDIDO = {
  id: 'p1',
  anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7' },
  comprador: { id: 'c1', nombre: 'Escola de Bàsquet Gràcia' },
  vendedor: { id: 'c2', nombre: 'Club Esportiu Les Corts' },
  unidades: 4,
  modalidad: 'venta',
  total_centimos: 3400,
  metodo_pago: 'transferencia',
  estado: 'aceptado',
  pagado_en: null,
  recibido_en: null,
  acciones: [],
};

describe('accionesDeCierre (US-80 CA1, US-42 CA1)', () => {
  test('solo los botones que vienen en `acciones`', () => {
    assert.deepEqual(accionesDeCierre({ ...PEDIDO, acciones: ['marcar_pagado'] }).map((o) => o.texto), ['Marcar como cobrado']);
    assert.deepEqual(accionesDeCierre({ ...PEDIDO, acciones: ['recibir'] }).map((o) => o.texto), ['He recibido el material']);
    assert.deepEqual(accionesDeCierre({ ...PEDIDO, acciones: ['aceptar', 'rechazar'] }), []);
    assert.deepEqual(accionesDeCierre({ ...PEDIDO, acciones: undefined }), []);
  });

  test('avisos exactos (US-80 CA2, US-42 CA4)', () => {
    assert.equal(ACCIONES_CIERRE.marcar_pagado.aviso, 'Pedido marcado como cobrado.');
    assert.equal(ACCIONES_CIERRE.recibir.aviso, 'Pedido marcado como recibido.');
  });
});

describe('diálogos', () => {
  test('US-80: «¿Has cobrado este pedido?» con el importe, el comprador y la forma de pago', () => {
    assert.deepEqual(ACCIONES_CIERRE.marcar_pagado.dialogo(PEDIDO), {
      titulo: '¿Has cobrado este pedido?',
      texto: 'Confirma que has recibido 34,00 € de Escola de Bàsquet Gràcia por transferencia bancaria. No se puede deshacer.',
      textoConfirmar: 'Sí, lo he cobrado',
      textoEnviando: 'Guardando…',
    });
    const efectivo = ACCIONES_CIERRE.marcar_pagado.dialogo({ ...PEDIDO, metodo_pago: 'efectivo_recogida', total_centimos: 123450 });
    assert.equal(efectivo.texto, 'Confirma que has recibido 1.234,50 € de Escola de Bàsquet Gràcia por efectivo al recoger. No se puede deshacer.');
  });

  test('US-42: «¿Confirmas que has recibido el material?» con las unidades y el título', () => {
    assert.deepEqual(ACCIONES_CIERRE.recibir.dialogo(PEDIDO), {
      titulo: '¿Confirmas que has recibido el material?',
      texto: 'Confirmas que has recibido 4 unidades de «Balones de baloncesto talla 7». El pedido quedará cerrado y no se podrá deshacer.',
      textoConfirmar: 'Sí, lo he recibido',
      textoEnviando: 'Guardando…',
    });
    assert.match(ACCIONES_CIERRE.recibir.dialogo({ ...PEDIDO, unidades: 1 }).texto, /has recibido 1 unidad de/);
  });
});

describe('etiqueta y líneas (US-80 CA2/CA3/CA9, US-42)', () => {
  test('«Pagado» solo con pagado_en', () => {
    assert.equal(estaPagado(PEDIDO), false);
    assert.equal(estaPagado({ ...PEDIDO, pagado_en: '2026-11-16T09:05:00Z' }), true);
  });

  test('líneas con fecha y hora de Madrid', () => {
    assert.equal(lineaPagado({ ...PEDIDO, pagado_en: '2026-11-16T09:05:00Z' }), 'Marcado como pagado el 16/11/2026 10:05');
    assert.equal(lineaRecibido({ ...PEDIDO, recibido_en: '2026-10-22T09:10:00Z' }), 'Recibido el 22/10/2026 11:10.');
    assert.equal(lineaPagado(PEDIDO), null);
    assert.equal(lineaRecibido(PEDIDO), null);
  });
});

describe('resultadoDelFallo', () => {
  test('409 → el message de la API y recargar', () => {
    for (const [code, message] of [
      ['YA_PAGADO', 'Este pedido ya consta como cobrado.'],
      ['PEDIDO_DONACION', 'Las donaciones no se cobran.'],
      ['INCIDENCIA_ABIERTA', 'Cierra la incidencia antes de confirmar la recepción.'],
      ['TRANSICION_NO_PERMITIDA', 'El pedido ya no está en un estado que permita esta acción.'],
    ]) {
      assert.deepEqual(resultadoDelFallo(new ErrorApi(409, { code, message })), { mensaje: message, recargar: true });
    }
  });

  test('404, 403 y el resto', () => {
    assert.deepEqual(resultadoDelFallo(new ErrorApi(404)), { noEncontrado: true });
    assert.deepEqual(resultadoDelFallo(new ErrorApi(403, { code: 'SIN_PERMISO', message: 'No puedes realizar esta acción en este pedido.' })),
      { mensaje: 'No puedes realizar esta acción en este pedido.' });
    for (const status of [0, 500, 503]) assert.deepEqual(resultadoDelFallo(new ErrorApi(status)), { mensaje: MENSAJE_ERROR_GENERICO });
  });
});
