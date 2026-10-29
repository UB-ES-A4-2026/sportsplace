// T14-5 · E2E de US-14 (vender con precio o ceder gratis). Casos: docs/especificacion/E03 (US-14).
// Usa la plantilla de T12-7: login real con `entrar` y las cuentas de la semilla de T12-8.
//
// La migración (T14-1), la validación (T14-2) y el formulario (T14-3) ya están en la base, así que
// los casos comprueban el cuerpo que envía la web (petición interceptada) y lo que guarda la API.
// Solo quedan en `fixme` los textos de la ficha («8,50 € / unidad», «Donación · Gratis»), que
// dependen de T14-4 (#64): quitar el `fixme` de esos tests cuando #64 esté fusionada.
// Los ayudantes están copiados de us-12-publicar-anuncio.spec.js: importarlos registraría sus tests otra vez.
import { test, expect, entrar } from '../fixtures.js';

// CA3 · conversión a céntimos en la web (sin coma flotante).
const CONVERSION = [
  { escrito: '8,5', centimos: 850 },
  { escrito: '8,05', centimos: 805 },
  { escrito: '0,01', centimos: 1 },
  { escrito: '99999,99', centimos: 9999999 },
];

const RANGO = 'El precio debe estar entre 0,01 € y 99.999,99 €.';
const FORMATO = 'Escribe el precio con hasta 2 decimales, por ejemplo 12,50.';
const FALTA = 'Indica el precio por unidad.';
const DONACION_CON_PRECIO = 'Una donación no puede tener precio.';
const TEXTO_DONACION = 'El material se cederá gratis.';

// CA4 · casos límite de la web. `null` = se acepta y publica.
const LIMITES = [
  { escrito: '0,01', error: null },
  { escrito: '0', error: RANGO },
  { escrito: '0,00', error: RANGO },
  { escrito: '99999,99', error: null },
  { escrito: '100000', error: RANGO },
  { escrito: '12,345', error: FORMATO },
  { escrito: '1.234,50', error: FORMATO },
  { escrito: '12 €', error: FORMATO },
  { escrito: '-5', error: FORMATO },
  { escrito: 'abc', error: FORMATO },
  { escrito: '', error: FALTA },
];

const VALIDO = {
  titulo: 'Raquetas de pádel',
  descripcion: 'Cuatro raquetas de pádel de carbono, usadas una temporada.',
  categoria: 'Material de entrenamiento',
  deporte: 'Pádel',
  unidades: '4',
  estado: 'Buen estado',
};

const VALIDO_API = {
  titulo: VALIDO.titulo,
  descripcion: VALIDO.descripcion,
  categoria: 'material_entrenamiento',
  deporte: 'padel',
  unidades_disponibles: 4,
  estado_material: 'buen_estado',
};

const URL_FICHA = /\/anuncios\/[0-9a-f-]{36}$/;

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
    modalidad: (etiqueta) => page.getByRole('radio', { name: etiqueta, exact: true }),
    precio: page.getByLabel('Precio por unidad (€)'),
    publicar: page.getByRole('button', { name: /^Publicar$|^Publicando…$/ }),
  };
}

// Rellena los campos de US-12 y marca la modalidad. Con `precio` (también ''), lo escribe.
async function rellenar(page, modalidad, precio) {
  const c = campos(page);
  await c.titulo.fill(VALIDO.titulo);
  await c.descripcion.fill(VALIDO.descripcion);
  await c.categoria.selectOption({ label: VALIDO.categoria });
  await c.deporte.selectOption({ label: VALIDO.deporte });
  await c.unidades.fill(VALIDO.unidades);
  await c.estado.selectOption({ label: VALIDO.estado });
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

// Pulsa «Publicar», espera la ficha y devuelve el cuerpo enviado y el id del anuncio creado.
async function publicar(page) {
  const peticion = page.waitForRequest(esPublicacion);
  await campos(page).publicar.click();
  const cuerpo = (await peticion).postDataJSON();
  await expect(page).toHaveURL(URL_FICHA);
  return { cuerpo, id: page.url().split('/').pop() };
}

async function leerAnuncio(request, token, id) {
  const res = await request.get(`/api/anuncios/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  return (await res.json()).anuncio;
}

async function abrirFormulario(page, cuentas) {
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

  test('E2E-5 · API: donación con precio → 400', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    // En esta rama POST /api/anuncios todavía es JSON; con US-13 pasará a multipart.
    const res = await request.post('/api/anuncios', {
      headers: { Authorization: `Bearer ${token}` },
      data: { ...VALIDO_API, modalidad: 'donacion', precio_unitario_centimos: 500 },
    });
    expect(res.status()).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.precio_unitario_centimos).toBe(DONACION_CON_PRECIO); // CA9
  });

  // ---------------------------------------------------------------- tablas de valores

  test.describe('CA3 · conversión a céntimos', () => {
    for (const { escrito, centimos } of CONVERSION) {
      test(`«${escrito}» → ${centimos}`, async ({ page, cuentas }) => {
        await abrirFormulario(page, cuentas);
        await rellenar(page, 'Venta', escrito);
        const { cuerpo } = await publicar(page);
        expect(cuerpo.precio_unitario_centimos).toBe(centimos);
      });
    }
  });

  test.describe('CA4 · casos límite del precio', () => {
    for (const { escrito, error } of LIMITES) {
      const nombre = escrito === '' ? 'vacío' : `«${escrito}»`;
      test(`${nombre} → ${error ?? 'se publica'}`, async ({ page, cuentas }) => {
        await abrirFormulario(page, cuentas);
        await rellenar(page, 'Venta', escrito);
        const publicaciones = contarPublicaciones(page);
        await campos(page).publicar.click();
        if (error) {
          await expect(page.getByText(error)).toBeVisible();
          await expect(page).toHaveURL('/anuncios/nuevo');
          expect(publicaciones.n).toBe(0);
        } else {
          await expect(page).toHaveURL(URL_FICHA);
        }
      });
    }
  });

  // ---------------------------------------------------------------- ficha (T14-4, #64)

  // El precio y «Donación · Gratis» en la ficha los añade T14-4 (#64, Lucía). Quitar el `fixme` cuando se fusione.
  test.describe('Ficha (T14-4, #64)', () => {
    for (const [escrito, texto] of [['8,50', '8,50 € / unidad'], ['99999,99', '99.999,99 € / unidad']]) {
      test.fixme(`venta «${escrito}» → «${texto}» (T14-4, #64)`, async ({ page, cuentas }) => {
        await abrirFormulario(page, cuentas);
        await rellenar(page, 'Venta', escrito);
        await publicar(page);
        await expect(page.getByText(texto, { exact: true })).toBeVisible(); // CA6
      });
    }

    test.fixme('donación → «Donación · Gratis» (T14-4, #64)', async ({ page, cuentas }) => {
      await abrirFormulario(page, cuentas);
      await rellenar(page, 'Donación');
      await publicar(page);
      await expect(page.getByText('Donación · Gratis', { exact: true })).toBeVisible(); // CA7
    });
  });
});
