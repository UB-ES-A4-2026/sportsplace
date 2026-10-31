// T16-3 · E2E de US-16 (pausar y reactivar un anuncio). Casos: docs/especificacion/E03 (US-16).
// Usa la plantilla de T12-7 y la semilla de T12-8. Cada caso crea sus propios anuncios copiando una fila
// de la semilla, así no depende del formato de POST /api/anuncios (JSON hoy, multipart con US-13).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { fixtureAnuncios, seedAnuncios } from '../../tools/scripts/e2e-fixtures.js';

// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = fixtureAnuncios()[0].id;
const RETIRADO = fixtureAnuncios().find((anuncio) => anuncio.estado === 'retirado').id;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const MENSAJE_409 = 'Esta acción no está disponible en el estado actual del anuncio.';
const FRANJA = 'Este anuncio está pausado: los demás centros no lo ven.';
const HACE_UN_DIA = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

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

// Copia la fila plantilla con los cambios indicados. Fechas de ayer, para ver que se renueva actualizado_en.
async function insertarAnuncio(cambios) {
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify({
      id: crypto.randomUUID(), estado: 'activo', publicado_en: HACE_UN_DIA, creado_en: HACE_UN_DIA,
      actualizado_en: HACE_UN_DIA, retirado_en: null, entregado_en: null, ...cambios,
    })],
  );
  creados.push(rows[0].id);
  return rows[0].id;
}

// Fila completa como JSON, para comparar que no cambia nada más que estado y actualizado_en (CA5).
async function filaDe(id) {
  const { rows } = await db.query('SELECT to_jsonb(a) AS fila FROM public.anuncios a WHERE id = $1', [id]);
  expect(rows).toHaveLength(1);
  return rows[0].fila;
}

function sinEstado(fila) {
  const resto = { ...fila };
  delete resto.estado;
  delete resto.actualizado_en;
  return resto;
}

function boton(ambito, nombre) {
  return ambito.getByRole('button', { name: nombre, exact: true });
}

async function abrirFicha(page, id, titulo) {
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
}

// Marca la página: si se recarga, la marca desaparece (CA3, sin recargar).
async function marcarPagina(page) {
  await page.evaluate(() => { globalThis.__sinRecargar = true; });
}

async function sigueSinRecargar(page) {
  expect(await page.evaluate(() => globalThis.__sinRecargar === true)).toBe(true);
}

// Retiene la siguiente petición POST de la acción hasta llamar a la función devuelta (CA2).
async function retener(page, id, accion) {
  let soltar;
  const retenido = new Promise((resolve) => { soltar = resolve; });
  await page.route(`**/api/anuncios/${id}/${accion}`, async (route) => {
    await retenido;
    await route.continue();
  });
  return soltar;
}

function fila(page, titulo) {
  return page.locator(':is(li, tr, article)')
    .filter({ has: page.getByRole('link', { name: titulo, exact: true }) })
    .last();
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
    `UPDATE public.anuncios SET estado = 'retirado', retirado_en = coalesce(retirado_en, now()), entregado_en = NULL
     WHERE id = ANY($1::uuid[]) AND estado <> 'retirado'`,
    [creados.splice(0)],
  );
});

test.afterAll(async () => {
  await db?.close();
});

// ---------------------------------------------------------------- flujos e2e

test('US-16 · E2E-1 · pausar y reactivar desde la ficha', async ({ page, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Balones de balonmano' });
  const antes = await filaDe(id);

  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, 'Balones de balonmano');
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect(page.getByText(FRANJA)).toHaveCount(0);
  await expect(boton(page, 'Reactivar')).toHaveCount(0);
  await marcarPagina(page);

  // CA2: «Pausando…» y deshabilitado mientras la petición está en curso. CA3: sin diálogo.
  const soltarPausa = await retener(page, id, 'pausar');
  await boton(page, 'Pausar').click();
  await expect(boton(page, 'Pausando…')).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  soltarPausa();

  // 1. Aviso, etiqueta «Pausado», franja gris y «Reactivar», sin recargar (CA3 y CA4).
  await expect(page.getByText('Anuncio pausado.')).toBeVisible();
  await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
  await expect(page.getByText(FRANJA)).toBeVisible();
  await expect(boton(page, 'Reactivar')).toBeVisible();
  await expect(boton(page, 'Pausar')).toHaveCount(0);
  await sigueSinRecargar(page);

  // CA5: solo cambian estado y actualizado_en; publicado_en se mantiene.
  const pausado = await filaDe(id);
  expect(pausado.estado).toBe('pausado');
  expect(sinEstado(pausado)).toEqual(sinEstado(antes));
  expect(new Date(pausado.actualizado_en).getTime()).toBeGreaterThan(new Date(antes.actualizado_en).getTime());

  // 2. «Reactivar» → aviso y «Activo».
  await page.unroute(`**/api/anuncios/${id}/pausar`);
  const soltarReactivar = await retener(page, id, 'reactivar');
  await boton(page, 'Reactivar').click();
  await expect(boton(page, 'Reactivando…')).toBeDisabled();
  soltarReactivar();

  await expect(page.getByText('Anuncio reactivado.')).toBeVisible();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect(page.getByText(FRANJA)).toHaveCount(0);
  await expect(boton(page, 'Pausar')).toBeVisible();
  await sigueSinRecargar(page);

  const activo = await filaDe(id);
  expect(activo.estado).toBe('activo');
  expect(sinEstado(activo)).toEqual(sinEstado(antes));
  expect(new Date(activo.actualizado_en).getTime()).toBeGreaterThanOrEqual(new Date(pausado.actualizado_en).getTime());
});

