// T21-7 · E2E de US-22 (filtrar los anuncios por categoría y deporte). Casos: docs/especificacion/E04 (US-22).
// B filtra el catálogo; los anuncios son de A. Cada caso vacía el catálogo y crea solo los suyos.
// Los casos se omiten mientras su pieza no esté en la rama: filtros en la API (T21-3) y barra de filtros (T21-6).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  consulta, datosCentro, desplegable, etiqueta, fecha, getCatalogo, hayBarraFiltros, hayCuadroBusqueda,
  hayFiltroEnApi, insertarAnuncio, limpiarFiltros, quitarEtiqueta, restablecerSemilla, tarjetas, tokenDe,
  vaciarCatalogo,
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

const CATEGORIAS = [
  'Balones', 'Ropa y equipación', 'Calzado', 'Protecciones', 'Material de entrenamiento', 'Porterías y redes',
  'Máquinas y fitness', 'Otros',
];
const DEPORTES = [
  'Fútbol', 'Baloncesto', 'Balonmano', 'Voleibol', 'Tenis', 'Pádel', 'Natación', 'Atletismo', 'Gimnasio y fitness',
  'Varios',
];

// Datos de los flujos E2E-1 a E2E-5.
async function insertarDatosE2E() {
  const a = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...a, titulo: 'Balones baloncesto Molten', categoria: 'balones', deporte: 'baloncesto', publicado_en: fecha(20) });
  await insertarAnuncio(db, { ...a, titulo: 'Balones fútbol', categoria: 'balones', deporte: 'futbol', publicado_en: fecha(19) });
  await insertarAnuncio(db, { ...a, titulo: 'Zapatillas baloncesto', categoria: 'calzado', deporte: 'baloncesto', publicado_en: fecha(18) });
}

async function entrarYFiltrar(page, cuentas, ruta = '/catalogo') {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBarraFiltros(page)), 'La barra de filtros (T21-6) aún no está en esta rama.');
  if (ruta !== '/catalogo') await page.goto(ruta);
}

// ---------------------------------------------------------------- flujos e2e

test('US-22 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?pagina=2');

  // CA1 y CA2: opciones, orden y valor por defecto.
  await expect(desplegable(page, 'Categoría').locator('option')).toHaveText(['Todas las categorías', ...CATEGORIAS]);
  await expect(desplegable(page, 'Deporte').locator('option')).toHaveText(['Todos los deportes', ...DEPORTES]);
  await expect(desplegable(page, 'Categoría')).toHaveValue('');
  // CA7: sin filtros activos no se ve «Limpiar filtros».
  await expect(limpiarFiltros(page)).toHaveCount(0);

  // CA3: se aplica en el acto y vuelve a la página 1.
  await desplegable(page, 'Categoría').selectOption({ label: 'Balones' });
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', categoria: 'balones' });
  await expect(tarjetas(page)).toHaveText([/Balones baloncesto Molten/, /Balones fútbol/]);

  // CA4: los dos filtros a la vez (Y).
  await desplegable(page, 'Deporte').selectOption({ label: 'Baloncesto' });
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', categoria: 'balones', deporte: 'baloncesto' });
  await expect(tarjetas(page)).toHaveText([/Balones baloncesto Molten/]);
  // CA6: una etiqueta por filtro activo.
  await expect(etiqueta(page, 'Categoría: Balones')).toBeVisible();
  await expect(etiqueta(page, 'Deporte: Baloncesto')).toBeVisible();

  // CA5: «Todos los deportes» quita el parámetro.
  await desplegable(page, 'Deporte').selectOption({ label: 'Todos los deportes' });
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', categoria: 'balones' });
  await expect(etiqueta(page, 'Deporte: Baloncesto')).toHaveCount(0);
});

test('US-22 · E2E-2 · quitar uno', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?categoria=balones&deporte=baloncesto');
  // CA8: abrir la URL deja los desplegables y las etiquetas puestos.
  await expect(desplegable(page, 'Categoría')).toHaveValue('balones');
  await expect(desplegable(page, 'Deporte')).toHaveValue('baloncesto');
  await expect(tarjetas(page)).toHaveText([/Balones baloncesto Molten/]);

  // CA6: la «×» quita solo ese filtro y deja el desplegable en «Todas las categorías».
  await quitarEtiqueta(page, 'Categoría: Balones').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', deporte: 'baloncesto' });
  await expect(desplegable(page, 'Categoría')).toHaveValue('');
  await expect(tarjetas(page)).toHaveText([/Balones baloncesto Molten/, /Zapatillas baloncesto/]);

  // «Atrás» recupera el filtro anterior (la URL se actualiza con push).
  await page.goBack();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', categoria: 'balones', deporte: 'baloncesto' });
  await expect(tarjetas(page)).toHaveText([/Balones baloncesto Molten/]);
});

