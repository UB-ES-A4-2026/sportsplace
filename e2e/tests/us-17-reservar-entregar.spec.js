// T17-3 · E2E de US-17 (marcar un anuncio como reservado o entregado). Casos: docs/especificacion/E03 (US-17).
// Usa la plantilla de T12-7 y la semilla de T12-8. Cada caso crea sus propios anuncios copiando una fila
// de la semilla (sirve con o sin las columnas de US-13/US-14) y los retira al acabar.
//
// La parte de E2E-3 con `PATCH /api/anuncios/:id` (409 ANUNCIO_NO_EDITABLE) depende de US-15, que todavía
// no está en dev: queda en un test aparte en `fixme`, con las aserciones escritas.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { fixtureAnuncios, seedAnuncios } from '../../tools/scripts/e2e-fixtures.js';

// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = fixtureAnuncios()[0].id;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const MENSAJE_409 = 'Esta acción no está disponible en el estado actual del anuncio.';
const FRANJA_RESERVADO = 'Este anuncio está reservado: los demás centros lo ven como no disponible.';
const HACE_UN_DIA = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const RESERVAR = 'Marcar como reservado';
const QUITAR = 'Quitar reserva';
const ENTREGAR = 'Marcar como entregado';

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

// Fila completa como JSON, para comprobar qué cambia y qué no (CA5).
async function filaDe(id) {
  const { rows } = await db.query('SELECT to_jsonb(a) AS fila FROM public.anuncios a WHERE id = $1', [id]);
  expect(rows).toHaveLength(1);
  return rows[0].fila;
}

// Todo menos lo que una transición puede cambiar: estado, actualizado_en y entregado_en.
function sinTransicion(fila) {
  const resto = { ...fila };
  delete resto.estado;
  delete resto.actualizado_en;
  delete resto.entregado_en;
  return resto;
}

function boton(ambito, nombre) {
  return ambito.getByRole('button', { name: nombre, exact: true });
}

// Fila de «Mis anuncios» con ese título.
function fila(page, titulo) {
  return page.locator('li').filter({ has: page.getByRole('link', { name: titulo, exact: true }) }).last();
}

function dialogoEntregar(page) {
  return page.getByRole('dialog', { name: '¿Marcar como entregado?' });
}

async function abrirFicha(page, id, titulo) {
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
}

// Marca la página: si se recarga, la marca desaparece (los cambios se ven sin recargar).
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

function hoy() {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
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

test('US-17 · E2E-1 · reservar, quitar reserva y entregar', async ({ page, cuentas }) => {
  const titulo = 'Vallas de atletismo';
  const id = await insertarAnuncio({ centro_id: centros.a, titulo });
  const antes = await filaDe(id);

  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, titulo);
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect(page.getByText(FRANJA_RESERVADO)).toHaveCount(0);
  await expect(boton(page, QUITAR)).toHaveCount(0);
  await marcarPagina(page);

  // 1. Reservar: inmediato (CA3), «Reservando…» deshabilitado mientras responde (CA2).
  const soltarReserva = await retener(page, id, 'reservar');
  await boton(page, RESERVAR).click();
  await expect(boton(page, 'Reservando…')).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  soltarReserva();

  // CA4: aviso, etiqueta y franja naranja; CA1: botones de un reservado. Todo sin recargar.
  await expect(page.getByText('Anuncio reservado.')).toBeVisible();
  await expect(page.getByText('Reservado', { exact: true })).toBeVisible();
  await expect(page.getByText(FRANJA_RESERVADO)).toBeVisible();
  await expect(boton(page, QUITAR)).toBeVisible();
  await expect(boton(page, ENTREGAR)).toBeVisible();
  await expect(boton(page, RESERVAR)).toHaveCount(0);
  await sigueSinRecargar(page);
  expect((await filaDe(id)).estado).toBe('reservado');

  // 2. Quitar la reserva: «Quitando reserva…» y vuelve a «Activo».
  await page.unroute(`**/api/anuncios/${id}/reservar`);
  const soltarQuitar = await retener(page, id, 'quitar-reserva');
  await boton(page, QUITAR).click();
  await expect(boton(page, 'Quitando reserva…')).toBeDisabled();
  soltarQuitar();

  await expect(page.getByText('Reserva quitada.')).toBeVisible();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect(page.getByText(FRANJA_RESERVADO)).toHaveCount(0);
  await expect(boton(page, RESERVAR)).toBeVisible();
  await sigueSinRecargar(page);
  expect((await filaDe(id)).estado).toBe('activo');

  // 3. Entregar: diálogo con su título, texto y botones (CA3); «Marcando…» mientras responde (CA2).
  await page.unroute(`**/api/anuncios/${id}/quitar-reserva`);
  await boton(page, ENTREGAR).click();
  const dialogo = dialogoEntregar(page);
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Ya no podrás editarlo ni cambiar su estado.')).toBeVisible();
  await expect(boton(dialogo, 'Cancelar')).toBeVisible();
  const soltarEntrega = await retener(page, id, 'entregar');
  await boton(dialogo, ENTREGAR).click();
  await expect(boton(dialogo, 'Marcando…')).toBeDisabled();
  soltarEntrega();

  // CA4 y CA6: aviso, franja azul con la fecha de hoy y ningún botón de acción.
  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Anuncio entregado.')).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(page.getByText(`Material entregado el ${hoy()}. Este anuncio ya no se puede modificar.`)).toBeVisible();
  for (const nombre of [RESERVAR, QUITAR, ENTREGAR, 'Editar', 'Pausar', 'Reactivar', 'Retirar anuncio']) {
    await expect(boton(page, nombre)).toHaveCount(0);
  }
  await sigueSinRecargar(page);

  // CA5: entregado_en guardado; ni unidades, ni precio, ni fotos, ni nada más cambia.
  const entregado = await filaDe(id);
  expect(entregado.estado).toBe('entregado');
  expect(entregado.entregado_en).not.toBeNull();
  expect(sinTransicion(entregado)).toEqual(sinTransicion(antes));
});

