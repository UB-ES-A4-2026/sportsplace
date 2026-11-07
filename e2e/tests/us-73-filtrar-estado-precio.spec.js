// T21-7 · E2E de US-73 (filtrar por estado del material y por precio). Casos: docs/especificacion/E04 (US-73).
// B filtra el catálogo; los anuncios son de A. Cada caso vacía el catálogo y crea solo los suyos.
// Los casos se omiten mientras su pieza no esté en la rama: filtros en la API (T21-3) y barra de filtros (T21-6).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  boton, consulta, datosCentro, etiqueta, fecha, getCatalogo, hayBarraFiltros, hayFiltroEnApi, insertarAnuncio,
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

// A1 a A4 de los flujos, del más reciente al más antiguo.
async function insertarDatosE2E() {
  const a = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...a, titulo: 'A1 venta nuevo 15', estado_material: 'nuevo', precio_unitario_centimos: 1500, publicado_en: fecha(20) });
  await insertarAnuncio(db, { ...a, titulo: 'A2 venta nuevo 25', estado_material: 'nuevo', precio_unitario_centimos: 2500, publicado_en: fecha(19) });
  await insertarAnuncio(db, { ...a, titulo: 'A3 donación como nuevo', estado_material: 'como_nuevo', modalidad: 'donacion', publicado_en: fecha(18) });
  await insertarAnuncio(db, { ...a, titulo: 'A4 venta usado 10', estado_material: 'usado', precio_unitario_centimos: 1000, publicado_en: fecha(17) });
}

const ESTADOS = ['Nuevo', 'Como nuevo', 'Buen estado', 'Usado', 'Para reparar'];

async function entrarYFiltrar(page, cuentas, ruta = '/catalogo') {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBarraFiltros(page)), 'La barra de filtros (T21-6) aún no está en esta rama.');
  if (ruta !== '/catalogo') await page.goto(ruta);
}

// El botón del desplegable cambia de nombre: «Estado del material», el estado elegido o «Estado (N)».
function botonEstado(page) {
  return page.getByRole('button', { name: new RegExp(`^(Estado del material|Estado \\(\\d\\)|${ESTADOS.join('|')})$`) });
}

async function casillaEstado(page, nombre) {
  const casilla = page.getByRole('checkbox', { name: nombre, exact: true });
  if (!(await casilla.isVisible())) await botonEstado(page).click();
  return casilla;
}

function desde(page) {
  return page.getByLabel('Desde', { exact: true });
}

function hasta(page) {
  return page.getByLabel('Hasta', { exact: true });
}

async function precio(page, min, max) {
  await desde(page).fill(min);
  await hasta(page).fill(max);
  await boton(page, 'Aplicar').click();
}

// ---------------------------------------------------------------- flujos e2e

test('US-73 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas);
  await expect(botonEstado(page)).toHaveText('Estado del material');

  // CA1: las casillas se aplican al marcarlas; varios estados con O.
  await (await casillaEstado(page, 'Nuevo')).check();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', estado_material: 'nuevo' });
  await (await casillaEstado(page, 'Como nuevo')).check();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', estado_material: 'nuevo,como_nuevo' });
  await expect(botonEstado(page)).toHaveText('Estado (2)');

  // CA5 y CA6: el precio se aplica con «Aplicar»; CA7: la donación cuenta como 0 €.
  await precio(page, '', '20');
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', estado_material: 'nuevo,como_nuevo', precio_max: '20' });
  await expect(tarjetas(page)).toHaveText([/A1 venta nuevo 15/, /A3 donación como nuevo/]);
  await expect(etiqueta(page, 'Estado: Nuevo, Como nuevo')).toBeVisible();
  await expect(etiqueta(page, 'Precio: hasta 20 €')).toBeVisible();

  // CA10: al abrir la URL, casillas y campos rellenos.
  await page.reload();
  await expect(hasta(page)).toHaveValue('20');
  await expect(await casillaEstado(page, 'Nuevo')).toBeChecked();
  await expect(await casillaEstado(page, 'Como nuevo')).toBeChecked();
  await expect(await casillaEstado(page, 'Usado')).not.toBeChecked();
});

// Nota: en el texto de E2E-2, «Hasta 25 → A1, A2, A3» solo cuadra con los estados de E2E-1 marcados
// (sin ellos entraría A4, de 10 €) y «Desde 1 → A1, A2, A4», sin ellos. Se prueba así.
test('US-73 · E2E-2 · límites', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas, '/catalogo?estado_material=nuevo,como_nuevo');
  await precio(page, '', '25');
  await expect(tarjetas(page)).toHaveText([/A1 venta nuevo 15/, /A2 venta nuevo 25/, /A3 donación como nuevo/]);

  await page.goto('/catalogo');
  // CA5: Intro dentro de un campo también aplica.
  await desde(page).fill('1');
  await desde(page).press('Enter');
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', precio_min: '1' });
  await expect(tarjetas(page)).toHaveText([/A1 venta nuevo 15/, /A2 venta nuevo 25/, /A4 venta usado 10/]);
  await expect(etiqueta(page, 'Precio: desde 1 €')).toBeVisible();

  // CA4: «Desde» = «Hasta» es válido.
  await precio(page, '15', '15');
  await expect(tarjetas(page)).toHaveText([/A1 venta nuevo 15/]);
  await expect(etiqueta(page, 'Precio: 15 € – 15 €')).toBeVisible();

  // CA5: los dos vacíos quitan el filtro de precio.
  await precio(page, '', '');
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await expect(tarjetas(page)).toHaveCount(4);
});

