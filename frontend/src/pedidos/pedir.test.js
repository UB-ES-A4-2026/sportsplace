import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  TEXTOS, avisoEfectivoConEnvio, direccionInicial, errorDeUnidades, hayCambios, leerUnidades, normalizarTelefono, resultadoDelFallo,
  sePuedePedir, textoDisponibles, textoModalidad, textoTotal, validarPedido,
} from './pedir.js';

// Anuncios de ejemplo de E06: A1 en venta (8,50 €, 12 unidades) y A2 en donación (30 unidades).
const A1 = { id: 'a1', modalidad: 'venta', precio_unitario_centimos: 850, unidades_disponibles: 12, estado: 'activo' };
const A2 = { id: 'a2', modalidad: 'donacion', precio_unitario_centimos: null, unidades_disponibles: 30, estado: 'activo' };
const DIRECCION = {
  destinatario: 'Marta Puig', calle_numero: 'Carrer de Verdi 12', piso_puerta: '', codigo_postal: '08012',
  localidad: 'Barcelona', provincia: 'Barcelona', telefono_contacto: '612 345 678', indicaciones: 'Entrada por el pabellón',
};
const venta = (cambios = {}) => ({ unidades: '4', mensaje: '', metodoPago: 'transferencia', metodoEntrega: 'recogida', ...cambios });

describe('sePuedePedir (CA5)', () => {
  test('anuncio activo de otro centro', () => {
    assert.equal(sePuedePedir(A1), true);
  });

  test('propio, no activo o inexistente: no', () => {
    assert.equal(sePuedePedir({ ...A1, es_propio: true }), false);
    for (const estado of ['reservado', 'pausado', 'entregado', 'retirado']) assert.equal(sePuedePedir({ ...A1, estado }), false, estado);
    assert.equal(sePuedePedir(null), false);
  });
});

describe('tarjeta resumen', () => {
  test('«Venta · 8,50 € por unidad» o «Donación»', () => {
    assert.equal(textoModalidad(A1), 'Venta · 8,50 € por unidad');
    assert.equal(textoModalidad({ ...A1, precio_unitario_centimos: 123450 }), 'Venta · 1.234,50 € por unidad');
    assert.equal(textoModalidad(A2), 'Donación');
  });

  test('«Disponibles: 12»', () => {
    assert.equal(textoDisponibles(12), 'Disponibles: 12');
  });
});

describe('leerUnidades (CA7)', () => {
  test('1 y el máximo se aceptan', () => {
    assert.equal(leerUnidades('1', 12), 1);
    assert.equal(leerUnidades('12', 12), 12);
  });

  test('0, 13, decimales, negativos y vacío se rechazan', () => {
    for (const valor of ['0', '13', '2,5', '2.5', '-1', '', '  ', 'abc', null]) assert.equal(leerUnidades(valor, 12), null, String(valor));
  });

  test('el error lleva el máximo disponible', () => {
    assert.equal(errorDeUnidades(12), 'Indica entre 1 y 12 unidades.');
    assert.equal(errorDeUnidades(3), 'Indica entre 1 y 3 unidades.');
  });
});

describe('textoTotal (CA9)', () => {
  test('venta: unidades × precio', () => {
    assert.equal(textoTotal(A1, '4'), 'Total: 34,00 €');
    assert.equal(textoTotal({ ...A1, precio_unitario_centimos: 123450 }, '1'), 'Total: 1.234,50 €');
  });

  test('con unidades no válidas, 0', () => {
    assert.equal(textoTotal(A1, ''), 'Total: 0,00 €');
    assert.equal(textoTotal(A1, '2,5'), 'Total: 0,00 €');
  });

  test('donación: «Donación: sin coste»', () => {
    assert.equal(textoTotal(A2, '10'), 'Donación: sin coste');
  });
});

