// T24-3 · E2E y tests de API de US-24 (ver el detalle de un anuncio de otro centro).
// Casos: docs/especificacion/E04-busqueda-y-exploracion.md (US-24, E2E-1 a E2E-5, CA1-CA16).
// A publica y B mira. Cada caso crea sus anuncios copiando una fila de la semilla (como US-16) y, si hacen falta,
// sus fotos directamente en `anuncio_fotos` (no se sube nada a Storage: la galería solo necesita `src` y `alt`).
// Al acabar se borran las fotos creadas y se retiran los anuncios.
// El 403 EMAIL_NO_CONFIRMADO y el 405 los cubren los tests del backend (backend/test/catalogo-api.test.js).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { fixtureAnuncios } from '../../tools/scripts/e2e-fixtures.js';

const PLANTILLA = fixtureAnuncios()[0].id;
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PUBLICADO = '2026-11-08T10:00:00.000Z';

const BALONES = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada.\nSin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  estado_material: 'buen_estado',
  unidades_disponibles: 12,
  modalidad: 'venta',
  precio_unitario_centimos: 1250,
};

const TEXTOS = {
  volver: '← Volver al catálogo',
  reservado: 'No disponible: este material está reservado.',
  noDisponible: 'Este anuncio no existe o ya no está disponible.',
  irAlCatalogo: 'Ir al catálogo',
  proximamente: 'Disponible próximamente',
  cargando: 'Cargando…',
  error: 'No se ha podido cargar.',
};

let db;
let centros;
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = { a: await centro(cuentas.centroA), b: await centro(cuentas.centroB) };
});

test.afterAll(async () => {
  if (!db) return;
  if (creados.length > 0) {
    await db.query('DELETE FROM public.anuncio_fotos WHERE anuncio_id = ANY($1::uuid[])', [creados]);
    await db.query(
      "UPDATE public.anuncios SET estado = 'retirado', retirado_en = now(), entregado_en = NULL WHERE id = ANY($1::uuid[])",
      [creados],
    );
  }
  await db.close();
});

// ---------------------------------------------------------------- utilidades

async function centro(email) {
  const { rows } = await db.query('SELECT id, nombre, localidad FROM public.centros WHERE email = $1', [email]);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

function conToken(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

// Copia la fila plantilla de la semilla con los cambios indicados (por defecto, el anuncio de E2E-1 de A, activo).
async function nuevoAnuncio(cambios = {}) {
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify({
      id: crypto.randomUUID(), centro_id: centros.a.id, ...BALONES, estado: 'activo', publicado_en: PUBLICADO,
      creado_en: PUBLICADO, actualizado_en: PUBLICADO, retirado_en: null, entregado_en: null, ...cambios,
    })],
  );
  creados.push(rows[0].id);
  return rows[0].id;
}

// Fotos con `orden` 1..n; `principal` es el `orden` de la principal. Devuelve las rutas por `orden`.
async function anadirFotos(anuncioId, n, principal = 1) {
  const rutas = {};
  for (let orden = 1; orden <= n; orden += 1) {
    rutas[orden] = `${centros.a.id}/${anuncioId}/e2e-us24-${orden}.jpg`;
    await db.query(
      `INSERT INTO public.anuncio_fotos (anuncio_id, ruta, tipo_mime, bytes, orden, es_principal)
       VALUES ($1, $2, 'image/jpeg', 1000, $3, $4)`,
      [anuncioId, rutas[orden], orden, orden === principal],
    );
  }
  return rutas;
}

async function cambiarEstado(id, estado) {
  await db.query(
    `UPDATE public.anuncios SET estado = $2,
       retirado_en = CASE WHEN $2 = 'retirado' THEN now() ELSE NULL END,
       entregado_en = CASE WHEN $2 = 'entregado' THEN now() ELSE NULL END
     WHERE id = $1`,
    [id, estado],
  );
}

async function esperarNoEncontrado(res) {
  expect(res.status()).toBe(404);
  const { error } = await res.json();
  expect(error.code).toBe('NO_ENCONTRADO');
  expect(error.message).toBe('Anuncio no encontrado.');
}

function fotoGrande(page, n, total, titulo = BALONES.titulo) {
  return page.getByRole('img', { name: `Foto ${n} de ${total}: ${titulo}`, exact: true });
}

function boton(page, nombre) {
  return page.getByRole('button', { name: nombre, exact: true });
}

