// T15-3 · E2E de US-15 (modificar un anuncio ya publicado). Casos: docs/especificacion/E03 (US-15), E2E-1..6.
// Usa la plantilla de T12-7 (`entrar`) y las cuentas de la semilla de T12-8.
//
// Cada caso publica su propio anuncio con POST /api/anuncios (multipart, US-13 y US-14): así tiene fotos
// reales en Storage (F1 = balones1.jpg, principal; F2 = balones2.png) y se puede comprobar qué pasa con
// ellas al editar. Las fechas se mueven a ayer para ver que `actualizado_en` se renueva y `publicado_en`
// no (CA7). Lo que crea cada caso se retira al acabar, para no alterar los recuentos de otros specs.
import { readFileSync } from 'node:fs';
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { archivo, relleno } from './fixtures/imagenes.js';

const TITULO = 'Balones de fútbol talla 5';

const DATOS_API = {
  titulo: TITULO,
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  modalidad: 'venta',
  precio_unitario_centimos: 850,
};

const AVISO_GUARDADO = 'Cambios guardados.';
const NO_EDITABLE = 'Este anuncio ya no se puede editar.';
const FRANJA_PAUSADO = 'Este anuncio está pausado: los demás centros no lo ven.';
const MENSAJE_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const HACE_UN_DIA = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function imagenReal(nombre, mimeType) {
  return { name: nombre, mimeType, buffer: readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url)) };
}

const F1 = imagenReal('balones1.jpg', 'image/jpeg');
const F2 = imagenReal('balones2.png', 'image/png');
// La foto que se añade en E2E-1. Se genera en memoria (fixtures/imagenes.js, decidido en la #138).
const NUEVA = archivo('nueva.jpg', 30 * 1024);

let db;
const creados = [];

// ---------------------------------------------------------------- utilidades

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

function cabeceras(token) {
  return { Authorization: `Bearer ${token}` };
}

// Multipart con FormData: el objeto `multipart` de Playwright no admite varias partes `fotos`.
function multipart({ datos, fotos = [], principal }) {
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify(datos));
  for (const { name, mimeType, buffer } of fotos) {
    formulario.append('fotos', new Blob([buffer], { type: mimeType }), name);
  }
  if (principal !== undefined) formulario.append('foto_principal', String(principal));
  return formulario;
}

// Paso 1 de E2E-1: anuncio activo de A con 12 unidades, 850 céntimos y fotos F1 (principal) y F2.
// Devuelve el id y las fotos de la API en su orden.
async function publicarAnuncio(request, token, cambios = {}) {
  const res = await request.post('/api/anuncios', {
    headers: cabeceras(token),
    multipart: multipart({ datos: { ...DATOS_API, ...cambios }, fotos: [F1, F2], principal: 1 }),
  });
  expect(res.status()).toBe(201);
  const { anuncio } = await res.json();
  creados.push(anuncio.id);
  await db.query(
    'UPDATE public.anuncios SET publicado_en = $2, creado_en = $2, actualizado_en = $2 WHERE id = $1',
    [anuncio.id, HACE_UN_DIA],
  );
  const fotos = [...anuncio.fotos].sort((a, b) => a.orden - b.orden);
  expect(fotos.map((foto) => [foto.orden, foto.es_principal])).toEqual([[1, true], [2, false]]);
  return { id: anuncio.id, fotos };
}

// PATCH /api/anuncios/:id con el anuncio completo y las fotos que se quedan (CA11).
function editarPorApi(request, token, id, { datos, fotos, principal }) {
  return request.patch(`/api/anuncios/${id}`, {
    headers: cabeceras(token),
    multipart: multipart({ datos, fotos, principal }),
  });
}

async function filaDe(id) {
  const { rows } = await db.query('SELECT to_jsonb(a) AS fila FROM public.anuncios a WHERE id = $1', [id]);
  expect(rows).toHaveLength(1);
  return rows[0].fila;
}

async function fotosDe(id) {
  const { rows } = await db.query(
    'SELECT id, ruta, orden, es_principal FROM public.anuncio_fotos WHERE anuncio_id = $1 ORDER BY orden',
    [id],
  );
  return rows;
}

// Anuncio y fotos tal como están en la BD, para comprobar que un caso no los cambia.
async function estadoEnBd(id) {
  return { fila: await filaDe(id), fotos: await fotosDe(id) };
}

function enlaceEditar(page) {
  return page.getByRole('link', { name: 'Editar', exact: true });
}

