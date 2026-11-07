// T21-7 · E2E de US-96 (ver el catálogo de anuncios de otros centros). Casos: docs/especificacion/E04 (US-96).
// B mira el catálogo; los anuncios son de A. Cada caso vacía el catálogo y crea solo los suyos.
// Los casos se omiten mientras su pieza no esté en la rama: API (T21-1) y pantalla (T21-4).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  boton, datosCentro, fecha, getCatalogo, hayApiCatalogo, hayPantallaCatalogo, insertarAnuncio,
  restablecerSemilla, tarjeta, tarjetas, tokenDe, vaciarCatalogo,
} from '../catalogo.js';

let db;
let centros;

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = { a: await datosCentro(db, cuentas.centroA), b: await datosCentro(db, cuentas.centroB) };
});

test.beforeEach(async () => {
  await vaciarCatalogo(db);
});

test.afterAll(async () => {
  if (!db) return;
  await restablecerSemilla(db);
  await db.close();
});

async function entrarAlCatalogo(page, cuentas) {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayPantallaCatalogo(page)), 'La pantalla /catalogo (T21-4) aún no está en esta rama.');
}

async function insertarVarios(n, cambios = {}) {
  const ids = [];
  // Del 1 al n, cada uno un minuto más reciente: el último insertado va primero.
  for (let i = 1; i <= n; i += 1) {
    ids.push(await insertarAnuncio(db, {
      centro_id: centros.a.id, titulo: `Anuncio del catálogo ${String(i).padStart(2, '0')}`,
      publicado_en: fecha(1, i), ...cambios,
    }));
  }
  return ids;
}

// ---------------------------------------------------------------- flujos e2e

