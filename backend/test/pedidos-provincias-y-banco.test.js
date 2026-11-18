import assert from 'node:assert/strict';
import test from 'node:test';
import { PROVINCIA_POR_PREFIJO, PROVINCIAS } from '../../shared/provincias.js';
import { validarEntregaPedido } from '../src/validation/entrega-pedido.js';
import { validarMetodoPago, validarPedido } from '../src/validation/pedidos.js';

const anuncioId = '2ae56a32-c1c9-4cd1-b6e4-68361bf43aa5';
const direccion = {
  destinatario: 'Marta Puig',
  calle_numero: 'Carrer de Sants 10',
  piso_puerta: '',
  codigo_postal: '08014',
  localidad: 'Barcelona',
  provincia: 'Barcelona',
  telefono_contacto: '612345678',
  indicaciones: '',
};
const DATOS_BANCARIOS = { iban: 'ES9121000418450200051332', datos_bancarios: 'ES91 2100 0418', titular_cuenta: 'CN Gràcia' };

test('US-40 CA9: la lista fija tiene las 52 provincias, una por prefijo 01-52 y en orden alfabético', () => {
  assert.equal(PROVINCIAS.length, 52);
  assert.equal(new Set(PROVINCIAS).size, 52);
  const prefijos = Object.keys(PROVINCIA_POR_PREFIJO).sort();
  assert.deepEqual(prefijos, Array.from({ length: 52 }, (_, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual([...PROVINCIAS].sort((a, b) => a.localeCompare(b, 'es')), PROVINCIAS);
  assert.equal(PROVINCIAS[0], 'A Coruña');
  assert.equal(PROVINCIAS.at(-1), 'Zaragoza');
  for (const nombre of ['Álava', 'Ceuta', 'Melilla', 'Las Palmas', 'Santa Cruz de Tenerife']) {
    assert.ok(PROVINCIAS.includes(nombre), nombre);
  }
});

test('US-40 CA9: una provincia fuera de la lista se rechaza con «Elige una provincia.»', () => {
  for (const provincia of ['Catalunya', 'barcelona', '', 'Gibraltar']) {
    assert.throws(
      () => validarEntregaPedido({ metodo_entrega: 'envio', direccion_envio: { ...direccion, provincia } }),
      { status: 400, details: { 'direccion_envio.provincia': 'Elige una provincia.' } },
    );
  }
  for (const provincia of ['Ceuta', 'Melilla']) {
    const codigo_postal = provincia === 'Ceuta' ? '51001' : '52001';
    const { direccion_envio: guardada } = validarEntregaPedido({
      metodo_entrega: 'envio', direccion_envio: { ...direccion, provincia, codigo_postal },
    });
    assert.equal(guardada.provincia, provincia);
  }
});

test('US-35 CA9: los datos bancarios del cuerpo no llegan al pedido ni a la dirección de envío', () => {
  const pedido = validarPedido({ anuncio_id: anuncioId, unidades: 2, metodo_pago: 'transferencia', ...DATOS_BANCARIOS });
  assert.deepEqual(Object.keys(pedido).sort(), ['anuncio_id', 'mensaje', 'metodo_pago', 'unidades']);
  assert.equal(validarMetodoPago(pedido, 'venta'), 'transferencia');

  const { direccion_envio: guardada } = validarEntregaPedido({
    metodo_entrega: 'envio', direccion_envio: { ...direccion, ...DATOS_BANCARIOS },
  });
  for (const clave of Object.keys(DATOS_BANCARIOS)) assert.equal(Object.hasOwn(guardada, clave), false, clave);
});

test('US-35 CA9: la forma de pago solo admite el método, nunca un número de cuenta', () => {
  for (const metodo_pago of ['ES9121000418450200051332', { iban: 'ES91' }, 'transferencia ES91']) {
    assert.throws(() => validarMetodoPago({ metodo_pago }, 'venta'), {
      status: 400, details: { metodo_pago: 'Elige una forma de pago.' },
    });
  }
});