// CA1 hasta que llegue US-21: todavía no hay tarjeta en /catalogo que pulsar. Se navega dentro de la SPA dejando en el
// estado de la ruta lo mismo que dejará la tarjeta (`state.desde`, ver detalleOtroCentro.js). Cuando US-21 esté en dev,
// QA de US-21 sustituye esta función por el clic en la tarjeta del catálogo.
async function abrirDesdeCatalogo(page, anuncioId, desde) {
  await page.evaluate(({ ruta, desde: origen }) => {
    const idx = (globalThis.history.state?.idx ?? 0) + 1;
    globalThis.history.pushState({ usr: { desde: origen }, key: 'e2e-us24', idx }, '', ruta);
    globalThis.dispatchEvent(new globalThis.PopStateEvent('popstate', { state: globalThis.history.state }));
  }, { ruta: `/anuncios/${anuncioId}`, desde });
}

// ---------------------------------------------------------------- flujos e2e

test('US-24 · E2E-1 · camino feliz: datos, galería en bucle y volver al catálogo', async ({ page, cuentas }) => {
  const id = await nuevoAnuncio();
  // La principal es la 2: tiene que salir la primera y después las demás por `orden` (CA6, CA12).
  const rutas = await anadirFotos(id, 3, 2);

  await entrar(page, cuentas.centroB, cuentas.password);
  const desde = '/catalogo?categoria=balones&pagina=2';
  await abrirDesdeCatalogo(page, id, desde);
  await expect(page).toHaveURL(`/anuncios/${id}`);

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: BALONES.titulo })).toBeVisible();

  // Columna de datos en el orden de la pantalla: título, precio, detalles, botones, «Ofrecido por».
  await expect(main.getByText('12,50 € / unidad', { exact: true })).toBeVisible();
  const detalles = main.getByRole('region', { name: 'Detalles' });
  for (const [dt, dd] of [
    ['Categoría', 'Balones'], ['Deporte', 'Fútbol'], ['Estado del material', 'Buen estado'],
    ['Unidades disponibles', '12 unidades'], ['Publicado el', '08/11/2026'],
  ]) {
    await expect(detalles.locator('div', { has: page.locator('dt', { hasText: dt }) }).locator('dd')).toHaveText(dd);
  }
  const ofrecido = main.getByRole('region', { name: 'Ofrecido por' });
  await expect(ofrecido.getByText(centros.a.nombre, { exact: true })).toBeVisible();
  await expect(ofrecido).toContainText(centros.a.localidad);
  const texto = await main.innerText();
  const posiciones = [BALONES.titulo, '12,50 € / unidad', 'Detalles', 'Pedir material', 'Escribir al centro', 'Ofrecido por', 'Descripción']
    .map((trozo) => texto.indexOf(trozo));
  expect(posiciones.every((p) => p >= 0)).toBe(true);
  expect([...posiciones].sort((x, y) => x - y)).toEqual(posiciones);

  // CA10: hasta US-32 y US-28, los dos botones deshabilitados con «Disponible próximamente».
  await expect(boton(page, 'Pedir material')).toBeDisabled();
  await expect(boton(page, 'Escribir al centro')).toBeDisabled();
  await expect(main.getByText(TEXTOS.proximamente)).toHaveCount(2);

  // CA6 y CA7: principal primero, «›» dos veces → foto 3, «›» otra vez → vuelve a la 1; «‹» desde la 1 → la 3.
  await expect(fotoGrande(page, 1, 3)).toHaveAttribute('src', new RegExp(`${rutas[2]}$`));
  await boton(page, 'Foto siguiente').click();
  await expect(fotoGrande(page, 2, 3)).toHaveAttribute('src', new RegExp(`${rutas[1]}$`));
  await boton(page, 'Foto siguiente').click();
  await expect(fotoGrande(page, 3, 3)).toHaveAttribute('src', new RegExp(`${rutas[3]}$`));
  await boton(page, 'Foto siguiente').click();
  await expect(fotoGrande(page, 1, 3)).toBeVisible();
  await boton(page, 'Foto anterior').click();
  await expect(fotoGrande(page, 3, 3)).toBeVisible();
  // Miniatura y teclado (← →).
  await boton(page, 'Ver foto 2 de 3').click();
  await expect(fotoGrande(page, 2, 3)).toBeVisible();
  await expect(boton(page, 'Ver foto 2 de 3')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(fotoGrande(page, 3, 3)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(fotoGrande(page, 2, 3)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(fotoGrande(page, 1, 3)).toBeVisible();

  // CA8: descripción como texto, con el salto de línea respetado.
  const descripcion = main.getByRole('region', { name: 'Descripción' }).locator('p');
  await expect(descripcion).toHaveText(BALONES.descripcion);
  expect(await descripcion.evaluate((el) => globalThis.getComputedStyle(el).whiteSpace)).toMatch(/^pre(-wrap|-line)?$/);

  // CA1: vuelve a la URL exacta del catálogo de la que se vino.
  await main.getByRole('link', { name: TEXTOS.volver }).click();
  await expect(page).toHaveURL(desde);
});

test('US-24 · E2E-2 · anuncio reservado', async ({ page, request, cuentas }) => {
  const id = await nuevoAnuncio();
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  expect((await request.post(`/api/anuncios/${id}/reservar`, conToken(tokenA))).status()).toBe(200);

  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${id}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: BALONES.titulo })).toBeVisible();
  // CA4: etiqueta antes del título y «Pedir material» deshabilitado.
  await expect(main.getByText(TEXTOS.reservado, { exact: true })).toBeVisible();
  const texto = await main.innerText();
  expect(texto.indexOf(TEXTOS.reservado)).toBeLessThan(texto.indexOf(BALONES.titulo));
  await expect(boton(page, 'Pedir material')).toBeDisabled();
  // «Escribir al centro» seguirá habilitado con US-28; hasta entonces aplica CA10 (deshabilitado y «próximamente»).
  await expect(boton(page, 'Escribir al centro')).toHaveAccessibleDescription(TEXTOS.proximamente);

  // CA12: la API mantiene el estado `reservado` para que la web lo indique.
  const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);
  const res = await request.get(`/api/catalogo/${id}`, conToken(tokenB));
  expect(res.status()).toBe(200);
  expect((await res.json()).estado).toBe('reservado');
});

