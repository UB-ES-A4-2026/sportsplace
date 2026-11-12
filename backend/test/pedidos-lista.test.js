import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPedidosRepository } from '../src/repositories/pedidos.js';
import { startApi } from './helpers.js';

// US-109 (T33-1): GET /api/pedidos y GET /api/pedidos/contador. La API con un
// doble del repositorio y el repositorio con un doble de la base de datos.
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';

const usuarios = {
  'token-gracia': { id: 'usuario-gracia', email: 'gracia@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-x', email: 'x@example.com', email_confirmado: false },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

const resumen = {
  id: '9d3c2b1a-0000-4000-8000-000000000099',
  anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7', foto_principal_url: null },
  otro_centro: { id: LES_CORTS, nombre: 'Club Esportiu Les Corts' },
  unidades: 4, modalidad: 'venta', total_centimos: 3400, estado: 'pendiente', pagado_en: null,
  creado_en: '2026-10-21T08:30:00.000Z',
};

const llamadas = [];
const fakePedidos = {
  async listar(usuarioId, consulta) {
    llamadas.push({ usuarioId, ...consulta });
    return { pedidos: consulta.pagina === 1 ? [resumen] : [], pagina: consulta.pagina, total: 1, por_pagina: 20 };
  },
  async contador(usuarioId) {
    llamadas.push({ usuarioId, contador: true });
    return { recibidos_pendientes: 3 };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, pedidos: fakePedidos }); });
after(() => api.close());

const pedir = (ruta, token, opciones = {}) => fetch(`${api.baseUrl}${ruta}`, {
  ...opciones,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

async function errorDe(respuesta, status, code) {
  assert.equal(respuesta.status, status);
  const { error } = await respuesta.json();
  assert.equal(error.code, code);
  return error;
}

test('CA10: 200 { pedidos, pagina, total, por_pagina } con el rol y la página pedidos', async () => {
  llamadas.length = 0;
  const respuesta = await pedir('/api/pedidos?rol=realizados&pagina=1', 'token-gracia');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { pedidos: [resumen], pagina: 1, total: 1, por_pagina: 20 });
  assert.deepEqual(llamadas, [{ usuarioId: 'usuario-gracia', rol: 'realizados', pagina: 1 }]);
});

test('CA11: sin pagina se sirve la 1; una página mayor que la última responde 200 con lista vacía', async () => {
  llamadas.length = 0;
  assert.equal((await pedir('/api/pedidos?rol=recibidos', 'token-gracia')).status, 200);
  assert.equal(llamadas[0].pagina, 1);
  const respuesta = await pedir('/api/pedidos?rol=recibidos&pagina=9', 'token-gracia');
  assert.equal(respuesta.status, 200);
  assert.deepEqual((await respuesta.json()).pedidos, []);
});

test('CA11: rol ausente, vacío, inválido o repetido → 400 DATOS_INVALIDOS con details.rol', async () => {
  for (const query of ['', '?rol=', '?rol=todos', '?rol=recibidos&rol=realizados']) {
    const error = await errorDe(await pedir(`/api/pedidos${query}`, 'token-gracia'), 400, 'DATOS_INVALIDOS');
    assert.equal(error.details.rol, 'Indica recibidos o realizados.');
  }
});

test('CA11: pagina menor que 1 o no entera → 400 DATOS_INVALIDOS y no se consulta', async () => {
  llamadas.length = 0;
  for (const pagina of ['0', '-1', '1.5', 'uno', '']) {
    const error = await errorDe(
      await pedir(`/api/pedidos?rol=recibidos&pagina=${pagina}`, 'token-gracia'), 400, 'DATOS_INVALIDOS',
    );
    assert.ok(error.details.pagina);
  }
  assert.equal(llamadas.length, 0);
});

test('CA12: GET /api/pedidos/contador → 200 { recibidos_pendientes }', async () => {
  llamadas.length = 0;
  const respuesta = await pedir('/api/pedidos/contador', 'token-gracia');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { recibidos_pendientes: 3 });
  assert.deepEqual(llamadas, [{ usuarioId: 'usuario-gracia', contador: true }]);
});

test('CA14: sin token 401 y con el email sin confirmar 403, en la lista y en el contador', async () => {
  for (const ruta of ['/api/pedidos?rol=recibidos', '/api/pedidos/contador']) {
    await errorDe(await pedir(ruta), 401, 'NO_AUTENTICADO');
    await errorDe(await pedir(ruta, 'token-sin-confirmar'), 403, 'EMAIL_NO_CONFIRMADO');
  }
});

test('métodos: /api/pedidos admite GET y POST; /api/pedidos/contador solo GET', async () => {
  const lista = await pedir('/api/pedidos', 'token-gracia', { method: 'DELETE' });
  assert.equal(lista.status, 405);
  assert.equal(lista.headers.get('allow'), 'GET, POST');
  const contador = await pedir('/api/pedidos/contador', 'token-gracia', { method: 'POST' });
  assert.equal(contador.status, 405);
  assert.equal(contador.headers.get('allow'), 'GET');
});

