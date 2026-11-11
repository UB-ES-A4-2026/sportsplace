import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { ApiError } from '../src/errors.js';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { createConversacionesAnuncioRepository } from '../src/repositories/conversaciones-anuncio.js';
import { startApi } from './helpers.js';

const anuncioId = '00000000-0000-4000-8000-000000000001';
const conversacionId = '00000000-0000-4000-8000-000000000002';
const usuarios = {
  vendedor: { id: 'usuario-vendedor', email_confirmado: true },
  comprador: { id: 'usuario-comprador', email_confirmado: true },
  tercero: { id: 'usuario-tercero', email_confirmado: true },
  pendiente: { id: 'usuario-pendiente', email_confirmado: false },
};
const auth = { getUser: async token => usuarios[token] ?? null };
const noEncontrado = () => new ApiError(404, 'NO_ENCONTRADO', 'Recurso no encontrado.');
const lista = {
  conversaciones: [{
    id: conversacionId,
    otro_centro: { id: 'centro-comprador', nombre: 'CE Gràcia Bàsquet', eliminado: false },
    ultimo_mensaje: { texto_resumen: '¿Podemos recogerlos el sábado?', es_mio: false, creado_en: '2026-11-11T10:00:00.000Z' },
    sin_leer: true,
  }],
};
let llamadas;
let fallo;
let resultado;
let api;

before(async () => {
  api = await startApi({
    auth,
    conversacionesAnuncio: {
      async listar(usuarioId, id) {
        llamadas.push({ accion: 'listar', usuarioId, id });
        if (fallo) throw fallo;
        if (usuarioId !== 'usuario-vendedor' || id !== anuncioId) throw noEncontrado();
        return resultado;
      },
      async marcarLeida(usuarioId, id) {
        llamadas.push({ accion: 'leida', usuarioId, id });
        if (fallo) throw fallo;
        if (!['usuario-vendedor', 'usuario-comprador'].includes(usuarioId) || id !== conversacionId) {
          throw noEncontrado();
        }
      },
    },
  });
});
after(() => api.close());
beforeEach(() => {
  llamadas = [];
  fallo = null;
  resultado = lista;
});

