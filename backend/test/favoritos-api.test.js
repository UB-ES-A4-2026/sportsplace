import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado, anuncioPropio, limiteFavoritos } from '../src/repositories/anuncios.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { startApi } from './helpers.js';

// T25-1 (#405): rutas de US-25 con un doble del repositorio.
const id = '6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10';
const usuarios = {
  comprador: { id: 'comprador', email_confirmado: true },
  pendiente: { id: 'pendiente', email_confirmado: false },
};
const auth = { getUser: async (token) => usuarios[token] ?? null };
const tarjeta = {
  id,
  titulo: 'Balones de fútbol talla 5',
  modalidad: 'venta',
  precio_unitario_centimos: 1250,
  estado: 'pausado',
  estado_material: 'buen_estado',
  unidades_disponibles: 12,
  foto_principal_url: null,
  publicado_en: '2026-11-08T10:00:00.000Z',
  centro: { id: 'centro-a', nombre: 'CE Montjuïc', localidad: 'Barcelona' },
  distancia_km: null,
  es_favorito: true,
  disponible: false,
};
let llamadas;
let fallo;
let api;
before(async () => {
  const registrar = (metodo) => async (usuarioId, argumento) => {
    llamadas.push({ metodo, usuarioId, argumento });
    if (fallo) throw fallo;
    if (metodo === 'listarFavoritos') {
      return { anuncios: [tarjeta], pagina: argumento.pagina, por_pagina: 20, total: 1, total_paginas: 1 };
    }
    return undefined;
  };
  api = await startApi({
    auth,
    anuncios: {
      guardarFavorito: registrar('guardarFavorito'),
      quitarFavorito: registrar('quitarFavorito'),
      listarFavoritos: registrar('listarFavoritos'),
    },
  });
});
after(() => api.close());
beforeEach(() => {
  llamadas = [];
  fallo = null;
});
const pedir = (ruta, { method = 'GET', token = 'comprador' } = {}) => fetch(`${api.baseUrl}/api/favoritos${ruta}`, {
  method,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

test('US-25 CA13: PUT guarda el favorito del centro de la sesión y responde 204 sin cuerpo', async () => {
  const response = await pedir(`/${id}`, { method: 'PUT' });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.deepEqual(llamadas, [{ metodo: 'guardarFavorito', usuarioId: 'comprador', argumento: id }]);
});

test('US-25 CA13: guardar dos veces el mismo anuncio no da error', async () => {
  for (let vez = 0; vez < 2; vez += 1) {
    assert.equal((await pedir(`/${id}`, { method: 'PUT' })).status, 204);
  }
  assert.equal(llamadas.length, 2);
});

test('US-25 CA13: DELETE responde 204 también si no estaba en favoritos', async () => {
  const response = await pedir(`/${id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.deepEqual(llamadas, [{ metodo: 'quitarFavorito', usuarioId: 'comprador', argumento: id }]);
});

test('US-25 CA14: anuncio inexistente o no visible en el catálogo → 404 NO_ENCONTRADO', async () => {
  fallo = anuncioNoEncontrado();
  const response = await pedir(`/${id}`, { method: 'PUT' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' } });
});

test('US-25 CA14: anuncio propio → 400 ANUNCIO_PROPIO con su mensaje', async () => {
  fallo = anuncioPropio();
  const response = await pedir(`/${id}`, { method: 'PUT' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'ANUNCIO_PROPIO', message: 'No puedes guardar tus propios anuncios.' },
  });
});

test('US-25 CA11/CA14: pasar de 500 favoritos → 409 LIMITE_FAVORITOS con el aviso de la web', async () => {
  fallo = limiteFavoritos();
  const response = await pedir(`/${id}`, { method: 'PUT' });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'LIMITE_FAVORITOS',
      message: 'Has llegado al máximo de 500 favoritos. Quita alguno para guardar otro.',
    },
  });
});

test('US-25 CA15: GET lista los favoritos con la tarjeta y `disponible`, página 1 por defecto', async () => {
  const response = await pedir('');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    anuncios: [tarjeta], pagina: 1, por_pagina: 20, total: 1, total_paginas: 1,
  });
  assert.deepEqual(llamadas, [{ metodo: 'listarFavoritos', usuarioId: 'comprador', argumento: { pagina: 1 } }]);
});

test('US-25 CA6/CA15: ?pagina=N pide esa página; las no válidas → 400 DATOS_INVALIDOS sin consultar', async () => {
  assert.equal((await pedir('?pagina=3')).status, 200);
  assert.deepEqual(llamadas[0].argumento, { pagina: 3 });
  llamadas = [];
  for (const pagina of ['0', '10001', 'abc', '2.5', '-1', '1&pagina=2']) {
    const response = await pedir(`?pagina=${pagina}`);
    assert.equal(response.status, 400, pagina);
    const { error } = await response.json();
    assert.equal(error.code, 'DATOS_INVALIDOS');
    assert.equal(error.details.pagina, 'La página debe ser un número entero entre 1 y 10000.');
  }
  assert.deepEqual(llamadas, []);
});

test('US-25 CA18: sin sesión, token inválido o email sin confirmar no se toca ningún favorito', async () => {
  for (const [method, ruta] of [['GET', ''], ['PUT', `/${id}`], ['DELETE', `/${id}`]]) {
    for (const [token, status, code] of [
      [null, 401, 'NO_AUTENTICADO'],
      ['caducado', 401, 'NO_AUTENTICADO'],
      ['pendiente', 403, 'EMAIL_NO_CONFIRMADO'],
    ]) {
      const response = await pedir(ruta, { method, token });
      assert.equal(response.status, status, `${method} ${token}`);
      assert.equal((await response.json()).error.code, code);
    }
  }
  assert.deepEqual(llamadas, []);
});

test('US-25: un fallo de PostgreSQL responde 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  fallo = databaseUnavailable();
  for (const [method, ruta] of [['GET', ''], ['PUT', `/${id}`], ['DELETE', `/${id}`]]) {
    const response = await pedir(ruta, { method });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  }
});

test('US-25: métodos no admitidos → 405 con Allow', async () => {
  for (const [method, ruta, allow] of [['POST', '', 'GET'], ['GET', `/${id}`, 'PUT, DELETE'], ['POST', `/${id}`, 'PUT, DELETE']]) {
    const response = await pedir(ruta, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), allow);
    assert.equal((await response.json()).error.code, 'METODO_NO_PERMITIDO');
  }
  assert.deepEqual(llamadas, []);
});
