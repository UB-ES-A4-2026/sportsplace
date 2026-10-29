// T12-5 · E2E de US-12 (publicar un anuncio). Casos: docs/especificacion/E03 (US-12) y casos-US-12.md
// Usa la plantilla de T12-7: login real con `entrar` y las cuentas de la semilla de T12-8.
import { test, expect, entrar } from '../fixtures.js';

const VALIDO = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'Balones',
  deporte: 'Fútbol',
  unidades: '12',
  estado: 'Buen estado',
  // US-14: `modalidad` es obligatoria y NOT NULL desde la migración de T14-1, así que
  // todo caso de US-12 que llegue a publicar tiene que elegirla. Se usa «Donación»
  // porque no arrastra el campo de precio, que es asunto de los E2E de US-14.
  modalidad: 'Donación',
};

const VALIDO_API = {
  titulo: VALIDO.titulo,
  descripcion: VALIDO.descripcion,
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  modalidad: 'donacion',
};

const ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

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
    // US-14 (T14-3): «Modalidad» son dos radios en fila, «Venta» y «Donación».
    modalidad: (etiqueta) => page.getByRole('radio', { name: etiqueta, exact: true }),
    publicar: page.getByRole('button', { name: /^Publicar$|^Publicando…$/ }),
    cancelar: page.getByRole('button', { name: 'Cancelar' }),
  };
}

async function rellenar(page, datos = VALIDO) {
  const c = campos(page);
  await c.titulo.fill(datos.titulo);
  await c.descripcion.fill(datos.descripcion);
  await c.categoria.selectOption({ label: datos.categoria });
  await c.deporte.selectOption({ label: datos.deporte });
  await c.unidades.fill(datos.unidades);
  await c.estado.selectOption({ label: datos.estado });
  await c.modalidad(datos.modalidad).check();
}

// Cuenta las peticiones POST /api/anuncios que hace el navegador.
function contarPublicaciones(page) {
  const contador = { n: 0 };
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/anuncios') contador.n += 1;
  });
  return contador;
}

function hoy() {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date());
}

// ---------------------------------------------------------------- flujos e2e