// ---------------------------------------------------------------- repositorio

function fakeDatabase(respuestas, error) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      if (error) throw error;
      return { rows: respuestas.shift() ?? [] };
    },
  };
}

const urlFoto = (ruta) => `https://proyecto.supabase.co/storage/v1/object/public/anuncios/${ruta}`;
const filaRecibida = {
  id: resumen.id, anuncio_id: 'a1', titulo_anuncio: 'Balones de baloncesto talla 7', unidades: 4,
  modalidad: 'venta', total_centimos: '3400', estado: 'pendiente', creado_en: new Date('2026-10-21T08:30:00Z'),
  pagado_en: null, otro_id: GRACIA, otro_nombre: 'Escola de Bàsquet Gràcia', ruta_foto: 'c/a1/1.jpg',
};

test('repositorio CA3, CA10 y CA13: Recibidos filtra por el vendedor del token y el otro centro es el comprador', async () => {
  const database = fakeDatabase([[{ total: 21 }], [filaRecibida]]);
  const pagina = await createPedidosRepository(database, { urlFoto }).listar('usuario-lescorts', { rol: 'recibidos', pagina: 2 });
  assert.deepEqual(pagina, {
    pedidos: [{
      id: resumen.id,
      anuncio: { id: 'a1', titulo: 'Balones de baloncesto talla 7', foto_principal_url: urlFoto('c/a1/1.jpg') },
      otro_centro: { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia' },
      unidades: 4, modalidad: 'venta', total_centimos: 3400, estado: 'pendiente', pagado_en: null,
      creado_en: '2026-10-21T08:30:00.000Z',
    }],
    pagina: 2, total: 21, por_pagina: 20,
  });
  const [cuenta, lista] = database.log;
  const centroDelToken = /p\.vendedor_centro_id = \(SELECT c\.id FROM public\.centros c WHERE c\.usuario_id = \$1\)/;
  assert.match(cuenta.sql, centroDelToken);
  assert.match(lista.sql, centroDelToken);
  assert.match(lista.sql, /JOIN public\.centros o ON o\.id = p\.comprador_centro_id/);
  assert.deepEqual(lista.values, ['usuario-lescorts', 20, 20]);
});

test('repositorio CA4: pendientes primero y, en cada grupo, del más nuevo al más antiguo', async () => {
  const database = fakeDatabase([[{ total: 0 }], []]);
  await createPedidosRepository(database).listar('usuario-gracia', { rol: 'realizados', pagina: 1 });
  assert.match(database.log[1].sql, /ORDER BY \(p\.estado = 'pendiente'\) DESC, p\.creado_en DESC, p\.id DESC LIMIT \$2 OFFSET \$3/);
});

test('repositorio CA3: Realizados filtra por el comprador y el otro centro es el vendedor; sin fotos, null', async () => {
  const database = fakeDatabase([[{ total: 1 }], [{ ...filaRecibida, ruta_foto: null, pagado_en: '2026-10-22T10:00:00+00:00' }]]);
  const { pedidos } = await createPedidosRepository(database, { urlFoto }).listar('usuario-gracia', { rol: 'realizados', pagina: 1 });
  assert.match(database.log[1].sql, /WHERE p\.comprador_centro_id = \(SELECT/);
  assert.match(database.log[1].sql, /JOIN public\.centros o ON o\.id = p\.vendedor_centro_id/);
  assert.equal(pedidos[0].anuncio.foto_principal_url, null);
  assert.equal(pedidos[0].pagado_en, '2026-10-22T10:00:00.000Z');
});

test('repositorio CA12: el contador cuenta solo los recibidos pendientes del centro del token', async () => {
  const database = fakeDatabase([[{ n: 5 }]]);
  assert.deepEqual(await createPedidosRepository(database).contador('usuario-lescorts'), { recibidos_pendientes: 5 });
  assert.match(database.log[0].sql, /p\.vendedor_centro_id = \(SELECT c\.id FROM public\.centros c WHERE c\.usuario_id = \$1\) AND p\.estado = 'pendiente'/);
  assert.deepEqual(database.log[0].values, ['usuario-lescorts']);
});

test('repositorio: un fallo de PostgreSQL responde 503 en la lista y en el contador', async (t) => {
  t.mock.method(console, 'error', () => {});
  const fallo = Object.assign(new Error('x'), { code: 'ECONNREFUSED' });
  const pedidos = createPedidosRepository(fakeDatabase([], fallo));
  await assert.rejects(pedidos.listar('usuario-gracia', { rol: 'recibidos', pagina: 1 }), { status: 503 });
  await assert.rejects(pedidos.contador('usuario-gracia'), { status: 503 });
});
