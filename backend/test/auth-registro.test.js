import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { emailAlreadyRegistered } from '../src/repositories/centros.js';
import { postJson, startApi } from './helpers.js';

// US-01: registrar mi centro en la plataforma. Los dobles simulan la tabla
// centros (email único) y Supabase Auth.
let centrosGuardados;
let cuentas;
const fakeCentros = {
  async registrar(centro, crearCuenta) {
    if (centrosGuardados.some((guardado) => guardado.email === centro.email)) throw emailAlreadyRegistered();
    const usuario = await crearCuenta();
    centrosGuardados.push({ ...centro, usuario_id: usuario.id });
    return usuario;
  },
};
const fakeAuth = {
  async signUp(email, password) {
    cuentas.push({ email, password });
    return { id: `u${cuentas.length}`, email, email_confirmado: false };
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, centros: fakeCentros }); });
after(() => api.close());
beforeEach(() => {
  centrosGuardados = [];
  cuentas = [];
});

const alta = {
  nombre: '  Club Natació Exemple ',
  email: ' Centro@Example.com ',
  password: 'contraseña-segura',
  localidad: 'Barcelona',
  telefono: '930000000',
  acepta_politica_privacidad: true,
};
const registrar = (body) => postJson(`${api.baseUrl}/api/auth/registro`, body);

test('US-01: puedo darme de alta con los datos básicos de mi centro y mi email', async () => {
  const response = await registrar(alta);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    usuario: { id: 'u1', email: 'centro@example.com', email_confirmado: false },
  });
  assert.deepEqual(centrosGuardados, [{
    nombre: 'Club Natació Exemple',
    email: 'centro@example.com',
    localidad: 'Barcelona',
    direccion: null,
    codigo_postal: null,
    telefono: '930000000',
    usuario_id: 'u1',
  }]);
  assert.deepEqual(cuentas, [{ email: 'centro@example.com', password: 'contraseña-segura' }]);
});

test('US-01: no puedo darme de alta con un email que ya tiene cuenta', async () => {
  await registrar(alta);
  const response = await registrar({ ...alta, nombre: 'Otro centro', email: 'CENTRO@example.com' });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: 'EMAIL_YA_REGISTRADO', message: 'Ya existe una cuenta con este email.' },
  });
  assert.equal(centrosGuardados.length, 1);
  assert.equal(cuentas.length, 1);
});

test('US-01: para completar el alta debo aceptar la política de privacidad', async () => {
  for (const acepta of [undefined, false, 'true']) {
    const response = await registrar({ ...alta, acepta_politica_privacidad: acepta });

    assert.equal(response.status, 400);
    assert.deepEqual((await response.json()).error.details, {
      acepta_politica_privacidad: 'Debes aceptar la política de privacidad.',
    });
  }
  assert.equal(centrosGuardados.length, 0);
  assert.equal(cuentas.length, 0);
});

test('US-01: los campos obligatorios y los formatos se validan por campo', async () => {
  const response = await registrar({ email: 'no-es-un-email', password: 'corta', direccion: 'x'.repeat(256) });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los datos del formulario.',
      details: {
        nombre: 'El nombre del centro es obligatorio.',
        localidad: 'La localidad es obligatoria.',
        direccion: 'Como máximo 255 caracteres.',
        email: 'El email no es válido.',
        password: 'La contraseña debe tener al menos 8 caracteres.',
        acepta_politica_privacidad: 'Debes aceptar la política de privacidad.',
      },
    },
  });
});

test('US-01: una contraseña de más de 72 bytes se rechaza', async () => {
  const response = await registrar({ ...alta, password: 'ñ'.repeat(37) });

  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).error.details, { password: 'La contraseña es demasiado larga.' });
});

test('US-01: sin base de datos configurada el alta responde 503', async () => {
  const withoutDatabase = await startApi({ auth: fakeAuth, centros: null });
  try {
    const response = await postJson(`${withoutDatabase.baseUrl}/api/auth/registro`, alta);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'BASE_DATOS_NO_DISPONIBLE');
  } finally {
    await withoutDatabase.close();
  }
});
