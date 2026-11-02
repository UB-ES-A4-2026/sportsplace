import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cuerpoDeUbicacion, validarUbicacion, valoresDeUbicacion } from './ubicacion.js';

const VALIDOS = { direccion: 'Carrer de la Piscina 12', codigo_postal: '08025', localidad: 'Barcelona' };
const error = (campo, valor) => validarUbicacion({ ...VALIDOS, [campo]: valor })[campo];

describe('validarUbicacion (CA3-CA6, mismos mensajes que la API)', () => {
  test('datos de la historia → sin errores', () => {
    assert.deepEqual(validarUbicacion(VALIDOS), {});
  });

  test('CA3: dirección opcional, 255 acepta, 256 rechaza', () => {
    assert.equal(error('direccion', ''), undefined);
    assert.equal(error('direccion', 'a'.repeat(255)), undefined);
    assert.equal(error('direccion', 'a'.repeat(256)), 'Como máximo 255 caracteres.');
  });

  test('CA4: código postal obligatorio, 5 cifras, entre 01000 y 52999', () => {
    assert.equal(error('codigo_postal', ''), 'El código postal es obligatorio.');
    assert.equal(error('codigo_postal', '   '), 'El código postal es obligatorio.');
    for (const valor of ['0802', '080251', '08O25']) {
      assert.equal(error('codigo_postal', valor), 'El código postal debe tener 5 cifras.', valor);
    }
    assert.equal(error('codigo_postal', '00999'), 'El código postal no es de España.');
    assert.equal(error('codigo_postal', '53000'), 'El código postal no es de España.');
    assert.equal(error('codigo_postal', '01000'), undefined);
    assert.equal(error('codigo_postal', '52999'), undefined);
    assert.equal(error('codigo_postal', ' 17001 '), undefined);
  });

  test('CA6: localidad obligatoria, 120 acepta, 121 rechaza', () => {
    assert.equal(error('localidad', ''), 'La localidad es obligatoria.');
    assert.equal(error('localidad', 'a'.repeat(120)), undefined);
    assert.equal(error('localidad', 'a'.repeat(121)), 'Como máximo 120 caracteres.');
  });
});

describe('valores y cuerpo del PUT', () => {
  test('CA1: los null se muestran vacíos', () => {
    assert.deepEqual(valoresDeUbicacion({ direccion: null, codigo_postal: null, localidad: 'Barcelona', provincia: null }),
      { direccion: '', codigo_postal: '', localidad: 'Barcelona' });
  });

  test('CA11: siempre los tres campos, recortados', () => {
    assert.deepEqual(cuerpoDeUbicacion({ direccion: '  ', codigo_postal: ' 17001 ', localidad: ' Girona ' }),
      { direccion: '', codigo_postal: '17001', localidad: 'Girona' });
  });
});