test('US-24 · E2E-3 · anuncio no disponible e id no válido', async ({ page, request, cuentas }) => {
  const id = await nuevoAnuncio();
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);

  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: BALONES.titulo })).toBeVisible();

  // A lo pausa; B recarga y ve el aviso (CA5) y la API da el 404 genérico (CA13).
  expect((await request.post(`/api/anuncios/${id}/pausar`, conToken(tokenA))).status()).toBe(200);
  await page.reload();
  const main = page.getByRole('main');
  await expect(main.getByText(TEXTOS.noDisponible, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: TEXTOS.irAlCatalogo })).toHaveAttribute('href', '/catalogo');
  await expect(main.getByRole('heading', { name: BALONES.titulo })).toHaveCount(0);
  await esperarNoEncontrado(await request.get(`/api/catalogo/${id}`, conToken(tokenB)));

  // Igual con un id que no es un uuid.
  await page.goto('/anuncios/1234');
  await expect(main.getByText(TEXTOS.noDisponible, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: TEXTOS.irAlCatalogo })).toBeVisible();
  await esperarNoEncontrado(await request.get('/api/catalogo/1234', conToken(tokenB)));
});

test('US-24 · E2E-4 · anuncio propio', async ({ page, request, cuentas }) => {
  const activo = await nuevoAnuncio();
  const pausado = await nuevoAnuncio({ estado: 'pausado' });

  // CA14: la API responde 200 con es_propio para que la web elija la ficha de propietario.
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const res = await request.get(`/api/catalogo/${activo}`, conToken(tokenA));
  expect(res.status()).toBe(200);
  expect((await res.json()).es_propio).toBe(true);

  // CA2: A ve su ficha de propietario de E03, también si su anuncio está pausado (404 en el catálogo).
  await entrar(page, cuentas.centroA, cuentas.password);
  for (const id of [activo, pausado]) {
    await page.goto(`/anuncios/${id}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: BALONES.titulo })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Editar', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: TEXTOS.volver })).toHaveCount(0);
    await expect(boton(page, 'Pedir material')).toHaveCount(0);
  }
});

test('US-24 · E2E-5 · descripción con HTML se ve como texto', async ({ page, cuentas }) => {
  const script = '<script>alert(1)</script>';
  const id = await nuevoAnuncio({ descripcion: `Material revisado y limpio.\n${script}` });
  const dialogos = [];
  page.on('dialog', async (dialogo) => { dialogos.push(dialogo.message()); await dialogo.dismiss(); });

  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${id}`);
  const descripcion = page.getByRole('main').getByRole('region', { name: 'Descripción' });
  await expect(descripcion.getByText(script)).toBeVisible();
  await expect(descripcion.locator('script')).toHaveCount(0);
  expect(dialogos).toEqual([]);
});

// ---------------------------------------------------------------- resto de CA (web)

test('US-24 · CA1 · entrando por el enlace, «Volver al catálogo» lleva a /catalogo', async ({ page, cuentas }) => {
  const id = await nuevoAnuncio();
  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${id}`);
  await expect(page.getByRole('main').getByRole('link', { name: TEXTOS.volver })).toHaveAttribute('href', '/catalogo');
});

test('US-24 · CA6 y CA9 · donación con una foto y una unidad', async ({ page, cuentas }) => {
  const titulo = 'Corcheras de competición 25 m';
  const id = await nuevoAnuncio({ titulo, modalidad: 'donacion', precio_unitario_centimos: null, unidades_disponibles: 1 });
  await anadirFotos(id, 1);

  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${id}`);
  const main = page.getByRole('main');
  await expect(main.getByText('Gratis · Donación', { exact: true })).toBeVisible();
  await expect(main.getByText('1 unidad', { exact: true })).toBeVisible();
  // Con una foto, ni flechas ni miniaturas.
  await expect(fotoGrande(page, 1, 1, titulo)).toBeVisible();
  await expect(boton(page, 'Foto siguiente')).toHaveCount(0);
  await expect(boton(page, 'Foto anterior')).toHaveCount(0);
  await expect(main.getByRole('button', { name: /^Ver foto/ })).toHaveCount(0);
});

