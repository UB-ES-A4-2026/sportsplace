// T18-3 · E2E de US-18 (ver todos mis anuncios con su estado). Casos: docs/especificacion/E03 (US-18).
// Usa la plantilla de T12-7 y la semilla de T12-8: 21 anuncios visibles de A, uno de B y uno retirado de A.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { fixtureAnuncios, seedAnuncios } from '../../tools/scripts/e2e-fixtures.js';

const IDS_SEMILLA = fixtureAnuncios().map((anuncio) => anuncio.id);
// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = IDS_SEMILLA[0];

let db;
let centros;

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

// Los anuncios creados por otros casos (US-12, etc.) se retiran: nunca se listan (CA3)
// y la semilla vuelve a su estado inicial, así cada caso parte de 21 de A y 1 de B.
async function restablecerSemilla() {
  await db.query(
    `UPDATE public.anuncios SET estado = 'retirado', retirado_en = now(), entregado_en = NULL
     WHERE centro_id = ANY($1::uuid[]) AND NOT (id = ANY($2::uuid[])) AND estado <> 'retirado'`,
    [[centros.a, centros.b], IDS_SEMILLA],
  );
  await seedAnuncios(db, { requireAnuncios: true });
}

async function retirarTodos(centro) {
  await db.query(
    `UPDATE public.anuncios SET estado = 'retirado', retirado_en = now(), entregado_en = NULL
     WHERE centro_id = $1 AND estado <> 'retirado'`,
    [centro],
  );
}

// Copia la fila plantilla con los cambios indicados (sirve con o sin las columnas de US-14).
async function insertarAnuncio(cambios) {
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify({ id: crypto.randomUUID(), ...cambios })],
  );
  return rows[0].id;
}

async function visiblesDe(centro) {
  const { rows } = await db.query(
    "SELECT count(*)::int AS n FROM public.anuncios WHERE centro_id = $1 AND estado <> 'retirado'",
    [centro],
  );
  return rows[0].n;
}

// Cada fila contiene el enlace a la ficha con el título del anuncio (CA1).
function enlacesTitulo(page) {
  return page.getByRole('main')
    .locator('a[href^="/anuncios/"]:not([href="/anuncios/nuevo"]):not([href$="/editar"])')
    .filter({ hasText: /\S/ });
}

function fila(page, titulo) {
  return page.locator(':is(li, tr, article)')
    .filter({ has: page.getByRole('link', { name: titulo, exact: true }) })
    .last();
}

async function irAMisAnuncios(page) {
  await page.getByRole('link', { name: 'Mis anuncios', exact: true }).click();
  await expect(page).toHaveURL('/mis-anuncios');
  await expect(page.getByRole('heading', { level: 1, name: 'Mis anuncios' })).toBeVisible();
}

// ---------------------------------------------------------------- preparación

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = { a: await centroId(cuentas.centroA), b: await centroId(cuentas.centroB) };
});

test.beforeEach(async () => {
  await restablecerSemilla();
});

test.afterAll(async () => {
  if (!db) return;
  await restablecerSemilla();
  await db.close();
});

// ---------------------------------------------------------------- flujos e2e

