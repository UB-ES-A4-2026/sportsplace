import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { listarCatalogo } from './catalogo.js';

function espia(respuesta = { anuncios: [], pagina: 1, por_pagina: 20, total: 0, total_paginas: 0 }) {
  const llamadas = [];
  const llamarApi = async (ruta, opciones) => {
    llamadas.push({ ruta, opciones });
    return respuesta;
  };
  return { llamadas, llamarApi };
}

describe('listarCatalogo', () => {
  test('US-96 CA16: sin parámetros pide GET /catalogo y devuelve la respuesta tal cual', async () => {
    const respuesta = { anuncios: [{ id: 'a1' }], pagina: 1, por_pagina: 20, total: 1, total_paginas: 1 };
    const { llamadas, llamarApi } = espia(respuesta);
    assert.deepEqual(await listarCatalogo({}, {}, llamarApi), respuesta);
    assert.equal(llamadas[0].ruta, '/catalogo');
  });

  test('envía la búsqueda, los filtros y la página con los nombres de la URL', async () => {
    const { llamadas, llamarApi } = espia();
    await listarCatalogo({ q: 'balon futbol', categoria: 'balones', estado_material: 'nuevo,usado', pagina: '2' }, {}, llamarApi);
    assert.equal(llamadas[0].ruta, '/catalogo?q=balon+futbol&categoria=balones&estado_material=nuevo,usado&pagina=2');
  });

  test('pasa la señal para poder cancelar la petición al cambiar de página', async () => {
    const { llamadas, llamarApi } = espia();
    const control = new AbortController();
    await listarCatalogo({ pagina: '3' }, { signal: control.signal }, llamarApi);
    assert.equal(llamadas[0].opciones.signal, control.signal);
  });

  test('los errores de la API llegan a la pantalla (CA15)', async () => {
    const fallo = new Error('No disponible');
    await assert.rejects(listarCatalogo({}, {}, async () => { throw fallo; }), fallo);
  });
});
