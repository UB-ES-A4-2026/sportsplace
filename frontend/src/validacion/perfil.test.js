import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cuerpoDelPerfil, hayCambios, validarPerfil, valoresDelCentro } from './perfil.js';

const VALIDOS = { nombre: 'Club Natació Exemple', descripcion: '', telefono: '', email_contacto: '', web: '' };
const error = (campo, valor) => validarPerfil({ ...VALIDOS, [campo]: valor })[campo];

describe('validarPerfil (CA6-CA10, mismos mensajes que la API)', () => {
  test('CA6: nombre obligatorio, 160 acepta, 161 rechaza', () => {
    assert.equal(error('nombre', ''), 'El nombre del centro es obligatorio.');
    assert.equal(error('nombre', '   '), 'El nombre del centro es obligatorio.');
    assert.equal(error('nombre', 'a'.repeat(160)), undefined);
    assert.equal(error('nombre', 'a'.repeat(161)), 'Como máximo 160 caracteres.');
  });

  test('CA7: descripción opcional, 1000 acepta (con saltos de línea), 1001 rechaza', () => {
    assert.equal(error('descripcion', ''), undefined);
    assert.equal(error('descripcion', 'a\n'.repeat(500)), undefined);
    assert.equal(error('descripcion', 'a'.repeat(1001)), 'Como máximo 1000 caracteres.');
  });

  test('CA8: teléfono', () => {
    assert.equal(error('telefono', '931234567'), undefined);
    assert.equal(error('telefono', '+34 931 234 567'), undefined);
    assert.equal(error('telefono', '93123456'), 'El teléfono no es válido.');
    assert.equal(error('telefono', '93-123-45-67'), 'El teléfono no es válido.');
    assert.equal(error('telefono', '93-123'), 'El teléfono no es válido.');
    assert.equal(error('telefono', '9'.repeat(30)), undefined);
    assert.equal(error('telefono', '9'.repeat(31)), 'Como máximo 30 caracteres.');
  });

  test('CA9: email de contacto', () => {
    assert.equal(error('email_contacto', 'material@clubnatacio.cat'), undefined);
    assert.equal(error('email_contacto', 'material@clubnatacio'), 'El email no es válido.');
  });

  test('CA10: web', () => {
    const base = 'https://clubnatacio.cat/';
    assert.equal(error('web', 'https://clubnatacio.cat'), undefined);
    assert.equal(error('web', 'clubnatacio.cat'), 'La web debe empezar por http:// o https://.');
    assert.equal(error('web', 'https://localhost'), 'La web no es válida.');
    assert.equal(error('web', base + 'a'.repeat(255 - base.length)), undefined);
    assert.equal(error('web', base + 'a'.repeat(256 - base.length)), 'Como máximo 255 caracteres.');
  });

  test('CA25: un emoji cuenta como 1 carácter', () => {
    assert.equal(error('nombre', '🏊'.repeat(160)), undefined);
    assert.equal(error('nombre', '🏊'.repeat(161)), 'Como máximo 160 caracteres.');
  });

  test('E2E-3: teléfono y web erróneos a la vez → los dos errores', () => {
    assert.deepEqual(validarPerfil({ ...VALIDOS, telefono: '93-123', web: 'clubnatacio.cat' }), {
      telefono: 'El teléfono no es válido.',
      web: 'La web debe empezar por http:// o https://.',
    });
  });
});

describe('valores, cambios y cuerpo del PATCH', () => {
  const centro = { nombre: 'Club', descripcion: null, telefono: '931234567', email_contacto: null, web: 'https://a.cat', localidad: 'Barcelona' };

  test('CA3: los null se muestran vacíos y solo se toman los campos editables', () => {
    assert.deepEqual(valoresDelCentro(centro),
      { nombre: 'Club', descripcion: '', telefono: '931234567', email_contacto: '', web: 'https://a.cat' });
  });

  test('CA13: sin cambios → false; cualquier cambio → true', () => {
    assert.equal(hayCambios(valoresDelCentro(centro), centro), false);
    assert.equal(hayCambios({ ...valoresDelCentro(centro), web: '' }, centro), true);
  });

  test('CA18 y CA24: se recortan los espacios y un opcional vacío o solo con espacios es null', () => {
    assert.deepEqual(cuerpoDelPerfil({ nombre: '  Club  ', descripcion: '   ', telefono: ' 931234567 ', email_contacto: '', web: '' }),
      { nombre: 'Club', descripcion: null, telefono: '931234567', email_contacto: null, web: null });
  });
});
