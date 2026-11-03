import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import { MENSAJE_ERROR_GENERICO } from './perfil.js';
import { faltaCodigoPostal, resultadoDeLaUbicacion, textoDireccion, textoZona, TEXTOS_UBICACION } from './ubicacion.js';

describe('textos de US-68', () => {
  test('banda, botones, aviso y explicación exactos', () => {
    assert.deepEqual(TEXTOS_UBICACION, {
      banda: 'Indica tu código postal para que los demás centros sepan a qué distancia estás.',
      indicar: 'Indicar ubicación',
      editar: 'Editar ubicación',
      guardada: 'Ubicación guardada.',
      explicacion: 'Los demás centros solo verán tu localidad y tu provincia.',
    });
  });

  test('zona y dirección como en la historia', () => {
    const centro = { direccion: 'Carrer de la Piscina 12', codigo_postal: '08025', localidad: 'Barcelona', provincia: 'Barcelona' };
    assert.equal(textoZona(centro), 'Zona: Barcelona (Barcelona)');
    assert.equal(textoDireccion(centro), 'Dirección (solo la ves tú): Carrer de la Piscina 12, 08025 Barcelona');
  });

  test('CA19: sin dirección, solo el código postal y la localidad', () => {
    assert.equal(textoDireccion({ direccion: null, codigo_postal: '17001', localidad: 'Girona' }),
      'Dirección (solo la ves tú): 17001 Girona');
  });

  test('CA10: banda mientras no haya código postal', () => {
    assert.equal(faltaCodigoPostal({ codigo_postal: null }), true);
    assert.equal(faltaCodigoPostal({ codigo_postal: '08025' }), false);
  });
});

describe('resultadoDeLaUbicacion', () => {
  test('CA12: 400 DATOS_INVALIDOS → cada mensaje bajo su campo', () => {
    const fallo = new ErrorApi(400, { code: 'DATOS_INVALIDOS', message: 'x', details: { localidad: 'La localidad es obligatoria.' } });
    assert.deepEqual(resultadoDeLaUbicacion(fallo), { errores: { localidad: 'La localidad es obligatoria.' } });
  });

  test('CA5: 400 CODIGO_POSTAL_DESCONOCIDO → bajo el código postal', () => {
    const mensaje = 'No conocemos este código postal. Revísalo.';
    const fallo = new ErrorApi(400, { code: 'CODIGO_POSTAL_DESCONOCIDO', message: mensaje, details: { codigo_postal: mensaje } });
    assert.deepEqual(resultadoDeLaUbicacion(fallo), { errores: { codigo_postal: mensaje } });
  });

  test('403 EMAIL_NO_CONFIRMADO → el aviso de US-02', () => {
    const mensaje = 'Confirma tu email con el enlace que te hemos enviado antes de continuar.';
    assert.deepEqual(resultadoDeLaUbicacion(new ErrorApi(403, { code: 'EMAIL_NO_CONFIRMADO', message: mensaje })), { mensaje });
  });

  test('red, 500 y 503 → aviso genérico', () => {
    for (const fallo of [new ErrorApi(0, { code: 'SIN_CONEXION' }), new ErrorApi(500), new ErrorApi(503)]) {
      assert.deepEqual(resultadoDeLaUbicacion(fallo), { mensaje: MENSAJE_ERROR_GENERICO });
    }
  });
});
