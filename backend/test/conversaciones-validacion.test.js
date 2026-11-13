import assert from 'node:assert/strict';
import test from 'node:test';
import { validarCursor, validarMensaje, validarNuevaConversacion } from '../src/validation/mensajes.js';

// US-28 (CA7-CA9, CA20-CA22): texto del mensaje y parámetros de la conversación.
const ANUNCIO = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const VACIO = 'Escribe un mensaje.';
const LARGO = 'El mensaje no puede superar los 2000 caracteres.';

function detallesDe(funcion) {
  try {
    funcion();
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'DATOS_INVALIDOS');
    return error.details;
  }
  assert.fail('Tenía que rechazar los datos.');
}

test('CA7: recorta los extremos, conserva los saltos de línea y acepta 2000 caracteres', () => {
  assert.deepEqual(validarMensaje({ texto: '  Hola\n¿Seguís teniendo los balones?  ' }), {
    texto: 'Hola\n¿Seguís teniendo los balones?',
  });
  assert.equal(validarMensaje({ texto: ` ${'x'.repeat(2000)}\n` }).texto.length, 2000);
  // Un emoji cuenta como un carácter, como char_length en PostgreSQL.
  assert.equal(validarMensaje({ texto: '⚽'.repeat(2000) }).texto, '⚽'.repeat(2000));
  // CA15: el texto se guarda tal cual, sin interpretar HTML.
  assert.equal(validarMensaje({ texto: '<b>hola</b>' }).texto, '<b>hola</b>');
});

test('CA8: vacío, solo espacios, ausente o que no es texto → «Escribe un mensaje.»', () => {
  for (const cuerpo of [{ texto: '' }, { texto: '  \n\t ' }, {}, undefined, { texto: 42 }, { texto: null }]) {
    assert.deepEqual(detallesDe(() => validarMensaje(cuerpo)), { texto: VACIO });
  }
});

test('CA9: 2001 caracteres → «El mensaje no puede superar los 2000 caracteres.»', () => {
  assert.deepEqual(detallesDe(() => validarMensaje({ texto: 'x'.repeat(2001) })), { texto: LARGO });
});

test('CA20 y CA21: la nueva conversación exige un anuncio_id UUID y el texto', () => {
  assert.deepEqual(validarNuevaConversacion({ anuncio_id: ANUNCIO.toUpperCase(), texto: ' Hola ' }), {
    anuncioId: ANUNCIO,
    texto: 'Hola',
  });
  assert.deepEqual(detallesDe(() => validarNuevaConversacion({ anuncio_id: 'no-es-un-uuid', texto: 'Hola' })), {
    anuncio_id: 'El anuncio no es válido.',
  });
  assert.deepEqual(detallesDe(() => validarNuevaConversacion({ texto: '' })), {
    texto: VACIO,
    anuncio_id: 'El anuncio no es válido.',
  });
  assert.deepEqual(detallesDe(() => validarNuevaConversacion({ anuncio_id: ANUNCIO })), { texto: VACIO });
});

test('CA22: cursor antes o despues, nunca los dos, y siempre un UUID', () => {
  assert.deepEqual(validarCursor({}), {});
  assert.deepEqual(validarCursor({ antes: ANUNCIO }), { antes: ANUNCIO });
  assert.deepEqual(validarCursor({ despues: ANUNCIO.toUpperCase() }), { despues: ANUNCIO });
  assert.deepEqual(detallesDe(() => validarCursor({ antes: '12' })), { antes: 'El mensaje no es válido.' });
  assert.deepEqual(detallesDe(() => validarCursor({ despues: [ANUNCIO, ANUNCIO] })), { despues: 'El mensaje no es válido.' });
  assert.deepEqual(detallesDe(() => validarCursor({ antes: ANUNCIO, despues: ANUNCIO })), {
    antes: 'Usa solo «antes» o «despues».',
  });
});
