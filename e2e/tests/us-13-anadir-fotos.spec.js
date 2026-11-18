// T13-5 · E2E de US-13 (añadir fotos a mi anuncio). Casos: docs/especificacion/E03 (US-13).
// Usa la plantilla de T12-7 (`entrar`) y las cuentas de la semilla de T12-8.
//
// La historia ya tiene T13-2 (multipart y Storage), T13-3 (sección «Fotos») y T13-4 (galería),
// así que los seis casos se ejecutan.
//
// Archivos de prueba (decidido en la #138): solo se versionan las dos imágenes reales de E2E-1
// (`fixtures/balones1.jpg` y `fixtures/balones2.png`, < 20 kB), que tienen que verse en la ficha.
// Las demás, incluidas las de 5.242.880 y 5.242.881 bytes, se generan en memoria con
// `fixtures/imagenes.js`.
//
// Storage se comprueba sin la clave de servicio: la ruta de cada fila de `anuncio_fotos` está bajo
// `<centro_id>/<anuncio_id>/` y su URL pública devuelve la imagen tal cual (mismos bytes).
// Lo que crea cada caso se retira al acabar, para no alterar los recuentos de otros specs.
import { readFileSync } from 'node:fs';
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { archivo, relleno, LIMITE_FOTO, UN_BYTE_DE_MAS, SEIS_MB, MAXIMO_FOTOS } from './fixtures/imagenes.js';

const VALIDO = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'Balones',
  deporte: 'Fútbol',
  unidades: '12',
  estado: 'Buen estado',
};

const VALIDO_API = {
  titulo: VALIDO.titulo,
  descripcion: VALIDO.descripcion,
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  // US-14: `modalidad` es obligatoria desde T14-1; «donacion» no arrastra el campo de precio.
  modalidad: 'donacion',
};

const MENSAJES = {
  tipo: 'Solo se admiten fotos JPG, PNG o WebP.',
  peso: 'Cada foto debe pesar 5 MB como máximo.',
  maximo: `Puedes añadir ${MAXIMO_FOTOS} fotos como máximo.`,
  faltan: 'Añade al menos una foto.',
  principal: 'La foto principal no es válida.',
  datos: 'Faltan los datos del anuncio.',
};

const URL_FICHA = /\/anuncios\/[0-9a-f-]{36}$/;

function imagenReal(nombre, mimeType) {
  return { name: nombre, mimeType, buffer: readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url)) };
}

const BALONES1 = imagenReal('balones1.jpg', 'image/jpeg');
const BALONES2 = imagenReal('balones2.png', 'image/png');

let db;
let centroA;
const creados = [];

// ---------------------------------------------------------------- utilidades

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

// POST /api/anuncios en multipart. Se usa FormData porque el objeto `multipart` de Playwright no admite
// varias partes con el mismo nombre (`fotos`).
function publicarPorApi(request, token, { datos = VALIDO_API, fotos = [], principal } = {}) {
  const formulario = new FormData();
  if (datos !== null) formulario.append('datos', JSON.stringify(datos));
  for (const { name, mimeType, buffer } of fotos) {
    formulario.append('fotos', new Blob([buffer], { type: mimeType }), name);
  }
  if (principal !== undefined) formulario.append('foto_principal', String(principal));
  return request.post('/api/anuncios', { headers: { Authorization: `Bearer ${token}` }, multipart: formulario });
}

function campos(page) {
  return {
    titulo: page.getByLabel('Título'),
    descripcion: page.getByLabel('Descripción'),
    categoria: page.getByLabel('Categoría'),
    deporte: page.getByLabel('Deporte'),
    unidades: page.getByLabel('Unidades disponibles'),
    estado: page.getByLabel('Estado del material'),
    donacion: page.getByRole('radio', { name: 'Donación', exact: true }),
    anadir: page.getByRole('button', { name: '+ Añadir fotos' }),
    publicar: page.getByRole('button', { name: /^Publicar$|^Publicando…$/ }),
  };
}

async function rellenarDatos(page) {
  const c = campos(page);
  await c.titulo.fill(VALIDO.titulo);
  await c.descripcion.fill(VALIDO.descripcion);
  await c.categoria.selectOption({ label: VALIDO.categoria });
  await c.deporte.selectOption({ label: VALIDO.deporte });
  await c.unidades.fill(VALIDO.unidades);
  await c.estado.selectOption({ label: VALIDO.estado });
  // US-14: sin modalidad no se publica. Los casos de precio son de us-14-modalidad-precio.spec.js.
  await c.donacion.check();
}

// «+ Añadir fotos» abre el selector del sistema (CA1); se eligen los archivos como lo haría el usuario.
async function elegirFotos(page, fotos) {
  const selector = page.waitForEvent('filechooser');
  await campos(page).anadir.click();
  await (await selector).setFiles(fotos);
}

function contador(page, n) {
  return page.getByText(`${n}/${MAXIMO_FOTOS} fotos`, { exact: true });
}