test('US-24 · CA11 · «Cargando…», error 503 y «Reintentar»', async ({ page, cuentas }) => {
  const id = await nuevoAnuncio();
  await entrar(page, cuentas.centroB, cuentas.password);

  let liberar;
  const retenida = new Promise((resolve) => { liberar = resolve; });
  // En desarrollo, StrictMode lanza la carga dos veces y cancela la primera: responder a la cancelada no debe romper el caso.
  await page.route(`**/api/catalogo/${id}`, async (route) => {
    await retenida;
    await route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'BASE_DATOS_NO_DISPONIBLE', message: 'No disponible.' } }),
    }).catch(() => {});
  });
  await page.goto(`/anuncios/${id}`);
  const main = page.getByRole('main');
  await expect(main.getByText(TEXTOS.cargando)).toBeVisible();
  liberar();
  await expect(main.getByText(TEXTOS.error)).toBeVisible();

  // Con la API de nuevo disponible, «Reintentar» carga el anuncio.
  await page.unroute(`**/api/catalogo/${id}`);
  await boton(page, 'Reintentar').click();
  await expect(main.getByRole('heading', { level: 1, name: BALONES.titulo })).toBeVisible();
});

// ---------------------------------------------------------------- API (CA12-CA16)

test('US-24 · API · CA12 y CA15 · formato del detalle sin datos privados', async ({ request, cuentas }) => {
  const id = await nuevoAnuncio();
  const rutas = await anadirFotos(id, 3, 3);
  const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);

  const res = await request.get(`/api/catalogo/${id}`, conToken(tokenB));
  expect(res.status()).toBe(200);
  const cuerpo = await res.json();
  expect(Object.keys(cuerpo).sort()).toEqual([
    'categoria', 'centro', 'deporte', 'descripcion', 'distancia_km', 'es_favorito', 'es_propio', 'estado',
    'estado_material', 'fotos', 'id', 'modalidad', 'precio_unitario_centimos', 'publicado_en', 'titulo',
    'unidades_disponibles',
  ]);
  expect(cuerpo).toMatchObject({
    id, ...BALONES, estado: 'activo', publicado_en: PUBLICADO, es_favorito: false, es_propio: false,
  });
  expect(cuerpo.distancia_km === null || typeof cuerpo.distancia_km === 'number').toBe(true);

  // CA15: del centro solo id, nombre y localidad.
  expect(cuerpo.centro).toEqual({ id: centros.a.id, nombre: centros.a.nombre, localidad: centros.a.localidad });

  // CA12: fotos solo con url, orden y es_principal; la principal (orden 3) primero y luego por orden.
  expect(cuerpo.fotos.map((foto) => Object.keys(foto).sort())).toEqual(Array(3).fill(['es_principal', 'orden', 'url']));
  expect(cuerpo.fotos.map(({ orden, es_principal }) => ({ orden, es_principal }))).toEqual([
    { orden: 3, es_principal: true }, { orden: 1, es_principal: false }, { orden: 2, es_principal: false },
  ]);
  expect(cuerpo.fotos[0].url.endsWith(rutas[3])).toBe(true);
});

test('US-24 · API · CA13 · 404 genérico para no visibles', async ({ request, cuentas }) => {
  const tokenB = await tokenDe(request, cuentas.centroB, cuentas.password);
  const casos = [
    await nuevoAnuncio({ estado: 'pausado' }),
    await nuevoAnuncio({ estado: 'entregado', entregado_en: new Date().toISOString() }),
    await nuevoAnuncio({ estado: 'retirado', retirado_en: new Date().toISOString() }),
    await nuevoAnuncio({ unidades_disponibles: 0 }),
    INEXISTENTE,
    'no-es-un-uuid',
  ];
  for (const id of casos) await esperarNoEncontrado(await request.get(`/api/catalogo/${id}`, conToken(tokenB)));

  // Reservado con stock sí es visible (CA4).
  const reservado = await nuevoAnuncio();
  await cambiarEstado(reservado, 'reservado');
  expect((await request.get(`/api/catalogo/${reservado}`, conToken(tokenB))).status()).toBe(200);
});

test('US-24 · API · CA16 · sin sesión responde 401', async ({ request }) => {
  const id = await nuevoAnuncio();
  const res = await request.get(`/api/catalogo/${id}`);
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe('NO_AUTENTICADO');
});