function boton(ambito, nombre) {
  return ambito.getByRole('button', { name: nombre, exact: true });
}

function valorDe(page, dato) {
  return page.locator('table.ficha-datos tr').filter({ has: page.getByRole('rowheader', { name: dato, exact: true }) })
    .locator('td');
}

async function abrirFicha(page, id, titulo = TITULO) {
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
}

// Desde la ficha, «Editar» → «Editar anuncio» con los datos cargados.
async function abrirEdicion(page, id) {
  await enlaceEditar(page).click();
  await expect(page).toHaveURL(`/anuncios/${id}/editar`);
  await expect(page.getByRole('heading', { level: 1, name: 'Editar anuncio' })).toBeVisible();
  await expect(page.getByLabel('Título')).toHaveValue(TITULO);
}

// Cuenta las peticiones PATCH al anuncio (los casos de validación y cancelar no deben enviar ninguna).
function contarEdiciones(page, id) {
  const cuenta = { n: 0 };
  page.on('request', (req) => {
    if (req.method() === 'PATCH' && new URL(req.url()).pathname === `/api/anuncios/${id}`) cuenta.n += 1;
  });
  return cuenta;
}

// Retiene el PATCH hasta llamar a la función devuelta (CA6: «Guardando…» mientras guarda). El GET de la
// ficha usa la misma URL y pasa sin esperar.
async function retenerEdicion(page, id) {
  let soltar;
  const retenido = new Promise((resolve) => { soltar = resolve; });
  await page.route(`**/api/anuncios/${id}`, async (route) => {
    if (route.request().method() === 'PATCH') await retenido;
    await route.continue();
  });
  return soltar;
}

// ---------------------------------------------------------------- preparación

test.beforeAll(() => {
  db = createDatabase({ environment: loadTestEnvironment() });
});

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

