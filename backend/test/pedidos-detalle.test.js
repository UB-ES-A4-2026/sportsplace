import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPedidosRepository, pedidoNoEncontrado } from '../src/repositories/pedidos.js';
import { aPedido } from '../src/services/serializar-pedido.js';
import { startApi } from './helpers.js';

// US-108 (T32-3): GET /api/pedidos/:id. La API con un doble del repositorio y
// el repositorio con un doble de la base de datos.
const GRACIA = 'c0000000-0000-4000-8000-000000000001';
const LES_CORTS = 'c0000000-0000-4000-8000-000000000002';
const PEDIDO = '9d3c2b1a-0000-4000-8000-000000000099';

const usuarios = {
  'token-gracia': { id: 'usuario-gracia', email: 'gracia@example.com', email_confirmado: true },
  'token-lescorts': { id: 'usuario-lescorts', email: 'lescorts@example.com', email_confirmado: true },
  'token-sabadell': { id: 'usuario-sabadell', email: 'sabadell@example.com', email_confirmado: true },
  'token-sin-confirmar': { id: 'usuario-x', email: 'x@example.com', email_confirmado: false },
};
const centroDe = { 'usuario-gracia': GRACIA, 'usuario-lescorts': LES_CORTS, 'usuario-sabadell': 'c-sabadell' };
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

const fila = {
  id: PEDIDO, titulo_anuncio: 'Balones de baloncesto talla 7', unidades: 4, modalidad: 'venta',
  precio_unitario_centimos: 850, total_centimos: 3400, metodo_pago: 'transferencia', mensaje: null,
  estado: 'pendiente', creado_en: '2026-10-21T08:30:00Z',
};
const datos = {
  fila,
  anuncio: { id: 'a1', estado: 'activo', unidades_disponibles: 12, foto_principal_url: null },
  comprador: { id: GRACIA, nombre: 'Escola de Bàsquet Gràcia', localidad: 'Barcelona', email: 'gracia@example.com' },
  vendedor: { id: LES_CORTS, nombre: 'Club Esportiu Les Corts', localidad: 'Barcelona', email: 'lescorts@example.com' },
};

// El doble aplica la misma regla que el JOIN del repositorio: solo comprador o vendedor.
const fakePedidos = {
  async obtener(usuarioId, id) {
    const centroId = centroDe[usuarioId];
    if (id !== PEDIDO || ![GRACIA, LES_CORTS].includes(centroId)) throw pedidoNoEncontrado();
    return aPedido(datos, centroId);
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, pedidos: fakePedidos }); });
after(() => api.close());