test('US-16 · E2E-2 · desde «Mis anuncios»', async ({ page, cuentas }) => {
  // Fechas de ahora: así es la primera fila de la lista.
  const ahora = new Date().toISOString();
  const titulo = 'Picas de atletismo';
  const id = await insertarAnuncio({
    centro_id: centros.a, titulo, publicado_en: ahora, creado_en: ahora, actualizado_en: ahora,
  });

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.getByRole('link', { name: 'Mis anuncios', exact: true }).click();
  await expect(page).toHaveURL('/mis-anuncios');
  const activa = fila(page, titulo);
  await expect(activa.getByText('Activo', { exact: true })).toBeVisible();
  await marcarPagina(page);
  let cargas = 0;
  page.on('request', (req) => {
    if (req.method() === 'GET' && new URL(req.url()).pathname === '/api/anuncios/mios') cargas += 1;
  });

  // «Pausar» está en el menú «Más ▾» de la fila (US-18 CA6).
  await boton(activa, 'Más ▾').click();
  await page.getByRole('menuitem', { name: 'Pausar' }).or(boton(page, 'Pausar')).click();

  await expect(page.getByText('Anuncio pausado.')).toBeVisible();
  await expect(activa.getByText('Pausado', { exact: true })).toBeVisible();
  await boton(activa, 'Más ▾').click();
  await expect(page.getByRole('menuitem', { name: 'Reactivar' }).or(boton(page, 'Reactivar'))).toBeVisible();
  await sigueSinRecargar(page);
  expect(cargas).toBe(0);
  expect((await filaDe(id)).estado).toBe('pausado');
});

test('US-16 · E2E-3 · transición no permitida', async ({ page, request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Porterías reservadas', estado: 'reservado' });

  // CA1: en `reservado` no hay «Pausar» ni «Reactivar».
  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, 'Porterías reservadas');
  await expect(page.getByText('Reservado', { exact: true })).toBeVisible();
  await expect(boton(page, 'Pausar')).toHaveCount(0);
  await expect(boton(page, 'Reactivar')).toHaveCount(0);

  // CA8: POST directo → 409 con el estado actual.
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  const res = await request.post(`/api/anuncios/${id}/pausar`, { headers: auth });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toMatchObject({
    code: 'TRANSICION_NO_PERMITIDA', message: MENSAJE_409, details: { estado_actual: 'reservado' },
  });
  expect((await filaDe(id)).estado).toBe('reservado');
});

