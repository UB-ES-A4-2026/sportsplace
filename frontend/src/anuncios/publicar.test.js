import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import { MENSAJE_ERROR_GENERICO, resultadoDelEnvio } from './publicar.js';

describe('resultadoDelEnvio', () => {
  test('CA12: 400 DATOS_INVALIDOS → cada mensaje bajo su campo', () => {
    const fallo = new ErrorApi(400, {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: { titulo: 'El título no puede tener saltos de línea.', descripcion: 'La descripción es obligatoria.' },
    });
    assert.deepEqual(resultadoDelEnvio(fallo), {
      errores: { titulo: 'El título no puede tener saltos de línea.', descripcion: 'La descripción es obligatoria.' },
    });
  });

  test('400 sin campos del formulario → el mensaje de la API', () => {
    const fallo = new ErrorApi(400, { code: 'DATOS_INVALIDOS', message: 'Revisa los campos marcados.', details: {} });
    assert.deepEqual(resultadoDelEnvio(fallo), { mensaje: 'Revisa los campos marcados.' });
  });

  test('CA3: 403 EMAIL_NO_CONFIRMADO → aviso de US-02 (mensaje de la API)', () => {
    const mensaje = 'Confirma tu email con el enlace que te hemos enviado antes de continuar.';
    const fallo = new ErrorApi(403, { code: 'EMAIL_NO_CONFIRMADO', message: mensaje });
    assert.deepEqual(resultadoDelEnvio(fallo), { mensaje });
  });

  test('CA11: red caída, 500 y 503 → aviso genérico', () => {
    for (const fallo of [
      new ErrorApi(0, { code: 'SIN_CONEXION', message: 'No se ha podido conectar con el servidor.' }),
      new ErrorApi(500, { code: 'ERROR_INTERNO', message: 'Error' }),
      new ErrorApi(503, { code: 'BASE_DATOS_NO_DISPONIBLE', message: 'Error' }),
      new ErrorApi(503),
    ]) {
      assert.deepEqual(resultadoDelEnvio(fallo), { mensaje: MENSAJE_ERROR_GENERICO });
    }
    assert.equal(MENSAJE_ERROR_GENERICO, 'No se ha podido completar la acción. Inténtalo de nuevo.');
  });
});
