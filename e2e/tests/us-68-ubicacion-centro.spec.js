// T68-4 · E2E de US-68 (indicar dónde está mi centro).
// Casos: docs/especificacion/E01-E02 (US-68). Usa la plantilla de T12-7 y la semilla de T12-8.
// Los casos de API (CA3-CA19) solo dependen de T68-1 y T68-2; E2E-1 a E2E-4, de T68-3.
// La semilla registra los centros sin código postal (como los de Sprint 0), así que
// el centro A parte con la banda amarilla de CA10.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';

const UBICACION = ['direccion', 'codigo_postal', 'localidad', 'provincia', 'latitud', 'longitud'];
const DATOS_HISTORIA = { direccion: 'Carrer de la Piscina 12', codigo_postal: '08025', localidad: 'Barcelona' };
const BANDA = 'Indica tu código postal para que los demás centros sepan a qué distancia estás.';
const OCULTOS = ['direccion', 'codigo_postal', 'latitud', 'longitud'];

let db;
const originales = {};

// ---------------------------------------------------------------- utilidades

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

async function filaCentro(email) {
  const { rows } = await db.query(
    `SELECT id, ${UBICACION.join(', ')}, actualizado_en FROM public.centros WHERE email = $1`,
    [email],
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

// Deja la ubicación de cada centro como estaba en la semilla, para que cada caso parta del mismo estado.
async function restablecerUbicacion() {
  for (const fila of Object.values(originales)) {
    await db.query(
      `UPDATE public.centros SET ${UBICACION.map((campo, i) => `${campo} = $${i + 2}`).join(', ')} WHERE id = $1`,
      [fila.id, ...UBICACION.map((campo) => fila[campo])],
    );
  }
}

async function putUbicacion(request, token, data) {
  return request.put('/api/centros/mio/ubicacion', { headers: { Authorization: `Bearer ${token}` }, data });
}

function campo(page, etiqueta) {
  return page.getByLabel(etiqueta, { exact: true });
}

async function rellenar(page, { direccion, codigo_postal: codigoPostal, localidad }) {
  await campo(page, 'Dirección').fill(direccion);
  await campo(page, 'Código postal').fill(codigoPostal);
  await campo(page, 'Localidad').fill(localidad);
}

function boton(page, nombre) {
  return page.getByRole('link', { name: nombre, exact: true })
    .or(page.getByRole('button', { name: nombre, exact: true }));
}

async function irAUbicacionDesdePerfil(page, nombreBoton) {
  await page.goto('/perfil');
  await expect(page.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeVisible();
  await boton(page, nombreBoton).click();
  await expect(page).toHaveURL('/perfil/ubicacion');
  await expect(page.getByRole('heading', { level: 1, name: 'Ubicación del centro' })).toBeVisible();
  await expect(page.getByText('Los demás centros solo verán tu localidad y tu provincia.', { exact: true })).toBeVisible();
}

// ---------------------------------------------------------------- preparación

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  originales.a = await filaCentro(cuentas.centroA);
  originales.b = await filaCentro(cuentas.centroB);
});

test.afterEach(async () => {
  await restablecerUbicacion();
});

test.afterAll(async () => {
  await db?.close();
});

// ---------------------------------------------------------------- flujos e2e (pantallas de T68-3)

test('US-68 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await irAUbicacionDesdePerfil(page, 'Indicar ubicación');

  await rellenar(page, DATOS_HISTORIA);
  await page.getByRole('button', { name: 'Guardar ubicación', exact: true }).click();

  // CA2: vuelve a /perfil con el aviso verde y la zona.
  await expect(page).toHaveURL('/perfil');
  await expect(page.getByText('Ubicación guardada.', { exact: true })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByText('Zona: Barcelona (Barcelona)', { exact: true })).toBeVisible();
  await expect(main.getByText('Dirección (solo la ves tú): Carrer de la Piscina 12, 08025 Barcelona', { exact: true }))
    .toBeVisible();

  // CA7 y CA8: provincia y coordenadas salen de codigos_postales; la localidad, del usuario.
  const fila = await filaCentro(cuentas.centroA);
  expect(fila).toMatchObject({ ...DATOS_HISTORIA, provincia: 'Barcelona' });
  expect(fila.latitud).not.toBeNull();
  expect(fila.longitud).not.toBeNull();

  // CA1: «Editar ubicación» abre el formulario con los valores actuales.
  await irAUbicacionDesdePerfil(page, 'Editar ubicación');
  await expect(campo(page, 'Dirección')).toHaveValue(DATOS_HISTORIA.direccion);
  await expect(campo(page, 'Código postal')).toHaveValue(DATOS_HISTORIA.codigo_postal);
  await expect(campo(page, 'Localidad')).toHaveValue(DATOS_HISTORIA.localidad);
});

