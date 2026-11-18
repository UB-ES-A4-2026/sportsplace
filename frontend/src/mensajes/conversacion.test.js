import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MENSAJE_ERROR_GENERICO } from '../auth/recuperacion.js';
import {
  anuncioAdmiteConversacion,
  bandaDeEstado,
  conMensajesAnteriores,
  conMensajesNuevos,
  contador,
  destinoDeEscribir,
  esAtajoDeEnvio,
  fotoPrincipal,
  otroCentro,
  precioDeCabecera,
  puedeEnviar,
  resultadoDelFallo,
  TEXTOS,
  textoDeAyuda,
  tituloConEnlace,
  ultimoId,
} from './conversacion.js';

describe('cuadro de texto (CA7-CA10, CA13)', () => {
  test('CA7-CA8: vacío o solo espacios no se envía; 1 carácter sí', () => {
    assert.equal(puedeEnviar(''), false);
    assert.equal(puedeEnviar('   \n  '), false);
    assert.equal(puedeEnviar(' a '), true);
    assert.equal(puedeEnviar('Hola\n¿Seguís teniendo los balones?'), true);
  });

  test('CA9: 2000 caracteres valen; 2001 no', () => {
    assert.equal(puedeEnviar('a'.repeat(2000)), true);
    assert.equal(puedeEnviar('a'.repeat(2001)), false);
    assert.equal(puedeEnviar(`  ${'a'.repeat(2000)}  `), true);
  });

  test('CA10: «n/2000», en rojo a partir de 1900', () => {
    assert.deepEqual(contador(''), { texto: '0/2000', alerta: false });
    assert.deepEqual(contador('a'.repeat(1899)), { texto: '1899/2000', alerta: false });
    assert.deepEqual(contador('a'.repeat(1900)), { texto: '1900/2000', alerta: true });
    assert.deepEqual(contador('a'.repeat(2000)), { texto: '2000/2000', alerta: true });
  });

  test('CA13: Ctrl+Enter y Cmd+Enter envían; Enter solo, no', () => {
    assert.equal(esAtajoDeEnvio({ key: 'Enter', ctrlKey: true }), true);
    assert.equal(esAtajoDeEnvio({ key: 'Enter', metaKey: true }), true);
    assert.equal(esAtajoDeEnvio({ key: 'Enter' }), false);
    assert.equal(esAtajoDeEnvio({ key: 'a', ctrlKey: true }), false);
  });
});

describe('navegación (CA3, CA5)', () => {
  test('CA3: sin conversación → nueva; con ella → su hilo', () => {
    assert.equal(destinoDeEscribir(null, 'a 1'), '/mensajes/nueva?anuncio=a%201');
    assert.equal(destinoDeEscribir({ id: 'c1' }, 'a1'), '/mensajes/c1');
  });

  test('CA5: solo anuncios de otro centro, activos o reservados', () => {
    assert.equal(anuncioAdmiteConversacion({ estado: 'activo', es_propio: false }), true);
    assert.equal(anuncioAdmiteConversacion({ estado: 'reservado', es_propio: false }), true);
    assert.equal(anuncioAdmiteConversacion({ estado: 'activo', es_propio: true }), false);
    for (const estado of ['pausado', 'entregado', 'retirado']) {
      assert.equal(anuncioAdmiteConversacion({ estado, es_propio: false }), false, estado);
    }
    assert.equal(anuncioAdmiteConversacion(null), false);
  });
});

