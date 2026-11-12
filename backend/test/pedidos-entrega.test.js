import assert from 'node:assert/strict';
import test from 'node:test';
import { aPedido } from '../src/services/serializar-pedido.js';
import { validarEntregaPedido } from '../src/validation/entrega-pedido.js';

const direccionEnvio = {
  destinatario: 'Marta Puig',
  calle_numero: 'Carrer de Verdi 12',
  piso_puerta: null,
  codigo_postal: '08012',
  localidad: 'Barcelona',
  provincia: 'Barcelona',
  telefono_contacto: '612345678',
  indicaciones: null,
};
const envio = (cambios = {}) => ({
  metodo_entrega: 'envio',
  direccion_envio: { ...direccionEnvio, ...cambios },
});

function errorEntrega(cuerpo, campo, mensaje) {
  assert.throws(
    () => validarEntregaPedido(cuerpo),
    (error) => error.status === 400 && error.code === 'DATOS_INVALIDOS' && error.details[campo] === mensaje,
  );
}

test('US-40 CA1 y CA2: el método es obligatorio y la recogida ignora una dirección enviada', () => {
  errorEntrega({}, 'metodo_entrega', 'Elige cómo quieres recibir el material.');
  errorEntrega({ metodo_entrega: 'mensajero' }, 'metodo_entrega', 'Elige cómo quieres recibir el material.');
  assert.deepEqual(
    validarEntregaPedido({ metodo_entrega: 'recogida', direccion_envio: { destinatario: 123 } }),
    { metodo_entrega: 'recogida', direccion_envio: null },
  );
});

test('US-40 CA6, CA11 y CA19: un envío guarda los campos permitidos y normaliza espacios', () => {
  assert.deepEqual(
    validarEntregaPedido(envio({ piso_puerta: ' ', telefono_contacto: '612 345 678', coordenadas: [1, 2] })),
    { metodo_entrega: 'envio', direccion_envio: direccionEnvio },
  );
});

test('US-40 CA4-CA12: rangos, formato y mensajes de error por campo', () => {
  const casos = [
    ['destinatario', 'x', 'Indica la persona de contacto (entre 2 y 100 caracteres).'],
    ['calle_numero', '1234', 'Indica la calle y el número (entre 5 y 150 caracteres).'],
    ['piso_puerta', 'x'.repeat(51), 'Máximo 50 caracteres.'],
    ['codigo_postal', '53001', 'Introduce un código postal español de 5 cifras.'],
    ['localidad', 'x'.repeat(121), 'Indica la localidad (entre 2 y 120 caracteres).'],
    ['provincia', 'Barna', 'Elige una provincia.'],
    ['telefono_contacto', '512345678', 'Introduce un teléfono español de 9 cifras.'],
    ['indicaciones', 'x'.repeat(301), 'Máximo 300 caracteres.'],
  ];
  for (const [campo, valor, mensaje] of casos) {
    errorEntrega(envio({ [campo]: valor }), `direccion_envio.${campo}`, mensaje);
  }
  assert.equal(validarEntregaPedido(envio({ destinatario: '😀'.repeat(100) })).direccion_envio.destinatario.length, 200);
});

test('US-40 CA7, CA9 y CA10: el prefijo debe corresponder a la provincia', () => {
  errorEntrega(envio({ provincia: 'Girona' }), 'direccion_envio.codigo_postal',
    'El código postal no corresponde a la provincia elegida.');
  for (const [codigo_postal, provincia] of [['01001', 'Álava'], ['51001', 'Ceuta'], ['52001', 'Melilla']]) {
    assert.equal(validarEntregaPedido(envio({ codigo_postal, provincia })).direccion_envio.codigo_postal, codigo_postal);
  }
  errorEntrega({ metodo_entrega: 'envio' }, 'direccion_envio.destinatario',
    'Indica la persona de contacto (entre 2 y 100 caracteres).');
});

const comprador = { id: 'comprador', nombre: 'Comprador', localidad: 'Barcelona' };
const vendedor = {
  id: 'vendedor',
  nombre: 'Vendedor',
  localidad: 'Barcelona',
  direccion: "Carrer de l'Estadi 40",
  codigo_postal: '08038',
};
const anuncio = { id: 'anuncio', estado: 'activo', unidades_disponibles: 4 };

function pedidoDe(centroId, fila, centroVendedor = vendedor) {
  return aPedido({ fila, anuncio, comprador, vendedor: centroVendedor }, centroId);
}

test('US-40 CA14, CA15 y CA20: solo el comprador ve la recogida una vez aceptada', () => {
  const fila = { metodo_entrega: 'recogida' };
  for (const estado of ['pendiente', 'rechazado', 'cancelado']) {
    assert.equal(pedidoDe(comprador.id, { ...fila, estado }).entrega.direccion_recogida, null);
  }
  for (const estado of ['aceptado', 'recibido']) {
    const pedido = pedidoDe(comprador.id, { ...fila, estado });
    assert.deepEqual(pedido.entrega, {
      metodo: 'recogida',
      direccion_envio: null,
      direccion_recogida: { direccion: vendedor.direccion, codigo_postal: '08038', localidad: 'Barcelona' },
    });
    assert.equal('direccion' in pedido.vendedor, false);
    assert.equal(pedidoDe(vendedor.id, { ...fila, estado }).entrega.direccion_recogida, null);
  }
  assert.equal(pedidoDe(comprador.id, { ...fila, estado: 'aceptado' }, { ...vendedor, direccion: null })
    .entrega.direccion_recogida, null);
});

test('US-40 CA16: ambas partes ven la dirección de envío desde el estado pendiente', () => {
  const fila = { estado: 'pendiente', ...envio() };
  for (const centroId of [comprador.id, vendedor.id]) {
    assert.deepEqual(pedidoDe(centroId, fila).entrega, {
      metodo: 'envio', direccion_envio: direccionEnvio, direccion_recogida: null,
    });
  }
});