describe('normalizarTelefono (T32-8)', () => {
  test('quita el prefijo +34 o 0034', () => {
    assert.equal(normalizarTelefono('+34612345678'), '612345678');
    assert.equal(normalizarTelefono('0034612345678'), '612345678');
  });

  test('quita los espacios, con prefijo o sin él', () => {
    assert.equal(normalizarTelefono('+34 612 34 56 78'), '612345678');
    assert.equal(normalizarTelefono('612 345 678'), '612345678');
    assert.equal(normalizarTelefono(' 93 123 45 67 '), '931234567');
  });

  test('sin prefijo ni espacios, igual', () => {
    assert.equal(normalizarTelefono('612345678'), '612345678');
  });

  test('si no quedan 9 cifras, no quita el prefijo', () => {
    assert.equal(normalizarTelefono('+34 6123'), '+346123');
    assert.equal(normalizarTelefono('+44 20 7946 0958'), '+442079460958');
  });

  test('sin teléfono, vacío', () => {
    assert.equal(normalizarTelefono(null), '');
    assert.equal(normalizarTelefono(undefined), '');
    assert.equal(normalizarTelefono(''), '');
  });
});

describe('direccionInicial (US-40 CA3)', () => {
  test('rellena dirección, CP, localidad y teléfono del centro; persona y provincia, vacías', () => {
    const centro = { direccion: 'Carrer de Verdi 12', codigo_postal: '08012', localidad: 'Barcelona', telefono: '612345678' };
    assert.deepEqual(direccionInicial(centro), {
      destinatario: '', calle_numero: 'Carrer de Verdi 12', piso_puerta: '', codigo_postal: '08012',
      localidad: 'Barcelona', provincia: '', telefono_contacto: '612345678', indicaciones: '',
    });
  });

  test('sin datos del centro, todo vacío', () => {
    assert.deepEqual(Object.values(direccionInicial({ direccion: null, codigo_postal: null, localidad: null, telefono: null })), Array(8).fill(''));
  });
});

describe('avisoEfectivoConEnvio (US-35 CA8)', () => {
  test('solo con efectivo y envío', () => {
    assert.equal(avisoEfectivoConEnvio({ metodoPago: 'efectivo_recogida', metodoEntrega: 'envio' }), TEXTOS.efectivoConEnvio);
    assert.equal(avisoEfectivoConEnvio({ metodoPago: 'efectivo_recogida', metodoEntrega: 'recogida' }), null);
    assert.equal(avisoEfectivoConEnvio({ metodoPago: 'transferencia', metodoEntrega: 'envio' }), null);
  });
});

describe('validarPedido', () => {
  test('E2E-1: venta con recogida → cuerpo sin precio ni total (CA11)', () => {
    const { cuerpo } = validarPedido(A1, venta({ mensaje: '  Los necesitamos para el torneo de junio.  ' }));
    assert.deepEqual(cuerpo, {
      anuncio_id: 'a1', unidades: 4, mensaje: 'Los necesitamos para el torneo de junio.',
      metodo_pago: 'transferencia', metodo_entrega: 'recogida',
    });
  });

  test('E2E-2: donación sin forma de pago y con mensaje vacío', () => {
    const { cuerpo } = validarPedido(A2, { unidades: '10', mensaje: '   ', metodoEntrega: 'recogida' });
    assert.deepEqual(cuerpo, { anuncio_id: 'a2', unidades: 10, mensaje: '', metodo_entrega: 'recogida' });
  });

  test('E2E-3: 13 unidades y mensaje de 501 caracteres', () => {
    const { errores } = validarPedido(A1, venta({ unidades: '13', mensaje: 'x'.repeat(501) }));
    assert.equal(errores.unidades, 'Indica entre 1 y 12 unidades.');
    assert.equal(errores.mensaje, 'El mensaje no puede superar 500 caracteres.');
  });

  test('CA8: 500 caracteres (tras quitar espacios) se aceptan', () => {
    assert.ok(validarPedido(A1, venta({ mensaje: ` ${'x'.repeat(500)} ` })).cuerpo);
  });

  test('el máximo puede bajar tras un 409 (E2E-4)', () => {
    assert.equal(validarPedido(A1, venta(), 3).errores.unidades, 'Indica entre 1 y 3 unidades.');
  });

  test('US-35 CA2: en venta hay que elegir forma de pago; en donación no se pide', () => {
    assert.equal(validarPedido(A1, venta({ metodoPago: null })).errores.metodo_pago, 'Elige una forma de pago.');
    assert.equal(validarPedido(A2, { unidades: '1', metodoEntrega: 'recogida' }).errores, undefined);
  });

  test('US-40 CA1: hay que elegir cómo recibir el material', () => {
    assert.equal(validarPedido(A1, venta({ metodoEntrega: null })).errores.metodo_entrega, 'Elige cómo quieres recibir el material.');
  });

  test('US-40 E2E-1: envío con la dirección validada y el teléfono sin espacios', () => {
    const { cuerpo } = validarPedido(A1, venta({ metodoEntrega: 'envio', direccion: DIRECCION }));
    assert.deepEqual(cuerpo.direccion_envio, {
      destinatario: 'Marta Puig', calle_numero: 'Carrer de Verdi 12', piso_puerta: null, codigo_postal: '08012',
      localidad: 'Barcelona', provincia: 'Barcelona', telefono_contacto: '612345678', indicaciones: 'Entrada por el pabellón',
    });
    assert.equal(cuerpo.metodo_entrega, 'envio');
  });

  test('US-40 E2E-3: CP de otra provincia y teléfono no válido, con claves como las de la API', () => {
    const { errores } = validarPedido(A1, venta({
      metodoEntrega: 'envio', direccion: { ...DIRECCION, provincia: 'Girona', telefono_contacto: '512345678' },
    }));
    assert.equal(errores['direccion_envio.codigo_postal'], 'El código postal no corresponde a la provincia elegida.');
    assert.equal(errores['direccion_envio.telefono_contacto'], 'Introduce un teléfono español de 9 cifras.');
  });

  test('US-40 CA2: con recogida no se valida ni se envía la dirección', () => {
    const { cuerpo } = validarPedido(A1, venta({ direccion: { destinatario: '' } }));
    assert.equal('direccion_envio' in cuerpo, false);
  });
});