describe('cabecera y bandas (CA33-CA35)', () => {
  test('precio: «12,00 € / unidad» o «Donación»', () => {
    assert.equal(precioDeCabecera({ modalidad: 'venta', precio_unitario_centimos: 1200 }), '12,00 € / unidad');
    assert.equal(precioDeCabecera({ modalidad: 'donacion', precio_unitario_centimos: null }), 'Donación');
  });

  test('foto principal: la de la conversación o la principal del detalle', () => {
    assert.equal(fotoPrincipal({ foto_principal_url: 'https://x/1.jpg' }), 'https://x/1.jpg');
    assert.equal(fotoPrincipal({ fotos: [{ url: 'b', orden: 1, es_principal: false }, { url: 'p', orden: 2, es_principal: true }] }), 'p');
    assert.equal(fotoPrincipal({ fotos: [] }), null);
  });

  test('CA33 y CA34: banda según el estado del anuncio', () => {
    assert.equal(bandaDeEstado('activo'), null);
    assert.equal(bandaDeEstado('reservado'), null);
    assert.equal(bandaDeEstado('pausado'), 'Este anuncio ya no está disponible en el catálogo.');
    assert.equal(bandaDeEstado('entregado'), 'Este anuncio ya no está disponible en el catálogo.');
    assert.equal(bandaDeEstado('retirado'), 'El vendedor ha retirado este anuncio.');
    assert.equal(tituloConEnlace('retirado'), false);
    assert.equal(tituloConEnlace('pausado'), true);
  });

  test('CA35: el otro centro eliminado se ve como «Centro eliminado» sin enlace', () => {
    assert.deepEqual(otroCentro({ id: 'c2', nombre: 'Club Natació Sabadell', eliminado: false }),
      { nombre: 'Club Natació Sabadell', enlace: '/centros/c2' });
    assert.deepEqual(otroCentro({ id: 'c2', nombre: 'Club Natació Sabadell', eliminado: true }),
      { nombre: 'Centro eliminado', enlace: null });
  });

  test('texto de ayuda de /mensajes/nueva', () => {
    assert.equal(textoDeAyuda('Club Natació Sabadell'),
      'Escribe tu pregunta a Club Natació Sabadell. Solo vosotros dos veréis esta conversación.');
  });
});

describe('errores al enviar (CA17, CA18, CA21, CA26, CA35)', () => {
  const fallo = (code, details) => ({ code, details });

  test('CONVERSACION_YA_EXISTE → se va a esa conversación', () => {
    assert.deepEqual(resultadoDelFallo(fallo('CONVERSACION_YA_EXISTE', { conversacion_id: 'c9' })), { ir: '/mensajes/c9' });
  });

  test('códigos conocidos → su aviso rojo', () => {
    assert.deepEqual(resultadoDelFallo(fallo('ANUNCIO_NO_DISPONIBLE')), { aviso: 'Este anuncio ya no está disponible.' });
    assert.deepEqual(resultadoDelFallo(fallo('ANUNCIO_PROPIO')), { aviso: 'No puedes escribirte sobre tu propio anuncio.' });
    assert.deepEqual(resultadoDelFallo(fallo('DEMASIADOS_INTENTOS')),
      { aviso: 'Has enviado demasiados mensajes seguidos. Espera un minuto.' });
    assert.deepEqual(resultadoDelFallo(fallo('CENTRO_ELIMINADO')), { aviso: TEXTOS.sinEscribir });
    assert.deepEqual(resultadoDelFallo(fallo('DATOS_INVALIDOS', { texto: 'Escribe un mensaje.' })), { aviso: 'Escribe un mensaje.' });
  });

  test('CA17: red, 500 o 503 → aviso genérico', () => {
    for (const code of ['SIN_CONEXION', 'ERROR_INTERNO', 'BASE_DATOS_NO_DISPONIBLE', undefined]) {
      assert.deepEqual(resultadoDelFallo(fallo(code)), { aviso: MENSAJE_ERROR_GENERICO }, String(code));
    }
  });
});

describe('hilo (CA12, CA14)', () => {
  const m = (id) => ({ id, texto: id });

  test('los nuevos se añaden al final sin repetir', () => {
    assert.deepEqual(conMensajesNuevos([m('1'), m('2')], [m('2'), m('3')]).map((x) => x.id), ['1', '2', '3']);
  });

  test('los anteriores se ponen delante sin repetir', () => {
    assert.deepEqual(conMensajesAnteriores([m('3'), m('4')], [m('1'), m('2'), m('3')]).map((x) => x.id), ['1', '2', '3', '4']);
  });

  test('CA14: el sondeo usa el último id; sin mensajes, null', () => {
    assert.equal(ultimoId([m('1'), m('2')]), '2');
    assert.equal(ultimoId([]), null);
  });
});
