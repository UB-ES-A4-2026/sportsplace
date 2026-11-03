import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import { DIALOGO_DESCARTAR, MENSAJE_ERROR_GENERICO, resultadoDelGuardado, TEXTOS_PERFIL } from './perfil.js';

describe('textos de US-07', () => {
  test('pantallas, CA4, CA5, CA16 y CA24 exactos', () => {
    assert.equal(TEXTOS_PERFIL.sinDescripcion, 'Todavía no has escrito una descripción.');
    assert.equal(TEXTOS_PERFIL.sinDato, '—');
    assert.equal(TEXTOS_PERFIL.actualizado, 'Perfil actualizado.');
    assert.deepEqual(DIALOGO_DESCARTAR, {
      titulo: '¿Descartar cambios?',
      texto: 'Los cambios que has hecho no se guardarán.',
      confirmar: 'Descartar',
      cancelar: 'Cancelar',
    });
    assert.equal(MENSAJE_ERROR_GENERICO, 'No se ha podido completar la acción. Inténtalo de nuevo.');
  });
});

describe('resultadoDelGuardado', () => {
  test('CA11: 400 DATOS_INVALIDOS → cada mensaje bajo su campo (solo los del formulario)', () => {
    const fallo = new ErrorApi(400, {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los datos del formulario.',
      details: { web: 'La web no es válida.', localidad: 'Este campo no se puede modificar.' },
    });
    assert.deepEqual(resultadoDelGuardado(fallo), { errores: { web: 'La web no es válida.' } });
  });

  test('CA23: 403 EMAIL_NO_CONFIRMADO → el aviso de US-02 (mensaje de la API)', () => {
    const mensaje = 'Confirma tu email con el enlace que te hemos enviado antes de continuar.';
    assert.deepEqual(resultadoDelGuardado(new ErrorApi(403, { code: 'EMAIL_NO_CONFIRMADO', message: mensaje })), { mensaje });
  });

  test('CA16: red caída, 500, 503 y 400 sin campos del formulario → aviso genérico', () => {
    for (const fallo of [
      new ErrorApi(0, { code: 'SIN_CONEXION', message: 'x' }),
      new ErrorApi(500, { code: 'ERROR_INTERNO', message: 'x' }),
      new ErrorApi(503, { code: 'BASE_DATOS_NO_DISPONIBLE', message: 'x' }),
      new ErrorApi(400, { code: 'JSON_INVALIDO', message: 'x' }),
    ]) {
      assert.deepEqual(resultadoDelGuardado(fallo), { mensaje: MENSAJE_ERROR_GENERICO });
    }
  });
});
