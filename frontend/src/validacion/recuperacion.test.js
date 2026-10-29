import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { validarRecuperacion, validarRestablecimiento } from './recuperacion.js';

// Email de exactamente `longitud` caracteres con un formato válido.
function emailDeLongitud(longitud) {
  const dominio = '@ejemplo.com';
  return 'a'.repeat(longitud - dominio.length) + dominio;
}

describe('validarRecuperacion (CA6)', () => {
  test('vacío o solo espacios → obligatorio', () => {
    assert.deepEqual(validarRecuperacion({ email: '' }), { email: 'El email es obligatorio.' });
    assert.deepEqual(validarRecuperacion({ email: '   ' }), { email: 'El email es obligatorio.' });
  });

  test('centro@ejemplo → no válido', () => {
    assert.deepEqual(validarRecuperacion({ email: 'centro@ejemplo' }), { email: 'El email no es válido.' });
  });

  test('254 caracteres se acepta; 255 se rechaza', () => {
    assert.deepEqual(validarRecuperacion({ email: emailDeLongitud(254) }), {});
    assert.deepEqual(validarRecuperacion({ email: emailDeLongitud(255) }), { email: 'El email no es válido.' });
  });

  test('CA25: se recortan los espacios antes de validar', () => {
    assert.deepEqual(validarRecuperacion({ email: '  Piscina@ClubNatacio.CAT ' }), {});
  });
});

describe('validarRestablecimiento (CA7, CA8)', () => {
  const valida = (password) => validarRestablecimiento({ password, password_repetida: password });

  test('vacía → obligatoria', () => {
    assert.deepEqual(valida(''), { password: 'La contraseña es obligatoria.' });
  });

  test('8 caracteres se aceptan; 7 se rechazan', () => {
    assert.deepEqual(valida('abcdefg1'), {});
    assert.deepEqual(valida('abcdefg'), { password: 'La contraseña debe tener al menos 8 caracteres.' });
  });

  test('72 bytes se aceptan; 73 se rechazan (cuenta bytes, no caracteres)', () => {
    assert.deepEqual(valida('a'.repeat(72)), {});
    assert.deepEqual(valida('a'.repeat(73)), { password: 'La contraseña es demasiado larga.' });
    // «ñ» ocupa 2 bytes: 36 «ñ» = 72 bytes; 36 «ñ» + «a» = 73 bytes.
    assert.deepEqual(valida('ñ'.repeat(36)), {});
    assert.deepEqual(valida('ñ'.repeat(36) + 'a'), { password: 'La contraseña es demasiado larga.' });
  });

  test('no se recortan los espacios de la contraseña', () => {
    assert.deepEqual(valida('  abcd  '), {});
    assert.deepEqual(
      validarRestablecimiento({ password: ' abcdefg1 ', password_repetida: 'abcdefg1' }),
      { password_repetida: 'Las contraseñas no coinciden.' },
    );
  });

  test('E2E-4: abc / abc → solo el error de longitud', () => {
    assert.deepEqual(valida('abc'), { password: 'La contraseña debe tener al menos 8 caracteres.' });
  });

  test('E2E-4: Natacio2026! / Natacio2026? → no coinciden', () => {
    assert.deepEqual(
      validarRestablecimiento({ password: 'Natacio2026!', password_repetida: 'Natacio2026?' }),
      { password_repetida: 'Las contraseñas no coinciden.' },
    );
  });

  test('repetición vacía con contraseña escrita → no coinciden', () => {
    assert.deepEqual(
      validarRestablecimiento({ password: 'Natacio2026!', password_repetida: '' }),
      { password_repetida: 'Las contraseñas no coinciden.' },
    );
  });
});