test('US-73 · E2E-3 · validación', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await entrarYFiltrar(page, cuentas);

  // CA4: mínimo mayor que el máximo → mensaje y no se aplica.
  await precio(page, '30', '20');
  await expect(page.getByText('El precio mínimo no puede ser mayor que el máximo.')).toBeVisible();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });

  // CA3: enteros de 0 a 99999.
  for (const valor of ['12,5', '-1', '100000', 'abc']) {
    await precio(page, '', valor);
    await expect(page.getByText('Indica un precio entero entre 0 y 99.999 €.')).toBeVisible();
    await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  }
  await precio(page, '0', '99999');
  await expect(page.getByText('Indica un precio entero entre 0 y 99.999 €.')).toHaveCount(0);
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', precio_min: '0', precio_max: '99999' });
  await expect(tarjetas(page)).toHaveCount(4);
});

test('US-73 · E2E-4 · combinado', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  await insertarAnuncio(db, {
    centro_id: centros.a.id, titulo: 'Zapatillas nuevas 12', categoria: 'calzado', estado_material: 'nuevo',
    precio_unitario_centimos: 1200, publicado_en: fecha(21),
  });
  await entrarYFiltrar(page, cuentas, '/catalogo?categoria=balones&precio_max=20&pagina=1');
  // CA8: Y con la categoría.
  await expect(tarjetas(page)).toHaveText([/A1 venta nuevo 15/, /A3 donación como nuevo/, /A4 venta usado 10/]);

  // CA9: cada etiqueta quita su filtro; «Limpiar filtros» los quita todos.
  await quitarEtiqueta(page, 'Precio: hasta 20 €').click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', categoria: 'balones' });
  await expect(hasta(page)).toHaveValue('');

  // CA2: marcar los 5 estados equivale a no filtrar.
  for (const nombre of ESTADOS) await (await casillaEstado(page, nombre)).check();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo', categoria: 'balones' });

  await page.goto('/catalogo?categoria=balones&precio_max=20&estado_material=nuevo');
  await limpiarFiltros(page).click();
  await expect.poll(() => consulta(page)).toEqual({ ruta: '/catalogo' });
  await expect(tarjetas(page)).toHaveCount(5);
});

// ---------------------------------------------------------------- API

async function titulos(request, token, parametros) {
  const res = await getCatalogo(request, token, parametros);
  expect(res.status(), parametros).toBe(200);
  return (await res.json()).anuncios.map((anuncio) => anuncio.titulo);
}

test('US-73 · API · estado y precio (CA6 a CA8)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFiltroEnApi(request, token, 'estado_material=roto')), 'Los filtros de estado y precio (T21-3) aún no están en esta rama.');
  await insertarDatosE2E();
  const a = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...a, titulo: 'B1 venta 20,00', precio_unitario_centimos: 2000, publicado_en: fecha(16) });
  await insertarAnuncio(db, { ...a, titulo: 'B2 venta 20,01', precio_unitario_centimos: 2001, publicado_en: fecha(15) });

  // Varios estados con O.
  expect(await titulos(request, token, 'estado_material=nuevo,como_nuevo'))
    .toEqual(['A1 venta nuevo 15', 'A2 venta nuevo 25', 'A3 donación como nuevo']);
  // CA6: extremos incluidos, en euros por unidad.
  expect(await titulos(request, token, 'precio_max=20'))
    .toEqual(['A1 venta nuevo 15', 'A3 donación como nuevo', 'A4 venta usado 10', 'B1 venta 20,00']);
  expect(await titulos(request, token, 'precio_min=20&precio_max=20')).toEqual(['B1 venta 20,00']);
  // CA7: las donaciones cuentan como 0 €.
  expect(await titulos(request, token, 'precio_min=0&precio_max=0')).toEqual(['A3 donación como nuevo']);
  expect(await titulos(request, token, 'precio_min=1')).not.toContain('A3 donación como nuevo');
  // CA8: Y con los demás filtros.
  expect(await titulos(request, token, 'estado_material=nuevo&precio_max=20&modalidad=venta')).toEqual(['A1 venta nuevo 15']);
});

test('US-73 · API · validación (CA11, CA12)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFiltroEnApi(request, token, 'estado_material=roto')), 'Los filtros de estado y precio (T21-3) aún no están en esta rama.');
  const fueraDeRango = 'Indica un precio entero entre 0 y 99.999 €.';
  for (const [parametros, campo, mensaje] of [
    ['estado_material=nuevo,roto', 'estado_material', 'Estado del material no válido.'],
    ['estado_material=nuevo,nuevo', 'estado_material', 'Estado del material no válido.'],
    ['precio_min=-1', 'precio_min', fueraDeRango],
    ['precio_max=100000', 'precio_max', fueraDeRango],
    ['precio_max=12.5', 'precio_max', fueraDeRango],
    ['precio_min=abc', 'precio_min', fueraDeRango],
    ['precio_min=30&precio_max=20', 'precio_min', 'El precio mínimo no puede ser mayor que el máximo.'],
  ]) {
    const res = await getCatalogo(request, token, parametros);
    expect(res.status(), parametros).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details[campo]).toBe(mensaje);
  }
  for (const parametros of ['precio_min=0&precio_max=99999', 'precio_min=10&precio_max=10']) {
    expect((await getCatalogo(request, token, parametros)).status(), parametros).toBe(200);
  }
});