test('US-18 · E2E-1 · lista con estados', async ({ page, cuentas }) => {
  await retirarTodos(centros.b);
  const base = Date.UTC(2026, 9, 20, 10, 0);
  const momento = (minutos) => new Date(base + minutos * 60_000).toISOString();
  const comunes = { centro_id: centros.b, publicado_en: momento(0), creado_en: momento(0), retirado_en: null, entregado_en: null };
  await insertarAnuncio({ ...comunes, titulo: 'Anuncio activo de B', estado: 'activo', actualizado_en: momento(1) });
  await insertarAnuncio({ ...comunes, titulo: 'Anuncio pausado de B', estado: 'pausado', actualizado_en: momento(2) });
  await insertarAnuncio({ ...comunes, titulo: 'Anuncio reservado de B', estado: 'reservado', actualizado_en: momento(3) });
  await insertarAnuncio({
    ...comunes, titulo: 'Anuncio entregado de B', estado: 'entregado', actualizado_en: momento(4), entregado_en: momento(4),
  });
  await insertarAnuncio({
    ...comunes, titulo: 'Anuncio retirado de B', estado: 'retirado', actualizado_en: momento(5), retirado_en: momento(5),
  });

  await entrar(page, cuentas.centroB, cuentas.password);
  await irAMisAnuncios(page);

  await expect(page.getByText('4 anuncios', { exact: true })).toBeVisible();
  // CA4: del último modificado al más antiguo; el retirado no aparece (CA3).
  await expect(enlacesTitulo(page)).toHaveText([
    'Anuncio entregado de B', 'Anuncio reservado de B', 'Anuncio pausado de B', 'Anuncio activo de B',
  ]);
  await expect(page.getByText('Anuncio retirado de B')).toHaveCount(0);
  for (const [titulo, etiqueta] of [
    ['Anuncio entregado de B', 'Entregado'], ['Anuncio reservado de B', 'Reservado'],
    ['Anuncio pausado de B', 'Pausado'], ['Anuncio activo de B', 'Activo'],
  ]) {
    await expect(fila(page, titulo).getByText(etiqueta, { exact: true })).toBeVisible();
  }
  // Datos de la fila (pantallas para el boceto).
  const activa = fila(page, 'Anuncio activo de B');
  await expect(activa.getByText('Balones · Fútbol')).toBeVisible();
  await expect(activa.getByText('1 unidad', { exact: true })).toBeVisible();
  await expect(activa.getByText('Modificado el 20/10/2026')).toBeVisible();
  // Con 4 anuncios no hay paginación (CA5).
  await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);

  // CA1: el título lleva a la ficha.
  await page.getByRole('link', { name: 'Anuncio pausado de B', exact: true }).click();
  await expect(page).toHaveURL(/\/anuncios\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Anuncio pausado de B' })).toBeVisible();
});

// [Depende de US-14] precio de la fila (T14-4) y [Depende de US-15] botón principal «Editar» según el estado (CA6).
// Se activa (quitar el fixme) cuando esas historias lleguen a dev.
test.fixme('US-18 · E2E-1 · precio y botón principal de la fila', async ({ page, cuentas }) => {
  await retirarTodos(centros.b);
  const comunes = { centro_id: centros.b, retirado_en: null, actualizado_en: new Date().toISOString() };
  await insertarAnuncio({ ...comunes, titulo: 'Anuncio activo de B', estado: 'activo', entregado_en: null });
  await insertarAnuncio({ ...comunes, titulo: 'Anuncio entregado de B', estado: 'entregado', entregado_en: new Date().toISOString() });

  await entrar(page, cuentas.centroB, cuentas.password);
  await irAMisAnuncios(page);
  const activa = fila(page, 'Anuncio activo de B');
  await expect(activa.getByText('Donación · Gratis')).toBeVisible();
  await expect(activa.getByRole('button', { name: 'Editar' }).or(activa.getByRole('link', { name: 'Editar' }))).toBeVisible();
  const entregada = fila(page, 'Anuncio entregado de B');
  await expect(entregada.getByRole('button', { name: 'Editar' }).or(entregada.getByRole('link', { name: 'Editar' }))).toHaveCount(0);
});

test('US-18 · E2E-2 · vacío', async ({ page, cuentas }) => {
  await retirarTodos(centros.b);
  await entrar(page, cuentas.centroB, cuentas.password);
  await irAMisAnuncios(page);

  await expect(page.getByText('Todavía no has publicado ningún anuncio.')).toBeVisible();
  await page.getByRole('link', { name: 'Publicar tu primer anuncio' })
    .or(page.getByRole('button', { name: 'Publicar tu primer anuncio' }))
    .click();
  await expect(page).toHaveURL('/anuncios/nuevo');
});

test('US-18 · E2E-3 · paginación', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await irAMisAnuncios(page);

  // CA15: 21 anuncios → 20 + 1, «Página x de 2».
  await expect(page.getByText('21 anuncios', { exact: true })).toBeVisible();
  await expect(enlacesTitulo(page)).toHaveCount(20);
  await expect(enlacesTitulo(page).first()).toHaveText('Material de prueba 21');
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL('/mis-anuncios?pagina=2');
  await expect(enlacesTitulo(page)).toHaveText(['Material de prueba 01']);
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

  // CA2: recargar mantiene la página.
  await page.reload();
  await expect(enlacesTitulo(page)).toHaveText(['Material de prueba 01']);

  // CA2 y CA10: página no numérica → la 1; mayor que la última → la última.
  await page.goto('/mis-anuncios?pagina=abc');
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.goto('/mis-anuncios?pagina=9');
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expect(enlacesTitulo(page)).toHaveText(['Material de prueba 01']);
});