test('US-96 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  await insertarAnuncio(db, { centro_id: centros.a.id, titulo: 'Raquetas de pádel', publicado_en: fecha(18) });
  await insertarAnuncio(db, {
    centro_id: centros.a.id, titulo: 'Red de portería de fútbol 7', publicado_en: fecha(19),
    modalidad: 'donacion', estado_material: 'como_nuevo', unidades_disponibles: 1,
  });
  const id20 = await insertarAnuncio(db, {
    centro_id: centros.a.id, titulo: 'Balones de fútbol talla 5', publicado_en: fecha(20),
    precio_unitario_centimos: 123450, unidades_disponibles: 12,
  });

  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayPantallaCatalogo(page)), 'La pantalla /catalogo (T21-4) aún no está en esta rama.');

  // CA1: «Catálogo» de la cabecera lleva a /catalogo y queda marcado como activo; el logo también.
  await page.goto('/panel');
  await page.getByRole('link', { name: 'Catálogo', exact: true }).click();
  await expect(page).toHaveURL('/catalogo');
  await expect(page.getByRole('link', { name: 'Catálogo', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.goto('/panel');
  await page.getByRole('link', { name: 'Sportsplace' }).first().click();
  await expect(page).toHaveURL('/catalogo');

  // CA11 y CA5: total y orden del más reciente al más antiguo.
  await expect(page.getByText('3 anuncios', { exact: true })).toBeVisible();
  await expect(tarjetas(page)).toHaveText([/Balones de fútbol talla 5/, /Red de portería de fútbol 7/, /Raquetas de pádel/]);
  await expect(tarjetas(page).first()).toHaveAttribute('href', `/anuncios/${id20}`);

  // Contenido de la tarjeta (pantallas para el boceto) y CA12.
  const origen = `${centros.a.nombre} · ${centros.a.localidad}`;
  for (const titulo of ['Balones de fútbol talla 5', 'Red de portería de fútbol 7', 'Raquetas de pádel']) {
    await expect(tarjeta(page, titulo).getByText(origen)).toBeVisible();
  }
  const balones = tarjeta(page, 'Balones de fútbol talla 5');
  await expect(balones.getByText('1.234,50 € / unidad')).toBeVisible();
  await expect(balones.getByText('Buen estado · 12 unidades')).toBeVisible();
  await expect(balones.getByText('Publicado el 20/10/2026')).toBeVisible();
  await expect(balones.getByText('Sin foto')).toBeVisible();
  const red = tarjeta(page, 'Red de portería de fútbol 7');
  await expect(red.getByText('Gratis · Donación')).toBeVisible();
  await expect(red.getByText('Como nuevo · 1 unidad')).toBeVisible();
  await expect(tarjeta(page, 'Raquetas de pádel').getByText('12,50 € / unidad')).toBeVisible();
  // Con 3 anuncios no hay paginación (CA8).
  await expect(boton(page, 'Siguiente')).toHaveCount(0);

  // CA3: pulsar la tarjeta lleva a la ficha.
  await tarjetas(page).first().click();
  await expect(page).toHaveURL(`/anuncios/${id20}`);
});

test('US-96 · E2E-2 · estados', async ({ page, cuentas }) => {
  const comunes = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio activo de A', publicado_en: fecha(10) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio reservado de A', estado: 'reservado', publicado_en: fecha(14) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio activo nuevo de A', publicado_en: fecha(15) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio activo viejo de A', publicado_en: fecha(9) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio pausado de A', estado: 'pausado', publicado_en: fecha(16) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio entregado de A', estado: 'entregado', publicado_en: fecha(17) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio retirado de A', estado: 'retirado', publicado_en: fecha(18) });
  // CA4: sin unidades disponibles tampoco aparece.
  await insertarAnuncio(db, { ...comunes, titulo: 'Anuncio agotado de A', unidades_disponibles: 0, publicado_en: fecha(19) });

  await entrarAlCatalogo(page, cuentas);
  await expect(page.getByText('4 anuncios', { exact: true })).toBeVisible();
  // CA6: el reservado ocupa su sitio según la fecha, con «No disponible».
  await expect(tarjetas(page)).toHaveText([
    /Anuncio activo nuevo de A/, /Anuncio reservado de A/, /Anuncio activo de A/, /Anuncio activo viejo de A/,
  ]);
  await expect(tarjeta(page, 'Anuncio reservado de A').getByText('No disponible', { exact: true })).toBeVisible();
  await expect(tarjeta(page, 'Anuncio activo de A').getByText('No disponible', { exact: true })).toHaveCount(0);
  for (const titulo of ['pausado', 'entregado', 'retirado', 'agotado']) {
    await expect(page.getByText(`Anuncio ${titulo} de A`)).toHaveCount(0);
  }
});

test('US-96 · E2E-3 · propios', async ({ page, browser, cuentas }, testInfo) => {
  await insertarAnuncio(db, { centro_id: centros.b.id, titulo: 'Anuncio propio de B' });

  await entrarAlCatalogo(page, cuentas);
  await expect(page.getByText('Anuncio propio de B')).toHaveCount(0);
  await expect(page.getByText('Todavía no hay anuncios de otros centros. Vuelve más tarde o publica el tuyo.')).toBeVisible();

  // A, en otro navegador, sí lo ve.
  const { baseURL, locale, timezoneId } = testInfo.project.use;
  const contextoA = await browser.newContext({ baseURL, locale, timezoneId });
  const a = await contextoA.newPage();
  await entrar(a, cuentas.centroA, cuentas.password);
  await a.goto('/catalogo');
  await expect(tarjeta(a, 'Anuncio propio de B')).toBeVisible();
  await expect(a.getByText('1 anuncio', { exact: true })).toBeVisible();
  await contextoA.close();
});

test('US-96 · E2E-4 · paginación', async ({ page, cuentas }) => {
  await insertarVarios(41);

  await entrarAlCatalogo(page, cuentas);
  await expect(page.getByText('41 anuncios', { exact: true })).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(20);
  await expect(tarjetas(page).first()).toContainText('Anuncio del catálogo 41');
  await expect(page.getByText('Página 1 de 3')).toBeVisible();
  await expect(boton(page, 'Anterior')).toBeDisabled();

  await boton(page, 'Siguiente').click();
  await expect(page).toHaveURL('/catalogo?pagina=2');
  await expect(tarjetas(page)).toHaveCount(20);
  await expect(tarjetas(page).first()).toContainText('Anuncio del catálogo 21');
  await expect(page.getByText('Página 2 de 3')).toBeVisible();

  await boton(page, 'Siguiente').click();
  await expect(page).toHaveURL('/catalogo?pagina=3');
  await expect(tarjetas(page)).toHaveCount(1);
  await expect(tarjetas(page).first()).toContainText('Anuncio del catálogo 01');
  await expect(boton(page, 'Siguiente')).toBeDisabled();
  // CA11: el total es el de la consulta, no el de la página.
  await expect(page.getByText('41 anuncios', { exact: true })).toBeVisible();

  // CA9: «Anterior» vuelve y la página 1 no se escribe en la URL.
  await boton(page, 'Anterior').click();
  await boton(page, 'Anterior').click();
  await expect(page).toHaveURL('/catalogo');

  // CA10: página mayor que la última → la última, con la URL corregida; valores no válidos → página 1.
  await page.goto('/catalogo?pagina=9');
  await expect(page).toHaveURL('/catalogo?pagina=3');
  await expect(tarjetas(page)).toHaveCount(1);
  for (const valor of ['0', '-1', 'abc']) {
    await page.goto(`/catalogo?pagina=${valor}`);
    await expect(page).toHaveURL('/catalogo');
    await expect(tarjetas(page).first()).toContainText('Anuncio del catálogo 41');
  }
});

test('US-96 · E2E-5 · vacío y error', async ({ page, cuentas }) => {
  await entrarAlCatalogo(page, cuentas);
  // CA14: catálogo vacío.
  await expect(page.getByText('Todavía no hay anuncios de otros centros. Vuelve más tarde o publica el tuyo.')).toBeVisible();
  await boton(page.getByRole('main'), 'Publicar anuncio').click();
  await expect(page).toHaveURL('/anuncios/nuevo');

  // CA15: con la API caída, error y «Reintentar», que repite la misma petición.
  await insertarAnuncio(db, { centro_id: centros.a.id, titulo: 'Anuncio tras el error' });
  let fallos = 0;
  await page.route('**/api/catalogo**', (ruta) => {
    fallos += 1;
    return ruta.fulfill({ status: 503, json: { error: { code: 'SERVICIO_NO_DISPONIBLE', message: 'No disponible.' } } });
  });
  await page.goto('/catalogo');
  await expect(page.getByText('No se ha podido cargar.')).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(0);
  await page.unroute('**/api/catalogo**');
  expect(fallos).toBeGreaterThan(0);
  await boton(page, 'Reintentar').click();
  await expect(tarjeta(page, 'Anuncio tras el error')).toBeVisible();
});

test('US-96 · CA2 y CA13 · sin sesión y «Cargando…»', async ({ page, cuentas }) => {
  await page.goto('/catalogo');
  await expect(page).toHaveURL('/entrar');

  await entrarAlCatalogo(page, cuentas);
  let soltar;
  const pendiente = new Promise((resolve) => { soltar = resolve; });
  await page.route('**/api/catalogo**', async (ruta) => { await pendiente; await ruta.continue(); });
  await page.goto('/catalogo');
  await expect(page.getByText('Cargando…')).toBeVisible();
  soltar();
  await expect(page.getByText('Cargando…')).toHaveCount(0);
});

// ---------------------------------------------------------------- API

test('US-96 · API · respuesta, campos y estados (CA16, CA20, CA21, CA24)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayApiCatalogo(request, token)), 'GET /api/catalogo (T21-1) aún no está en esta rama.');
  const id = await insertarAnuncio(db, {
    centro_id: centros.a.id, titulo: 'Balones de fútbol talla 5', publicado_en: fecha(20), unidades_disponibles: 12,
  });
  for (const estado of ['pausado', 'entregado', 'retirado']) {
    await insertarAnuncio(db, { centro_id: centros.a.id, titulo: `Anuncio ${estado} de A`, estado });
  }
  await insertarAnuncio(db, { centro_id: centros.b.id, titulo: 'Anuncio propio de B' });

  const res = await getCatalogo(request, token);
  expect(res.status()).toBe(200);
  const cuerpo = await res.json();
  expect(cuerpo).toMatchObject({ pagina: 1, por_pagina: 20, total: 1, total_paginas: 1 });
  expect(cuerpo.anuncios).toHaveLength(1);
  const [anuncio] = cuerpo.anuncios;
  expect(anuncio).toEqual({
    id, titulo: 'Balones de fútbol talla 5', modalidad: 'venta', precio_unitario_centimos: 1250,
    estado: 'activo', estado_material: 'buen_estado', unidades_disponibles: 12,
    foto_principal_url: null, publicado_en: expect.any(String),
    centro: { id: centros.a.id, nombre: centros.a.nombre, localidad: centros.a.localidad },
    distancia_km: null, es_favorito: false,
  });
  expect(new Date(anuncio.publicado_en).toISOString()).toBe(fecha(20));
  // CA21: nada de descripción ni datos de contacto del centro.
  const texto = JSON.stringify(cuerpo);
  for (const campo of ['descripcion', 'email', 'telefono', 'direccion']) expect(texto).not.toContain(`"${campo}"`);

  // CA24: ni cambiando la URL aparecen los estados ocultos.
  const manipulada = await getCatalogo(request, token, 'estado=pausado&estado=retirado&incluir_propios=true');
  expect((await manipulada.json()).anuncios.map((a) => a.id)).toEqual([id]);
});