const pedir = (id, token, opciones = {}) => fetch(`${api.baseUrl}/api/pedidos/${id}`, {
  ...opciones,
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

test('CA10: el comprador recibe 200 { pedido } con mi_papel comprador', async () => {
  const respuesta = await pedir(PEDIDO, 'token-gracia');
  assert.equal(respuesta.status, 200);
  const { pedido } = await respuesta.json();
  assert.equal(pedido.id, PEDIDO);
  assert.equal(pedido.mi_papel, 'comprador');
  assert.equal(pedido.total_centimos, 3400);
  assert.deepEqual(pedido.acciones, []);
  assert.equal('email' in pedido.vendedor, false); // CA12
});

test('CA10 y CA13: el vendedor recibe mi_papel vendedor y las acciones aceptar y rechazar', async () => {
  const { pedido } = await (await pedir(PEDIDO, 'token-lescorts')).json();
  assert.equal(pedido.mi_papel, 'vendedor');
  assert.deepEqual(pedido.acciones, ['aceptar', 'rechazar']);
});

test('CA14: un tercero recibe 404 NO_ENCONTRADO', async () => {
  const respuesta = await pedir(PEDIDO, 'token-sabadell');
  assert.equal(respuesta.status, 404);
  assert.equal((await respuesta.json()).error.code, 'NO_ENCONTRADO');
});

test('CA11: id que no es uuid o pedido inexistente → 404 NO_ENCONTRADO', async () => {
  for (const id of ['no-es-uuid', 'a0000000-0000-4000-8000-000000000000']) {
    const respuesta = await pedir(id, 'token-gracia');
    assert.equal(respuesta.status, 404, id);
    assert.equal((await respuesta.json()).error.code, 'NO_ENCONTRADO', id);
  }
});

test('CA11: sin token → 401 NO_AUTENTICADO', async () => {
  const respuesta = await pedir(PEDIDO);
  assert.equal(respuesta.status, 401);
  assert.equal((await respuesta.json()).error.code, 'NO_AUTENTICADO');
});

test('CA11: email sin confirmar → 403 EMAIL_NO_CONFIRMADO', async () => {
  const respuesta = await pedir(PEDIDO, 'token-sin-confirmar');
  assert.equal(respuesta.status, 403);
  assert.equal((await respuesta.json()).error.code, 'EMAIL_NO_CONFIRMADO');
});

test('otro método sobre /api/pedidos/:id → 405 con Allow: GET', async () => {
  const respuesta = await pedir(PEDIDO, 'token-gracia', { method: 'PUT' });
  assert.equal(respuesta.status, 405);
  assert.equal(respuesta.headers.get('allow'), 'GET');
});

test('sin base de datos configurada → 503', async () => {
  const sinBd = await startApi({ auth: fakeAuth });
  try {
    const respuesta = await fetch(`${sinBd.baseUrl}/api/pedidos/${PEDIDO}`, { headers: { Authorization: 'Bearer token-gracia' } });
    assert.equal(respuesta.status, 503);
  } finally {
    await sinBd.close();
  }
});

// Repositorio con un doble de la base de datos.
function fakeDatabase(rows, error) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      if (error) throw error;
      return { rows };
    },
  };
}

const urlFoto = (ruta) => `https://proyecto.supabase.co/storage/v1/object/public/anuncios/${ruta}`;

test('repositorio: lee el pedido del centro de la sesión y monta el objeto de la API', async () => {
  const database = fakeDatabase([{
    fila, anuncio: { id: 'a1', estado: 'activo', unidades_disponibles: 12 }, ruta_foto: 'c/a1/1.jpg',
    comprador: datos.comprador, vendedor: datos.vendedor, centro_id: LES_CORTS,
  }]);
  const pedido = await createPedidosRepository(database, { urlFoto }).obtener('usuario-lescorts', PEDIDO);
  assert.equal(pedido.mi_papel, 'vendedor');
  assert.equal(pedido.anuncio.foto_principal_url, urlFoto('c/a1/1.jpg'));
  assert.deepEqual(database.log[0].values, ['usuario-lescorts', PEDIDO]);
  assert.match(database.log[0].sql, /yo\.usuario_id = \$1 AND yo\.id IN \(cc\.id, cv\.id\)/);
});

test('repositorio: sin fotos, foto_principal_url es null', async () => {
  const database = fakeDatabase([{
    fila, anuncio: { id: 'a1', estado: 'activo', unidades_disponibles: 12 }, ruta_foto: null,
    comprador: datos.comprador, vendedor: datos.vendedor, centro_id: GRACIA,
  }]);
  const pedido = await createPedidosRepository(database, { urlFoto }).obtener('usuario-gracia', PEDIDO);
  assert.equal(pedido.anuncio.foto_principal_url, null);
});

test('repositorio: sin fila (inexistente o ajeno) → 404; id no uuid no consulta la base', async () => {
  const database = fakeDatabase([]);
  const pedidos = createPedidosRepository(database);
  await assert.rejects(pedidos.obtener('usuario-sabadell', PEDIDO), { status: 404, code: 'NO_ENCONTRADO' });
  await assert.rejects(pedidos.obtener('usuario-gracia', 'no-es-uuid'), { status: 404 });
  assert.equal(database.log.length, 1);
});

test('repositorio: un fallo de PostgreSQL responde 503', async (t) => {
  t.mock.method(console, 'error', () => {});
  const pedidos = createPedidosRepository(fakeDatabase([], Object.assign(new Error('x'), { code: 'ECONNREFUSED' })));
  await assert.rejects(pedidos.obtener('usuario-gracia', PEDIDO), { status: 503 });
});
