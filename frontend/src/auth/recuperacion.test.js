import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import {
  AVISO_CONTRASENA_CAMBIADA,
  CONFIRMACION_ENVIO,
  esEnlaceDeRecuperacion,
  MENSAJE_DEMASIADOS_INTENTOS,
  MENSAJE_ERROR_GENERICO,
  resultadoDelFallo,
} from './recuperacion.js';

describe('textos de US-04', () => {
  test('CA5, CA16, CA17 y CA18 exactos', () => {
    assert.equal(AVISO_CONTRASENA_CAMBIADA, 'Contraseña cambiada. Ya puedes entrar con la nueva.');
    assert.equal(
      CONFIRMACION_ENVIO,
      'Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña. Caduca en 1 hora.',
    );
    assert.equal(MENSAJE_DEMASIADOS_INTENTOS, 'Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.');
    assert.equal(MENSAJE_ERROR_GENERICO, 'No se ha podido completar la acción. Inténtalo de nuevo.');
  });
});

describe('esEnlaceDeRecuperacion (CA4)', () => {
  test('token_hash y type=recovery → válido', () => {
    assert.equal(esEnlaceDeRecuperacion('abc123', 'recovery'), true);
  });

  test('sin token_hash o con otro type → no válido', () => {
    assert.equal(esEnlaceDeRecuperacion(null, 'recovery'), false);
    assert.equal(esEnlaceDeRecuperacion('', 'recovery'), false);
    assert.equal(esEnlaceDeRecuperacion('abc123', null), false);
    assert.equal(esEnlaceDeRecuperacion('abc123', 'email'), false);
  });
});

describe('resultadoDelFallo', () => {
  test('400 ENLACE_INVALIDO → variante «Enlace no válido»', () => {
    const fallo = new ErrorApi(400, { code: 'ENLACE_INVALIDO', message: 'El enlace…' });
    assert.deepEqual(resultadoDelFallo(fallo, ['password']), { enlaceInvalido: true });
  });

  test('400 DATOS_INVALIDOS con details.token_hash → variante «Enlace no válido»', () => {
    const fallo = new ErrorApi(400, {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: { token_hash: 'Falta el token del enlace.' },
    });
    assert.deepEqual(resultadoDelFallo(fallo, ['password']), { enlaceInvalido: true });
  });

  test('400 DATOS_INVALIDOS → cada mensaje bajo su campo', () => {
    const fallo = new ErrorApi(400, {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: { email: 'El email no es válido.' },
    });
    assert.deepEqual(resultadoDelFallo(fallo, ['email']), { errores: { email: 'El email no es válido.' } });
  });

  test('400 DATOS_INVALIDOS sin campos del formulario → aviso genérico', () => {
    const fallo = new ErrorApi(400, { code: 'DATOS_INVALIDOS', message: 'Revisa los campos marcados.', details: {} });
    assert.deepEqual(resultadoDelFallo(fallo, ['email']), { mensaje: MENSAJE_ERROR_GENERICO });
  });

  test('CA17: 429 → aviso de demasiados intentos (texto de la web, no el de la API)', () => {
    const fallo = new ErrorApi(429, {
      code: 'DEMASIADOS_INTENTOS',
      message: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    });
    assert.deepEqual(resultadoDelFallo(fallo, ['email']), { mensaje: MENSAJE_DEMASIADOS_INTENTOS });
  });

  test('CA18: red caída, 500 y 503 → aviso genérico', () => {
    for (const fallo of [
      new ErrorApi(0, { code: 'SIN_CONEXION', message: 'No se ha podido conectar con el servidor.' }),
      new ErrorApi(500, { code: 'ERROR_INTERNO', message: 'Error' }),
      new ErrorApi(503, { code: 'AUTH_NO_DISPONIBLE', message: 'Error' }),
      new ErrorApi(503),
    ]) {
      assert.deepEqual(resultadoDelFallo(fallo, ['password']), { mensaje: MENSAJE_ERROR_GENERICO });
    }
  });
});
