import assert from 'node:assert/strict';
import test from 'node:test';
import { aPedido } from '../src/services/serializar-pedido.js';
import {
  ACCIONES_PEDIDO, accionesPermitidas, comprobarTransicion, papelEn,
} from '../src/services/transiciones-pedido.js';

// US-108 (T32-3): `accionesPermitidas` y el serializador `pedido` de E06.
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';
const SABADELL = 'c0000000-0000-4000-8000-000000000003';

const comprador = {
  id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona', email: 'gracia@example.com', telefono: '931112233',
};
const vendedor = {
  id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona', email: 'lescorts@example.com', telefono: '934445566',
};
const anuncio = { id: 'a1', estado: 'activo', unidades_disponibles: 12, foto_principal_url: 'https://x/a1.jpg' };

// Pedido de E2E-1 de US-32: 4 balones de A1 a 8,50 €.
function fila(cambios = {}) {
  return {
    id: '9d3c2b1a-0000-4000-8000-000000000099',
    anuncio_id: 'a1',
    comprador_centro_id: GRACIA,
    vendedor_centro_id: LES_CORTS,
    titulo_anuncio: 'Balones de baloncesto talla 7',
    unidades: 4,
    modalidad: 'venta',
    precio_unitario_centimos: 850,
    total_centimos: 3400,
    metodo_pago: 'transferencia',
    mensaje: 'Los necesitamos para el torneo de junio.',
    estado: 'pendiente',
    creado_en: '2026-10-21T08:30:00+00:00',
    actualizado_en: '2026-10-21T08:30:00+00:00',
    ...cambios,
  };
}

const pedidoDe = (cambios, centroId, anuncioCambios = {}) => aPedido(
  { fila: fila(cambios), anuncio: { ...anuncio, ...anuncioCambios }, comprador, vendedor },
  centroId,
);

test('CA10: el objeto pedido tiene la forma de la base común de E06', () => {
  assert.deepEqual(pedidoDe({}, GRACIA), {
    id: '9d3c2b1a-0000-4000-8000-000000000099',
    anuncio: {
      id: 'a1', titulo: 'Balones de baloncesto talla 7', foto_principal_url: 'https://x/a1.jpg', estado: 'activo', unidades_disponibles: 12,
    },
    comprador: { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' },
    vendedor: { id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' },
    mi_papel: 'comprador',
    unidades: 4,
    modalidad: 'venta',
    precio_unitario_centimos: 850,
    total_centimos: 3400,
    metodo_pago: 'transferencia',
    metodo_entrega: null,
    entrega: { metodo: null, direccion_envio: null, direccion_recogida: null },
    mensaje: 'Los necesitamos para el torneo de junio.',
    estado: 'pendiente',
    motivo_codigo: null,
    motivo_texto: null,
    cerrado_por: null,
    pagado_en: null,
    creado_en: '2026-10-21T08:30:00.000Z',
    respondido_en: null,
    cancelado_en: null,
    acciones: [],
  });
});

test('CA10: mi_papel es vendedor para el centro que publicó el anuncio', () => {
  assert.equal(pedidoDe({}, LES_CORTS).mi_papel, 'vendedor');
});

test('CA7 y CA12: sin email ni teléfono del otro centro mientras no está aceptado o recibido', () => {
  for (const estado of ['pendiente', 'rechazado', 'cancelado']) {
    const pedido = pedidoDe({ estado }, GRACIA);
    assert.equal('email' in pedido.vendedor, false, estado);
    assert.equal('telefono' in pedido.vendedor, false, estado);
    assert.equal('email' in pedido.comprador, false, estado);
  }
});

test('CA7 y CA12: con el pedido aceptado o recibido vienen el email y el teléfono', () => {
  for (const estado of ['aceptado', 'recibido']) {
    const pedido = pedidoDe({ estado }, GRACIA);
    assert.equal(pedido.vendedor.email, 'lescorts@example.com', estado);
    assert.equal(pedido.vendedor.telefono, '934445566', estado);
    assert.equal(pedido.comprador.email, 'gracia@example.com', estado);
  }
});

test('donación: precio null y total 0 tal como vienen de la fila', () => {
  const pedido = pedidoDe({ modalidad: 'donacion', precio_unitario_centimos: null, total_centimos: 0, metodo_pago: null }, GRACIA);
  assert.equal(pedido.precio_unitario_centimos, null);
  assert.equal(pedido.total_centimos, 0);
  assert.equal(pedido.metodo_pago, null);
});

test('las columnas de historias posteriores se serializan cuando existen', () => {
  const pedido = pedidoDe({
    estado: 'rechazado', motivo_codigo: 'otro', motivo_texto: 'No hacemos envíos.', cerrado_por: 'vendedor',
    respondido_en: '2026-10-22T10:00:00Z',
  }, GRACIA);
  assert.equal(pedido.motivo_codigo, 'otro');
  assert.equal(pedido.cerrado_por, 'vendedor');
  assert.equal(pedido.respondido_en, '2026-10-22T10:00:00.000Z');
});

test('papelEn: un tercero no es parte del pedido', () => {
  const pedido = pedidoDe({}, GRACIA);
  assert.equal(papelEn(pedido, SABADELL), null);
  assert.equal(papelEn(pedido, null), null);
});

test('CA13: el vendedor puede aceptar y rechazar un pedido pendiente; el comprador, nada todavía', () => {
  assert.deepEqual(pedidoDe({}, LES_CORTS).acciones, ['aceptar', 'rechazar']);
  assert.deepEqual(pedidoDe({}, GRACIA).acciones, []);
});

test('CA13: fuera de pendiente no hay aceptar ni rechazar', () => {
  for (const estado of ['aceptado', 'rechazado', 'cancelado', 'recibido']) {
    assert.deepEqual(pedidoDe({ estado }, LES_CORTS).acciones, [], estado);
  }
});

test('US-34 CA9: sin unidades suficientes en el anuncio no se ofrece aceptar', () => {
  assert.deepEqual(pedidoDe({ unidades: 13 }, LES_CORTS, { unidades_disponibles: 12 }).acciones, ['rechazar']);
  assert.deepEqual(pedidoDe({ unidades: 12 }, LES_CORTS, { unidades_disponibles: 12 }).acciones, ['aceptar', 'rechazar']);
});

test('accionesPermitidas de un tercero está vacía', () => {
  assert.deepEqual(accionesPermitidas(pedidoDe({}, LES_CORTS), SABADELL), []);
});

test('comprobarTransicion usa la misma tabla: 403 SIN_PERMISO y 409 TRANSICION_NO_PERMITIDA', () => {
  const pendiente = pedidoDe({}, LES_CORTS);
  assert.doesNotThrow(() => comprobarTransicion(pendiente, LES_CORTS, 'aceptar'));
  assert.throws(() => comprobarTransicion(pendiente, GRACIA, 'aceptar'), { status: 403, code: 'SIN_PERMISO' });
  const aceptado = pedidoDe({ estado: 'aceptado' }, LES_CORTS);
  assert.throws(
    () => comprobarTransicion(aceptado, LES_CORTS, 'rechazar'),
    { status: 409, code: 'TRANSICION_NO_PERMITIDA', details: { estado_actual: 'aceptado' } },
  );
  assert.throws(() => comprobarTransicion(pendiente, LES_CORTS, 'volar'), /desconocida/);
});

test('cada acción de la tabla es de un papel del pedido', () => {
  for (const regla of Object.values(ACCIONES_PEDIDO)) {
    assert.ok(['comprador', 'vendedor'].includes(regla.papel));
  }
});
