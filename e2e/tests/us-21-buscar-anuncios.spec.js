// T21-7 · E2E de US-21 (buscar anuncios escribiendo palabras). Casos: docs/especificacion/E04 (US-21).
// B busca en el catálogo; los anuncios son de A. Cada caso vacía el catálogo y crea solo los suyos.
// Los casos se omiten mientras su pieza no esté en la rama: `q` en la API (T21-2), cuadro de búsqueda
// (T21-5) y, para E2E-4, el filtro de categoría (T21-3).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  boton, contarPeticiones, datosCentro, fecha, getCatalogo, hayBusquedaEnApi, hayCuadroBusqueda,
  hayFiltrosEnApi, insertarAnuncio, restablecerSemilla, tarjeta, tarjetas, tokenDe, vaciarCatalogo,
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

// Datos de los flujos E2E-1 a E2E-5.
async function insertarDatosE2E() {
  const comunes = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...comunes, titulo: 'Raquetas de pádel', deporte: 'padel', categoria: 'otros', publicado_en: fecha(18) });
  await insertarAnuncio(db, {
    ...comunes, titulo: 'Red de portería de fútbol 7', categoria: 'porterias_redes', publicado_en: fecha(19),
  });
  await insertarAnuncio(db, { ...comunes, titulo: 'Balones de fútbol talla 5', publicado_en: fecha(20) });
  await insertarAnuncio(db, { ...comunes, titulo: 'Balones de baloncesto', deporte: 'baloncesto', publicado_en: fecha(17) });
}

async function entrarYBuscar(page, cuentas) {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayCuadroBusqueda(page)), 'El cuadro de búsqueda (T21-5) aún no está en esta rama.');
  return page.getByPlaceholder('Buscar material…');
}

// La «×» del cuadro: su nombre accesible lo fija el frontend; se acepta «×» o un texto de borrar/quitar.
function botonBorrar(page) {
  return page.getByRole('button', { name: /^(×|borrar búsqueda|quitar búsqueda|borrar|limpiar búsqueda)$/i });
}

// ---------------------------------------------------------------- flujos e2e

test('US-21 · E2E-1 · camino feliz', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  const cuadro = await entrarYBuscar(page, cuentas);
  await expect(page.getByText('4 anuncios', { exact: true })).toBeVisible();

  // CA6: no se busca a cada tecla, solo con Intro o «Buscar».
  const peticiones = contarPeticiones(page);
  await cuadro.pressSequentially('BALON');
  await page.waitForTimeout(800);
  expect(peticiones.filter((url) => url.includes('q='))).toHaveLength(0);
  await cuadro.press('Enter');
  await expect(page).toHaveURL('/catalogo?q=BALON');
  // «BALON» está en el título de los dos balones (CA8 y CA9); la red y las raquetas no lo contienen.
  await expect(page.getByText('2 anuncios para «BALON»', { exact: true })).toBeVisible();
  // CA12: mismo orden que sin búsqueda; CA16: sin resaltar.
  await expect(tarjetas(page)).toHaveText([/Balones de fútbol talla 5/, /Balones de baloncesto/]);
  await expect(page.getByRole('main').locator('mark')).toHaveCount(0);

  await cuadro.fill('talla 5');
  await boton(page, 'Buscar').click();
  await expect(page).toHaveURL('/catalogo?q=talla+5');
  // CA17: singular.
  await expect(page.getByText('1 anuncio para «talla 5»', { exact: true })).toBeVisible();
  await expect(tarjetas(page)).toHaveText([/Balones de fútbol talla 5/]);

  // CA15: abrir la URL deja el cuadro relleno y los resultados filtrados.
  await page.goto('/catalogo?q=balon');
  await expect(cuadro).toHaveValue('balon');
  await expect(page.getByText('2 anuncios para «balon»', { exact: true })).toBeVisible();
});

test('US-21 · E2E-2 · varias palabras', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  const cuadro = await entrarYBuscar(page, cuentas);

  // CA10: tienen que estar todas las palabras.
  await cuadro.fill('futbol red');
  await cuadro.press('Enter');
  await expect(page.getByText('1 anuncio para «futbol red»', { exact: true })).toBeVisible();
  await expect(tarjetas(page)).toHaveText([/Red de portería de fútbol 7/]);

  // CA18: sin resultados.
  await cuadro.fill('futbol padel');
  await cuadro.press('Enter');
  await expect(page.getByText('No hay anuncios para «futbol padel».', { exact: true })).toBeVisible();
  await expect(page.getByText('Prueba con otras palabras o quita algún filtro.')).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(0);

  // CA2: se quitan los espacios sobrantes antes de buscar.
  await cuadro.fill('   futbol    red  ');
  await cuadro.press('Enter');
  await expect(page).toHaveURL('/catalogo?q=futbol+red');
  await expect(cuadro).toHaveValue('futbol red');
});

