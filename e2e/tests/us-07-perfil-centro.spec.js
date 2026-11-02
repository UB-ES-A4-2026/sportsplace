// T07-4 · E2E de US-07 (editar la descripción y los datos de contacto del perfil de mi centro).
// Casos: docs/especificacion/E01-E02 (US-07). Usa la plantilla de T12-7 y la semilla de T12-8.
// Los casos de API (CA6-CA10 y CA17-CA25) solo dependen de T07-1 y T07-2; E2E-1 a E2E-5, de T07-3.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';

const PERFIL = ['nombre', 'descripcion', 'telefono', 'email_contacto', 'web'];
const DATOS_HISTORIA = {
  descripcion: 'Club de natación con 2 piscinas de 25 m. Renovamos material cada temporada.',
  telefono: '+34 931 234 567',
  email_contacto: 'material@clubnatacio.cat',
  web: 'https://clubnatacio.cat',
};

let db;
let original;

// ---------------------------------------------------------------- utilidades

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

async function filaCentro(email) {
  const { rows } = await db.query(
    `SELECT id, ${PERFIL.join(', ')}, actualizado_en FROM public.centros WHERE email = $1`,
    [email],
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

// Deja el perfil del centro A como estaba en la semilla, para que cada caso parta del mismo estado.
async function restablecerPerfil() {
  await db.query(
    `UPDATE public.centros SET ${PERFIL.map((campo, i) => `${campo} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [original.id, ...PERFIL.map((campo) => original[campo])],
  );
}

async function patchPerfil(request, token, data) {
  return request.patch('/api/centros/mio', { headers: { Authorization: `Bearer ${token}` }, data });
}

// Web de exactamente n caracteres con un dominio válido.
function webDe(n) {
  const base = 'https://clubnatacio.cat/';
  return base + 'a'.repeat(n - base.length);
}

async function irAMiPerfil(page) {
  await page.getByRole('button', { name: /Club Natació Exemple/ }).click();
  await page.getByRole('menuitem', { name: 'Mi perfil', exact: true })
    .or(page.getByRole('link', { name: 'Mi perfil', exact: true }))
    .click();
  await expect(page).toHaveURL('/perfil');
  await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
}

async function irAEditar(page) {
  await page.getByRole('link', { name: 'Editar perfil', exact: true })
    .or(page.getByRole('button', { name: 'Editar perfil', exact: true }))
    .click();
  await expect(page).toHaveURL('/perfil/editar');
  await expect(page.getByRole('heading', { level: 1, name: 'Editar perfil' })).toBeVisible();
}

function campo(page, etiqueta) {
  return page.getByLabel(etiqueta, { exact: true });
}

// ---------------------------------------------------------------- preparación

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  original = await filaCentro(cuentas.centroA);
});

test.afterEach(async () => {
  await restablecerPerfil();
});

test.afterAll(async () => {
  await db?.close();
});

// ---------------------------------------------------------------- flujos e2e (pantallas de T07-3)

test('US-07 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  const antes = await filaCentro(cuentas.centroA);
  await entrar(page, cuentas.centroA, cuentas.password);
  await irAMiPerfil(page);
  await irAEditar(page);

  // CA3: el formulario llega con los valores actuales.
  await expect(campo(page, 'Nombre del centro')).toHaveValue(antes.nombre);

  await campo(page, 'Descripción').fill(DATOS_HISTORIA.descripcion);
  await campo(page, 'Teléfono de contacto').fill(DATOS_HISTORIA.telefono);
  await campo(page, 'Email de contacto').fill(DATOS_HISTORIA.email_contacto);
  await campo(page, 'Web').fill(DATOS_HISTORIA.web);
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

  // CA5: vuelve a /perfil con el aviso verde y los datos nuevos.
  await expect(page).toHaveURL('/perfil');
  await expect(page.getByText('Perfil actualizado.', { exact: true })).toBeVisible();
  for (const valor of Object.values(DATOS_HISTORIA)) {
    await expect(page.getByRole('main').getByText(valor, { exact: true })).toBeVisible();
  }

  const despues = await filaCentro(cuentas.centroA);
  expect(despues).toMatchObject(DATOS_HISTORIA);
  expect(despues.actualizado_en.getTime()).toBeGreaterThan(antes.actualizado_en.getTime());
});

test('US-07 · E2E-2 · límite de la descripción', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/editar');
  const guardar = page.getByRole('button', { name: 'Guardar cambios', exact: true });

  await campo(page, 'Descripción').fill('a'.repeat(1001));
  await expect(page.getByText('1001/1000', { exact: true })).toBeVisible();
  await guardar.click();
  await expect(page.getByText('Como máximo 1000 caracteres.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/perfil/editar');
  expect((await filaCentro(cuentas.centroA)).descripcion).toBe(original.descripcion);

  await campo(page, 'Descripción').fill('a'.repeat(1000));
  await guardar.click();
  await expect(page).toHaveURL('/perfil');
  expect((await filaCentro(cuentas.centroA)).descripcion).toBe('a'.repeat(1000));
});