function solicitar(path, { token = 'vendedor', method = 'GET' } = {}) {
  return fetch(`${api.baseUrl}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test('US-77 CA8: el vendedor recibe la lista con el contrato y sin caché', async () => {
  const response = await solicitar(`/api/anuncios/${anuncioId}/conversaciones`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), lista);
  assert.deepEqual(llamadas, [{ accion: 'listar', usuarioId: 'usuario-vendedor', id: anuncioId }]);
});

test('US-77 CA8: el propietario sin conversaciones recibe una lista vacía', async () => {
  resultado = { conversaciones: [] };
  const response = await solicitar(`/api/anuncios/${anuncioId}/conversaciones`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { conversaciones: [] });
});

test('US-77 CA9: un comprador o tercero no puede listar las conversaciones del anuncio', async () => {
  for (const token of ['comprador', 'tercero']) {
    const response = await solicitar(`/api/anuncios/${anuncioId}/conversaciones`, { token });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'NO_ENCONTRADO');
  }
});

test('US-77 CA7: comprador y vendedor marcan su propia lectura con 204 y cuerpo vacío', async () => {
  for (const token of ['comprador', 'vendedor']) {
    const response = await solicitar(`/api/conversaciones/${conversacionId}/leida`, { token, method: 'POST' });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
  }
  assert.deepEqual(llamadas, [
    { accion: 'leida', usuarioId: 'usuario-comprador', id: conversacionId },
    { accion: 'leida', usuarioId: 'usuario-vendedor', id: conversacionId },
  ]);
});

test('US-77 CA7: un tercero recibe 404 al intentar marcar la conversación como leída', async () => {
  const response = await solicitar(`/api/conversaciones/${conversacionId}/leida`, { token: 'tercero', method: 'POST' });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NO_ENCONTRADO');
});

test('US-77: los identificadores inválidos e inexistentes mantienen el error 404', async () => {
  for (const id of ['no-es-uuid', '00000000-0000-4000-8000-000000000099']) {
    for (const [path, method] of [
      [`/api/anuncios/${id}/conversaciones`, 'GET'],
      [`/api/conversaciones/${id}/leida`, 'POST'],
    ]) {
      const response = await solicitar(path, { method });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, 'NO_ENCONTRADO');
    }
  }
});

test('US-77: ambas rutas exigen sesión válida y email confirmado antes de consultar datos', async () => {
  for (const [token, status, code] of [
    [null, 401, 'NO_AUTENTICADO'],
    ['caducado', 401, 'NO_AUTENTICADO'],
    ['pendiente', 403, 'EMAIL_NO_CONFIRMADO'],
  ]) {
    for (const [path, method] of [
      [`/api/anuncios/${anuncioId}/conversaciones`, 'GET'],
      [`/api/conversaciones/${conversacionId}/leida`, 'POST'],
    ]) {
      const response = await solicitar(path, { token, method });
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
  }
  assert.deepEqual(llamadas, []);
});

test('US-77: errores de base de datos conservan el formato 503', async () => {
  fallo = databaseUnavailable();
  for (const [path, method] of [
    [`/api/anuncios/${anuncioId}/conversaciones`, 'GET'],
    [`/api/conversaciones/${conversacionId}/leida`, 'POST'],
  ]) {
    const response = await solicitar(path, { method });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  }
});

test('US-77: sin repositorio configurado se responde 503', async () => {
  const sinDb = await startApi({ auth });
  try {
    const response = await fetch(`${sinDb.baseUrl}/api/anuncios/${anuncioId}/conversaciones`, {
      headers: { Authorization: 'Bearer vendedor' },
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  } finally {
    await sinDb.close();
  }
});

test('US-77: métodos ajenos al contrato responden 405 con Allow', async () => {
  for (const [path, method, permitido] of [
    [`/api/anuncios/${anuncioId}/conversaciones`, 'DELETE', 'GET'],
    [`/api/conversaciones/${conversacionId}/leida`, 'GET', 'POST'],
  ]) {
    const response = await solicitar(path, { method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), permitido);
    assert.equal((await response.json()).error.code, 'METODO_NO_PERMITIDO');
  }
  assert.deepEqual(llamadas, []);
});

function baseDePruebas(respuestas) {
  const consultas = [];
  return {
    consultas,
    async query(sql, values) {
      consultas.push({ sql, values });
      return { rows: respuestas.shift() ?? [] };
    },
  };
}

const fila = {
  id: conversacionId,
  otro_centro_id: 'centro-comprador',
  otro_centro_nombre: 'CE Gràcia Bàsquet',
  mensaje_id: 'mensaje-1',
  texto: '¿Podemos recogerlos el sábado?',
  tipo: 'texto',
  centro_autor_id: 'centro-comprador',
  mensaje_creado_en: new Date('2026-11-11T10:00:00Z'),
  sin_leer: true,
};

test('US-77 CA8: el repositorio construye una respuesta explícita sin contactos ni identificadores internos', async () => {
  const db = baseDePruebas([
    [{ id: anuncioId, centro_id: 'centro-vendedor' }],
    [{ ...fila, email: 'privado@example.invalid', telefono: 'privado', autor_usuario_id: 'persona-privada', direccion: 'privada' }],
  ]);
  const resultado = await createConversacionesAnuncioRepository(db).listar('usuario-vendedor', anuncioId);
  assert.deepEqual(resultado, lista);
  assert.deepEqual(db.consultas.map(c => c.values), [
    ['usuario-vendedor', anuncioId],
    [anuncioId, 'centro-vendedor'],
  ]);
});

test('US-77 CA11: el resumen respeta el límite de 80 caracteres Unicode', async () => {
  const ochenta = '😀'.repeat(80);
  const db = baseDePruebas([
    [{ id: anuncioId, centro_id: 'centro-vendedor' }],
    [
      { ...fila, id: 'exacto', texto: ochenta },
      { ...fila, id: 'largo', texto: `${ochenta}ñ` },
      { ...fila, id: 'corto', texto: 'Hola\n¿Sigue disponible?' },
    ],
  ]);
  const { conversaciones } = await createConversacionesAnuncioRepository(db).listar('usuario-vendedor', anuncioId);
  assert.deepEqual(conversaciones.map(c => c.ultimo_mensaje.texto_resumen), [
    ochenta, `${ochenta}…`, 'Hola\n¿Sigue disponible?',
  ]);
});

test('US-77 CA7: un último mensaje propio no oculta los anteriores del comprador sin leer', async () => {
  const db = baseDePruebas([
    [{ id: anuncioId, centro_id: 'centro-vendedor' }],
    [{ ...fila, centro_autor_id: 'centro-vendedor', sin_leer: true }],
  ]);
  const { conversaciones: [conversacion] } = await createConversacionesAnuncioRepository(db).listar('usuario-vendedor', anuncioId);
  assert.equal(conversacion.ultimo_mensaje.es_mio, true);
  assert.equal(conversacion.sin_leer, true);
});

test('US-77: una conversación aún sin mensajes devuelve ultimo_mensaje null', async () => {
  const db = baseDePruebas([
    [{ id: anuncioId, centro_id: 'centro-vendedor' }],
    [{ ...fila, mensaje_id: null, texto: null, mensaje_creado_en: null, sin_leer: false }],
  ]);
  const { conversaciones: [conversacion] } = await createConversacionesAnuncioRepository(db).listar('usuario-vendedor', anuncioId);
  assert.equal(conversacion.ultimo_mensaje, null);
  assert.equal(conversacion.sin_leer, false);
});

test('US-77 CA9: un no propietario recibe 404 sin consultar conversaciones', async () => {
  const db = baseDePruebas([]);
  await assert.rejects(createConversacionesAnuncioRepository(db).listar('usuario-tercero', anuncioId), {
    status: 404, code: 'NO_ENCONTRADO',
  });
  assert.equal(db.consultas.length, 1);
});

test('US-77: un UUID inválido no llega a consultar PostgreSQL', async () => {
  const db = baseDePruebas([]);
  const repo = createConversacionesAnuncioRepository(db);
  await assert.rejects(repo.listar('usuario-vendedor', 'no-es-uuid'), { status: 404, code: 'NO_ENCONTRADO' });
  await assert.rejects(repo.marcarLeida('usuario-vendedor', 'no-es-uuid'), { status: 404, code: 'NO_ENCONTRADO' });
  assert.deepEqual(db.consultas, []);
});

test('US-77 CA7: marcar lectura utiliza exclusivamente la identidad de la sesión', async () => {
  const db = baseDePruebas([[{ id: conversacionId }]]);
  assert.equal(await createConversacionesAnuncioRepository(db).marcarLeida('usuario-comprador', conversacionId), undefined);
  assert.deepEqual(db.consultas[0].values, ['usuario-comprador', conversacionId]);
});

test('US-77 CA7: una conversación ajena o inexistente no se puede marcar como leída', async () => {
  const db = baseDePruebas([]);
  await assert.rejects(createConversacionesAnuncioRepository(db).marcarLeida('usuario-tercero', conversacionId), {
    status: 404, code: 'NO_ENCONTRADO',
  });
});

test('US-77: los errores de consulta se traducen a 503 en lista y lectura', async t => {
  t.mock.method(console, 'error', () => {});
  const db = { query: async () => { throw Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' }); } };
  const repo = createConversacionesAnuncioRepository(db);
  await assert.rejects(repo.listar('usuario-vendedor', anuncioId), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
  await assert.rejects(repo.marcarLeida('usuario-vendedor', conversacionId), { status: 503, code: 'BASE_DATOS_NO_DISPONIBLE' });
});