test('US-17 · E2E-2 · entregar desde reservado y cancelar', async ({ page, cuentas }) => {
  const titulo = 'Conos reservados';
  const id = await insertarAnuncio({ centro_id: centros.a, titulo, estado: 'reservado' });
  let entregas = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === `/api/anuncios/${id}/entregar`) entregas += 1;
  });

  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, titulo);
  const dialogo = dialogoEntregar(page);

  // 1. «Cancelar» cierra el diálogo sin hacer nada: sigue «Reservado».
  await boton(page, ENTREGAR).click();
  await expect(dialogo).toBeVisible();
  await boton(dialogo, 'Cancelar').click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Reservado', { exact: true })).toBeVisible();
  expect(entregas).toBe(0);
  expect((await filaDe(id)).estado).toBe('reservado');

  // 2. Se repite y se confirma: «Entregado».
  await boton(page, ENTREGAR).click();
  await boton(dialogo, ENTREGAR).click();
  await expect(page.getByText('Anuncio entregado.')).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  const fila = await filaDe(id);
  expect(fila.estado).toBe('entregado');
  expect(fila.entregado_en).not.toBeNull();
});

test('US-17 · E2E-3 · estado final', async ({ page, request, cuentas }) => {
  const titulo = 'Porterías entregadas';
  const id = await insertarAnuncio({
    centro_id: centros.a, titulo, estado: 'entregado', entregado_en: HACE_UN_DIA,
  });
  const antes = await filaDe(id);

  // CA6: la ficha de un entregado no tiene botones de acción.
  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, titulo);
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  for (const nombre of [RESERVAR, QUITAR, ENTREGAR, 'Editar', 'Pausar', 'Reactivar', 'Retirar anuncio']) {
    await expect(boton(page, nombre)).toHaveCount(0);
  }

  // CA8 y CA10: desde entregado, todas las transiciones y la retirada dan 409 y nada cambia.
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  for (const accion of ['reservar', 'quitar-reserva', 'entregar', 'pausar']) {
    const res = await request.post(`/api/anuncios/${id}/${accion}`, { headers: auth });
    expect(res.status(), accion).toBe(409);
    expect((await res.json()).error).toMatchObject({
      code: 'TRANSICION_NO_PERMITIDA', message: MENSAJE_409, details: { estado_actual: 'entregado' },
    });
  }
  const retirar = await request.delete(`/api/anuncios/${id}`, { headers: auth });
  expect(retirar.status()).toBe(409);
  expect((await retirar.json()).error.code).toBe('TRANSICION_NO_PERMITIDA');
  expect(await filaDe(id)).toEqual(antes);
});

