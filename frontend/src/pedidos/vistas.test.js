import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { datosDelPedido, TEXTOS } from './detalle.js';
import {
  baldosasDelPedido,
  cifrasDelPedido,
  colorDelEstado,
  esVendedor,
  etiquetaDelPapel,
  mensajeDelComprador,
  panelDelVendedor,
  pasosDelSeguimiento,
  puedeCobrar,
  puedeRecibir,
  TEXTOS_VISTA,
} from './vistas.js';

// Los mockups de Lucía: Gràcia pide 4 balones de A1 (8,50 €) a Les Corts, que tiene 12; el vendedor lo ve.
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

test('papel: «Pedido recibido» para el vendedor y «Pedido realizado» para el comprador', () => {
  assert.equal(esVendedor(PEDIDO), true);
  assert.equal(esVendedor(COMPRADOR), false);
  assert.equal(esVendedor(null), false);
  assert.deepEqual(etiquetaDelPapel(PEDIDO), { texto: 'Pedido recibido', clase: 'recibido' });
  assert.deepEqual(etiquetaDelPapel(COMPRADOR), { texto: 'Pedido realizado', clase: 'realizado' });
});

test('color según el estado; uno desconocido, en gris', () => {
  for (const estado of ['pendiente', 'aceptado', 'rechazado', 'cancelado', 'recibido']) assert.equal(colorDelEstado(estado), estado);
  assert.equal(colorDelEstado('raro'), 'cancelado');
});

describe('panel del vendedor', () => {
  test('pendiente con acciones: «¿Aceptas este pedido?»; solo «Rechazar» (faltan unidades) también', () => {
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

describe('cifras de US-34', () => {
  test('te piden 4, tienes 12 y quedarán 8', () => {
    assert.deepEqual(cifrasDelPedido(PEDIDO), [
      { clave: 'piden', valor: '4', texto: 'te piden', falta: false },
      { clave: 'disponibles', valor: '12', texto: 'tienes disponibles', falta: false },
      { clave: 'quedaran', valor: '8', texto: 'quedarán en el anuncio', falta: false },
    ]);
    assert.equal(cifrasDelPedido({ ...PEDIDO, unidades: 12 })[2].valor, '0');
  });

  test('faltan unidades: las disponibles en rojo y «—» con «no te llegan»', () => {
    const cifras = cifrasDelPedido({ ...PEDIDO, unidades: 10, anuncio: { ...PEDIDO.anuncio, unidades_disponibles: 8 } });
    assert.deepEqual(cifras.map(({ valor }) => valor), ['10', '8', '—']);
    assert.equal(cifras[1].falta, true);
    assert.equal(cifras[2].texto, 'no te llegan');
  });

  test('sin las disponibles del anuncio, sin cifras', () => {
    assert.equal(cifrasDelPedido({ ...PEDIDO, anuncio: { ...PEDIDO.anuncio, unidades_disponibles: undefined } }), null);
    assert.equal(cifrasDelPedido(null), null);
  });
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

describe('datos del pedido en baldosas', () => {
  test('venta: cuatro baldosas con el total destacado y sin el mensaje', () => {
    const { baldosas, sueltas } = baldosasDelPedido(datosDelPedido(PEDIDO));
    assert.deepEqual(baldosas.map(({ etiqueta, valor, destacada }) => `${etiqueta}: ${valor}${destacada ? ' (destacada)' : ''}`), [
      'Unidades: 4', 'Precio por unidad: 8,50 €', 'Total: 34,00 € (destacada)', 'Forma de pago: Transferencia bancaria',
    ]);
    assert.deepEqual(sueltas, []);
  });

  test('donación: «Donación: sin coste» aparte', () => {
    const donacion = { ...PEDIDO, modalidad: 'donacion', precio_unitario_centimos: null, total_centimos: 0, metodo_pago: null };
    const { baldosas, sueltas } = baldosasDelPedido(datosDelPedido(donacion));
    assert.deepEqual(baldosas.map(({ etiqueta }) => etiqueta), ['Unidades']);
    assert.deepEqual(sueltas, ['Donación: sin coste']);
  });
});

test('mensaje del comprador: bocadillo, o «Sin mensaje»', () => {
  assert.deepEqual(mensajeDelComprador(PEDIDO), { texto: '¿Podríais tenerlo antes del sábado? Gracias.', vacio: false });
  assert.deepEqual(mensajeDelComprador({ ...PEDIDO, mensaje: '' }), { texto: TEXTOS.sinMensaje, vacio: true });
  assert.deepEqual(mensajeDelComprador({ ...PEDIDO, mensaje: null }), { texto: 'Sin mensaje', vacio: true });
});

test('textos de presentación (los decide Lucía)', () => {
  assert.equal(TEXTOS_VISTA.aceptas, '¿Aceptas este pedido?');
  assert.equal(TEXTOS_VISTA.contactar('Escola de Bàsquet Gràcia'), 'Ya puedes contactar con Escola de Bàsquet Gràcia:');
  // Los E2E buscan «Material recibido.» (la frase de CA5) con exact: true: el paso no lleva punto.
  assert.notEqual(TEXTOS_VISTA.pasoRecibido, 'Material recibido.');
});
