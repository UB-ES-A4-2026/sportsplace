// T21-7 · E2E de US-74 (ver solo los anuncios en venta o solo los de donación). Casos: docs/especificacion/E04 (US-74).
// B filtra el catálogo; los anuncios son de A. Cada caso vacía el catálogo y crea solo los suyos.
// Los casos se omiten mientras su pieza no esté en la rama: filtros en la API (T21-3) y barra de filtros (T21-6).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  consulta, datosCentro, etiqueta, fecha, getCatalogo, hayBarraFiltros, hayFiltroEnApi, insertarAnuncio,
  limpiarFiltros, quitarEtiqueta, restablecerSemilla, tarjetas, tokenDe, vaciarCatalogo,
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

// 3 ventas y 2 donaciones, intercaladas por fecha.
async function insertarDatosE2E() {
  const a = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...a, titulo: 'Venta 1', precio_unitario_centimos: 1500, publicado_en: fecha(20) });
  await insertarAnuncio(db, { ...a, titulo: 'Donación 1', modalidad: 'donacion', publicado_en: fecha(19) });
  await insertarAnuncio(db, { ...a, titulo: 'Venta 2', precio_unitario_centimos: 3000, publicado_en: fecha(18) });
  await insertarAnuncio(db, { ...a, titulo: 'Donación 2', modalidad: 'donacion', publicado_en: fecha(17) });
  await insertarAnuncio(db, { ...a, titulo: 'Venta 3', precio_unitario_centimos: 900, publicado_en: fecha(16) });
}

async function entrarYFiltrar(page, cuentas, ruta = '/catalogo') {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBarraFiltros(page)), 'La barra de filtros (T21-6) aún no está en esta rama.');
  if (ruta !== '/catalogo') await page.goto(ruta);
}

// Selector de tres botones unidos; se acepta botón o radio.
function opcion(page, nombre) {
  return page.getByRole('button', { name: nombre, exact: true }).or(page.getByRole('radio', { name: nombre, exact: true }));
}

// ---------------------------------------------------------------- flujos e2e

test('US-74 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?pagina=2');
  await expect(tarjetas(page)).toHaveCount(0);

  // CA1 y CA2: se aplica en el acto y vuelve a la página 1.
  await opcion(page, 'Donación').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', modalidad: 'donacion' });
  await expect(tarjetas(page)).toHaveText([/Donación 1/, /Donación 2/]);
  for (const titulo of ['Donación 1', 'Donación 2']) {
    await expect(tarjetas(page).filter({ hasText: titulo }).getByText('Gratis · Donación')).toBeVisible();
  }
  await expect(etiqueta(page, 'Modalidad: Donación')).toBeVisible();

  await opcion(page, 'Venta').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', modalidad: 'venta' });
  await expect(tarjetas(page)).toHaveText([/Venta 1/, /Venta 2/, /Venta 3/]);
  await expect(etiqueta(page, 'Modalidad: Venta')).toBeVisible();

  await opcion(page, 'Todos').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await expect(tarjetas(page)).toHaveCount(5);

  // CA5: la «×» de la etiqueta y «Limpiar filtros» vuelven a «Todos».
  await opcion(page, 'Venta').click();
  await quitarEtiqueta(page, 'Modalidad: Venta').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await opcion(page, 'Donación').click();
  await limpiarFiltros(page).click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await expect(tarjetas(page)).toHaveCount(5);
});

test('US-74 · E2E-2 · donación deshabilita el precio', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?precio_max=20');
  await expect(tarjetas(page)).toHaveCount(4);

  // CA4: el precio se quita de la URL y el grupo queda deshabilitado con su aviso.
  await opcion(page, 'Donación').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', modalidad: 'donacion' });
  await expect(page.getByLabel('Desde', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Hasta', { exact: true })).toBeDisabled();
  await expect(page.getByText('No aplica a donaciones')).toBeVisible();
  await expect(tarjetas(page)).toHaveText([/Donación 1/, /Donación 2/]);

  await opcion(page, 'Todos').click();
  await expect(page.getByLabel('Hasta', { exact: true })).toBeEnabled();
  await expect(page.getByText('No aplica a donaciones')).toHaveCount(0);
});

test('US-74 · E2E-3 · URL manipulada', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?modalidad=gratis');
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await expect(tarjetas(page)).toHaveCount(5);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// ---------------------------------------------------------------- API

async function titulos(request, token, parametros) {
  const res = await getCatalogo(request, token, parametros);
  expect(res.status(), parametros).toBe(200);
  return (await res.json()).anuncios.map((anuncio) => anuncio.titulo);
}

test('US-74 · API · modalidad (CA2, CA3, CA6)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFiltroEnApi(request, token, 'modalidad=gratis')), 'El filtro de modalidad (T21-3) aún no está en esta rama.');
  await insertarDatosE2E();

  expect(await titulos(request, token, 'modalidad=venta')).toEqual(['Venta 1', 'Venta 2', 'Venta 3']);
  expect(await titulos(request, token, 'modalidad=donacion')).toEqual(['Donación 1', 'Donación 2']);
  expect(await titulos(request, token, 'modalidad=')).toHaveLength(5);
  // CA3: donación con precio mínimo ≥ 1 no da nada.
  expect(await titulos(request, token, 'modalidad=donacion&precio_min=1')).toEqual([]);
  expect(await titulos(request, token, 'modalidad=venta&precio_max=15')).toEqual(['Venta 1', 'Venta 3']);

  for (const valor of ['gratis', 'Venta', 'donación']) {
    const res = await getCatalogo(request, token, `modalidad=${encodeURIComponent(valor)}`);
    expect(res.status(), valor).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.modalidad).toBe('Modalidad no válida.');
  }
});

test('US-74 · web · «Donación» con precio mínimo quita el precio (CA3, CA4)', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?precio_min=1');
  await expect(tarjetas(page)).toHaveCount(3);
  await opcion(page, 'Donación').click();
  // Con la regla de CA4 el precio se quita; el mensaje de CA3 se comprueba con la API (arriba).
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', modalidad: 'donacion' });
  await expect(tarjetas(page)).toHaveCount(2);
});