test('US-16 · E2E-4 · estado desfasado', async ({ page, context, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Aros de gimnasia' });

  await entrar(page, cuentas.centroA, cuentas.password);
  const pestana2 = await context.newPage();
  await abrirFicha(page, id, 'Aros de gimnasia');
  await abrirFicha(pestana2, id, 'Aros de gimnasia');

  // En la pestaña 1 se pausa.
  await boton(page, 'Pausar').click();
  await expect(page.getByText('Anuncio pausado.')).toBeVisible();

  // En la 2, todavía «Activo», «Pausar» → aviso rojo y se recarga el anuncio con su estado real (CA4).
  await boton(pestana2, 'Pausar').click();
  await expect(pestana2.getByText(MENSAJE_409)).toBeVisible();
  await expect(pestana2.getByText('Pausado', { exact: true })).toBeVisible();
  await expect(pestana2.getByText(FRANJA)).toBeVisible();
  await expect(boton(pestana2, 'Reactivar')).toBeVisible();
  expect((await filaDe(id)).estado).toBe('pausado');
});

test('US-16 · E2E-5 · otro centro', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Colchonetas del centro A' });
  const antes = await filaDe(id);
  const authB = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroB, cuentas.password)}` };

  for (const accion of ['pausar', 'reactivar']) {
    const res = await request.post(`/api/anuncios/${id}/${accion}`, { headers: authB });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatchObject({ code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
  }
  expect(await filaDe(id)).toEqual(antes);
});

// ---------------------------------------------------------------- criterios sueltos

test('US-16 · CA1 · botones según el estado en la ficha', async ({ page, cuentas }) => {
  // `borrador` llega con US-20: hasta entonces la base de datos no admite ese estado.
  const casos = [
    ['activo', 'Activo', 'Pausar', 'Reactivar'],
    ['pausado', 'Pausado', 'Reactivar', 'Pausar'],
    ['reservado', 'Reservado', null, null],
    ['entregado', 'Entregado', null, null],
  ];
  const ids = [];
  for (const [estado] of casos) {
    ids.push(await insertarAnuncio({
      centro_id: centros.a, titulo: `Bancos suecos ${estado}`, estado,
      entregado_en: estado === 'entregado' ? HACE_UN_DIA : null,
    }));
  }

  await entrar(page, cuentas.centroA, cuentas.password);
  for (const [indice, [estado, etiqueta, visible, oculto]] of casos.entries()) {
    await abrirFicha(page, ids[indice], `Bancos suecos ${estado}`);
    await expect(page.getByText(etiqueta, { exact: true })).toBeVisible();
    if (visible) {
      await expect(boton(page, visible)).toBeVisible();
      await expect(boton(page, oculto)).toHaveCount(0);
    } else {
      await expect(boton(page, 'Pausar')).toHaveCount(0);
      await expect(boton(page, 'Reactivar')).toHaveCount(0);
    }
    await expect(page.getByText(FRANJA)).toHaveCount(estado === 'pausado' ? 1 : 0);
  }
});

test('US-16 · CA6, CA7 y CA8 · API', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Redes de tenis' });
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  const post = (accion) => request.post(`/api/anuncios/${id}/${accion}`, { headers: auth });

  // CA8: reactivar uno activo → 409.
  const reactivarActivo = await post('reactivar');
  expect(reactivarActivo.status()).toBe(409);
  expect((await reactivarActivo.json()).error).toMatchObject({
    code: 'TRANSICION_NO_PERMITIDA', details: { estado_actual: 'activo' },
  });

  // CA6: activo → pausado, 200 { anuncio } con el estado nuevo y el resto igual.
  const pausar = await post('pausar');
  expect(pausar.status()).toBe(200);
  const { anuncio: pausado } = await pausar.json();
  expect(pausado).toMatchObject({ id, estado: 'pausado', titulo: 'Redes de tenis' });
  expect(new Date(pausado.publicado_en).toISOString()).toBe(HACE_UN_DIA);

  // CA8: pausar uno ya pausado → 409 (no es idempotente).
  const otraVez = await post('pausar');
  expect(otraVez.status()).toBe(409);
  expect((await otraVez.json()).error).toMatchObject({
    code: 'TRANSICION_NO_PERMITIDA', message: MENSAJE_409, details: { estado_actual: 'pausado' },
  });

  // CA7: pausado → activo.
  const reactivar = await post('reactivar');
  expect(reactivar.status()).toBe(200);
  expect((await reactivar.json()).anuncio).toMatchObject({ id, estado: 'activo' });

  // CA8: desde entregado tampoco.
  await db.query("UPDATE public.anuncios SET estado = 'entregado', entregado_en = now() WHERE id = $1", [id]);
  for (const accion of ['pausar', 'reactivar']) {
    const res = await post(accion);
    expect(res.status()).toBe(409);
    expect((await res.json()).error.details).toEqual({ estado_actual: 'entregado' });
  }
});

test('US-16 · CA9 · errores de la API', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Vallas de atletismo' });
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };

  // Sin sesión → 401 y sin cambios. El 403 EMAIL_NO_CONFIRMADO lo cubren los tests del backend:
  // la cuenta sin confirmar no puede obtener token (el login responde 403).
  const sinSesion = await request.post(`/api/anuncios/${id}/pausar`);
  expect(sinSesion.status()).toBe(401);
  expect((await filaDe(id)).estado).toBe('activo');

  // Inexistente, no UUID y retirado → 404 NO_ENCONTRADO.
  for (const otro of [INEXISTENTE, 'abc', RETIRADO]) {
    const res = await request.post(`/api/anuncios/${otro}/pausar`, { headers: auth });
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
  }

  // GET → 405 METODO_NO_PERMITIDO.
  for (const accion of ['pausar', 'reactivar']) {
    const res = await request.get(`/api/anuncios/${id}/${accion}`, { headers: auth });
    expect(res.status()).toBe(405);
    expect((await res.json()).error.code).toBe('METODO_NO_PERMITIDO');
  }
  expect((await filaDe(id)).estado).toBe('activo');
});

test('US-16 · CA10 · dos «pausar» simultáneos', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Discos de lanzamiento' });
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };

  const respuestas = await Promise.all([1, 2].map(() => request.post(`/api/anuncios/${id}/pausar`, { headers: auth })));
  expect(respuestas.map((res) => res.status()).sort()).toEqual([200, 409]);
  expect((await filaDe(id)).estado).toBe('pausado');
});
