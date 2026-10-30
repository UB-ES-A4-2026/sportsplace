// T70-3 · E2E de US-70 (retirar un anuncio de forma definitiva). Casos: docs/especificacion/E03 (US-70).
// Usa la plantilla de T12-7 y la semilla de T12-8. Cada caso crea sus propios anuncios copiando una fila
// de la semilla, así no depende del formato de POST /api/anuncios (JSON hoy, multipart con US-13).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { fixtureAnuncios, seedAnuncios } from '../../tools/scripts/e2e-fixtures.js';

// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = fixtureAnuncios()[0].id;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const MENSAJE_409 = 'Esta acción no está disponible en el estado actual del anuncio.';
const ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

let db;
let centros;
const creados = [];

// ---------------------------------------------------------------- utilidades

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

async function centroId(email) {
  const { rows } = await db.query('SELECT id FROM public.centros WHERE email = $1', [email]);
  expect(rows).toHaveLength(1);
  return rows[0].id;
}

// Copia la fila plantilla con los cambios indicados (sirve con o sin las columnas de US-14).
async function insertarAnuncio(cambios) {
  const ahora = new Date().toISOString();
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify({
      id: crypto.randomUUID(), estado: 'activo', publicado_en: ahora, creado_en: ahora, actualizado_en: ahora,
      retirado_en: null, entregado_en: null, ...cambios,
    })],
  );
  creados.push(rows[0].id);
  return rows[0].id;
}

async function filaDe(id) {
  const { rows } = await db.query(
    'SELECT estado, retirado_en, actualizado_en FROM public.anuncios WHERE id = $1',
    [id],
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

// CA10: con US-13 en la rama, el anuncio lleva una foto y se comprueba que la retirada no la borra.
async function tablaFotos() {
  const { rows } = await db.query("SELECT to_regclass('public.anuncio_fotos') IS NOT NULL AS existe");
  return rows[0].existe;
}

async function anadirFoto(anuncio) {
  if (!(await tablaFotos())) return;
  await db.query(
    `INSERT INTO public.anuncio_fotos (anuncio_id, ruta, tipo_mime, bytes, orden, es_principal)
     VALUES ($1, $2, 'image/jpeg', 1024, 1, true)`,
    [anuncio, `${centros.a}/${anuncio}/foto-e2e.jpg`],
  );
}

async function fotosDe(anuncio) {
  if (!(await tablaFotos())) return 0;
  const { rows } = await db.query('SELECT count(*)::int AS n FROM public.anuncio_fotos WHERE anuncio_id = $1', [anuncio]);
  return rows[0].n;
}

function dialogoRetirar(page) {
  return page.getByRole('dialog', { name: '¿Retirar este anuncio?' });
}

function botonRetirar(page) {
  return page.getByRole('button', { name: 'Retirar anuncio', exact: true });
}

async function abrirFicha(page, id, titulo) {
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
}

// Cuenta las peticiones DELETE /api/anuncios/:id que hace el navegador.
function contarRetiradas(page) {
  const contador = { n: 0 };
  page.on('request', (req) => {
    if (req.method() === 'DELETE' && /^\/api\/anuncios\/[^/]+$/.test(new URL(req.url()).pathname)) contador.n += 1;
  });
  return contador;
}

// ---------------------------------------------------------------- preparación

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  await seedAnuncios(db, { requireAnuncios: true });
  centros = { a: await centroId(cuentas.centroA), b: await centroId(cuentas.centroB) };
});

// Lo que crea cada caso se retira al acabar: no se ve en «Mis anuncios» de los demás specs.
test.afterEach(async () => {
  if (!creados.length) return;
  await db.query(
    `UPDATE public.anuncios SET estado = 'retirado', retirado_en = coalesce(retirado_en, now())
     WHERE id = ANY($1::uuid[]) AND estado <> 'retirado'`,
    [creados.splice(0)],
  );
});

test.afterAll(async () => {
  await db?.close();
});

// ---------------------------------------------------------------- flujos e2e

