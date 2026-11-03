import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { databaseUnavailable } from '../src/repositories/centros.js';
import { startApi, usuarioConfirmado } from './helpers.js';

// US-07: ver y editar el perfil de mi centro. Los dobles simulan Supabase Auth
// y la tabla centros (un centro por usuario_id).
const usuarios = {
  'token-confirmado': usuarioConfirmado,
  'token-sin-confirmar': { id: 'u2', email: 'nuevo@example.com', email_confirmado: false },
  'token-sin-centro': { id: 'u3', email: 'otro@example.com', email_confirmado: true },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let centros;
let actualizaciones;
let caida;
const fakeCentros = {
  async centroDelUsuario(usuarioId) {
    if (caida) throw databaseUnavailable();
    return centros[usuarioId] ?? null;
  },
  async actualizarPerfil(usuarioId, cambios) {
    if (caida) throw databaseUnavailable();
    actualizaciones.push({ usuarioId, cambios });
    if (!centros[usuarioId]) return null;
    Object.assign(centros[usuarioId], cambios);
    return centros[usuarioId];
  },
};

const centroInicial = () => ({
  id: 'centro-1',
  nombre: 'Club Natació Exemple',
  email: 'centro@example.com',
  localidad: 'Barcelona',
  direccion: null,
  codigo_postal: '08001',
  telefono: null,
  descripcion: null,
  email_contacto: null,
  web: null,
  creado_en: '2026-10-09T10:00:00.000Z',
});

let api;
before(async () => { api = await startApi({ auth: fakeAuth, centros: fakeCentros }); });
after(() => api.close());
beforeEach(() => {
  centros = { u1: centroInicial(), u2: { ...centroInicial(), id: 'centro-2' } };
  actualizaciones = [];
  caida = false;
});

const leer = (token = 'token-confirmado') => fetch(`${api.baseUrl}/api/centros/mio`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const editar = (body, token = 'token-confirmado') => fetch(`${api.baseUrl}/api/centros/mio`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

async function errorDe(response) {
  return (await response.json()).error;
}

// CA17
test('US-07 CA17: GET /api/centros/mio devuelve el centro de mi cuenta', async () => {
  const response = await leer();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { centro: centroInicial() });
});

test('US-07 CA17: GET /api/centros/mio sin sesión → 401 NO_AUTENTICADO', async () => {
  const response = await leer(null);

  assert.equal(response.status, 401);
  assert.equal((await errorDe(response)).code, 'NO_AUTENTICADO');
});

test('US-07 CA23: con el email sin confirmar puedo ver mi perfil', async () => {
  const response = await leer('token-sin-confirmar');

  assert.equal(response.status, 200);
  assert.equal((await response.json()).centro.id, 'centro-2');
});

test('US-07: una cuenta sin centro recibe 404 NO_ENCONTRADO', async () => {
  const response = await leer('token-sin-centro');

  assert.equal(response.status, 404);
  assert.equal((await errorDe(response)).code, 'NO_ENCONTRADO');
});

// CA18
test('US-07 CA18: PATCH guarda los datos de la historia y devuelve el centro actualizado', async () => {
  const response = await editar({
    descripcion: 'Club de natación con 2 piscinas de 25 m.\nRenovamos material cada temporada.',
    telefono: '+34 931 234 567',
    email_contacto: ' Material@ClubNatacio.cat ',
    web: 'https://clubnatacio.cat',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    centro: {
      ...centroInicial(),
      descripcion: 'Club de natación con 2 piscinas de 25 m.\nRenovamos material cada temporada.',
      telefono: '+34 931 234 567',
      email_contacto: 'material@clubnatacio.cat',
      web: 'https://clubnatacio.cat',
    },
  });
});

test('US-07 CA18: los campos no enviados no cambian', async () => {
  centros.u1.web = 'https://clubnatacio.cat';
  await editar({ nombre: '  Club Natació Nou ' });

  assert.deepEqual(actualizaciones, [{ usuarioId: 'u1', cambios: { nombre: 'Club Natació Nou' } }]);
  assert.equal(centros.u1.web, 'https://clubnatacio.cat');
});

test('US-07 CA18 y CA24: null, "" o solo espacios borran un campo opcional', async () => {
  const response = await editar({ descripcion: '   ', telefono: '', web: null, email_contacto: null });

  assert.equal(response.status, 200);
  assert.deepEqual(actualizaciones[0].cambios, { descripcion: null, telefono: null, web: null, email_contacto: null });
});

// CA19 y CA6-CA10
const invalidos = [
  ['CA6 nombre vacío', { nombre: '  ' }, 'nombre', 'El nombre del centro es obligatorio.'],
  ['CA6 nombre null', { nombre: null }, 'nombre', 'El nombre del centro es obligatorio.'],
  ['CA6 nombre de 161', { nombre: 'a'.repeat(161) }, 'nombre', 'Como máximo 160 caracteres.'],
  ['CA7 descripción de 1001', { descripcion: 'a'.repeat(1001) }, 'descripcion', 'Como máximo 1000 caracteres.'],
  ['CA8 teléfono de 8', { telefono: '93123456' }, 'telefono', 'El teléfono no es válido.'],
  ['CA8 teléfono con guiones', { telefono: '93-123-45-67' }, 'telefono', 'El teléfono no es válido.'],
  ['CA8 teléfono con + en medio', { telefono: '93+1234567' }, 'telefono', 'El teléfono no es válido.'],
  ['CA8 teléfono de 31', { telefono: '9'.repeat(31) }, 'telefono', 'Como máximo 30 caracteres.'],
  ['CA9 email sin dominio con punto', { email_contacto: 'material@clubnatacio' }, 'email_contacto', 'El email no es válido.'],
  ['CA9 email de 255', { email_contacto: `${'a'.repeat(243)}@example.com` }, 'email_contacto', 'El email no es válido.'],
  ['CA10 web sin protocolo', { web: 'clubnatacio.cat' }, 'web', 'La web debe empezar por http:// o https://.'],
  ['CA10 web localhost', { web: 'https://localhost' }, 'web', 'La web no es válida.'],
  ['CA10 web de 256', { web: `https://${'a'.repeat(244)}.cat` }, 'web', 'Como máximo 255 caracteres.'],
  ['CA19 campo no editable', { email: 'otro@example.com' }, 'email', 'Este campo no se puede modificar.'],
  ['CA19 usuario_id', { usuario_id: 'u9' }, 'usuario_id', 'Este campo no se puede modificar.'],
  ['CA19 localidad', { localidad: 'Girona' }, 'localidad', 'Este campo no se puede modificar.'],
  ['campo que no es texto', { telefono: 931234567 }, 'telefono', 'Debe ser un texto.'],
];

for (const [nombre, body, campo, mensaje] of invalidos) {
  test(`US-07 ${nombre} → 400 DATOS_INVALIDOS y no se guarda`, async () => {
    const response = await editar(body);

    assert.equal(response.status, 400);
    const error = await errorDe(response);
    assert.equal(error.code, 'DATOS_INVALIDOS');
    assert.deepEqual(error.details, { [campo]: mensaje });
    assert.deepEqual(actualizaciones, []);
  });
}

test('US-07 CA19: devuelve los errores de todos los campos a la vez', async () => {
  const response = await editar({ telefono: '93-123', web: 'clubnatacio.cat' });

  assert.deepEqual((await errorDe(response)).details, {
    telefono: 'El teléfono no es válido.',
    web: 'La web debe empezar por http:// o https://.',
  });
});

const validos = [
  ['CA6 nombre de 160', { nombre: 'a'.repeat(160) }],
  ['CA7 descripción de 1000 con saltos de línea', { descripcion: `${'a'.repeat(499)}\n${'b'.repeat(500)}` }],
  ['CA8 teléfono sin prefijo', { telefono: '931234567' }],
  ['CA8 teléfono de 30', { telefono: '9'.repeat(30) }],
  ['CA9 email de 254', { email_contacto: `${'a'.repeat(242)}@example.com` }],
  ['CA10 web http de 255', { web: `http://${'a'.repeat(244)}.cat` }],
  ['CA25 emojis cuentan como 1 carácter', { nombre: '🏊'.repeat(160), descripcion: '🏊'.repeat(1000) }],
];

for (const [nombre, body] of validos) {
  test(`US-07 ${nombre} se acepta`, async () => {
    const response = await editar(body);

    assert.equal(response.status, 200);
    assert.deepEqual(actualizaciones[0].cambios, body);
  });
}

test('US-07 CA25: 1001 emojis en la descripción superan el límite', async () => {
  const response = await editar({ descripcion: '🏊'.repeat(1001) });

  assert.equal(response.status, 400);
  assert.deepEqual((await errorDe(response)).details, { descripcion: 'Como máximo 1000 caracteres.' });
});

test('US-07 CA19: un cuerpo que no es JSON → 400 JSON_INVALIDO', async () => {
  const response = await editar('{"nombre":');

  assert.equal(response.status, 400);
  assert.equal((await errorDe(response)).code, 'JSON_INVALIDO');
});

test('US-07 CA19: un cuerpo que no es un objeto → 400 DATOS_INVALIDOS', async () => {
  const response = await editar(['nombre']);

  assert.equal(response.status, 400);
  assert.equal((await errorDe(response)).code, 'DATOS_INVALIDOS');
});

test('US-07 CA19: PATCH sin sesión → 401 NO_AUTENTICADO', async () => {
  const response = await editar({ nombre: 'Club' }, null);

  assert.equal(response.status, 401);
  assert.equal((await errorDe(response)).code, 'NO_AUTENTICADO');
});

test('US-07 CA23: con el email sin confirmar no puedo guardar → 403 EMAIL_NO_CONFIRMADO', async () => {
  const response = await editar({ nombre: 'Club' }, 'token-sin-confirmar');

  assert.equal(response.status, 403);
  assert.equal((await errorDe(response)).code, 'EMAIL_NO_CONFIRMADO');
  assert.deepEqual(actualizaciones, []);
});

test('US-07 CA19: sin base de datos → 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  caida = true;

  for (const response of [await leer(), await editar({ nombre: 'Club' })]) {
    assert.equal(response.status, 503);
    assert.equal((await errorDe(response)).code, 'BASE_DATOS_NO_DISPONIBLE');
  }
});

test('US-07: otros métodos en /api/centros/mio → 405', async () => {
  const response = await fetch(`${api.baseUrl}/api/centros/mio`, { method: 'DELETE' });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, PATCH');
});

test('US-07 CA22: no hay ruta para editar otro centro por id', async () => {
  const response = await fetch(`${api.baseUrl}/api/centros/centro-2`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-confirmado' },
    body: JSON.stringify({ nombre: 'Otro' }),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(actualizaciones, []);
});