test('US-22 · E2E-3 · limpiar con búsqueda', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBarraFiltros(page)), 'La barra de filtros (T21-6) aún no está en esta rama.');
  test.skip(!(await hayCuadroBusqueda(page)), 'El cuadro de búsqueda (T21-5) aún no está en esta rama.');

  // CA9: búsqueda y filtro a la vez. CA7: «Limpiar filtros» conserva q y orden.
  await page.goto('/catalogo?q=molten&categoria=balones&orden=recientes');
  await expect(tarjetas(page)).toHaveText([/Balones baloncesto Molten/]);
  await limpiarFiltros(page).click();
  const { ruta, q, categoria } = consulta(page);
  expect({ ruta, q, categoria }).toEqual({ ruta: '/catalogo', q: 'molten', categoria: undefined });
  await expect(page.getByPlaceholder('Buscar material…')).toHaveValue('molten');
  await expect(limpiarFiltros(page)).toHaveCount(0);
});

test('US-22 · E2E-4 · sin resultados', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas);
  await desplegable(page, 'Deporte').selectOption({ label: 'Natación' });
  await desplegable(page, 'Categoría').selectOption({ label: 'Porterías y redes' });
  // CA10.
  await expect(page.getByText('No hay anuncios con estos filtros.', { exact: true })).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(0);
  await limpiarFiltros(page).click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await expect(tarjetas(page)).toHaveCount(3);
});

test('US-22 · E2E-5 · URL manipulada', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas);
  const entradas = await page.evaluate(() => globalThis.history.length);
  // CA14: se carga sin el filtro, la URL queda limpia (replace) y no hay error.
  for (const ruta of ['/catalogo?deporte=golf', '/catalogo?categoria=pelotas', '/catalogo?categoria=Balones']) {
    await page.goto(ruta);
    await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
    await expect(tarjetas(page)).toHaveCount(3);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  expect(await page.evaluate(() => globalThis.history.length)).toBe(entradas + 3);
});

test('US-22 · móvil · la barra se pliega tras «Filtros (N)»', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarYFiltrar(page, cuentas, '/catalogo?categoria=balones&deporte=baloncesto');
  const plegar = page.getByRole('button', { name: 'Filtros (2)', exact: true });
  await expect(plegar).toBeVisible();
  await expect(desplegable(page, 'Categoría')).toBeHidden();
  await plegar.click();
  await expect(desplegable(page, 'Categoría')).toBeVisible();
  await expect(desplegable(page, 'Categoría')).toHaveValue('balones');
});

// ---------------------------------------------------------------- API

async function titulos(request, token, parametros) {
  const res = await getCatalogo(request, token, parametros);
  expect(res.status(), parametros).toBe(200);
  return (await res.json()).anuncios.map((anuncio) => anuncio.titulo);
}

test('US-22 · API · filtros por categoría y deporte (CA4, CA11)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFiltroEnApi(request, token, 'categoria=pelotas')), 'Los filtros de GET /api/catalogo (T21-3) aún no están en esta rama.');
  await insertarDatosE2E();
  await insertarAnuncio(db, { centro_id: centros.a.id, titulo: 'Material de varios deportes', deporte: 'varios', categoria: 'otros', publicado_en: fecha(17) });
  await insertarAnuncio(db, { centro_id: centros.b.id, titulo: 'Balones propios de B', deporte: 'baloncesto', publicado_en: fecha(21) });

  expect(await titulos(request, token, 'categoria=balones&deporte=baloncesto')).toEqual(['Balones baloncesto Molten']);
  expect(await titulos(request, token, 'categoria=balones')).toEqual(['Balones baloncesto Molten', 'Balones fútbol']);
  expect(await titulos(request, token, 'deporte=baloncesto')).toEqual(['Balones baloncesto Molten', 'Zapatillas baloncesto']);
  // CA4: «Varios» y «Otros» son valores normales.
  expect(await titulos(request, token, 'deporte=varios')).toEqual(['Material de varios deportes']);
  expect(await titulos(request, token, 'categoria=otros')).toEqual(['Material de varios deportes']);
  // Un parámetro vacío equivale a no enviarlo; los desconocidos se ignoran.
  expect(await titulos(request, token, 'categoria=&deporte=&color=rojo')).toHaveLength(4);
  const total = await (await getCatalogo(request, token, 'categoria=balones')).json();
  expect(total).toMatchObject({ total: 2, pagina: 1, total_paginas: 1 });
});

test('US-22 · API · validación (CA12, CA13)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFiltroEnApi(request, token, 'categoria=pelotas')), 'Los filtros de GET /api/catalogo (T21-3) aún no están en esta rama.');
  for (const [parametros, campo, mensaje] of [
    ['categoria=pelotas', 'categoria', 'Categoría no válida.'],
    ['categoria=Balones', 'categoria', 'Categoría no válida.'],
    ['categoria=balones&categoria=calzado', 'categoria', 'Categoría no válida.'],
    ['deporte=golf', 'deporte', 'Deporte no válido.'],
  ]) {
    const res = await getCatalogo(request, token, parametros);
    expect(res.status(), parametros).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details[campo]).toBe(mensaje);
  }
});