test('US-96 · API · paginación y validación (CA5, CA7, CA17, CA18, CA19)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayApiCatalogo(request, token)), 'GET /api/catalogo (T21-1) aún no está en esta rama.');

  // CA19: sin anuncios.
  const vacio = await (await getCatalogo(request, token)).json();
  expect(vacio).toMatchObject({ anuncios: [], total: 0, total_paginas: 0 });

  // CA5: a igual fecha, por id ascendente. 41 anuncios con la misma fecha → 20, 20 y 1 en orden estable.
  const ids = [];
  for (let i = 0; i < 41; i += 1) {
    ids.push(await insertarAnuncio(db, { centro_id: centros.a.id, titulo: `Misma fecha ${i}`, publicado_en: fecha(5) }));
  }
  const vistos = [];
  for (const pagina of [1, 2, 3]) {
    const res = await getCatalogo(request, token, `pagina=${pagina}`);
    expect(res.status()).toBe(200);
    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({ pagina, por_pagina: 20, total: 41, total_paginas: 3 });
    expect(cuerpo.anuncios).toHaveLength(pagina === 3 ? 1 : 20);
    vistos.push(...cuerpo.anuncios.map((a) => a.id));
  }
  expect(vistos).toEqual([...ids].sort());

  // CA18: página mayor que la última.
  const lejos = await getCatalogo(request, token, 'pagina=9');
  expect(lejos.status()).toBe(200);
  expect(await lejos.json()).toMatchObject({ anuncios: [], total: 41 });
  expect((await getCatalogo(request, token, 'pagina=10000')).status()).toBe(200);

  // CA17: fuera de rango o no numérica.
  for (const valor of ['0', '10001', 'abc', '-1', '1.5']) {
    const res = await getCatalogo(request, token, `pagina=${valor}`);
    expect(res.status(), `pagina=${valor}`).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.pagina).toBe('La página debe ser un número entero entre 1 y 10000.');
  }
});

test('US-96 · API · acceso (CA23)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayApiCatalogo(request, token)), 'GET /api/catalogo (T21-1) aún no está en esta rama.');
  const sinToken = await getCatalogo(request, null);
  expect(sinToken.status()).toBe(401);
  expect((await sinToken.json()).error.code).toBe('NO_AUTENTICADO');
  // El 403 EMAIL_NO_CONFIRMADO lo cubren los tests del backend: la cuenta sin confirmar no puede iniciar sesión.
});