describe('hayCambios (CA6)', () => {
  test('detecta un campo cambiado', () => {
    const inicial = venta();
    assert.equal(hayCambios(inicial, { ...inicial }), false);
    assert.equal(hayCambios(inicial, { ...inicial, unidades: '5' }), true);
  });
});

describe('resultadoDelFallo', () => {
  test('400 DATOS_INVALIDOS: errores por campo de la API', () => {
    const fallo = { status: 400, code: 'DATOS_INVALIDOS', details: { metodo_pago: 'Elige una forma de pago.', 'direccion_envio.codigo_postal': 'x' } };
    assert.deepEqual(resultadoDelFallo(fallo, 'a1'), { errores: fallo.details });
  });

  test('E2E-4 · 409 UNIDADES_INSUFICIENTES: el texto bajo «Unidades» y el nuevo máximo', () => {
    const fallo = { status: 409, code: 'UNIDADES_INSUFICIENTES', message: 'Solo quedan 3 unidades disponibles.', details: { unidades_disponibles: 3 } };
    assert.deepEqual(resultadoDelFallo(fallo, 'a1'), { errores: { unidades: 'Solo quedan 3 unidades disponibles.' }, maximo: 3 });
  });

  test('CA22 · 409 PEDIDO_YA_PENDIENTE: va a ese pedido', () => {
    assert.deepEqual(resultadoDelFallo({ status: 409, code: 'PEDIDO_YA_PENDIENTE', details: { pedido_id: 'p1' } }, 'a1'), { irA: '/pedidos/p1' });
  });

  test('CA20 · 409 ANUNCIO_NO_DISPONIBLE: aviso y vuelta al anuncio', () => {
    assert.deepEqual(
      resultadoDelFallo({ status: 409, code: 'ANUNCIO_NO_DISPONIBLE', message: 'Este anuncio ya no está disponible.' }, 'a1'),
      { aviso: 'Este anuncio ya no está disponible.', irA: '/anuncios/a1' },
    );
  });

  test('404 y 403 PEDIDO_PROPIO: el anuncio no se puede pedir', () => {
    assert.deepEqual(resultadoDelFallo({ status: 404, code: 'NO_ENCONTRADO' }, 'a1'), { noDisponible: true });
    assert.deepEqual(resultadoDelFallo({ status: 403, code: 'PEDIDO_PROPIO' }, 'a1'), { noDisponible: true });
  });

  test('red, 500 o 503: aviso genérico', () => {
    for (const fallo of [{ status: 0, code: 'SIN_CONEXION' }, { status: 503 }, null]) {
      assert.deepEqual(resultadoDelFallo(fallo, 'a1'), { aviso: TEXTOS.errorGenerico });
    }
  });
});