test('US-12 · E2E-1 · publicar con datos correctos', async ({ page, request, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  const token = await tokenDe(request, cuentas.centroA, cuentas.password);
  
  await page.getByRole('link', { name: 'Publicar anuncio', exact: true }).click();
  await expect(page).toHaveURL('/anuncios/nuevo');
  await expect(page.getByRole('heading', { name: 'Publicar anuncio' })).toBeVisible();

  await rellenar(page);
  await expect(page.getByText('25/80')).toBeVisible();
  await expect(page.getByText('56/1000')).toBeVisible();

  const c = campos(page);
  await c.publicar.click();
  // «Publicando…» puede durar muy poco: si el test es inestable, retrasar la respuesta con page.route.
  await expect(page).toHaveURL(/\/anuncios\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Anuncio publicado.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: VALIDO.titulo })).toBeVisible();
  await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /Unidades disponibles/ })).toContainText('12');
  await expect(page.getByText(`Publicado el ${hoy()}`)).toBeVisible();

  const id = page.url().split('/').pop();

  // CA4: «Atrás» no vuelve al formulario relleno.
  await page.goBack();
  await expect(page).not.toHaveURL('/anuncios/nuevo');

  // Datos guardados (CA13, CA22).
  const res = await request.get(`/api/anuncios/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  const { anuncio } = await res.json();
  expect(anuncio).toMatchObject({ ...VALIDO_API, estado: 'activo' });
  expect(anuncio.publicado_en).toBe(anuncio.creado_en);
  expect(anuncio.actualizado_en).toBe(anuncio.creado_en);
});

test('US-12 · E2E-2 · formulario vacío', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/anuncios/nuevo');
  const publicaciones = contarPublicaciones(page);

  await campos(page).publicar.click();

  for (const mensaje of [
    'El título es obligatorio.',
    'La descripción es obligatoria.',
    'Elige una categoría.',
    'Elige un deporte.',
    'Indica las unidades disponibles.',
    'Elige el estado del material.',
  ]) {
    await expect(page.getByText(mensaje)).toBeVisible();
  }
  await expect(campos(page).titulo).toBeFocused();
  expect(publicaciones.n).toBe(0);
});

test('US-12 · E2E-3 · valores límite y revalidación', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/anuncios/nuevo');
  const c = campos(page);
  const publicaciones = contarPublicaciones(page);

  await rellenar(page, { ...VALIDO, titulo: 'Bola', unidades: '10000' });
  await c.publicar.click();
  const errorTitulo = page.getByText('El título debe tener entre 5 y 80 caracteres.');
  const errorUnidades = page.getByText('Las unidades deben ser un número entero entre 1 y 9999.');
  await expect(errorTitulo).toBeVisible();
  await expect(errorUnidades).toBeVisible();
  expect(publicaciones.n).toBe(0);

  await c.titulo.fill('Bolas');
  await expect(errorTitulo).toBeHidden();
  await c.unidades.fill('9999');
  await expect(errorUnidades).toBeHidden();

  await c.publicar.click();
  await expect(page).toHaveURL(/\/anuncios\/[0-9a-f-]{36}$/);
  await expect(page.getByText('9999')).toBeVisible();
});

for (const variante of ['503', 'red caída']) {
  test(`US-12 · E2E-4 · error de servidor (${variante})`, async ({ page, cuentas }) => {
    await entrar(page, cuentas.centroA, cuentas.password);
    await page.route('**/api/anuncios', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (variante === '503') {
        return route.fulfill({
          status: 503,
          json: { error: { code: 'BASE_DATOS_NO_DISPONIBLE', message: ERROR_GENERICO } },
        });
      }
      return route.abort('failed');
    });

    await page.goto('/anuncios/nuevo');
    await rellenar(page);
    const c = campos(page);
    await c.publicar.click();

    await expect(page.getByText(ERROR_GENERICO)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publicar' })).toBeEnabled();
    await expect(page).toHaveURL('/anuncios/nuevo');
    await expect(c.titulo).toHaveValue(VALIDO.titulo);
    await expect(c.descripcion).toHaveValue(VALIDO.descripcion);
    await expect(c.unidades).toHaveValue(VALIDO.unidades);
  });
}

test('US-12 · E2E-5 · anuncio de otro centro y API directa', async ({ page, request, cuentas }) => {
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const creado = await request.post('/api/anuncios', {
    headers: { Authorization: `Bearer ${tokenA}` },
    data: VALIDO_API,
  });
  expect(creado.status()).toBe(201);
  const { anuncio } = await creado.json();
  expect(creado.headers().location).toBe(`/api/anuncios/${anuncio.id}`);

  // Web con el centro B.
  await entrar(page, cuentas.centroB, cuentas.password);
  const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${anuncio.id}`);
  await expect(page.getByText('Anuncio no encontrado')).toBeVisible();
  await expect(page.getByText('Este anuncio no existe o ya no está disponible.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a mis anuncios' })).toBeVisible();

  // API con el centro B: ajeno, inexistente y no UUID dan el mismo 404.
  const authB = { Authorization: `Bearer ${tokenB}` };
  for (const id of [anuncio.id, '00000000-0000-4000-8000-000000000000', 'abc']) {
    const res = await request.get(`/api/anuncios/${id}`, { headers: authB });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toMatchObject({ code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' });
  }

  // POST con datos incorrectos: todos los errores a la vez.
  const malo = await request.post('/api/anuncios', {
    headers: authB,
    data: { titulo: 'Bal', unidades_disponibles: '3', estado: 'entregado' },
  });
  expect(malo.status()).toBe(400);
  const { error } = await malo.json();
  expect(error.code).toBe('DATOS_INVALIDOS');
  expect(error.message).toBe('Revisa los campos marcados.');
  // `modalidad` entra en la lista desde US-14 (CA1, CA8): al faltar en el cuerpo,
  // la validación de T14-2 la devuelve junto a los demás campos.
  expect(Object.keys(error.details).sort()).toEqual(
    ['categoria', 'descripcion', 'deporte', 'estado_material', 'modalidad', 'titulo', 'unidades_disponibles'].sort(),
  );

  // CA21: estado y centro_id del cuerpo se ignoran.
  const ignorado = await request.post('/api/anuncios', {
    headers: authB,
    data: { ...VALIDO_API, estado: 'entregado', centro_id: anuncio.centro_id },
  });
  expect(ignorado.status()).toBe(201);
  const deB = (await ignorado.json()).anuncio;
  expect(deB.estado).toBe('activo');
  expect(deB.centro_id).not.toBe(anuncio.centro_id);
});

test('US-12 · E2E-6 · cancelar con y sin datos', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  const c = campos(page);
  const publicaciones = contarPublicaciones(page);

  await page.goto('/anuncios/nuevo');
  await c.cancelar.click();
  await expect(page).toHaveURL('/mis-anuncios');

  await page.goto('/anuncios/nuevo');
  await c.titulo.fill('Conos');
  await c.cancelar.click();
  const dialogo = page.getByRole('dialog', { name: '¿Salir sin publicar?' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText('Se perderán los datos que has escrito.')).toBeVisible();

  await dialogo.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(dialogo).toBeHidden();
  await expect(c.titulo).toHaveValue('Conos');

  await c.cancelar.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL('/mis-anuncios');
  expect(publicaciones.n).toBe(0);
});

