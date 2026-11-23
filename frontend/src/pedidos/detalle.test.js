import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import {
  anuncioRetirado,
  datosDeEntrega,
  datosDelOtroCentro,
  datosDelPedido,
  etiquetaDelEstado,
  fraseDeSituacion,
  historial,
  lineasDelHistorial,
  resultadoDeLaCarga,
  rutaDeVuelta,
  TEXTOS,
} from './detalle.js';

// E2E-1 de US-32 / US-108: Gràcia pide 4 balones de A1 (8,50 €) a Les Corts, por transferencia.
const PEDIDO = {
  id: 'p1',
  anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7', foto_principal_url: null, estado: 'activo' },
  comprador: { id: 'c1', nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
  vendedor: { id: 'c2', nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
  mi_papel: 'comprador',
  unidades: 4,
  modalidad: 'venta',
  precio_unitario_centimos: 850,
  total_centimos: 3400,
  metodo_pago: 'transferencia',
  mensaje: 'Los necesitamos para el torneo de junio.',
  estado: 'pendiente',
  cerrado_por: null,
  creado_en: '2026-10-21T08:30:00Z',
  respondido_en: null,
  cancelado_en: null,
  pagado_en: null,
  entrega: { metodo: 'recogida', direccion_envio: null, direccion_recogida: null },
};

describe('textos fijos (CA3, CA4)', () => {
  test('exactos', () => {
    assert.equal(TEXTOS.sinAcceso, 'Este pedido no existe o no tienes acceso.');
    assert.equal(TEXTOS.irAPedidos, 'Ir a pedidos');
    assert.equal(TEXTOS.volver, '← Volver a pedidos');
    assert.equal(TEXTOS.cargando, 'Cargando…');
    assert.equal(TEXTOS.error, 'No se ha podido cargar. ');
  });
});

test('CA2: «Volver a pedidos» según el papel', () => {
  assert.equal(rutaDeVuelta(PEDIDO), '/pedidos?pestana=realizados');
  assert.equal(rutaDeVuelta({ ...PEDIDO, mi_papel: 'vendedor' }), '/pedidos?pestana=recibidos');
});

test('etiquetas de estado de E06', () => {
  assert.deepEqual(etiquetaDelEstado('pendiente'), { texto: 'Pendiente', clase: 'etiqueta-amarilla' });
  assert.deepEqual(etiquetaDelEstado('aceptado').texto, 'Aceptado');
  assert.deepEqual(etiquetaDelEstado('rechazado').texto, 'Rechazado');
  assert.deepEqual(etiquetaDelEstado('cancelado').texto, 'Cancelado');
  assert.deepEqual(etiquetaDelEstado('recibido').texto, 'Recibido');
});

describe('fraseDeSituacion (CA5)', () => {
  test('pendiente según el papel', () => {
    assert.equal(fraseDeSituacion(PEDIDO), 'Esperando la respuesta de Club Esportiu Les Corts.');
    assert.equal(fraseDeSituacion({ ...PEDIDO, mi_papel: 'vendedor' }),
      'Escola de Bàsquet Gràcia te ha pedido este material. Acepta o rechaza el pedido.');
  });

  test('resto de estados', () => {
    assert.equal(fraseDeSituacion({ ...PEDIDO, estado: 'aceptado' }), 'Pedido aceptado. Acordad la entrega y el pago.');
    // T32-7: una donación aceptada no tiene pago que acordar.
    assert.equal(fraseDeSituacion({ ...PEDIDO, estado: 'aceptado', modalidad: 'donacion' }), 'Pedido aceptado. Acordad la entrega.');
    assert.equal(fraseDeSituacion({ ...PEDIDO, estado: 'rechazado' }), 'Club Esportiu Les Corts ha rechazado el pedido.');
    assert.equal(fraseDeSituacion({ ...PEDIDO, estado: 'cancelado', cerrado_por: 'comprador' }), 'Pedido cancelado por Escola de Bàsquet Gràcia.');
    assert.equal(fraseDeSituacion({ ...PEDIDO, estado: 'cancelado', cerrado_por: 'vendedor' }), 'Pedido cancelado por Club Esportiu Les Corts.');
    assert.equal(fraseDeSituacion({ ...PEDIDO, estado: 'recibido' }), 'Material recibido.'); // T32-7
  });
});

test('CA8: anuncio retirado', () => {
  assert.equal(anuncioRetirado(PEDIDO), false);
  assert.equal(anuncioRetirado({ ...PEDIDO, anuncio: { ...PEDIDO.anuncio, estado: 'retirado' } }), true);
});

describe('datosDelPedido (punto 5, CA6, US-35 CA6)', () => {
  test('venta: unidades, precio, total, forma de pago y mensaje', () => {
    assert.deepEqual(datosDelPedido(PEDIDO).map((f) => (f.etiqueta ? `${f.etiqueta}: ${f.valor}` : f.valor)), [
      'Unidades: 4',
      'Precio por unidad: 8,50 €',
      'Total: 34,00 €',
      'Forma de pago: Transferencia bancaria',
      'Mensaje del comprador: Los necesitamos para el torneo de junio.',
    ]);
  });

  test('miles con punto, efectivo y sin mensaje', () => {
    const filas = datosDelPedido({ ...PEDIDO, unidades: 10, precio_unitario_centimos: 12345, total_centimos: 123450, metodo_pago: 'efectivo_recogida', mensaje: null });
    assert.deepEqual(filas.map((f) => f.valor), ['10', '123,45 €', '1.234,50 €', 'Efectivo al recoger', 'Sin mensaje']);
  });

  test('donación: «Donación: sin coste» y sin forma de pago', () => {
    const filas = datosDelPedido({ ...PEDIDO, modalidad: 'donacion', precio_unitario_centimos: null, total_centimos: 0, metodo_pago: null });
    assert.deepEqual(filas.map((f) => f.valor), ['4', 'Donación: sin coste', 'Los necesitamos para el torneo de junio.']);
  });
});

describe('datosDelOtroCentro (punto 6, CA7)', () => {
  test('pendiente: solo nombre y localidad del vendedor', () => {
    assert.deepEqual(datosDelOtroCentro(PEDIDO), { titulo: 'Vendedor', lineas: ['Club Esportiu Les Corts', 'Barcelona'] });
  });

  test('aceptado: email y teléfono cuando la API los manda', () => {
    const pedido = { ...PEDIDO, estado: 'aceptado', mi_papel: 'vendedor', comprador: { ...PEDIDO.comprador, email: 'gracia@example.com', telefono: '612345678' } };
    assert.deepEqual(datosDelOtroCentro(pedido), {
      titulo: 'Comprador',
      lineas: ['Escola de Bàsquet Gràcia', 'Barcelona', 'Email: gracia@example.com', 'Teléfono: 612345678'],
    });
  });
});

describe('datosDeEntrega (US-40)', () => {
  const envio = {
    destinatario: 'Marta Puig', calle_numero: 'Carrer de Verdi 12', piso_puerta: null, codigo_postal: '08012',
    localidad: 'Barcelona', provincia: 'Barcelona', telefono_contacto: '612345678', indicaciones: 'Entrada por el pabellón',
  };

  test('envío: método según el papel y la dirección en 4 líneas más indicaciones', () => {
    const pedido = { ...PEDIDO, entrega: { metodo: 'envio', direccion_envio: envio, direccion_recogida: null } };
    assert.deepEqual(datosDeEntrega(pedido), {
      metodo: 'Método: Envío a tu dirección',
      lineas: ['Marta Puig', 'Carrer de Verdi 12', '08012 Barcelona (Barcelona)', '612345678', 'Indicaciones: Entrada por el pabellón'],
      aviso: null,
      escribir: false,
    });
    assert.equal(datosDeEntrega({ ...pedido, mi_papel: 'vendedor' }).metodo, 'Método: Envío a la dirección del comprador');
    assert.equal(datosDeEntrega({ ...pedido, entrega: { metodo: 'envio', direccion_envio: { ...envio, piso_puerta: '2º 1ª' } } }).lineas[1],
      'Carrer de Verdi 12, 2º 1ª');
  });

  test('recogida pendiente: el comprador espera; el vendedor solo ve el método (CA15)', () => {
    assert.deepEqual(datosDeEntrega(PEDIDO), {
      metodo: 'Método: Recogida en el centro vendedor', lineas: [], aviso: TEXTOS.esperaRecogida, escribir: false,
    });
    assert.deepEqual(datosDeEntrega({ ...PEDIDO, mi_papel: 'vendedor' }).aviso, null);
  });

  test('recogida aceptada: dirección del vendedor, o el aviso de CA14 con «Escribir al vendedor»', () => {
    const recogida = { direccion: "Carrer de l'Estadi 40", codigo_postal: '08038', localidad: 'Barcelona' };
    const conDireccion = { ...PEDIDO, estado: 'aceptado', entrega: { metodo: 'recogida', direccion_envio: null, direccion_recogida: recogida } };
    assert.deepEqual(datosDeEntrega(conDireccion).lineas, ["Dirección de recogida: Carrer de l'Estadi 40, 08038 Barcelona"]);
    const sinDireccion = datosDeEntrega({ ...PEDIDO, estado: 'aceptado' });
    assert.equal(sinDireccion.aviso, 'El vendedor aún no ha indicado su dirección. Escríbele para acordarla.');
    assert.equal(sinDireccion.escribir, true);
  });

  test('recogida rechazada o cancelada: solo el método', () => {
    for (const estado of ['rechazado', 'cancelado']) {
      assert.deepEqual(datosDeEntrega({ ...PEDIDO, estado }), {
        metodo: 'Método: Recogida en el centro vendedor', lineas: [], aviso: null, escribir: false,
      });
    }
  });
});

describe('historial (punto 8, CA6)', () => {
  test('pedido, aceptado y pagado con hora de Madrid', () => {
    const pedido = { ...PEDIDO, estado: 'aceptado', respondido_en: '2026-10-21T09:00:00Z', pagado_en: '2026-10-22T16:15:00Z' };
    assert.deepEqual(historial(pedido), [
      'Pedido el 21/10/2026 10:30',
      'Aceptado el 21/10/2026 11:00',
      'Marcado como pagado el 22/10/2026 18:15',
    ]);
  });

  test('rechazado y cancelado', () => {
    assert.deepEqual(historial({ ...PEDIDO, estado: 'rechazado', respondido_en: '2026-10-21T09:00:00Z' })[1], 'Rechazado el 21/10/2026 11:00');
    assert.deepEqual(historial({ ...PEDIDO, estado: 'cancelado', cancelado_en: '2026-10-21T09:00:00Z', cerrado_por: 'vendedor' })[1],
      'Cancelado el 21/10/2026 11:00 por vendedor');
  });

  test('cada línea con su tipo para el color del punto', () => {
    const pedido = { ...PEDIDO, estado: 'aceptado', respondido_en: '2026-10-21T09:00:00Z', pagado_en: '2026-10-22T16:15:00Z' };
    assert.deepEqual(lineasDelHistorial(pedido).map(({ tipo }) => tipo), ['pendiente', 'aceptado', 'pagado']);
    assert.deepEqual(lineasDelHistorial({ ...PEDIDO, estado: 'rechazado', respondido_en: '2026-10-21T09:00:00Z' }).map(({ tipo }) => tipo),
      ['pendiente', 'rechazado']);
    assert.deepEqual(lineasDelHistorial({ ...PEDIDO, estado: 'cancelado', cancelado_en: '2026-10-21T09:00:00Z' })[1],
      { tipo: 'cancelado', texto: 'Cancelado el 21/10/2026 11:00 por comprador' });
    assert.deepEqual(lineasDelHistorial({ ...PEDIDO, creado_en: null }), []);
  });
});

test('resultadoDeLaCarga (CA3, CA4)', () => {
  assert.deepEqual(resultadoDeLaCarga(new ErrorApi(404, { code: 'NO_ENCONTRADO' })), { noEncontrado: true });
  for (const status of [0, 500, 503]) assert.deepEqual(resultadoDeLaCarga(new ErrorApi(status)), { error: true });
});