// [Depende de US-16] la acción «Pausar» del menú «Más ▾» (T16-2). Se activa (quitar el fixme) cuando US-16 llegue a dev.
test.fixme('US-18 · E2E-4 · acción en fila', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await irAMisAnuncios(page);
  // «Material de prueba 21» es el más reciente y está activo (índice 20 de la semilla).
  const titulo = 'Material de prueba 21';
  const activa = fila(page, titulo);
  await expect(activa.getByText('Activo', { exact: true })).toBeVisible();
  let cargas = 0;
  page.on('request', (req) => {
    if (req.method() === 'GET' && new URL(req.url()).pathname === '/api/anuncios/mios') cargas += 1;
  });

  await activa.getByRole('button', { name: 'Más ▾' }).click();
  await page.getByRole('menuitem', { name: 'Pausar' }).or(page.getByRole('button', { name: 'Pausar' })).click();

  // CA6 y CA7: la fila se actualiza sin recargar y no cambia de posición.
  await expect(activa.getByText('Pausado', { exact: true })).toBeVisible();
  await expect(enlacesTitulo(page).first()).toHaveText(titulo);
  await expect(page).toHaveURL('/mis-anuncios');
  expect(cargas).toBe(0);
});

test('US-18 · E2E-5 · error y reintento', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  const falla = (route) => route.fulfill({
    status: 503,
    json: { error: { code: 'BASE_DATOS_NO_DISPONIBLE', message: 'No se ha podido completar la acción. Inténtalo de nuevo.' } },
  });
  await page.route('**/api/anuncios/mios**', falla);

  await irAMisAnuncios(page);
  await expect(page.getByText('No se ha podido cargar.')).toBeVisible();

  await page.unroute('**/api/anuncios/mios**', falla);
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(enlacesTitulo(page)).toHaveCount(20);
  await expect(page.getByText('No se ha podido cargar.')).toHaveCount(0);
});

test('US-18 · E2E-6 · aislamiento', async ({ request, cuentas }) => {
  // CA14: A tiene más de 20 anuncios y B solo ve los suyos.
  await insertarAnuncio({ centro_id: centros.a, titulo: 'Anuncio extra de A', actualizado_en: new Date().toISOString() });
  const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);
  const res = await request.get('/api/anuncios/mios?pagina=1&por_pagina=50', { headers: { Authorization: `Bearer ${tokenB}` } });
  expect(res.status()).toBe(200);
  const cuerpo = await res.json();
  expect(cuerpo).toMatchObject({ total: await visiblesDe(centros.b), pagina: 1, por_pagina: 50 });
  expect(cuerpo.anuncios.map((anuncio) => anuncio.titulo)).toEqual(['Balones del centro B']);

  // CA12: el resumen trae exactamente los campos especificados.
  expect(Object.keys(cuerpo.anuncios[0]).sort()).toEqual([
    'actualizado_en', 'categoria', 'deporte', 'estado', 'foto_principal_url', 'id', 'modalidad',
    'precio_unitario_centimos', 'publicado_en', 'titulo', 'unidades_disponibles',
  ]);

  // Con el token de A: 22 visibles (21 de la semilla y el extra), 20 por defecto, ninguno de B ni retirado.
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const resA = await request.get('/api/anuncios/mios', { headers: { Authorization: `Bearer ${tokenA}` } });
  expect(resA.status()).toBe(200);
  const cuerpoA = await resA.json();
  expect(cuerpoA).toMatchObject({ total: 22, pagina: 1, por_pagina: 20 });
  expect(cuerpoA.anuncios).toHaveLength(20);
  expect(cuerpoA.anuncios[0].titulo).toBe('Anuncio extra de A');
  expect(cuerpoA.anuncios.map((anuncio) => anuncio.titulo)).not.toContain('Balones del centro B');
  expect(cuerpoA.anuncios.map((anuncio) => anuncio.titulo)).not.toContain('Material retirado');

  // CA13: sin token → 401; «mios» no se toma como id.
  const sinToken = await request.get('/api/anuncios/mios');
  expect(sinToken.status()).toBe(401);

  // CA11: parámetros fuera de rango.
  const malos = await request.get('/api/anuncios/mios?pagina=0&por_pagina=51', { headers: { Authorization: `Bearer ${tokenA}` } });
  expect(malos.status()).toBe(400);
  const { error } = await malos.json();
  expect(error.code).toBe('DATOS_INVALIDOS');
  expect(error.details).toMatchObject({
    pagina: 'Debe ser un número entero mayor que 0.',
    por_pagina: 'Debe ser un número entre 1 y 50.',
  });
});
