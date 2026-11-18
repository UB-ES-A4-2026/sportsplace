import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { conversacionDelAnuncio, crearConversacion, enviarMensaje, obtenerConversacion } from './mensajes.js';

function espia(respuesta) {
  const llamadas = [];
  const llamarApi = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    return respuesta;
  };
  return { llamadas, llamarApi };
}

describe('conversacionDelAnuncio (CA3, CA19)', () => {
  test('pide GET /anuncios/:id/conversacion y devuelve `conversacion` (o null)', async () => {
    const { llamadas, llamarApi } = espia({ conversacion: { id: 'c1' } });
    const controlador = new AbortController();
    assert.deepEqual(await conversacionDelAnuncio('a 1', { signal: controlador.signal }, llamarApi), { id: 'c1' });
    assert.equal(llamadas[0].ruta, '/anuncios/a%201/conversacion');
    assert.equal(llamadas[0].opciones.signal, controlador.signal);

    assert.equal(await conversacionDelAnuncio('a1', {}, espia({ conversacion: null }).llamarApi), null);
  });
});

describe('crearConversacion (CA20)', () => {
  test('POST /conversaciones con `anuncio_id` y `texto`; devuelve la respuesta entera', async () => {
    const respuesta = { conversacion: { id: 'c1' }, mensaje: { id: 'm1', texto: 'Hola' } };
    const { llamadas, llamarApi } = espia(respuesta);
    assert.deepEqual(await crearConversacion({ anuncioId: 'a1', texto: 'Hola' }, llamarApi), respuesta);
    assert.deepEqual(llamadas[0], { ruta: '/conversaciones', opciones: { method: 'POST', body: { anuncio_id: 'a1', texto: 'Hola' } } });
  });
});

describe('obtenerConversacion (CA14, CA22)', () => {
  test('sin opciones, sin parámetros; con `antes` o `despues`, en la consulta', async () => {
    const { llamadas, llamarApi } = espia({ conversacion: {}, mensajes: [], hay_anteriores: false });
    await obtenerConversacion('c1', {}, llamarApi);
    await obtenerConversacion('c1', { antes: 'm5' }, llamarApi);
    await obtenerConversacion('c1', { despues: 'm9' }, llamarApi);
    assert.deepEqual(llamadas.map((llamada) => llamada.ruta), [
      '/conversaciones/c1', '/conversaciones/c1?antes=m5', '/conversaciones/c1?despues=m9',
    ]);
  });
});

describe('enviarMensaje (CA12, CA25)', () => {
  test('POST /conversaciones/:id/mensajes con `texto` y devuelve el `mensaje`', async () => {
    const { llamadas, llamarApi } = espia({ mensaje: { id: 'm2', texto: '¿Seguro?' } });
    assert.deepEqual(await enviarMensaje('c1', '¿Seguro?', llamarApi), { id: 'm2', texto: '¿Seguro?' });
    assert.deepEqual(llamadas[0], { ruta: '/conversaciones/c1/mensajes', opciones: { method: 'POST', body: { texto: '¿Seguro?' } } });
  });
});