test('US-07 · E2E-3 · formatos de teléfono y web', async ({ page, cuentas }) => {
  const antes = await filaCentro(cuentas.centroA);
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/editar');

  await campo(page, 'Teléfono de contacto').fill('93-123');
  await campo(page, 'Web').fill('clubnatacio.cat');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

  await expect(page.getByText('El teléfono no es válido.', { exact: true })).toBeVisible();
  await expect(page.getByText('La web debe empezar por http:// o https://.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/perfil/editar');
  expect(await filaCentro(cuentas.centroA)).toEqual(antes);
});

test('US-07 · E2E-4 · borrar un campo opcional', async ({ page, request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroA, cuentas.password);
  expect((await patchPerfil(request, token, { web: DATOS_HISTORIA.web })).status()).toBe(200);

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/editar');
  await expect(campo(page, 'Web')).toHaveValue(DATOS_HISTORIA.web);
  await campo(page, 'Web').fill('');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();

  await expect(page).toHaveURL('/perfil');
  expect((await filaCentro(cuentas.centroA)).web).toBeNull();
  await expect(page.getByRole('main').getByText(DATOS_HISTORIA.web)).toHaveCount(0);
  await expect(page.getByRole('main').getByText('—', { exact: true }).first()).toBeVisible();
});

test('US-07 · E2E-5 · cancelar con cambios', async ({ page, cuentas }) => {
  const antes = await filaCentro(cuentas.centroA);
  let llamadas = 0;
  await page.route('**/api/centros/mio', (route) => {
    if (route.request().method() === 'PATCH') llamadas += 1;
    return route.continue();
  });

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/editar');
  await campo(page, 'Nombre del centro').fill('Nombre que no se guarda');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  // CA4: confirmación antes de descartar.
  const dialogo = page.getByRole('dialog', { name: '¿Descartar cambios?' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Los cambios que has hecho no se guardarán.', { exact: true })).toBeVisible();
  await dialogo.getByRole('button', { name: 'Descartar', exact: true }).click();

  await expect(page).toHaveURL('/perfil');
  await expect(page.getByRole('main').getByText(antes.nombre, { exact: true }).first()).toBeVisible();
  expect(llamadas).toBe(0);
  expect((await filaCentro(cuentas.centroA)).nombre).toBe(antes.nombre);
});

// ---------------------------------------------------------------- API (CA6-CA10, CA17-CA25)

test.describe('US-07 · API de /api/centros/mio', () => {
  let token;

  test.beforeEach(async ({ request, cuentas }) => {
    token = await tokenDe(request, cuentas.centroA, cuentas.password);
  });

  const RECHAZOS = [
    ['CA6', { nombre: '   ' }, 'nombre', 'El nombre del centro es obligatorio.'],
    ['CA6', { nombre: 'a'.repeat(161) }, 'nombre', 'Como máximo 160 caracteres.'],
    ['CA7', { descripcion: 'a'.repeat(1001) }, 'descripcion', 'Como máximo 1000 caracteres.'],
    ['CA8', { telefono: '93123456' }, 'telefono', 'El teléfono no es válido.'],
    ['CA8', { telefono: '93-123-45-67' }, 'telefono', 'El teléfono no es válido.'],
    ['CA8', { telefono: '9'.repeat(31) }, 'telefono', 'Como máximo 30 caracteres.'],
    ['CA9', { email_contacto: 'material@clubnatacio' }, 'email_contacto', 'El email no es válido.'],
    ['CA10', { web: 'clubnatacio.cat' }, 'web', 'La web debe empezar por http:// o https://.'],
    ['CA10', { web: 'https://localhost' }, 'web', 'La web no es válida.'],
    ['CA10', { web: webDe(256) }, 'web', 'Como máximo 255 caracteres.'],
    ['CA19', { email: 'otro@example.test' }, 'email', 'Este campo no se puede modificar.'],
    ['CA19', { localidad: 'Girona' }, 'localidad', 'Este campo no se puede modificar.'],
    ['CA25', { nombre: '🏊'.repeat(161) }, 'nombre', 'Como máximo 160 caracteres.'],
  ];

  for (const [ca, cuerpo, clave, mensaje] of RECHAZOS) {
    const muestra = JSON.stringify(cuerpo).slice(0, 40);
    test(`${ca} · rechaza ${muestra} con «${mensaje}» y no guarda nada`, async ({ request, cuentas }) => {
      const antes = await filaCentro(cuentas.centroA);
      const res = await patchPerfil(request, token, cuerpo);
      expect(res.status()).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('DATOS_INVALIDOS');
      expect(error.details).toEqual({ [clave]: mensaje });
      expect(await filaCentro(cuentas.centroA)).toEqual(antes);
    });
  }

  test('CA19 · un error en un campo no guarda los demás', async ({ request, cuentas }) => {
    const antes = await filaCentro(cuentas.centroA);
    const res = await patchPerfil(request, token, { descripcion: 'Válida', telefono: '93-123', web: 'clubnatacio.cat' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.details).toEqual({
      telefono: 'El teléfono no es válido.',
      web: 'La web debe empezar por http:// o https://.',
    });
    expect(await filaCentro(cuentas.centroA)).toEqual(antes);
  });

  const ACEPTADOS = [
    ['CA6', { nombre: 'a'.repeat(160) }],
    ['CA7', { descripcion: `${'a'.repeat(499)}\n${'b'.repeat(500)}` }],
    ['CA8', { telefono: '931234567' }],
    ['CA8', { telefono: '+34 931 234 567' }],
    ['CA8', { telefono: '9'.repeat(30) }],
    ['CA10', { web: 'https://clubnatacio.cat' }],
    ['CA10', { web: webDe(255) }],
    ['CA25', { nombre: '🏊'.repeat(160) }],
    ['CA25', { descripcion: '⚽🏀'.repeat(500) }],
  ];

  for (const [ca, cuerpo] of ACEPTADOS) {
    const muestra = JSON.stringify(cuerpo).slice(0, 40);
    test(`${ca} · acepta ${muestra}`, async ({ request, cuentas }) => {
      const res = await patchPerfil(request, token, cuerpo);
      expect(res.status()).toBe(200);
      expect((await res.json()).centro).toMatchObject(cuerpo);
      expect(await filaCentro(cuentas.centroA)).toMatchObject(cuerpo);
    });
  }

  test('CA9 y CA18 · recorta espacios y guarda el email de contacto en minúsculas', async ({ request, cuentas }) => {
    const res = await patchPerfil(request, token, { email_contacto: '  Material@ClubNatacio.CAT ', telefono: ' 931234567 ' });
    expect(res.status()).toBe(200);
    expect(await filaCentro(cuentas.centroA)).toMatchObject({
      email_contacto: 'material@clubnatacio.cat', telefono: '931234567',
    });
  });

  test('CA17 · GET devuelve el centro propio con todos sus campos', async ({ request, cuentas }) => {
    const res = await request.get('/api/centros/mio', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const { centro } = await res.json();
    expect(Object.keys(centro).sort()).toEqual([
      'codigo_postal', 'creado_en', 'descripcion', 'direccion', 'email', 'email_contacto',
      'id', 'localidad', 'nombre', 'telefono', 'web',
    ]);
    expect(centro).toMatchObject({ id: original.id, email: cuentas.centroA, nombre: original.nombre });
  });

  test('CA17 y CA19 · sin sesión responde 401', async ({ request }) => {
    expect((await request.get('/api/centros/mio')).status()).toBe(401);
    const res = await request.patch('/api/centros/mio', { data: { nombre: 'X' } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO');
  });

  test('CA18 y CA21 · los campos no enviados no cambian y se actualiza actualizado_en', async ({ request, cuentas }) => {
    expect((await patchPerfil(request, token, DATOS_HISTORIA)).status()).toBe(200);
    const antes = await filaCentro(cuentas.centroA);
    const res = await patchPerfil(request, token, { descripcion: 'Solo cambia esto.' });
    expect(res.status()).toBe(200);
    const despues = await filaCentro(cuentas.centroA);
    expect(despues).toMatchObject({ ...DATOS_HISTORIA, nombre: antes.nombre, descripcion: 'Solo cambia esto.' });
    expect(despues.actualizado_en.getTime()).toBeGreaterThan(antes.actualizado_en.getTime());
  });

  test('CA18 y CA24 · null, "" o solo espacios borran un opcional', async ({ request, cuentas }) => {
    expect((await patchPerfil(request, token, DATOS_HISTORIA)).status()).toBe(200);
    const res = await patchPerfil(request, token, { descripcion: '   \n  ', telefono: null, web: '' });
    expect(res.status()).toBe(200);
    expect(await filaCentro(cuentas.centroA)).toMatchObject({
      descripcion: null, telefono: null, web: null, email_contacto: DATOS_HISTORIA.email_contacto,
    });
  });

  test('CA19 · un cuerpo que no es JSON devuelve JSON_INVALIDO', async ({ request }) => {
    const res = await request.patch('/api/centros/mio', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: '{"nombre": ',
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('JSON_INVALIDO');
  });

  test('CA22 · no existe ninguna ruta para editar otro centro por id', async ({ request, cuentas }) => {
    const otro = await filaCentro(cuentas.centroB);
    const res = await request.patch(`/api/centros/${otro.id}`, {
      headers: { Authorization: `Bearer ${token}` }, data: { nombre: 'Intruso' },
    });
    expect(res.status()).toBe(404);
    expect(await filaCentro(cuentas.centroB)).toEqual(otro);
  });
});
