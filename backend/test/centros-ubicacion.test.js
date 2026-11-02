import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { codigoPostalDesconocido, databaseUnavailable } from '../src/repositories/centros.js';
import { startApi, usuarioConfirmado } from './helpers.js';

// US-68: indicar dónde está mi centro. Los dobles simulan Supabase Auth, la
// tabla centros (un centro por usuario_id) y una parte de codigos_postales.
const usuarios = {
  'token-confirmado': usuarioConfirmado,
  'token-sin-confirmar': { id: 'u2', email: 'nuevo@example.com', email_confirmado: false },
  'token-sin-centro': { id: 'u3', email: 'otro@example.com', email_confirmado: true },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

const codigosPostales = {
  '08025': { provincia: 'Barcelona', latitud: 41.4036, longitud: 2.1744 },
  '17001': { provincia: 'Girona', latitud: 41.9831, longitud: 2.8249 },
  '01000': { provincia: 'Álava', latitud: 42.85, longitud: -2.6727 },
  '52999': { provincia: 'Melilla', latitud: 35.2923, longitud: -2.9381 },
};

let centros;
let guardadas;
let caida;
const fakeCentros = {
  async centroDelUsuario(usuarioId) {
    if (caida) throw databaseUnavailable();
    return centros[usuarioId] ?? null;
  },
  async actualizarUbicacion(usuarioId, ubicacion) {
    if (caida) throw databaseUnavailable();
    const zona = codigosPostales[ubicacion.codigo_postal];
    if (!zona) throw codigoPostalDesconocido();
    guardadas.push({ usuarioId, ubicacion });
    if (!centros[usuarioId]) return null;
    Object.assign(centros[usuarioId], ubicacion, zona);
    return centros[usuarioId];
  },
};

// Centro del Sprint 0, registrado sin código postal (CA10).
const centroInicial = () => ({
  id: 'centro-1',
  nombre: 'Club Natació Exemple',
  email: 'centro@example.com',
  localidad: 'Barcelona',
  direccion: null,
  codigo_postal: null,
  telefono: null,
  descripcion: null,
  email_contacto: null,
  web: null,
  creado_en: '2026-10-09T10:00:00.000Z',
  provincia: null,
  latitud: null,
  longitud: null,
});

const historia = { direccion: 'Carrer de la Piscina 12', codigo_postal: '08025', localidad: 'Barcelona' };

let api;
before(async () => { api = await startApi({ auth: fakeAuth, centros: fakeCentros }); });
after(() => api.close());
beforeEach(() => {
  centros = { u1: centroInicial(), u2: { ...centroInicial(), id: 'centro-2' } };
  guardadas = [];
  caida = false;
});

const guardar = (body, token = 'token-confirmado', method = 'PUT') => fetch(`${api.baseUrl}/api/centros/mio/ubicacion`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

async function errorDe(response) {
  return (await response.json()).error;
}

async function detailsDe(body) {
  const response = await guardar(body);
  assert.equal(response.status, 400);
  const error = await errorDe(response);
  assert.equal(error.code, 'DATOS_INVALIDOS');
  return error.details;
}

// CA7, CA8, CA11
test('US-68 CA11: PUT guarda la ubicación de la historia y devuelve provincia y coordenadas', async () => {
  const response = await guardar(historia);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    centro: {
      ...centroInicial(),
      ...historia,
      provincia: 'Barcelona',
      latitud: 41.4036,
      longitud: 2.1744,
    },
  });
  assert.deepEqual(guardadas, [{ usuarioId: 'u1', ubicacion: historia }]);
});

test('US-68 CA8: la localidad es la que escribe el usuario y la provincia sale del código postal', async () => {
  const response = await guardar({ codigo_postal: '08025', localidad: "L'Hospitalet de Llobregat" });

  const { centro } = await response.json();
  assert.equal(centro.localidad, "L'Hospitalet de Llobregat");
  assert.equal(centro.provincia, 'Barcelona');
});

