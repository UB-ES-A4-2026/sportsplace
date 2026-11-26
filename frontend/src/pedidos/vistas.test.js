import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  baldosasDelPedido,
  colorDelEstado,
  contactoEnElPanel,
  esVendedor,
  notaDelContacto,
  panelDelVendedor,
  pasosDelSeguimiento,
  puedeCobrar,
  puedeRecibir,
  TEXTOS_VISTA,
} from './vistas.js';

// La imagen de referencia de Lucía: Gràcia pide 4 balones de A1 (8,50 €) a Les Corts, que tiene 12; el vendedor lo ve.
const PEDIDO = {
  id: 'p1',
  anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7', foto_principal_url: null, estado: 'activo', unidades_disponibles: 12 },
  comprador: { id: 'c1', nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
  vendedor: { id: 'c2', nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
  mi_papel: 'vendedor',
  unidades: 4,
  modalidad: 'venta',
  precio_unitario_centimos: 850,
  total_centimos: 3400,
  metodo_pago: 'transferencia',
  mensaje: '¿Podríais tenerlo antes del sábado? Gracias.',
  estado: 'pendiente',
  acciones: ['aceptar', 'rechazar'],
};
const COMPRADOR = { ...PEDIDO, mi_papel: 'comprador', acciones: [] };
const CONTACTO = { email: 'gracia@example.com', telefono: '934000000' };

test('papel: vendedor o comprador según mi_papel', () => {
  assert.equal(esVendedor(PEDIDO), true);
  assert.equal(esVendedor(COMPRADOR), false);
  assert.equal(esVendedor(null), false);
});

test('color según el estado; uno desconocido, en gris', () => {
  for (const estado of ['pendiente', 'aceptado', 'rechazado', 'cancelado', 'recibido']) assert.equal(colorDelEstado(estado), estado);
  assert.equal(colorDelEstado('raro'), 'cancelado');
});

describe('panel del vendedor', () => {
  test('pendiente con acciones: la frase con «Rechazar» y «Aceptar»; solo «Rechazar» (faltan unidades) también', () => {
    assert.equal(panelDelVendedor(PEDIDO), 'decidir');
    const faltan = { ...PEDIDO, anuncio: { ...PEDIDO.anuncio, unidades_disponibles: 3 }, acciones: ['rechazar'] };
    assert.equal(panelDelVendedor(faltan), 'decidir');
  });

  test('pendiente sin acciones y estados desconocidos: solo la frase', () => {
    assert.equal(panelDelVendedor({ ...PEDIDO, acciones: [] }), 'situacion');
    assert.equal(panelDelVendedor({ ...PEDIDO, estado: 'raro', acciones: [] }), 'situacion');
  });

  test('el resto de estados, con su panel', () => {
    for (const estado of ['aceptado', 'recibido', 'rechazado', 'cancelado']) {
      assert.equal(panelDelVendedor({ ...PEDIDO, estado, acciones: [] }), estado);
    }
  });
});

describe('contacto en el panel (US-108 CA7: una sola vez en la pantalla)', () => {
  test('sin contacto (pendiente, rechazado o sin datos), no sale', () => {
    assert.equal(contactoEnElPanel(PEDIDO), false);
    assert.equal(contactoEnElPanel({ ...PEDIDO, estado: 'aceptado' }), false);
    assert.equal(contactoEnElPanel({ ...PEDIDO, comprador: { ...PEDIDO.comprador, ...CONTACTO } }), false);
    assert.equal(contactoEnElPanel({ ...PEDIDO, estado: 'rechazado', comprador: { ...PEDIDO.comprador, ...CONTACTO } }), false);
  });

  test('aceptado y recibido: en el panel, para los dos', () => {
    for (const estado of ['aceptado', 'recibido']) {
      assert.equal(contactoEnElPanel({ ...PEDIDO, estado, comprador: { ...PEDIDO.comprador, ...CONTACTO } }), true);
      assert.equal(contactoEnElPanel({ ...COMPRADOR, estado, vendedor: { ...PEDIDO.vendedor, ...CONTACTO } }), true);
    }
  });
});

test('nota del contacto: solo mientras el pedido está pendiente, para los dos', () => {
  assert.equal(notaDelContacto(PEDIDO), 'El email y el teléfono se ven cuando el pedido está aceptado.');
  assert.equal(notaDelContacto(COMPRADOR), TEXTOS_VISTA.notaContacto);
  for (const estado of ['aceptado', 'recibido', 'rechazado', 'cancelado']) assert.equal(notaDelContacto({ ...PEDIDO, estado }), null);
  assert.equal(notaDelContacto(null), null);
});

test('cobro (US-80) y recepción (US-42) solo con su acción', () => {
  assert.equal(puedeCobrar({ ...PEDIDO, estado: 'aceptado', acciones: ['marcar_pagado'] }), true);
  assert.equal(puedeCobrar({ ...PEDIDO, estado: 'aceptado', acciones: [] }), false);
  assert.equal(puedeRecibir({ ...COMPRADOR, estado: 'aceptado', acciones: ['recibir'] }), true);
  assert.equal(puedeRecibir({ ...COMPRADOR, estado: 'aceptado' }), false);
});

describe('seguimiento del comprador en 3 pasos', () => {
  const resumen = (pedido) => pasosDelSeguimiento(pedido)
    .map(({ texto, tipo, actual, tramo }) => `${texto}·${tipo}${actual ? '·actual' : ''}·${tramo}`);

  test('pendiente: enviado, esperando la respuesta (paso actual) y recibido por llegar', () => {
    assert.deepEqual(resumen(COMPRADOR), [
      'Pedido enviado·hecho·hecho',
      'Respuesta del vendedor·espera·actual·futuro',
      'Material recibido·futuro·null',
    ]);
  });

  test('aceptado y recibido', () => {
    assert.deepEqual(resumen({ ...COMPRADOR, estado: 'aceptado' }), [
      'Pedido enviado·hecho·hecho', 'Aceptado·hecho·hecho', 'Material recibido·futuro·actual·null',
    ]);
    assert.deepEqual(resumen({ ...COMPRADOR, estado: 'recibido' }), [
      'Pedido enviado·hecho·hecho', 'Aceptado·hecho·hecho', 'Material recibido·hecho·actual·null',
    ]);
  });

  test('rechazado y cancelado: el segundo paso en rojo y la línea hasta él también', () => {
    assert.deepEqual(resumen({ ...COMPRADOR, estado: 'rechazado' }), [
      'Pedido enviado·hecho·mal', 'Rechazado·mal·actual·futuro', 'Material recibido·futuro·null',
    ]);
    assert.equal(pasosDelSeguimiento({ ...COMPRADOR, estado: 'cancelado' })[1].texto, 'Cancelado');
  });

  test('estado desconocido: sin paso actual', () => {
    assert.deepEqual(resumen({ ...COMPRADOR, estado: 'raro' }), [
      'Pedido enviado·hecho·hecho', 'Respuesta del vendedor·futuro·futuro', 'Material recibido·futuro·null',
    ]);
  });

  test('número y estado para el lector de pantalla', () => {
    const pasos = pasosDelSeguimiento(COMPRADOR);
    assert.deepEqual(pasos.map(({ numero }) => numero), [1, 2, 3]);
    assert.deepEqual(pasos.map(({ lector }) => lector), ['hecho', 'en espera', 'todavía no']);
    assert.equal(pasosDelSeguimiento({ ...COMPRADOR, estado: 'rechazado' })[1].lector, 'no');
  });
});

describe('datos del pedido en baldosas (rejilla de 3 columnas)', () => {
  const resumen = (pedido) => baldosasDelPedido(pedido)
    .map(({ etiqueta, valor, tipo, ancho, vacio }) => `${etiqueta ?? '—'}: ${valor} (${tipo}, ${ancho}${vacio ? ', vacío' : ''})`);

  test('venta: unidades, precio y total en la primera fila; forma de pago y el mensaje (2 columnas) en la segunda', () => {
    assert.deepEqual(resumen(PEDIDO), [
      'Unidades: 4 unidades (dato, 1)',
      'Precio por unidad: 8,50 € (dato, 1)',
      'Total: 34,00 € (total, 1)',
      'Forma de pago: Transferencia bancaria (dato, 1)',
      'Mensaje del comprador: ¿Podríais tenerlo antes del sábado? Gracias. (mensaje, 2)',
    ]);
    assert.deepEqual(baldosasDelPedido(PEDIDO).map(({ clave }) => clave),
      ['Unidades', 'Precio por unidad', 'Total', 'Forma de pago', 'mensaje']);
  });

  test('1 unidad, en singular', () => {
    assert.equal(baldosasDelPedido({ ...PEDIDO, unidades: 1 })[0].valor, '1 unidad');
  });

  test('venta sin forma de pago: el mensaje ocupa toda la segunda fila', () => {
    assert.equal(baldosasDelPedido({ ...PEDIDO, metodo_pago: null }).at(-1).ancho, 3);
  });

  test('donación: «Donación: sin coste» sin etiqueta y en verde (2 columnas); «Sin mensaje» a todo el ancho', () => {
    const donacion = { ...PEDIDO, modalidad: 'donacion', precio_unitario_centimos: null, total_centimos: 0, metodo_pago: null, mensaje: null };
    assert.deepEqual(resumen(donacion), [
      'Unidades: 4 unidades (dato, 1)',
      '—: Donación: sin coste (total, 2)',
      'Mensaje del comprador: Sin mensaje (mensaje, 3, vacío)',
    ]);
  });
});

test('textos de presentación (los decide Lucía)', () => {
  assert.equal(TEXTOS_VISTA.contactar('Escola de Bàsquet Gràcia'), 'Ya puedes contactar con Escola de Bàsquet Gràcia:');
  // Los E2E buscan «Material recibido.» (la frase de CA5) con exact: true: el paso no lleva punto.
  assert.notEqual(TEXTOS_VISTA.pasoRecibido, 'Material recibido.');
  // «Aceptado», «Rechazado» y «Cancelado» del paso 2 llevan además el estado para el lector («Aceptado (hecho)»): en
  // pantalla no compiten con la etiqueta de estado, que es la que buscan los E2E con exact: true.
  assert.equal(TEXTOS_VISTA.estadoPaso.hecho, 'hecho');
});