// [Depende de US-15] PATCH /api/anuncios/:id todavía no existe en esta historia (llega con T15-1).
// Se activa (quitar el fixme) cuando US-15 esté en dev e integrada en la rama.
test.fixme('US-17 · E2E-3 · estado final: PATCH → 409 ANUNCIO_NO_EDITABLE (US-15)', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({
    centro_id: centros.a, titulo: 'Porterías entregadas (PATCH)', estado: 'entregado', entregado_en: HACE_UN_DIA,
  });
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  const res = await request.patch(`/api/anuncios/${id}`, { headers: auth, multipart: { datos: '{}' } });
  expect(res.status()).toBe(409);
  expect((await res.json()).error.code).toBe('ANUNCIO_NO_EDITABLE');
});

test('US-17 · E2E-4 · pausado', async ({ page, request, cuentas }) => {
  const titulo = 'Petos pausados';
  const id = await insertarAnuncio({ centro_id: centros.a, titulo, estado: 'pausado' });

  // CA1: un pausado no muestra los botones de esta historia.
  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, titulo);
  await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
  for (const nombre of [RESERVAR, QUITAR, ENTREGAR]) await expect(boton(page, nombre)).toHaveCount(0);

  // CA8 y CA9: reservar y entregar desde pausado → 409 con el estado actual (hay que reactivar antes).
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  for (const accion of ['reservar', 'entregar']) {
    const res = await request.post(`/api/anuncios/${id}/${accion}`, { headers: auth });
    expect(res.status(), accion).toBe(409);
    expect((await res.json()).error).toMatchObject({
      code: 'TRANSICION_NO_PERMITIDA', details: { estado_actual: 'pausado' },
    });
  }
  expect((await filaDe(id)).estado).toBe('pausado');
});