test('US-68 CA13: GET /api/centros/mio incluye provincia, latitud y longitud', async () => {
  await guardar(historia);
  const response = await fetch(`${api.baseUrl}/api/centros/mio`, { headers: { Authorization: 'Bearer token-confirmado' } });

  const { centro } = await response.json();
  assert.equal(centro.provincia, 'Barcelona');
  assert.equal(centro.latitud, 41.4036);
  assert.equal(centro.longitud, 2.1744);
});

// CA18, CA19
test('US-68 CA18: cambiar de 08025 a 17001 actualiza provincia y coordenadas en la misma petición', async () => {
  await guardar(historia);
  const response = await guardar({ ...historia, codigo_postal: '17001', localidad: 'Girona' });

  const { centro } = await response.json();
  assert.equal(centro.provincia, 'Girona');
  assert.equal(centro.latitud, 41.9831);
  assert.equal(centro.longitud, 2.8249);
});

test('US-68 CA19: dirección vacía, solo con espacios, null o ausente se guarda como null', async () => {
  for (const direccion of ['', '   ', null, undefined]) {
    guardadas = [];
    const response = await guardar({ direccion, codigo_postal: '08025', localidad: 'Barcelona' });

    assert.equal(response.status, 200);
    assert.equal(guardadas[0].ubicacion.direccion, null);
    assert.equal((await response.json()).centro.provincia, 'Barcelona');
  }
});

test('US-68: se recortan los espacios antes de validar y guardar', async () => {
  await guardar({ direccion: '  Carrer de la Piscina 12 ', codigo_postal: ' 08025 ', localidad: ' Barcelona  ' });

  assert.deepEqual(guardadas[0].ubicacion, historia);
});

// CA3
test('US-68 CA3: dirección de 255 caracteres se acepta y de 256 no', async () => {
  assert.equal((await guardar({ ...historia, direccion: 'a'.repeat(255) })).status, 200);
  assert.deepEqual(await detailsDe({ ...historia, direccion: 'a'.repeat(256) }), {
    direccion: 'Como máximo 255 caracteres.',
  });
});

// CA4
test('US-68 CA4: el código postal es obligatorio', async () => {
  for (const codigo_postal of ['', '   ', null, undefined]) {
    assert.deepEqual(await detailsDe({ ...historia, codigo_postal }), {
      codigo_postal: 'El código postal es obligatorio.',
    });
  }
});

test('US-68 CA4: el código postal debe tener 5 cifras', async () => {
  for (const codigo_postal of ['0802', '080251', '08O25', '08 25']) {
    assert.deepEqual(await detailsDe({ ...historia, codigo_postal }), {
      codigo_postal: 'El código postal debe tener 5 cifras.',
    });
  }
});

test('US-68 CA4: 00999 y 53000 no son de España; 01000 y 52999 se aceptan si existen', async () => {
  for (const codigo_postal of ['00999', '53000']) {
    assert.deepEqual(await detailsDe({ ...historia, codigo_postal }), {
      codigo_postal: 'El código postal no es de España.',
    });
  }
  for (const codigo_postal of ['01000', '52999']) {
    assert.equal((await guardar({ ...historia, codigo_postal })).status, 200);
  }
});

// CA5, CA12
test('US-68 CA5: un código con formato válido que no está en la tabla → 400 CODIGO_POSTAL_DESCONOCIDO', async () => {
  const response = await guardar({ ...historia, codigo_postal: '52998' });

  assert.equal(response.status, 400);
  const error = await errorDe(response);
  assert.equal(error.code, 'CODIGO_POSTAL_DESCONOCIDO');
  assert.equal(error.message, 'No conocemos este código postal. Revísalo.');
  assert.deepEqual(error.details, { codigo_postal: 'No conocemos este código postal. Revísalo.' });
  assert.equal(centros.u1.codigo_postal, null);
});