function contarPublicaciones(page) {
  const cuenta = { n: 0 };
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/anuncios') cuenta.n += 1;
  });
  return cuenta;
}

async function abrirFormulario(page, cuentas) {
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/anuncios/nuevo');
}

async function contarAnuncios() {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM public.anuncios WHERE centro_id = $1', [centroA]);
  return rows[0].n;
}

async function contarFotos() {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM public.anuncio_fotos f
     JOIN public.anuncios a ON a.id = f.anuncio_id WHERE a.centro_id = $1`,
    [centroA],
  );
  return rows[0].n;
}

async function filasDeFotos(anuncioId) {
  const { rows } = await db.query(
    'SELECT ruta, tipo_mime, bytes, orden, es_principal FROM public.anuncio_fotos WHERE anuncio_id = $1 ORDER BY orden',
    [anuncioId],
  );
  return rows;
}

// ---------------------------------------------------------------- preparación

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  const { rows } = await db.query('SELECT id FROM public.centros WHERE email = $1', [cuentas.centroA]);
  centroA = rows[0].id;
});

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

test.describe('US-13 · Añadir fotos a mi anuncio', () => {
  test('E2E-1 · publicar con dos fotos y cambiar la principal', async ({ page, request, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await rellenarDatos(page);

    // CA1: selector con los tres tipos y selección múltiple.
    const entrada = page.locator('input[type="file"]');
    await expect(entrada).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    await expect(entrada).toHaveAttribute('multiple', '');

    await elegirFotos(page, [BALONES1, BALONES2]);
    await expect(contador(page, 2)).toBeVisible();

    // CA6: la primera añadida es la principal; la estrella de la segunda la cambia.
    await expect(page.getByRole('button', { name: 'Foto 1 (principal)' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Marcar foto 2 como principal' }).click();
    await expect(page.getByRole('button', { name: 'Foto 2 (principal)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Marcar foto 1 como principal' })).toBeVisible();
    await expect(page.locator('li.foto-principal img')).toHaveAttribute('alt', 'balones2.png');

    const peticion = page.waitForRequest((req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/anuncios');
    await campos(page).publicar.click();
    // CA12: la web envía multipart. Que `foto_principal` vale 2 lo demuestra la API más abajo: la principal
    // es la de orden 2 y conserva su orden (CA8).
    expect((await peticion).headers()['content-type']).toMatch(/^multipart\/form-data/);

    await expect(page).toHaveURL(URL_FICHA);
    const id = page.url().split('/').pop();
    creados.push(id);

    // API: dos fotos en orden, solo la 2 es principal (CA17).
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const res = await request.get(`/api/anuncios/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(200);
    const { anuncio } = await res.json();
    const fotos = [...anuncio.fotos].sort((a, b) => a.orden - b.orden);
    expect(fotos.map((f) => [f.orden, f.es_principal])).toEqual([[1, false], [2, true]]);

    // Ficha (CA9, CA10): balones2.png grande con el título como `alt`, y dos miniaturas.
    const grande = page.locator('img.galeria-grande');
    await expect(grande).toHaveAttribute('src', fotos[1].url);
    await expect(grande).toHaveAttribute('alt', VALIDO.titulo);
    await expect.poll(() => grande.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /^Ver foto \d$/ })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Ver foto 2' })).toHaveAttribute('aria-pressed', 'true');

    // CA9: al pulsar la miniatura 1 se ve grande en lugar de la principal.
    await page.getByRole('button', { name: 'Ver foto 1' }).click();
    await expect(grande).toHaveAttribute('src', fotos[0].url);
    await expect(grande).toHaveAttribute('alt', `${VALIDO.titulo} · foto 1`);

    // BD (CA19) y Storage (CA18, CA21, CA22): dos filas bajo <centro_id>/<anuncio_id>/, nombre UUID y
    // la URL pública devuelve los mismos bytes que se subieron.
    const filas = await filasDeFotos(id);
    expect(filas.map((f) => [f.orden, f.es_principal, f.tipo_mime, f.bytes])).toEqual([
      [1, false, 'image/jpeg', BALONES1.buffer.length],
      [2, true, 'image/png', BALONES2.buffer.length],
    ]);
    for (const [indice, fila] of filas.entries()) {
      expect(fila.ruta).toMatch(new RegExp(`^${centroA}/${id}/[0-9a-f-]{36}\\.(jpg|png)$`));
      expect(fila.ruta).not.toContain('balones');
      const descarga = await request.get(fotos[indice].url);
      expect(descarga.status()).toBe(200);
      expect((await descarga.body()).equals([BALONES1, BALONES2][indice].buffer)).toBe(true);
    }
  });

  test('E2E-2 · sin fotos', async ({ page, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await rellenarDatos(page);
    const antes = await contarAnuncios();
    const publicaciones = contarPublicaciones(page);

    await campos(page).publicar.click();

    // CA4: mensaje bajo la sección, sin petición y sin cambios en la BD.
    await expect(page.getByText(MENSAJES.faltan, { exact: true })).toBeVisible();
    await expect(page).toHaveURL('/anuncios/nuevo');
    expect(publicaciones.n).toBe(0);
    expect(await contarAnuncios()).toBe(antes);
  });

  test('E2E-3 · archivos inválidos', async ({ page, cuentas }) => {
    await abrirFormulario(page, cuentas);

    // CA2: un GIF (tipo no admitido), un JPG de 6 MB (pasado de tamaño) y un WebP válido de 100 kB.
    await elegirFotos(page, [
      archivo('logo.gif', 20 * 1024),
      archivo('grande.jpg', SEIS_MB),
      archivo('ok.webp', 100 * 1024),
    ]);

    await expect(page.getByText(`logo.gif: ${MENSAJES.tipo}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`grande.jpg: ${MENSAJES.peso}`, { exact: true })).toBeVisible();
    await expect(contador(page, 1)).toBeVisible();
    await expect(page.locator('li.foto img')).toHaveCount(1);
    await expect(page.locator('li.foto img')).toHaveAttribute('alt', 'ok.webp');
  });

  test('E2E-3 bis · los dos lados exactos del límite de 5 MB (CA5)', async ({ page, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await rellenarDatos(page);

    await elegirFotos(page, [archivo('justo.jpg', LIMITE_FOTO), archivo('pasado.jpg', UN_BYTE_DE_MAS)]);

    await expect(page.getByText(`pasado.jpg: ${MENSAJES.peso}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`justo.jpg: ${MENSAJES.peso}`, { exact: true })).toHaveCount(0);
    await expect(contador(page, 1)).toBeVisible();

    // La de 5.242.880 bytes también la acepta el servidor: se publica con una sola foto.
    await campos(page).publicar.click();
    await expect(page).toHaveURL(URL_FICHA);
    const id = page.url().split('/').pop();
    creados.push(id);
    expect((await filasDeFotos(id)).map((f) => f.bytes)).toEqual([LIMITE_FOTO]);
  });

  test('E2E-4 · límite de 8', async ({ page, cuentas }) => {
    await abrirFormulario(page, cuentas);
    const anadir = campos(page).anadir;

    await elegirFotos(page, relleno(7));
    await expect(contador(page, 7)).toBeVisible();
    await expect(anadir).toBeVisible();

    // CA3: con 3 más entran las primeras hasta 8, sale el aviso y desaparece «+ Añadir fotos».
    await elegirFotos(page, relleno(3, { desde: 8 }));
    await expect(contador(page, MAXIMO_FOTOS)).toBeVisible();
    await expect(page.getByText(MENSAJES.maximo, { exact: true })).toBeVisible();
    await expect(anadir).toHaveCount(0);
    await expect(page.locator('li.foto img').last()).toHaveAttribute('alt', 'foto-8.jpg');

    // CA7: la ✕ quita la foto sin confirmación y vuelve «+ Añadir fotos».
    await page.getByRole('button', { name: 'Quitar foto 1' }).click();
    await expect(contador(page, 7)).toBeVisible();
    await expect(anadir).toBeVisible();
  });

  test('E2E-5 · quitar la principal', async ({ page, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await elegirFotos(page, [archivo('a.jpg', 30 * 1024), archivo('b.jpg', 30 * 1024), archivo('c.jpg', 30 * 1024)]);
    await expect(contador(page, 3)).toBeVisible();
    await expect(page.locator('li.foto-principal img')).toHaveAttribute('alt', 'a.jpg');

    // CA7: al quitar la principal, pasa a serlo la primera de las restantes (la antigua 2).
    await page.getByRole('button', { name: 'Quitar foto 1' }).click();
    await expect(contador(page, 2)).toBeVisible();
    await expect(page.locator('li.foto-principal')).toHaveCount(1);
    await expect(page.locator('li.foto-principal img')).toHaveAttribute('alt', 'b.jpg');
    await expect(page.getByRole('button', { name: 'Foto 1 (principal)' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('E2E-6 · API con archivo falso', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const anuncios = await contarAnuncios();
    const fotos = await contarFotos();

    // CA13: un .txt que se declara como image/jpeg; la validación por cabecera binaria lo rechaza.
    const res = await publicarPorApi(request, token, { fotos: [archivo('trampa.txt', 2 * 1024, 'image/jpeg')] });

    expect(res.status()).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.fotos).toBe(MENSAJES.tipo);
    expect(await contarAnuncios()).toBe(anuncios);
    expect(await contarFotos()).toBe(fotos);
  });

  // ---------------------------------------------------------------- casos de la API

  test('CA5, CA12 y CA17 · API: 8 fotos con la principal en la 3', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const res = await publicarPorApi(request, token, { fotos: relleno(MAXIMO_FOTOS, { bytes: 10 * 1024 }), principal: 3 });
    expect(res.status()).toBe(201);
    const { anuncio } = await res.json();
    creados.push(anuncio.id);
    const fotos = [...anuncio.fotos].sort((a, b) => a.orden - b.orden);
    expect(fotos.map((f) => f.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fotos.filter((f) => f.es_principal).map((f) => f.orden)).toEqual([3]);
  });

});