test('US-21 · E2E-3 · longitudes', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  const cuadro = await entrarYBuscar(page, cuentas);
  const peticiones = contarPeticiones(page);

  // CA4: 1 carácter tras quitar espacios → mensaje y ninguna petición.
  await cuadro.fill(' a ');
  await cuadro.press('Enter');
  await expect(page.getByText('Escribe al menos 2 caracteres.')).toBeVisible();
  await expect(page).toHaveURL('/catalogo');

  // CA5: más de 5 palabras.
  await cuadro.fill('uno dos tres cuatro cinco seis');
  await boton(page, 'Buscar').click();
  await expect(page.getByText('Usa como máximo 5 palabras.')).toBeVisible();
  await expect(page).toHaveURL('/catalogo');
  expect(peticiones.filter((url) => url.includes('q='))).toHaveLength(0);

  // CA4: con 2 caracteres sí se busca.
  await cuadro.fill('pa');
  await cuadro.press('Enter');
  await expect(page).toHaveURL('/catalogo?q=pa');
  await expect(page.getByText('Escribe al menos 2 caracteres.')).toHaveCount(0);
  await expect(tarjeta(page, 'Raquetas de pádel')).toBeVisible();

  // CA1: como máximo 100 caracteres.
  await expect(cuadro).toHaveAttribute('maxlength', '100');
  await cuadro.fill('');
  await cuadro.pressSequentially('x'.repeat(101));
  await expect(cuadro).toHaveValue('x'.repeat(100));

  // CA3: vacío equivale a quitar la búsqueda.
  await cuadro.fill('   ');
  await cuadro.press('Enter');
  await expect(page).toHaveURL('/catalogo');
  await expect(page.getByText('4 anuncios', { exact: true })).toBeVisible();
});

test('US-21 · E2E-4 · limpiar', async ({ page, request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFiltrosEnApi(request, token)), 'El filtro de categoría (T21-3) aún no está en esta rama.');
  await insertarDatosE2E();
  await insertarAnuncio(db, { centro_id: centros.a.id, titulo: 'Pelotas de tenis', deporte: 'tenis', publicado_en: fecha(16) });
  await entrarYBuscar(page, cuentas);

  await page.goto('/catalogo?q=balon&categoria=balones');
  await expect(page.getByText('2 anuncios para «balon»', { exact: true })).toBeVisible();
  // CA14: la «×» vacía el cuadro, quita q y mantiene los filtros.
  await botonBorrar(page).click();
  await expect(page).toHaveURL('/catalogo?categoria=balones');
  await expect(page.getByPlaceholder('Buscar material…')).toHaveValue('');
  await expect(tarjetas(page)).toHaveText([/Balones de fútbol talla 5/, /Balones de baloncesto/, /Pelotas de tenis/]);

  // CA13: la búsqueda se combina con los filtros y vuelve a la página 1.
  await page.goto('/catalogo?categoria=balones&pagina=2');
  await page.getByPlaceholder('Buscar material…').fill('tenis');
  await page.getByPlaceholder('Buscar material…').press('Enter');
  await expect(page).not.toHaveURL(/pagina=/);
  await expect(page).toHaveURL(/categoria=balones/);
  await expect(page).toHaveURL(/q=tenis/);
  await expect(tarjetas(page)).toHaveText([/Pelotas de tenis/]);
});

test('US-21 · E2E-5 · sin resultados', async ({ page, cuentas }) => {
  await insertarDatosE2E();
  const cuadro = await entrarYBuscar(page, cuentas);
  await cuadro.fill('trampolin');
  await cuadro.press('Enter');
  await expect(page.getByText('No hay anuncios para «trampolin».', { exact: true })).toBeVisible();
  await boton(page, 'Quitar búsqueda y filtros').click();
  await expect(page).toHaveURL('/catalogo');
  await expect(page.getByText('4 anuncios', { exact: true })).toBeVisible();
  await expect(cuadro).toHaveValue('');
});

// ---------------------------------------------------------------- API

async function buscar(request, token, q) {
  const res = await getCatalogo(request, token, `q=${encodeURIComponent(q)}`);
  expect(res.status(), `q=${q}`).toBe(200);
  return (await res.json()).anuncios.map((anuncio) => anuncio.titulo);
}