test('US-68 · E2E-2 · formato del código postal', async ({ page, cuentas }) => {
  const antes = await filaCentro(cuentas.centroA);
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/ubicacion');

  await rellenar(page, { ...DATOS_HISTORIA, codigo_postal: '0802' });
  await page.getByRole('button', { name: 'Guardar ubicación', exact: true }).click();

  await expect(page.getByText('El código postal debe tener 5 cifras.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/perfil/ubicacion');
  expect(await filaCentro(cuentas.centroA)).toEqual(antes);
});

test('US-68 · E2E-3 · código postal desconocido', async ({ page, cuentas }) => {
  const antes = await filaCentro(cuentas.centroA);
  const { rows } = await db.query("SELECT 1 FROM public.codigos_postales WHERE codigo_postal = '52998'");
  expect(rows).toHaveLength(0);

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/ubicacion');
  await rellenar(page, { ...DATOS_HISTORIA, codigo_postal: '52998' });
  await page.getByRole('button', { name: 'Guardar ubicación', exact: true }).click();

  await expect(page.getByText('No conocemos este código postal. Revísalo.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL('/perfil/ubicacion');
  expect(await filaCentro(cuentas.centroA)).toEqual(antes);
});

test('US-68 · E2E-4 · centro antiguo sin código postal', async ({ page, cuentas }) => {
  expect(originales.a.codigo_postal).toBeNull();
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil');

  // CA10: banda amarilla hasta que se indica el código postal.
  await expect(page.getByText(BANDA, { exact: true })).toBeVisible();
  await irAUbicacionDesdePerfil(page, 'Indicar ubicación');
  await rellenar(page, { direccion: '', codigo_postal: '17001', localidad: 'Girona' });
  await page.getByRole('button', { name: 'Guardar ubicación', exact: true }).click();

  await expect(page).toHaveURL('/perfil');
  await expect(page.getByText('Ubicación guardada.', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('Zona: Girona (Girona)', { exact: true })).toBeVisible();
  await expect(page.getByText(BANDA, { exact: true })).toHaveCount(0);
  expect(await filaCentro(cuentas.centroA)).toMatchObject({
    codigo_postal: '17001', localidad: 'Girona', provincia: 'Girona', direccion: null,
  });
});

test('US-68 · CA1 y CA2 · ruta privada y «Cancelar» sin guardar', async ({ page, cuentas }) => {
  await page.goto('/perfil/ubicacion');
  await expect(page).toHaveURL(/\/entrar$/);

  const antes = await filaCentro(cuentas.centroA);
  let llamadas = 0;
  await page.route('**/api/centros/mio/ubicacion', (route) => {
    if (route.request().method() === 'PUT') llamadas += 1;
    return route.continue();
  });
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/ubicacion');
  await rellenar(page, DATOS_HISTORIA);
  await boton(page, 'Cancelar').click();

  await expect(page).toHaveURL('/perfil');
  expect(llamadas).toBe(0);
  expect(await filaCentro(cuentas.centroA)).toEqual(antes);
});

test('US-68 · CA9 · «Guardando…» durante el envío', async ({ page, cuentas }) => {
  let soltar;
  const retenido = new Promise((resolve) => { soltar = resolve; });
  await page.route('**/api/centros/mio/ubicacion', async (route) => {
    await retenido;
    return route.continue();
  });

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil/ubicacion');
  await rellenar(page, DATOS_HISTORIA);
  await page.getByRole('button', { name: 'Guardar ubicación', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Guardando…', exact: true })).toBeVisible();
  soltar();
  await expect(page).toHaveURL('/perfil');
});

// ---------------------------------------------------------------- API (CA3-CA19)

test.describe('US-68 · API de /api/centros/mio/ubicacion', () => {
  let token;

  test.beforeEach(async ({ request, cuentas }) => {
    token = await tokenDe(request, cuentas.centroA, cuentas.password);
  });

  const RECHAZOS = [
    ['CA3', { direccion: 'a'.repeat(256) }, 'direccion', 'Como máximo 255 caracteres.'],
    ['CA4', { codigo_postal: '' }, 'codigo_postal', 'El código postal es obligatorio.'],
    ['CA4', { codigo_postal: '   ' }, 'codigo_postal', 'El código postal es obligatorio.'],
    ['CA4', { codigo_postal: '0802' }, 'codigo_postal', 'El código postal debe tener 5 cifras.'],
    ['CA4', { codigo_postal: '080251' }, 'codigo_postal', 'El código postal debe tener 5 cifras.'],
    ['CA4', { codigo_postal: '08O25' }, 'codigo_postal', 'El código postal debe tener 5 cifras.'],
    ['CA4', { codigo_postal: '00999' }, 'codigo_postal', 'El código postal no es de España.'],
    ['CA4', { codigo_postal: '53000' }, 'codigo_postal', 'El código postal no es de España.'],
    ['CA6', { localidad: '' }, 'localidad', 'La localidad es obligatoria.'],
    ['CA6', { localidad: 'a'.repeat(121) }, 'localidad', 'Como máximo 120 caracteres.'],
  ];

  for (const [ca, cambio, clave, mensaje] of RECHAZOS) {
    const muestra = JSON.stringify(cambio).slice(0, 40);
    test(`${ca} y CA12 · rechaza ${muestra} con «${mensaje}» y no guarda nada`, async ({ request, cuentas }) => {
      const antes = await filaCentro(cuentas.centroA);
      const res = await putUbicacion(request, token, { ...DATOS_HISTORIA, ...cambio });
      expect(res.status()).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('DATOS_INVALIDOS');
      expect(error.details).toEqual({ [clave]: mensaje });
      expect(await filaCentro(cuentas.centroA)).toEqual(antes);
    });
  }

  test('CA12 · varios errores a la vez, sin guardar nada', async ({ request, cuentas }) => {
    const antes = await filaCentro(cuentas.centroA);
    const res = await putUbicacion(request, token, { direccion: 'a'.repeat(256), codigo_postal: '0802', localidad: ' ' });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.details).toEqual({
      direccion: 'Como máximo 255 caracteres.',
      codigo_postal: 'El código postal debe tener 5 cifras.',
      localidad: 'La localidad es obligatoria.',
    });
    expect(await filaCentro(cuentas.centroA)).toEqual(antes);
  });

  test('CA5 y CA12 · formato válido que no está en la tabla → CODIGO_POSTAL_DESCONOCIDO', async ({ request, cuentas }) => {
    const antes = await filaCentro(cuentas.centroA);
    const res = await putUbicacion(request, token, { ...DATOS_HISTORIA, codigo_postal: '52998' });
    expect(res.status()).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('CODIGO_POSTAL_DESCONOCIDO');
    expect(error.details).toEqual({ codigo_postal: 'No conocemos este código postal. Revísalo.' });
    expect(await filaCentro(cuentas.centroA)).toEqual(antes);
  });

  test('CA4 · 01000 y 52999 se aceptan si existen en la tabla', async ({ request, cuentas }) => {
    const limites = [['01000', 'Álava', 42.85, -2.67], ['52999', 'Melilla', 35.29, -2.94]];
    try {
      for (const fila of limites) {
        await db.query(
          'INSERT INTO public.codigos_postales (codigo_postal, provincia, latitud, longitud) VALUES ($1, $2, $3, $4)',
          fila,
        );
      }
      for (const [codigoPostal, provincia] of limites) {
        const res = await putUbicacion(request, token, { ...DATOS_HISTORIA, codigo_postal: codigoPostal });
        expect(res.status()).toBe(200);
        expect(await filaCentro(cuentas.centroA)).toMatchObject({ codigo_postal: codigoPostal, provincia });
      }
    } finally {
      await restablecerUbicacion();
      await db.query("DELETE FROM public.codigos_postales WHERE codigo_postal IN ('01000', '52999')");
    }
  });

  test('CA3 y CA6 · acepta 255 caracteres de dirección y 120 de localidad, recortados', async ({ request, cuentas }) => {
    const cuerpo = { direccion: ` ${'a'.repeat(255)} `, codigo_postal: ' 08025 ', localidad: ` ${'b'.repeat(120)} ` };
    const res = await putUbicacion(request, token, cuerpo);
    expect(res.status()).toBe(200);
    expect(await filaCentro(cuentas.centroA)).toMatchObject({
      direccion: 'a'.repeat(255), codigo_postal: '08025', localidad: 'b'.repeat(120),
    });
  });

  test('CA7, CA8 y CA11 · 200 con provincia y coordenadas de codigos_postales', async ({ request, cuentas }) => {
    const res = await putUbicacion(request, token, { ...DATOS_HISTORIA, localidad: 'Barna' });
    expect(res.status()).toBe(200);
    const { centro } = await res.json();
    const { rows: [cp] } = await db.query(
      "SELECT provincia, latitud::float8 AS latitud, longitud::float8 AS longitud FROM public.codigos_postales WHERE codigo_postal = '08025'",
    );
    expect(centro).toMatchObject({ ...DATOS_HISTORIA, localidad: 'Barna', ...cp });
    expect(await filaCentro(cuentas.centroA)).toMatchObject({ localidad: 'Barna', provincia: 'Barcelona' });
  });

  test('CA13 · GET /api/centros/mio incluye provincia, latitud y longitud', async ({ request }) => {
    expect((await putUbicacion(request, token, DATOS_HISTORIA)).status()).toBe(200);
    const res = await request.get('/api/centros/mio', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const { centro } = await res.json();
    expect(centro).toMatchObject({ ...DATOS_HISTORIA, provincia: 'Barcelona' });
    expect(typeof centro.latitud).toBe('number');
    expect(typeof centro.longitud).toBe('number');
  });

  test('CA14 · ninguna respuesta sobre otro centro expone su dirección ni sus coordenadas', async ({ request, cuentas }) => {
    const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);
    expect((await putUbicacion(request, tokenB, { ...DATOS_HISTORIA, codigo_postal: '17001', localidad: 'Girona' }))
      .status()).toBe(200);
    const centroB = await filaCentro(cuentas.centroB);
    const { rows: [anuncioB] } = await db.query(
      'SELECT id FROM public.anuncios WHERE centro_id = $1 LIMIT 1', [centroB.id],
    );

    const respuestas = [await request.get(`/api/centros/${centroB.id}`, { headers: { Authorization: `Bearer ${token}` } })];
    if (anuncioB) {
      respuestas.push(await request.get(`/api/anuncios/${anuncioB.id}`, { headers: { Authorization: `Bearer ${token}` } }));
    }
    for (const res of respuestas) {
      const texto = await res.text();
      for (const clave of OCULTOS) expect(texto).not.toContain(`"${clave}"`);
      expect(texto).not.toContain(DATOS_HISTORIA.direccion);
    }
  });

  test('CA17 y CA18 · una sola ubicación: cambiar 08025 por 17001 actualiza provincia y coordenadas', async ({ request, cuentas }) => {
    expect((await putUbicacion(request, token, DATOS_HISTORIA)).status()).toBe(200);
    const barcelona = await filaCentro(cuentas.centroA);
    const res = await putUbicacion(request, token, { ...DATOS_HISTORIA, codigo_postal: '17001', localidad: 'Girona' });
    expect(res.status()).toBe(200);
    const girona = await filaCentro(cuentas.centroA);
    expect(girona).toMatchObject({ id: barcelona.id, codigo_postal: '17001', provincia: 'Girona' });
    expect([girona.latitud, girona.longitud]).not.toEqual([barcelona.latitud, barcelona.longitud]);
    const { rows } = await db.query('SELECT count(*)::int AS n FROM public.centros WHERE email = $1', [cuentas.centroA]);
    expect(rows[0].n).toBe(1);
  });

  test('CA19 · dirección vacía guarda NULL y la zona sigue igual', async ({ request, cuentas }) => {
    expect((await putUbicacion(request, token, DATOS_HISTORIA)).status()).toBe(200);
    const antes = await filaCentro(cuentas.centroA);
    const res = await putUbicacion(request, token, { ...DATOS_HISTORIA, direccion: '   ' });
    expect(res.status()).toBe(200);
    expect(await filaCentro(cuentas.centroA)).toMatchObject({
      direccion: null, localidad: antes.localidad, provincia: antes.provincia,
      latitud: antes.latitud, longitud: antes.longitud,
    });
  });

  test('CA11 y CA12 · sin sesión responde 401 y otros métodos 405', async ({ request }) => {
    const res = await request.put('/api/centros/mio/ubicacion', { data: DATOS_HISTORIA });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO');
    const post = await request.post('/api/centros/mio/ubicacion', {
      headers: { Authorization: `Bearer ${token}` }, data: DATOS_HISTORIA,
    });
    expect(post.status()).toBe(405);
  });
});
