import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { actualizarMiCentro, guardarUbicacion, listarAnunciosDelCentro, obtenerCentro, obtenerMiCentro } from './centros.js';

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

describe('obtenerCentro (US-10 CA11)', () => {
  test('GET /centros/:id con el id codificado y devuelve el `centro`', async () => {
    const llamadas = [];
    const centro = { id: 'c 1', nombre: 'Club Natació Exemple', es_mio: false };
    const signal = new AbortController().signal;

    const resultado = await obtenerCentro('c 1', { signal }, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return { centro };
    });

    assert.deepEqual(llamadas, [{ ruta: '/centros/c%201', opciones: { signal } }]);
    assert.equal(resultado, centro);
  });
});

describe('listarAnunciosDelCentro (US-10 CA12)', () => {
  test('GET /centros/:id/anuncios?pagina=n y devuelve { anuncios, pagina, total }', async () => {
    const llamadas = [];
    const respuesta = { anuncios: [{ id: 'a1' }], pagina: 2, total: 21 };
    const signal = new AbortController().signal;

    const resultado = await listarAnunciosDelCentro('c1', { pagina: 2, signal }, async (ruta, opciones) => {
      llamadas.push({ ruta, opciones });
      return respuesta;
    });

    assert.deepEqual(llamadas, [{ ruta: '/centros/c1/anuncios?pagina=2', opciones: { signal } }]);
    assert.equal(resultado, respuesta);
  });

  test('sin página pide la 1', async () => {
    let ruta;
    await listarAnunciosDelCentro('c1', {}, async (r) => { ruta = r; return { anuncios: [], pagina: 1, total: 0 }; });
    assert.equal(ruta, '/centros/c1/anuncios?pagina=1');
  });
});
