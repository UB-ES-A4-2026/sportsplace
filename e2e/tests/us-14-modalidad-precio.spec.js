// T14-5 · E2E de US-14 (vender con precio o ceder gratis). Casos: docs/especificacion/E03 (US-14).
// Usa la plantilla de T12-7: login real con `entrar` y las cuentas de la semilla de T12-8.
//
// La migración (T14-1), la validación (T14-2) y el formulario (T14-3) ya están en la base, así que
// los casos comprueban el cuerpo que envía la web (petición interceptada) y lo que guarda la API.
// Los textos de la ficha («8,50 € / unidad», «Donación · Gratis») los añade T14-4 (#64).
// Los ayudantes están copiados de us-12-publicar-anuncio.spec.js: importarlos registraría sus tests otra vez.
//
// Desde US-13 publicar exige al menos una foto y POST /api/anuncios es multipart (`datos` + `fotos`):
// `rellenar` añade una foto y `publicar` lee el JSON de la parte `datos` que envía la web.
import { test, expect, entrar } from '../fixtures.js';
import { archivo } from './fixtures/imagenes.js';

const RANGO = 'El precio debe estar entre 0,01 € y 99.999,99 €.';
const FORMATO = 'Escribe el precio con hasta 2 decimales, por ejemplo 12,50.';
const FALTA = 'Indica el precio por unidad.';
const TEXTO_DONACION = 'El material se cederá gratis.';

const VALIDO = {
  titulo: 'Raquetas de pádel',
  descripcion: 'Cuatro raquetas de pádel de carbono, usadas una temporada.',
  categoria: 'Material de entrenamiento',
  deporte: 'Pádel',
  unidades: '4',
  estado: 'Buen estado',
};

const URL_FICHA = /\/anuncios\/[0-9a-f-]{36}$/;

// Una foto JPG pequeña y válida: estos casos no prueban las fotos, solo las necesitan para publicar.
const FOTO = archivo('foto-1.jpg', 50 * 1024);

// ---------------------------------------------------------------- utilidades

// Token de la API para los casos que llaman a la API directamente.
async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

// Los campos se buscan por su etiqueta visible (el «*» va aparte con aria-hidden).
function campos(page) {
  return {
    titulo: page.getByLabel('Título'),
    descripcion: page.getByLabel('Descripción'),
    categoria: page.getByLabel('Categoría'),
    deporte: page.getByLabel('Deporte'),
    unidades: page.getByLabel('Unidades disponibles'),
    estado: page.getByLabel('Estado del material'),
    anadirFotos: page.getByRole('button', { name: '+ Añadir fotos' }),
    modalidad: (etiqueta) => page.getByRole('radio', { name: etiqueta, exact: true }),
    precio: page.getByLabel('Precio por unidad (€)'),
    publicar: page.getByRole('button', { name: /^Publicar$|^Publicando…$/ }),
  };
}

// Añade una foto con «+ Añadir fotos» (US-13), como lo haría el usuario.
async function anadirFoto(page) {
  const selector = page.waitForEvent('filechooser');
  await campos(page).anadirFotos.click();
  await (await selector).setFiles([FOTO]);
  await expect(page.getByText('1/8 fotos', { exact: true })).toBeVisible();
}

// Rellena los campos de US-12, añade una foto y marca la modalidad. Con `precio` (también ''), lo escribe.
async function rellenar(page, modalidad, precio) {
  const c = campos(page);
  await c.titulo.fill(VALIDO.titulo);
  await c.descripcion.fill(VALIDO.descripcion);
  await c.categoria.selectOption({ label: VALIDO.categoria });
  await c.deporte.selectOption({ label: VALIDO.deporte });
  await c.unidades.fill(VALIDO.unidades);
  await c.estado.selectOption({ label: VALIDO.estado });
  await anadirFoto(page);
  await c.modalidad(modalidad).check();
  if (precio !== undefined) await c.precio.fill(precio);
}