test('US-21 · API · reglas de la búsqueda (CA7 a CA12, CA19, CA22, CA23)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBusquedaEnApi(request, token)), 'El parámetro q de GET /api/catalogo (T21-2) aún no está en esta rama.');
  const a = { centro_id: centros.a.id };
  await insertarAnuncio(db, { ...a, titulo: 'Balón talla 5', descripcion: 'Ideal para fútbol 7, poco uso y bien inflado.', publicado_en: fecha(20) });
  await insertarAnuncio(db, { ...a, titulo: 'Redes de voleibol', deporte: 'voleibol', publicado_en: fecha(19) });
  await insertarAnuncio(db, { ...a, titulo: 'Protectores de paredes', categoria: 'protecciones', publicado_en: fecha(18) });
  await insertarAnuncio(db, { ...a, titulo: 'Equipación de niño', categoria: 'ropa_equipacion', publicado_en: fecha(17) });
  await insertarAnuncio(db, { ...a, titulo: 'Pilotes de Lliçà', publicado_en: fecha(16) });
  await insertarAnuncio(db, { ...a, titulo: 'Camisetas 100% algodón', categoria: 'ropa_equipacion', publicado_en: fecha(15) });
  await insertarAnuncio(db, { ...a, titulo: 'Conos a_b de colores', publicado_en: fecha(14) });
  await insertarAnuncio(db, { ...a, titulo: 'Vallas C:\\pista', deporte: 'atletismo', publicado_en: fecha(13) });
  await insertarAnuncio(db, { ...a, titulo: 'Balón pausado de A', estado: 'pausado', publicado_en: fecha(21) });
  await insertarAnuncio(db, { centro_id: centros.b.id, titulo: 'Balón propio de B', publicado_en: fecha(21) });

  // CA8: sin mayúsculas ni acentos; ñ como n y ç como c.
  for (const q of ['BALON', 'balón', 'Balon']) expect(await buscar(request, token, q)).toEqual(['Balón talla 5']);
  expect(await buscar(request, token, 'nino')).toEqual(['Equipación de niño']);
  expect(await buscar(request, token, 'llica')).toEqual(['Pilotes de Lliçà']);
  // CA9: por fragmento. CA12: orden de más reciente a más antiguo.
  expect(await buscar(request, token, 'red')).toEqual(['Redes de voleibol', 'Protectores de paredes']);
  // CA10: todas las palabras, en título o descripción.
  expect(await buscar(request, token, 'balon futbol')).toEqual(['Balón talla 5']);
  expect(await buscar(request, token, 'balon voleibol')).toEqual([]);
  // CA2 en la API: espacios sobrantes.
  expect(await buscar(request, token, '  balon    futbol ')).toEqual(['Balón talla 5']);
  // CA7: no se busca en el nombre del centro, la categoría ni el deporte.
  expect(await buscar(request, token, centros.a.nombre.split(' ')[0])).toEqual([]);
  expect(await buscar(request, token, 'protecciones')).toEqual([]);
  expect(await buscar(request, token, 'atletismo')).toEqual([]);
  expect(await buscar(request, token, 'baloncesto')).toEqual([]);
  // CA11: %, _ y \ literales. CA23: solo símbolos → 0 resultados sin error.
  expect(await buscar(request, token, '0%')).toEqual(['Camisetas 100% algodón']);
  expect(await buscar(request, token, 'a_b')).toEqual(['Conos a_b de colores']);
  expect(await buscar(request, token, ':\\')).toEqual(['Vallas C:\\pista']);
  expect(await buscar(request, token, 'o%a')).toEqual([]);
  expect(await buscar(request, token, 'd_s')).toEqual([]);
  expect(await buscar(request, token, '%%')).toEqual([]);
  expect(await buscar(request, token, '__')).toEqual([]);
  // CA22: un pausado con la palabra no aparece; tampoco los propios.
  expect(await buscar(request, token, 'pausado')).toEqual([]);
  expect(await buscar(request, token, 'propio')).toEqual([]);

  // CA19: total y paginación con la búsqueda.
  const res = await getCatalogo(request, token, 'q=red');
  expect(await res.json()).toMatchObject({ total: 2, total_paginas: 1, pagina: 1 });
  // CA3: q vacío equivale a no enviarlo.
  const vacio = await (await getCatalogo(request, token, 'q=')).json();
  expect(vacio.total).toBe(8);
});

test('US-21 · API · validación (CA20)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBusquedaEnApi(request, token)), 'El parámetro q de GET /api/catalogo (T21-2) aún no está en esta rama.');
  for (const [q, mensaje] of [
    ['a', 'Escribe al menos 2 caracteres.'],
    ['  a  ', 'Escribe al menos 2 caracteres.'],
    ['x'.repeat(101), 'La búsqueda puede tener como máximo 100 caracteres.'],
    ['uno dos tres cuatro cinco seis', 'Usa como máximo 5 palabras.'],
  ]) {
    const res = await getCatalogo(request, token, `q=${encodeURIComponent(q)}`);
    expect(res.status(), `q=${q}`).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.q).toBe(mensaje);
  }
  // 100 caracteres y 5 palabras sí valen.
  expect((await getCatalogo(request, token, `q=${'x'.repeat(100)}`)).status()).toBe(200);
  expect((await getCatalogo(request, token, 'q=uno+dos+tres+cuatro+cinco')).status()).toBe(200);
});