test('US-70 · E2E-1 · retirar desde la ficha', async ({ page, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Conos de entrenamiento' });
  await anadirFoto(id);
  const fotos = await fotosDe(id);

  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, 'Conos de entrenamiento');

  // CA2: diálogo con sus textos.
  await botonRetirar(page).click();
  const dialogo = dialogoRetirar(page);
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Dejará de estar disponible y no podrás recuperarlo.')).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeVisible();

  // CA3: mientras se envía, «Retirando…» y deshabilitado. Se retiene el DELETE hasta comprobarlo.
  let soltar;
  const retenido = new Promise((resolve) => { soltar = resolve; });
  await page.route(`**/api/anuncios/${id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    await retenido;
    return route.continue();
  });
  await dialogo.getByRole('button', { name: 'Retirar', exact: true }).click();
  await expect(dialogo.getByRole('button', { name: 'Retirando…' })).toBeDisabled();
  soltar();

  // CA4: a «Mis anuncios» con el aviso y sin el anuncio en la lista.
  await expect(page).toHaveURL('/mis-anuncios');
  await expect(page.getByText('Anuncio retirado.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis anuncios' })).toBeVisible();
  await expect(page.getByRole('main').locator('a[href^="/anuncios/"]:not([href="/anuncios/nuevo"])').first()).toBeVisible();
  await expect(page.getByText('Conos de entrenamiento')).toHaveCount(0);

  // CA7 y CA10: retirada lógica, con retirado_en y sin borrar las fotos.
  const fila = await filaDe(id);
  expect(fila.estado).toBe('retirado');
  expect(fila.retirado_en).not.toBeNull();
  expect(await fotosDe(id)).toBe(fotos);

  // CA4: con `replace`, «Atrás» no vuelve a la ficha retirada.
  await page.goBack();
  await expect(page).not.toHaveURL(`/anuncios/${id}`);

  // CA5: la ficha da «Anuncio no encontrado» también al propietario.
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByText('Anuncio no encontrado')).toBeVisible();
  await expect(page.getByText('Este anuncio no existe o ya no está disponible.')).toBeVisible();
  // [Depende de US-15] /anuncios/:id/editar todavía no existe en esta historia; cuando entre, mismo resultado.
});

test('US-70 · E2E-2 · cancelar', async ({ page, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Petos de colores' });
  const antes = await filaDe(id);
  const retiradas = contarRetiradas(page);

  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, 'Petos de colores');
  const dialogo = dialogoRetirar(page);

  // CA2: «Cancelar», Esc y el clic fuera cierran sin hacer nada.
  await botonRetirar(page).click();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialogo).toBeHidden();

  await botonRetirar(page).click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();

  await botonRetirar(page).click();
  await expect(dialogo).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialogo).toBeHidden();

  await expect(page).toHaveURL(`/anuncios/${id}`);
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  expect(retiradas.n).toBe(0);
  expect(await filaDe(id)).toEqual(antes);
});

test('US-70 · E2E-3 · entregado', async ({ page, request, cuentas }) => {
  const id = await insertarAnuncio({
    centro_id: centros.a, titulo: 'Vallas entregadas', estado: 'entregado', entregado_en: new Date().toISOString(),
  });

  // CA1: sin botón en `entregado`.
  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, 'Vallas entregadas');
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(botonRetirar(page)).toHaveCount(0);

  // CA8: DELETE directo → 409 con el estado actual.
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const res = await request.delete(`/api/anuncios/${id}`, { headers: { Authorization: `Bearer ${tokenA}` } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatchObject({
    code: 'TRANSICION_NO_PERMITIDA', message: MENSAJE_409, details: { estado_actual: 'entregado' },
  });
  expect((await filaDe(id)).estado).toBe('entregado');
});

test('US-70 · E2E-4 · otro centro y repetición', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Colchonetas de gimnasia' });
  const authA = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  const authB = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroB, cuentas.password)}` };

  // 1. B no puede retirar el anuncio de A: 404 y sigue activo (CA8).
  const ajeno = await request.delete(`/api/anuncios/${id}`, { headers: authB });
  expect(ajeno.status()).toBe(404);
  expect((await ajeno.json()).error).toMatchObject({ code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
  expect((await filaDe(id)).estado).toBe('activo');

  // 2. A lo retira: 204 sin cuerpo (CA7); el segundo DELETE da 404 (CA12).
  const primero = await request.delete(`/api/anuncios/${id}`, { headers: authA });
  expect(primero.status()).toBe(204);
  expect(await primero.body()).toHaveLength(0);
  const fila = await filaDe(id);
  expect(fila.estado).toBe('retirado');
  expect(fila.retirado_en).not.toBeNull();

  const segundo = await request.delete(`/api/anuncios/${id}`, { headers: authA });
  expect(segundo.status()).toBe(404);
  expect((await segundo.json()).error.code).toBe('NO_ENCONTRADO');
});

// ---------------------------------------------------------------- criterios sueltos

test('US-70 · CA1 · el botón se ve en activo, pausado y reservado', async ({ page, cuentas }) => {
  // `borrador` llega con US-20: hasta entonces la base de datos no admite ese estado.
  const casos = [
    ['activo', 'Activo', 'Balones para retirar activo'],
    ['pausado', 'Pausado', 'Balones para retirar pausado'],
    ['reservado', 'Reservado', 'Balones para retirar reservado'],
  ];
  const ids = [];
  for (const [estado, , titulo] of casos) ids.push(await insertarAnuncio({ centro_id: centros.a, titulo, estado }));

  await entrar(page, cuentas.centroA, cuentas.password);
  for (const [indice, [, etiqueta, titulo]] of casos.entries()) {
    await abrirFicha(page, ids[indice], titulo);
    await expect(page.getByText(etiqueta, { exact: true })).toBeVisible();
    await expect(botonRetirar(page)).toBeVisible();
  }
});

test.describe('US-70 · CA6 · errores al retirar desde la ficha', () => {
  test('409: el anuncio cambió de estado mientras tanto', async ({ page, cuentas }) => {
    const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Raquetas de pádel' });
    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id, 'Raquetas de pádel');
    await botonRetirar(page).click();

    // Otra pestaña lo marca como entregado antes de confirmar.
    await db.query("UPDATE public.anuncios SET estado = 'entregado', entregado_en = now() WHERE id = $1", [id]);
    await dialogoRetirar(page).getByRole('button', { name: 'Retirar', exact: true }).click();

    await expect(dialogoRetirar(page)).toBeHidden();
    await expect(page.getByText(MENSAJE_409)).toBeVisible();
    await expect(page).toHaveURL(`/anuncios/${id}`);
    expect((await filaDe(id)).estado).toBe('entregado');
  });

  for (const variante of ['500', '503', 'red caída']) {
    test(`${variante}: aviso genérico y sin cambios`, async ({ page, cuentas }) => {
      const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Cronómetros de mano' });
      await page.route(`**/api/anuncios/${id}`, (route) => {
        if (route.request().method() !== 'DELETE') return route.continue();
        if (variante === 'red caída') return route.abort('failed');
        const [status, code] = variante === '500'
          ? [500, 'ERROR_INTERNO'] : [503, 'BASE_DATOS_NO_DISPONIBLE'];
        return route.fulfill({ status, json: { error: { code, message: ERROR_GENERICO } } });
      });

      await entrar(page, cuentas.centroA, cuentas.password);
      await abrirFicha(page, id, 'Cronómetros de mano');
      await botonRetirar(page).click();
      await dialogoRetirar(page).getByRole('button', { name: 'Retirar', exact: true }).click();

      await expect(dialogoRetirar(page)).toBeHidden();
      await expect(page.getByText(ERROR_GENERICO)).toBeVisible();
      await expect(page).toHaveURL(`/anuncios/${id}`);
      await expect(page.getByText('Activo', { exact: true })).toBeVisible();
      expect((await filaDe(id)).estado).toBe('activo');
    });
  }
});

test('US-70 · CA8, CA9 y CA11 · API', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Redes de voleibol' });
  const authA = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };

  // CA9: sin sesión → 401 y el anuncio no cambia. El 403 EMAIL_NO_CONFIRMADO lo cubren los tests
  // del backend: la cuenta sin confirmar no puede obtener token (el login responde 403).
  const sinSesion = await request.delete(`/api/anuncios/${id}`);
  expect(sinSesion.status()).toBe(401);
  expect((await filaDe(id)).estado).toBe('activo');

  // CA8: inexistente y no UUID → 404 NO_ENCONTRADO.
  for (const otro of [INEXISTENTE, 'abc']) {
    const res = await request.delete(`/api/anuncios/${otro}`, { headers: authA });
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
  }

  // CA11: una vez retirado, ninguna ruta lo devuelve.
  expect((await request.delete(`/api/anuncios/${id}`, { headers: authA })).status()).toBe(204);
  const ficha = await request.get(`/api/anuncios/${id}`, { headers: authA });
  expect(ficha.status()).toBe(404);
  expect((await ficha.json()).error.code).toBe('NO_ENCONTRADO');
  // [Depende de US-18, US-16, US-17 y US-15] GET /mios, las transiciones y PATCH: sus QA lo comprueban
  // con el anuncio retirado de la semilla («Material retirado»).
});
