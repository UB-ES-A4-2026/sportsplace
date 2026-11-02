import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { actualizarMiCentro, guardarUbicacion, obtenerMiCentro } from './centros.js';

describe('obtenerMiCentro', () => {
  test('CA17: GET /centros/mio y devuelve el `centro`', async () => {
    const llamadas = [];
    const centro = { id: 'c1', nombre: 'Club Natació Exemple' };
    const signal = new AbortController().signal;

    const resultado = await obtenerMiCentro({ signal }, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { centro };
    });

    assert.deepEqual(llamadas, [{ ruta: '/centros/mio', opciones: { signal } }]);
    assert.equal(resultado, centro);
  });
});

describe('actualizarMiCentro', () => {
  test('CA18: PATCH /centros/mio con los cambios y devuelve el `centro` actualizado', async () => {
    const llamadas = [];
    const centro = { id: 'c1', web: null };
    const cambios = { web: null };

    const resultado = await actualizarMiCentro(cambios, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { centro };
    });

    assert.deepEqual(llamadas, [{ ruta: '/centros/mio', opciones: { method: 'PATCH', body: cambios } }]);
    assert.equal(resultado, centro);
  });
});

describe('guardarUbicacion', () => {
  test('US-68 CA11: PUT /centros/mio/ubicacion con los tres campos y devuelve el `centro`', async () => {
    const llamadas = [];
    const centro = { id: 'c1', provincia: 'Barcelona' };
    const ubicacion = { direccion: 'Carrer de la Piscina 12', codigo_postal: '08025', localidad: 'Barcelona' };

    const resultado = await guardarUbicacion(ubicacion, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { centro };
    });

    assert.deepEqual(llamadas, [{ ruta: '/centros/mio/ubicacion', opciones: { method: 'PUT', body: ubicacion } }]);
    assert.equal(resultado, centro);
  });
});
