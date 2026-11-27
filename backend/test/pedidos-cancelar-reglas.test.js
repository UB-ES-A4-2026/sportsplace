import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aPedido } from '../src/services/serializar-pedido.js';
import { comprobarTransicion } from '../src/services/transiciones-pedido.js';

// T39-1 (#408): US-39, la acción «cancelar» en la tabla de transiciones (CA1 y CA8).
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';
const PEDIDO = '9d3c2b1a-0000-4000-8000-000000000099';
const A1 = 'a0000000-0000-4000-8000-000000000001';
const PAGADO = 'No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.';
const comprador = { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona' };
const vendedor = { id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona' };
const anuncio = { id: A1, estado: 'activo', unidades_disponibles: 8 };

function fila(cambios = {}) {
  return {
    id: PEDIDO, titulo_anuncio: 'Balones de baloncesto talla 7', unidades: 4, modalidad: 'venta',
    precio_unitario_centimos: 850, total_centimos: 3400, metodo_pago: 'transferencia',
    metodo_entrega: 'recogida', mensaje: null, estado: 'pendiente', creado_en: '2026-10-21T08:30:00Z',
    ...cambios,
  };
}
const pedidoDe = (cambios, centroId) => aPedido({ fila: fila(cambios), anuncio, comprador, vendedor }, centroId);

test('US-39 CA1: cancelar para comprador y vendedor en pendiente o aceptado, sin cobrar ni incidencia', () => {
  for (const estado of ['pendiente', 'aceptado']) {
    assert.ok(pedidoDe({ estado }, GRACIA).acciones.includes('cancelar'), `comprador ${estado}`);
    assert.ok(pedidoDe({ estado }, LES_CORTS).acciones.includes('cancelar'), `vendedor ${estado}`);
  }
  for (const estado of ['rechazado', 'cancelado', 'recibido']) {
    assert.ok(!pedidoDe({ estado }, GRACIA).acciones.includes('cancelar'), estado);
  }
  assert.ok(!pedidoDe({ estado: 'aceptado', pagado_en: '2026-11-12T10:00:00Z' }, GRACIA).acciones.includes('cancelar'));
  assert.ok(!pedidoDe({ estado: 'aceptado', incidencia_abierta: true }, GRACIA).acciones.includes('cancelar'));
  // Es la última acción de la lista: el botón cierra la barra de acciones.
  assert.equal(pedidoDe({}, LES_CORTS).acciones.at(-1), 'cancelar');
});

test('US-39 CA8: comprobarTransicion da el error propio de cada caso', () => {
  const caso = (cambios) => ({ ...pedidoDe(cambios, GRACIA), incidencia_abierta: cambios.incidencia_abierta });
  for (const estado of ['rechazado', 'cancelado', 'recibido']) {
    assert.throws(() => comprobarTransicion(caso({ estado }), GRACIA, 'cancelar'), {
      status: 409, code: 'TRANSICION_NO_PERMITIDA', details: { estado_actual: estado },
    });
  }
  assert.throws(
    () => comprobarTransicion(caso({ estado: 'aceptado', pagado_en: '2026-11-12T10:00:00Z' }), LES_CORTS, 'cancelar'),
    { status: 409, code: 'PEDIDO_PAGADO', message: PAGADO },
  );
  assert.throws(
    () => comprobarTransicion(caso({ estado: 'aceptado', incidencia_abierta: true }), GRACIA, 'cancelar'),
    { status: 409, code: 'INCIDENCIA_ABIERTA' },
  );
  assert.doesNotThrow(() => comprobarTransicion(caso({}), GRACIA, 'cancelar'));
  assert.doesNotThrow(() => comprobarTransicion(caso({ estado: 'aceptado' }), LES_CORTS, 'cancelar'));
});