test('US-17 · CA1 · desde «Mis anuncios»: reservar, quitar reserva y entregar en el menú «Más ▾» (#199)', async ({ page, cuentas }) => {
  // Fechas de ahora: así son las primeras filas de la lista.
  const ahora = new Date().toISOString();
  const comunes = { centro_id: centros.a, publicado_en: ahora, creado_en: ahora, actualizado_en: ahora };
  const titulo = 'Colchonetas de gimnasia';
  const id = await insertarAnuncio({ ...comunes, titulo });
  const tituloPausado = 'Aros pausados';
  await insertarAnuncio({ ...comunes, titulo: tituloPausado, estado: 'pausado' });

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.getByRole('link', { name: 'Mis anuncios', exact: true }).click();
  await expect(page).toHaveURL('/mis-anuncios');
  await marcarPagina(page);
  const activa = fila(page, titulo);
  await expect(activa.getByText('Activo', { exact: true })).toBeVisible();

  // Pausado: el menú no tiene acciones de esta historia (CA1, CA6).
  const pausada = fila(page, tituloPausado);
  await boton(pausada, 'Más ▾').click();
  await expect(boton(pausada, 'Reactivar')).toBeVisible();
  for (const nombre of [RESERVAR, QUITAR, ENTREGAR]) await expect(boton(pausada, nombre)).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Activo: «Marcar como reservado» y «Marcar como entregado», entre «Pausar» y «Retirar anuncio».
  await boton(activa, 'Más ▾').click();
  const opciones = activa.locator('.menu-mas-opciones > button');
  await expect(opciones).toHaveText(['Pausar', RESERVAR, ENTREGAR, 'Retirar anuncio']);
  await boton(activa, RESERVAR).click();

  // CA4: aviso y la fila pasa a «Reservado» sin recargar; su menú tiene «Quitar reserva» y «Marcar como entregado».
  await expect(page.getByText('Anuncio reservado.')).toBeVisible();
  await expect(activa.getByText('Reservado', { exact: true })).toBeVisible();
  expect((await filaDe(id)).estado).toBe('reservado');
  await boton(activa, 'Más ▾').click();
  await expect(opciones).toHaveText([QUITAR, ENTREGAR, 'Retirar anuncio']);
  await boton(activa, QUITAR).click();
  await expect(page.getByText('Reserva quitada.')).toBeVisible();
  await expect(activa.getByText('Activo', { exact: true })).toBeVisible();
  expect((await filaDe(id)).estado).toBe('activo');

  // CA3: «Marcar como entregado» abre el diálogo; «Cancelar» no cambia nada.
  await boton(activa, 'Más ▾').click();
  await boton(activa, ENTREGAR).click();
  const dialogo = dialogoEntregar(page);
  await expect(dialogo).toBeVisible();
  await boton(dialogo, 'Cancelar').click();
  await expect(dialogo).toBeHidden();
  expect((await filaDe(id)).estado).toBe('activo');

  // Confirmar: «Entregado» y la fila se queda sin menú (CA6: ninguna acción en entregado).
  // Tras «Cancelar» el menú sigue abierto (el diálogo está dentro de él), como con «Retirar anuncio».
  await expect(boton(activa, 'Más ▾')).toHaveAttribute('aria-expanded', 'true');
  await boton(activa, ENTREGAR).click();
  await expect(dialogo).toBeVisible();
  await boton(dialogo, ENTREGAR).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Anuncio entregado.')).toBeVisible();
  await expect(activa.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(boton(activa, 'Más ▾')).toHaveCount(0);
  await sigueSinRecargar(page);
  const entregado = await filaDe(id);
  expect(entregado.estado).toBe('entregado');
  expect(entregado.entregado_en).not.toBeNull();
});

// ---------------------------------------------------------------- criterios sueltos

test('US-17 · CA4 · 409 con el estado desfasado: aviso rojo y se recarga el anuncio', async ({ page, cuentas }) => {
  const titulo = 'Balones de baloncesto';
  const id = await insertarAnuncio({ centro_id: centros.a, titulo });

  await entrar(page, cuentas.centroA, cuentas.password);
  await abrirFicha(page, id, titulo);
  // Otra pestaña lo entrega antes de pulsar «Marcar como reservado».
  await db.query("UPDATE public.anuncios SET estado = 'entregado', entregado_en = now() WHERE id = $1", [id]);
  await boton(page, RESERVAR).click();

  await expect(page.getByText(MENSAJE_409)).toBeVisible();
  await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
  await expect(boton(page, RESERVAR)).toHaveCount(0);
});

test('US-17 · CA7 y CA8 · API: transiciones permitidas y errores', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Raquetas de bádminton' });
  const authA = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  const authB = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroB, cuentas.password)}` };
  const post = (accion, headers = authA, anuncio = id) => request.post(`/api/anuncios/${anuncio}/${accion}`, { headers });

  // CA8: 401 sin sesión, 404 con otro centro, inexistente y no UUID; el anuncio no cambia.
  expect((await request.post(`/api/anuncios/${id}/reservar`)).status()).toBe(401);
  for (const [headers, anuncio] of [[authB, id], [authA, INEXISTENTE], [authA, 'abc']]) {
    const res = await post('reservar', headers, anuncio);
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
  }
  expect((await filaDe(id)).estado).toBe('activo');

  // CA8: fuera de la tabla → 409 (quitar la reserva de uno activo).
  const quitarActivo = await post('quitar-reserva');
  expect(quitarActivo.status()).toBe(409);
  expect((await quitarActivo.json()).error.details).toMatchObject({ estado_actual: 'activo' });

  // CA7: activo → reservado → activo → entregado, cada una 200 { anuncio } sin cuerpo.
  for (const [accion, estado] of [['reservar', 'reservado'], ['quitar-reserva', 'activo'], ['entregar', 'entregado']]) {
    const res = await post(accion);
    expect(res.status(), accion).toBe(200);
    expect((await res.json()).anuncio).toMatchObject({ id, estado });
  }

  // CA10: entregar dos veces → la segunda 409.
  const otraVez = await post('entregar');
  expect(otraVez.status()).toBe(409);
  expect((await otraVez.json()).error.details).toMatchObject({ estado_actual: 'entregado' });
});

test('US-17 · CA7 · entregar directamente desde reservado (API)', async ({ request, cuentas }) => {
  const id = await insertarAnuncio({ centro_id: centros.a, titulo: 'Colchonetas reservadas', estado: 'reservado' });
  const auth = { Authorization: `Bearer ${await tokenDe(request, cuentas.centroA, cuentas.password)}` };
  const res = await request.post(`/api/anuncios/${id}/entregar`, { headers: auth });
  expect(res.status()).toBe(200);
  expect((await res.json()).anuncio.estado).toBe('entregado');
  // CA5: entregado_en se guarda en la BD (el objeto `anuncio` de la API no lo incluye).
  expect((await filaDe(id)).entregado_en).not.toBeNull();
});