test.describe('US-15 · Modificar un anuncio ya publicado', () => {
  test('E2E-1 · cambiar datos y fotos', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos: [f1, f2] } = await publicarAnuncio(request, token);
    const antes = await filaDe(id);
    const filasAntes = await fotosDe(id);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await abrirEdicion(page, id);

    // CA2 (pantalla): todos los datos y las fotos actuales, con su principal.
    await expect(page.getByLabel('Unidades disponibles')).toHaveValue('12');
    await expect(page.getByRole('radio', { name: 'Venta', exact: true })).toBeChecked();
    await expect(page.getByLabel('Precio por unidad (€)')).toHaveValue('8,50');
    await expect(page.locator('li.foto img')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Foto 1 (principal)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('li.foto img').first()).toHaveAttribute('src', f1.url);
    const historialEnEdicion = await page.evaluate(() => globalThis.history.length);

    // 2. Unidades 10, precio «7,00», quita F1, añade nueva.jpg y la marca como principal.
    await page.getByLabel('Unidades disponibles').fill('10');
    await page.getByLabel('Precio por unidad (€)').fill('7,00');
    await page.getByRole('button', { name: 'Quitar foto 1' }).click();
    await expect(page.locator('li.foto img')).toHaveCount(1);
    await expect(page.locator('li.foto img')).toHaveAttribute('src', f2.url);
    const selector = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '+ Añadir fotos' }).click();
    await (await selector).setFiles(NUEVA);
    await expect(page.locator('li.foto img')).toHaveCount(2);
    await page.getByRole('button', { name: 'Marcar foto 2 como principal' }).click();
    await expect(page.locator('li.foto-principal img')).toHaveAttribute('alt', 'nueva.jpg');

    // CA6: mientras guarda, deshabilitado y «Guardando…».
    const soltar = await retenerEdicion(page, id);
    const peticion = page.waitForRequest((req) => req.method() === 'PATCH'
      && new URL(req.url()).pathname === `/api/anuncios/${id}`);
    await boton(page, 'Guardar cambios').click();
    await expect(boton(page, 'Guardando…')).toBeDisabled();
    expect((await peticion).headers()['content-type']).toMatch(/^multipart\/form-data/); // CA11
    soltar();

    // 3. Ficha (CA4, con `replace`): aviso, 10 unidades, «7,00 € / unidad», nueva.jpg grande y sigue «Activo».
    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByText(AVISO_GUARDADO, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => globalThis.history.length)).toBe(historialEnEdicion);
    await expect(valorDe(page, 'Unidades disponibles')).toHaveText('10');
    await expect(page.getByText('7,00 € / unidad', { exact: true })).toBeVisible();
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();

    const res = await request.get(`/api/anuncios/${id}`, { headers: cabeceras(token) });
    expect(res.status()).toBe(200);
    const { anuncio } = await res.json();
    const finales = [...anuncio.fotos].sort((a, b) => a.orden - b.orden);
    expect(finales.map((foto) => [foto.id, foto.orden, foto.es_principal])).toEqual([
      [f2.id, 1, false],
      [finales[1].id, 2, true],
    ]);
    await expect(page.locator('img.galeria-grande')).toHaveAttribute('src', finales[1].url);
    await expect(page.getByRole('button', { name: /^Ver foto \d$/ })).toHaveCount(2);

    // 4. BD (CA7, CA8): 10 unidades y 700 céntimos; mismo estado y publicado_en; actualizado_en renovado.
    const despues = await filaDe(id);
    expect(despues).toMatchObject({ unidades_disponibles: 10, precio_unitario_centimos: 700, estado: 'activo' });
    expect(despues.publicado_en).toBe(antes.publicado_en);
    expect(new Date(despues.actualizado_en).getTime()).toBeGreaterThan(new Date(antes.actualizado_en).getTime());

    // anuncio_fotos = F2 (orden 1, no principal, mismo id y ruta) y la nueva (orden 2, principal).
    const filas = await fotosDe(id);
    const filaF2 = filasAntes.find((fila) => fila.id === f2.id);
    expect(filas.map((fila) => [fila.id, fila.ruta, fila.orden, fila.es_principal])).toEqual([
      [f2.id, filaF2.ruta, 1, false],
      [finales[1].id, filas[1].ruta, 2, true],
    ]);
    expect(filas.some((fila) => fila.id === f1.id)).toBe(false);

    // Storage: F2 conserva su URL, la nueva devuelve sus bytes y F1 ya no está.
    expect(finales[0].url).toBe(f2.url);
    const descargaNueva = await request.get(finales[1].url);
    expect(descargaNueva.status()).toBe(200);
    expect((await descargaNueva.body()).equals(NUEVA.buffer)).toBe(true);
    expect((await request.get(f2.url)).status()).toBe(200);
    await expect.poll(async () => (await request.get(f1.url)).status()).not.toBe(200);
  });

  test('E2E-2 · errores de validación', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos } = await publicarAnuncio(request, token);
    const antes = await estadoEnBd(id);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await abrirEdicion(page, id);
    const ediciones = contarEdiciones(page, id);

    // 1. Título vacío → mensaje de US-12 (CA5), sin salir de la pantalla y sin petición.
    await page.getByLabel('Título').fill('');
    await boton(page, 'Guardar cambios').click();
    await expect(page.getByText('El título es obligatorio.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`/anuncios/${id}/editar`);
    expect(ediciones.n).toBe(0);

    // La API aplica la misma regla: 400 DATOS_INVALIDOS con details.titulo.
    const res = await editarPorApi(request, token, id, {
      datos: { ...DATOS_API, titulo: '', fotos_conservar: fotos.map((foto) => foto.id) },
      principal: `existente:${fotos[0].id}`,
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatchObject({
      code: 'DATOS_INVALIDOS', details: { titulo: 'El título es obligatorio.' },
    });

    // BD sin cambios.
    expect(await estadoEnBd(id)).toEqual(antes);
  });

  test('E2E-3 · anuncio pausado', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id } = await publicarAnuncio(request, token);
    const pausa = await request.post(`/api/anuncios/${id}/pausar`, { headers: cabeceras(token) });
    expect(pausa.status()).toBe(200);
    const antes = await filaDe(id);
    const nuevoTitulo = 'Balones de fútbol talla 5 (revisados)';

    // CA1: «Editar» también en pausado.
    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
    await abrirEdicion(page, id);

    await page.getByLabel('Título').fill(nuevoTitulo);
    await boton(page, 'Guardar cambios').click();

    // Sigue «Pausado», con su franja, y el título nuevo (CA7).
    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByText(AVISO_GUARDADO, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: nuevoTitulo })).toBeVisible();
    await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
    await expect(page.getByText(FRANJA_PAUSADO)).toBeVisible();

    const despues = await filaDe(id);
    expect(despues).toMatchObject({ titulo: nuevoTitulo, estado: 'pausado' });
    expect(despues.publicado_en).toBe(antes.publicado_en);
  });

  test('E2E-4 · entregado', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos } = await publicarAnuncio(request, token);
    await db.query(
      `UPDATE public.anuncios SET estado = 'entregado', entregado_en = now() WHERE id = $1`,
      [id],
    );
    const antes = await estadoEnBd(id);

    // CA1: en entregado no hay «Editar».
    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
    await expect(enlaceEditar(page)).toHaveCount(0);

    // CA2: abrir /editar lleva a la ficha con el aviso rojo.
    await page.goto(`/anuncios/${id}/editar`);
    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByRole('alert').filter({ hasText: NO_EDITABLE })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: TITULO })).toBeVisible();

    // CA15: PATCH directo con datos válidos → 409 ANUNCIO_NO_EDITABLE, y la BD no cambia.
    const res = await editarPorApi(request, token, id, {
      datos: { ...DATOS_API, unidades_disponibles: 3, fotos_conservar: fotos.map((foto) => foto.id) },
      principal: `existente:${fotos[0].id}`,
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'ANUNCIO_NO_EDITABLE', message: NO_EDITABLE });
    expect(await estadoEnBd(id)).toEqual(antes);
  });

  test('E2E-5 · cancelar con cambios', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id } = await publicarAnuncio(request, token);
    const antes = await estadoEnBd(id);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    const ediciones = contarEdiciones(page, id);

    // CA3: «Cancelar» sin cambios vuelve a la ficha sin preguntar.
    await abrirEdicion(page, id);
    await boton(page, 'Cancelar').click();
    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // 1. Con cambios, pregunta. «Seguir editando» conserva lo escrito.
    await abrirEdicion(page, id);
    await page.getByLabel('Unidades disponibles').fill('5');
    await boton(page, 'Cancelar').click();
    const dialogo = page.getByRole('dialog', { name: '¿Descartar los cambios?' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText('Los cambios que no has guardado se perderán.', { exact: true })).toBeVisible();
    await boton(dialogo, 'Seguir editando').click();
    await expect(dialogo).toHaveCount(0);
    await expect(page.getByLabel('Unidades disponibles')).toHaveValue('5');

    // «Descartar» → ficha con los datos originales.
    await boton(page, 'Cancelar').click();
    await boton(dialogo, 'Descartar').click();
    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(valorDe(page, 'Unidades disponibles')).toHaveText('12');
    await expect(page.getByText('8,50 € / unidad', { exact: true })).toBeVisible();

    expect(ediciones.n).toBe(0);
    expect(await estadoEnBd(id)).toEqual(antes);
  });

  test('E2E-6 · otro centro', async ({ request, cuentas }) => {
    const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos } = await publicarAnuncio(request, tokenA);
    const antes = await estadoEnBd(id);

    // CA17: B hace PATCH sobre el anuncio de A con datos válidos → 404 NO_ENCONTRADO, y no cambia nada.
    const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);
    const res = await editarPorApi(request, tokenB, id, {
      datos: { ...DATOS_API, titulo: 'Anuncio cambiado por B', fotos_conservar: fotos.map((foto) => foto.id) },
      principal: `existente:${fotos[0].id}`,
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatchObject({ code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
    expect(await estadoEnBd(id)).toEqual(antes);
  });
});