// CA6
test('US-68 CA6: la localidad es obligatoria y tiene como máximo 120 caracteres', async () => {
  assert.deepEqual(await detailsDe({ ...historia, localidad: '  ' }), {
    localidad: 'La localidad es obligatoria.',
  });
  assert.deepEqual(await detailsDe({ ...historia, localidad: 'a'.repeat(121) }), {
    localidad: 'Como máximo 120 caracteres.',
  });
  assert.equal((await guardar({ ...historia, localidad: 'a'.repeat(120) })).status, 200);
});

test('US-68 CA12: devuelve los errores de todos los campos a la vez y no guarda nada', async () => {
  assert.deepEqual(await detailsDe({ direccion: 'a'.repeat(256), codigo_postal: '0802', localidad: '' }), {
    direccion: 'Como máximo 255 caracteres.',
    codigo_postal: 'El código postal debe tener 5 cifras.',
    localidad: 'La localidad es obligatoria.',
  });
  assert.deepEqual(guardadas, []);
});

test('US-68: los campos que no son texto se rechazan', async () => {
  assert.deepEqual(await detailsDe({ direccion: 12, codigo_postal: 8025, localidad: ['Barcelona'] }), {
    direccion: 'Debe ser un texto.',
    codigo_postal: 'Debe ser un texto.',
    localidad: 'Debe ser un texto.',
  });
});

test('US-68: los emojis cuentan como 1 carácter', async () => {
  assert.equal((await guardar({ ...historia, localidad: '🏊'.repeat(120) })).status, 200);
  assert.deepEqual(await detailsDe({ ...historia, localidad: '🏊'.repeat(121) }), {
    localidad: 'Como máximo 120 caracteres.',
  });
});

test('US-68 CA8: provincia, latitud y longitud enviadas por el cliente no se usan', async () => {
  const response = await guardar({ ...historia, provincia: 'Madrid', latitud: 0, longitud: 0 });

  assert.equal(response.status, 200);
  assert.deepEqual(guardadas[0].ubicacion, historia);
  assert.equal((await response.json()).centro.provincia, 'Barcelona');
});

test('US-68 CA12: un cuerpo que no es JSON → 400 JSON_INVALIDO', async () => {
  const response = await guardar('{"codigo_postal":');

  assert.equal(response.status, 400);
  assert.equal((await errorDe(response)).code, 'JSON_INVALIDO');
});

test('US-68 CA12: un cuerpo que no es un objeto → 400 DATOS_INVALIDOS con los obligatorios', async () => {
  assert.deepEqual(await detailsDe([]), {
    codigo_postal: 'El código postal es obligatorio.',
    localidad: 'La localidad es obligatoria.',
  });
});

test('US-68 CA12: sin sesión → 401 NO_AUTENTICADO', async () => {
  const response = await guardar(historia, null);

  assert.equal(response.status, 401);
  assert.equal((await errorDe(response)).code, 'NO_AUTENTICADO');
});

test('US-68 CA12: con el email sin confirmar → 403 EMAIL_NO_CONFIRMADO y no se guarda', async () => {
  const response = await guardar(historia, 'token-sin-confirmar');

  assert.equal(response.status, 403);
  assert.equal((await errorDe(response)).code, 'EMAIL_NO_CONFIRMADO');
  assert.deepEqual(guardadas, []);
});

test('US-68 CA12: sin base de datos → 503 BASE_DATOS_NO_DISPONIBLE', async () => {
  caida = true;
  const response = await guardar(historia);

  assert.equal(response.status, 503);
  assert.equal((await errorDe(response)).code, 'BASE_DATOS_NO_DISPONIBLE');
});

test('US-68: una cuenta sin centro recibe 404 NO_ENCONTRADO', async () => {
  const response = await guardar(historia, 'token-sin-centro');

  assert.equal(response.status, 404);
  assert.equal((await errorDe(response)).code, 'NO_ENCONTRADO');
});

test('US-68: otros métodos en /api/centros/mio/ubicacion → 405', async () => {
  const response = await guardar(historia, 'token-confirmado', 'PATCH');

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'PUT');
});