// ---------------------------------------------------------------- casos límite

test.describe('US-12 · CA26 · longitud del título', () => {
  for (const [nombre, titulo, publica] of [
    ['5 caracteres', 'Balón', true],
    ['80 caracteres', 'B'.repeat(80), true],
    ['4 caracteres', 'Balo', false],
    ['81 caracteres', 'B'.repeat(81), false],
  ]) {
    test(nombre, async ({ page, cuentas }) => {
      await entrar(page, cuentas.centroA, cuentas.password);
      await page.goto('/anuncios/nuevo');
      await rellenar(page, { ...VALIDO, titulo });
      await campos(page).publicar.click();
      if (publica) {
        await expect(page).toHaveURL(/\/anuncios\/[0-9a-f-]{36}$/);
      } else {
        await expect(page.getByText('El título debe tener entre 5 y 80 caracteres.')).toBeVisible();
        await expect(page).toHaveURL('/anuncios/nuevo');
      }
    });
  }

  test('espacios alrededor se recortan', async ({ page, cuentas }) => {
    await entrar(page, cuentas.centroA, cuentas.password);
    await page.goto('/anuncios/nuevo');
    await rellenar(page, { ...VALIDO, titulo: '   Balón   ' });
    await campos(page).publicar.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Balón', exact: true })).toBeVisible();
  });
});

test('US-12 · CA27 · título con salto de línea (API)', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroA, cuentas.password);
  const res = await request.post('/api/anuncios', {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...VALIDO_API, titulo: 'Balones\nde fútbol' },
  });
  expect(res.status()).toBe(400);
  const { error } = await res.json();
  expect(error.code).toBe('DATOS_INVALIDOS');
  expect(error.details.titulo).toBe('El título no puede tener saltos de línea.');
});

test.describe('US-12 · CA28 · unidades', () => {
  for (const [unidades, publica] of [['1', true], ['9999', true], ['0', false], ['10000', false]]) {
    test(`web: ${unidades}`, async ({ page, cuentas }) => {
      await entrar(page, cuentas.centroA, cuentas.password);
      await page.goto('/anuncios/nuevo');
      await rellenar(page, { ...VALIDO, unidades });
      await campos(page).publicar.click();
      if (publica) {
        await expect(page).toHaveURL(/\/anuncios\/[0-9a-f-]{36}$/);
      } else {
        await expect(page.getByText('Las unidades deben ser un número entero entre 1 y 9999.')).toBeVisible();
      }
    });
  }

  // «2,5» y «2.5» se escriben con el teclado: fill() falla en un input type="number" (respuesta de la #48).
  // «2,5» falla en Chromium: el campo descarta la coma, queda 25 y se publica. Fallo abierto y enlazado
  // en la #48; el test se activa (quitar el fixme) cuando se corrija el formulario.
  for (const escrito of ['2,5', '2.5']) {
    const caso = escrito === '2,5' ? test.fixme : test;
    caso(`web: ${escrito} (escrito con el teclado)`, async ({ page, cuentas }) => {
      await entrar(page, cuentas.centroA, cuentas.password);
      await page.goto('/anuncios/nuevo');
      await rellenar(page, { ...VALIDO, unidades: '' });
      const publicaciones = contarPublicaciones(page);
      await campos(page).unidades.click();
      await page.keyboard.type(escrito);
      await campos(page).publicar.click();
      await expect(page.getByText('Las unidades deben ser un número entero entre 1 y 9999.')).toBeVisible();
      await expect(page).toHaveURL('/anuncios/nuevo');
      expect(publicaciones.n).toBe(0);
    });
  }

  test('API: valores no enteros o fuera de rango', async ({ request, cuentas }) => {
    const token = await tokenDe(request, cuentas.centroA, cuentas.password);
    for (const valor of [2.5, '2,5', '3', 0, 10000]) {
      const res = await request.post('/api/anuncios', {
        headers: { Authorization: `Bearer ${token}` },
        data: { ...VALIDO_API, unidades_disponibles: valor },
      });
      expect(res.status(), `unidades_disponibles = ${JSON.stringify(valor)}`).toBe(400);
      expect((await res.json()).error.details).toHaveProperty('unidades_disponibles');
    }
  });
});

test('US-12 · CA29 · descripción solo con espacios', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/anuncios/nuevo');
  await rellenar(page, { ...VALIDO, descripcion: '                         ' });
  await campos(page).publicar.click();
  await expect(page.getByText('La descripción es obligatoria.')).toBeVisible();
});