// ---------------------------------------------------------------- resto de criterios (QA de #66)
// CA que los seis flujos no recorren. CA16 (atomicidad ante fallos de Storage o de la BD), el 403
// EMAIL_NO_CONFIRMADO y el 413 los cubren los tests del backend (anuncios-editar.test.js); CA21 depende de US-32.

test.describe('US-15 · Resto de criterios', () => {
  test('CA1 · «Editar» en la fila de «Mis anuncios» y en la ficha según el estado', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const estados = [
      ['activo', 'Conos de entrenamiento (activo)'],
      ['pausado', 'Conos de entrenamiento (pausado)'],
      ['reservado', 'Conos de entrenamiento (reservado)'],
      ['entregado', 'Conos de entrenamiento (entregado)'],
    ];
    const ids = {};
    for (const [estado, titulo] of estados) {
      ({ id: ids[estado] } = await publicarAnuncio(request, token, { titulo }));
      // Recientes, para que salgan en la primera página de «Mis anuncios» (orden por actualizado_en).
      await db.query(
        `UPDATE public.anuncios SET estado = $2, actualizado_en = now(),
           entregado_en = CASE WHEN $2 = 'entregado' THEN now() END WHERE id = $1`,
        [ids[estado], estado],
      );
    }

    await entrar(page, cuentas.centroA, cuentas.password);
    await page.goto('/mis-anuncios');
    for (const [estado, titulo] of estados) {
      const fila = page.locator(':is(li, tr, article)')
        .filter({ has: page.getByRole('link', { name: titulo, exact: true }) }).last();
      await expect(fila).toBeVisible();
      await expect(enlaceEditar(fila), estado).toHaveCount(estado === 'entregado' ? 0 : 1);
    }

    // En la ficha: también en reservado (activo, pausado y entregado ya los recorren E2E-1, E2E-3 y E2E-4).
    await abrirFicha(page, ids.reservado, 'Conos de entrenamiento (reservado)');
    await expect(enlaceEditar(page)).toBeVisible();
    await enlaceEditar(page).click();
    await expect(page).toHaveURL(`/anuncios/${ids.reservado}/editar`);
    await expect(page.getByLabel('Título')).toHaveValue('Conos de entrenamiento (reservado)');
  });

  test('CA9 · guardar sin cambios responde 200 y renueva actualizado_en', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos } = await publicarAnuncio(request, token);
    const antes = await estadoEnBd(id);

    const res = await editarPorApi(request, token, id, {
      datos: { ...DATOS_API, fotos_conservar: fotos.map((foto) => foto.id) },
      principal: `existente:${fotos[0].id}`,
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).anuncio).toMatchObject({ id, unidades_disponibles: 12, precio_unitario_centimos: 850 });

    const despues = await estadoEnBd(id);
    expect(despues.fotos).toEqual(antes.fotos);
    const { actualizado_en: renovado, ...resto } = despues.fila;
    const { actualizado_en: anterior, ...restoAntes } = antes.fila;
    expect(resto).toEqual(restoAntes);
    expect(new Date(renovado).getTime()).toBeGreaterThan(new Date(anterior).getTime());
  });

  test('CA12 y CA13 · total de fotos, fotos ajenas y principal no válida', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos } = await publicarAnuncio(request, token);
    const { fotos: deOtro } = await publicarAnuncio(request, token);
    const antes = await estadoEnBd(id);
    const conservar = fotos.map((foto) => foto.id);

    const casos = [
      // CA12: 0 fotos finales y 2 conservadas + 7 nuevas = 9.
      [{ datos: { ...DATOS_API, fotos_conservar: [] } }, 'fotos', 'Añade al menos una foto.'],
      [{ datos: { ...DATOS_API, fotos_conservar: conservar }, fotos: relleno(7), principal: `existente:${conservar[0]}` },
        'fotos', 'Puedes añadir 8 fotos como máximo.'],
      // CA13: una foto de otro anuncio, y una principal que no queda entre las finales.
      [{ datos: { ...DATOS_API, fotos_conservar: [conservar[0], deOtro[0].id] }, principal: `existente:${conservar[0]}` },
        'fotos_conservar', 'Alguna foto no pertenece a este anuncio.'],
      [{ datos: { ...DATOS_API, fotos_conservar: [conservar[1]] }, principal: `existente:${conservar[0]}` },
        'foto_principal', 'La foto principal no es válida.'],
    ];
    for (const [cuerpo, campo, mensaje] of casos) {
      const res = await editarPorApi(request, token, id, cuerpo);
      expect(res.status(), `${campo}: ${mensaje}`).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('DATOS_INVALIDOS');
      expect(error.details[campo], campo).toBe(mensaje);
    }
    expect(await estadoEnBd(id)).toEqual(antes);
  });

  test('CA15 · sin sesión 401; inexistente y retirado 404', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id, fotos } = await publicarAnuncio(request, token);
    const cuerpo = {
      datos: { ...DATOS_API, fotos_conservar: fotos.map((foto) => foto.id) },
      principal: `existente:${fotos[0].id}`,
    };

    const sinSesion = await request.patch(`/api/anuncios/${id}`, { multipart: multipart(cuerpo) });
    expect(sinSesion.status()).toBe(401);

    const inexistente = await editarPorApi(request, token, INEXISTENTE, cuerpo);
    expect(inexistente.status()).toBe(404);
    expect((await inexistente.json()).error.code).toBe('NO_ENCONTRADO');

    const retirada = await request.delete(`/api/anuncios/${id}`, { headers: cabeceras(token) });
    expect(retirada.ok()).toBe(true);
    const retirado = await editarPorApi(request, token, id, cuerpo);
    expect(retirado.status()).toBe(404);
    expect((await retirado.json()).error.code).toBe('NO_ENCONTRADO');
  });

  test('CA18 · quitar todas las fotos no envía nada', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id } = await publicarAnuncio(request, token);
    const antes = await estadoEnBd(id);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await abrirEdicion(page, id);
    const ediciones = contarEdiciones(page, id);

    await page.getByRole('button', { name: 'Quitar foto 2' }).click();
    await page.getByRole('button', { name: 'Quitar foto 1' }).click();
    await expect(page.locator('li.foto')).toHaveCount(0);
    await boton(page, 'Guardar cambios').click();

    await expect(page.getByText('Añade al menos una foto.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`/anuncios/${id}/editar`);
    expect(ediciones.n).toBe(0);
    expect(await estadoEnBd(id)).toEqual(antes);
  });

  test('CA19 · de venta a donación guarda el precio a null', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id } = await publicarAnuncio(request, token);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await abrirEdicion(page, id);
    await page.getByRole('radio', { name: 'Donación', exact: true }).check();
    await expect(page.getByLabel('Precio por unidad (€)')).toHaveCount(0);
    await boton(page, 'Guardar cambios').click();

    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByText(AVISO_GUARDADO, { exact: true })).toBeVisible();
    await expect(page.getByText('Donación · Gratis', { exact: true })).toBeVisible();
    expect(await filaDe(id)).toMatchObject({ modalidad: 'donacion', precio_unitario_centimos: null });
  });

  test('CA20 · si otro lo entrega mientras se edita, 409 y vuelta a la ficha', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id } = await publicarAnuncio(request, token);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await abrirEdicion(page, id);
    await page.getByLabel('Unidades disponibles').fill('3');

    // Otro miembro del centro lo marca como entregado mientras tanto.
    await db.query(`UPDATE public.anuncios SET estado = 'entregado', entregado_en = now() WHERE id = $1`, [id]);
    const antes = await estadoEnBd(id);
    await boton(page, 'Guardar cambios').click();

    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByRole('alert').filter({ hasText: NO_EDITABLE })).toBeVisible();
    await expect(page.getByText('Entregado', { exact: true })).toBeVisible();
    await expect(enlaceEditar(page)).toHaveCount(0);
    expect(await estadoEnBd(id)).toEqual(antes);
  });

  test('CA10 · con un error de red o un 500 se conservan los datos y la foto nueva', async ({ page, request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const { id } = await publicarAnuncio(request, token);
    const antes = await estadoEnBd(id);

    await entrar(page, cuentas.centroA, cuentas.password);
    await abrirFicha(page, id);
    await abrirEdicion(page, id);
    await page.getByLabel('Unidades disponibles').fill('9');
    const selector = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '+ Añadir fotos' }).click();
    await (await selector).setFiles(NUEVA);
    await expect(page.locator('li.foto img')).toHaveCount(3);

    // Primero sin conexión y después un 500: aviso rojo genérico y todo sigue en el formulario.
    for (const fallar of [(route) => route.abort('internetdisconnected'), (route) => route.fulfill({ status: 500 })]) {
      await page.route(`**/api/anuncios/${id}`, (route) => (
        route.request().method() === 'PATCH' ? fallar(route) : route.continue()));
      await boton(page, 'Guardar cambios').click();
      await expect(page.getByRole('alert').filter({ hasText: MENSAJE_GENERICO })).toBeVisible();
      await expect(page).toHaveURL(`/anuncios/${id}/editar`);
      await expect(page.getByLabel('Unidades disponibles')).toHaveValue('9');
      await expect(page.locator('li.foto img')).toHaveCount(3);
      await expect(page.locator('li.foto img').last()).toHaveAttribute('alt', 'nueva.jpg');
      await expect(boton(page, 'Guardar cambios')).toBeEnabled();
      await page.unroute(`**/api/anuncios/${id}`);
    }
    expect(await estadoEnBd(id)).toEqual(antes);

    // Con la red de vuelta, el mismo formulario se guarda con la foto nueva.
    await boton(page, 'Guardar cambios').click();
    await expect(page).toHaveURL(`/anuncios/${id}`);
    await expect(page.getByText(AVISO_GUARDADO, { exact: true })).toBeVisible();
    expect(await filaDe(id)).toMatchObject({ unidades_disponibles: 9 });
    expect(await fotosDe(id)).toHaveLength(3);
  });
});