const esPublicacion = (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/api/anuncios';

// Cuenta las peticiones POST /api/anuncios que hace el navegador.
function contarPublicaciones(page) {
  const contador = { n: 0 };
  page.on('request', (req) => {
    if (esPublicacion(req)) contador.n += 1;
  });
  return contador;
}

// Chromium no entrega a Playwright el cuerpo de una petición con archivos (`postData()` es null),
// así que la parte `datos` del multipart se guarda en la página justo antes de enviarla.
async function capturarDatos(page) {
  await page.addInitScript(() => {
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (recurso, opciones) => {
      if (opciones?.body instanceof FormData) globalThis.__datosEnviados = opciones.body.get('datos');
      return fetchOriginal(recurso, opciones);
    };
  });
}

// Pulsa «Publicar», espera la ficha y devuelve los datos enviados y el id del anuncio creado.
async function publicar(page) {
  const peticion = page.waitForRequest(esPublicacion);
  await campos(page).publicar.click();
  await peticion;
  const cuerpo = JSON.parse(await page.evaluate(() => globalThis.__datosEnviados));
  await expect(page).toHaveURL(URL_FICHA);
  return { cuerpo, id: page.url().split('/').pop() };
}

async function leerAnuncio(request, token, id) {
  const res = await request.get(`/api/anuncios/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  return (await res.json()).anuncio;
}

async function abrirFormulario(page, cuentas) {
  await capturarDatos(page);
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/anuncios/nuevo');
}

// ---------------------------------------------------------------- flujos e2e

test.describe('US-14 · Modalidad y precio', () => {
  test('E2E-1 · venta «8,50» se guarda como 850 céntimos', async ({ page, request, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await rellenar(page, 'Venta', '8,50');
    const { cuerpo, id } = await publicar(page);
    expect(cuerpo).toMatchObject({ modalidad: 'venta', precio_unitario_centimos: 850 }); // CA3, CA8
    await expect(page.getByText('8,50 € / unidad', { exact: true })).toBeVisible(); // CA6 en la ficha (T14-4, #64)

    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const anuncio = await leerAnuncio(request, token, id);
    expect(anuncio).toMatchObject({ modalidad: 'venta', precio_unitario_centimos: 850 }); // CA11
  });

  test('E2E-2 · donación sin campo de precio ni precio guardado', async ({ page, request, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await rellenar(page, 'Donación');
    await expect(campos(page).precio).toHaveCount(0); // CA2
    await expect(page.getByText(TEXTO_DONACION)).toBeVisible();

    const { cuerpo, id } = await publicar(page);
    expect(cuerpo.modalidad).toBe('donacion');
    expect(cuerpo).not.toHaveProperty('precio_unitario_centimos');
    await expect(page.getByText('Donación · Gratis', { exact: true })).toBeVisible(); // CA7 en la ficha (T14-4, #64)

    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const anuncio = await leerAnuncio(request, token, id);
    expect(anuncio).toMatchObject({ modalidad: 'donacion', precio_unitario_centimos: null });
  });

  test('E2E-3 · venta sin precio y límites', async ({ page, request, cuentas }) => {
    await abrirFormulario(page, cuentas);
    const c = campos(page);
    const publicaciones = contarPublicaciones(page);

    await rellenar(page, 'Venta');
    await c.publicar.click();
    await expect(page.getByText(FALTA)).toBeVisible();

    for (const [escrito, mensaje] of [['0,00', RANGO], ['12,345', FORMATO]]) {
      await c.precio.fill(escrito);
      await c.publicar.click();
      await expect(page.getByText(mensaje)).toBeVisible();
    }
    await expect(page).toHaveURL('/anuncios/nuevo');
    expect(publicaciones.n).toBe(0);

    await c.precio.fill('99999,99');
    const { cuerpo, id } = await publicar(page);
    expect(cuerpo.precio_unitario_centimos).toBe(9999999);
    await expect(page.getByText('99.999,99 € / unidad', { exact: true })).toBeVisible(); // CA6 con miles (T14-4, #64)
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    expect((await leerAnuncio(request, token, id)).precio_unitario_centimos).toBe(9999999);
  });

  test('E2E-4 · de «Venta» con error a «Donación»', async ({ page, request, cuentas }) => {
    await abrirFormulario(page, cuentas);
    const c = campos(page);
    await rellenar(page, 'Venta', 'abc');
    await c.publicar.click();
    await expect(page.getByText(FORMATO)).toBeVisible();

    // CA5: el campo y su error desaparecen y no se envía precio.
    await c.modalidad('Donación').check();
    await expect(page.getByText(FORMATO)).toHaveCount(0);
    await expect(c.precio).toHaveCount(0);

    const { cuerpo, id } = await publicar(page);
    expect(cuerpo.modalidad).toBe('donacion');
    expect(cuerpo).not.toHaveProperty('precio_unitario_centimos');
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    const anuncio = await leerAnuncio(request, token, id);
    expect(anuncio).toMatchObject({ modalidad: 'donacion', precio_unitario_centimos: null });
  });

  // ---------------------------------------------------------------- valores límite
  // Cada conversión (8,5 / 8,05 / 0,01 / 99999,99) y cada mensaje de CA4 los cubren
  // frontend/src/validacion/modalidadPrecio.test.js y anuncio.test.js; el formato de la ficha, anuncios/precio.test.js
  // y utilidades/euros.test.js. En la web, E2E-3 recorre los tres mensajes y publica el máximo; aquí, el mínimo en la BD.

  test('CA3 y CA4 · «0,01» se publica como 1 céntimo', async ({ page, cuentas }) => {
    await abrirFormulario(page, cuentas);
    await rellenar(page, 'Venta', '0,01');
    const { cuerpo } = await publicar(page);
    expect(cuerpo.precio_unitario_centimos).toBe(1);
    await expect(page.getByText('0,01 € / unidad', { exact: true })).toBeVisible();
  });
});
