// T32-6 · E2E de US-108 (ver el detalle y el estado de un pedido). Casos: docs/especificacion/E06 (US-108).
// Los pedidos se insertan en la BD en el estado que toca: B compra a A y el centro sin confirmar hace de
// tercero en el pedido ajeno. Los casos se omiten mientras no estén en la rama la tabla `pedidos` (T32-1),
// `GET /api/pedidos/:id` (T32-3) o la pantalla `/pedidos/:id` (T32-5).
// Las acciones de cada papel son las que ya tienen ruta en el S2 (aceptar y rechazar, US-33/US-79);
// «Cancelar pedido» (US-39) y «Marcar como pagado» (US-80) llegan en otro sprint.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, INEXISTENTE, boton, datosCentro, getPedido, hayGetPedido, hayPantallaPedido, hayTablaPedidos,
  insertarAnuncio, insertarPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';

const SIN_ACCESO = 'Este pedido no existe o no tienes acceso.';

let db;
let centros;
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    tercero: await datosCentro(db, cuentas.sinConfirmar),
  };
});

test.afterAll(async () => {
  if (!db) return;
  await retirarAnuncios(db, creados);
  await db.close();
});

async function nuevoPedido(cambios = {}, { anuncio = A1, estadoAnuncio = 'activo' } = {}) {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  const anuncioId = await insertarAnuncio(db, {
    centro_id: centros.a.id, ...anuncio, estado: estadoAnuncio,
    retirado_en: estadoAnuncio === 'retirado' ? new Date().toISOString() : null,
  });
  creados.push(anuncioId);
  const id = await insertarPedido(db, {
    anuncioId, compradorId: centros.b.id, vendedorId: centros.a.id, anuncio, ...cambios,
  });
  return { id, anuncioId };
}

async function conApi(request, cuentas) {
  test.skip(!(await hayGetPedido(request)), 'GET /api/pedidos/:id (T32-3) aún no está en esta rama.');
  return {
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
  };
}

async function alPedido(page, cuentas, id, email = cuentas.centroB) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayPantallaPedido(page, id)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
}

// ---------------------------------------------------------------- flujos e2e

test('US-108 · E2E-1 · el comprador ve su pedido pendiente', async ({ page, cuentas }) => {
  const { id } = await nuevoPedido({ mensaje: 'Los necesitamos para el torneo de junio.' });
  await alPedido(page, cuentas, id);
  const main = page.getByRole('main');

  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A1.titulo}` })).toBeVisible();
  await expect(main.getByText('Pendiente', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(`Esperando la respuesta de ${centros.a.nombre}.`)).toBeVisible();
  // CA6: importes y fecha (21/10/2026 08:30 UTC = 10:30 en Madrid).
  await expect(main.getByText('34,00 €')).toBeVisible();
  await expect(main.getByText('8,50 €')).toBeVisible();
  await expect(main.getByText('Los necesitamos para el torneo de junio.')).toBeVisible();
  await expect(main.getByText('Pedido el 21/10/2026 10:30')).toBeVisible();
  // CA7: sin datos de contacto del vendedor mientras está pendiente.
  await expect(main.getByText(centros.a.nombre).first()).toBeVisible();
  await expect(main.getByText(cuentas.centroA)).toHaveCount(0);
  // CA9: el comprador no tiene aceptar ni rechazar.
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
  await expect(boton(page, 'Rechazar')).toHaveCount(0);
});

test('US-108 · E2E-2 · el vendedor ve el mismo pedido', async ({ page, cuentas }) => {
  const { id } = await nuevoPedido();
  await alPedido(page, cuentas, id, cuentas.centroA);
  const main = page.getByRole('main');
  await expect(main.getByText(`${centros.b.nombre} te ha pedido este material. Acepta o rechaza el pedido.`)).toBeVisible();
  await expect(main.getByText('Sin mensaje')).toBeVisible();
  await expect(main.getByText(cuentas.centroB)).toHaveCount(0);
});

test('US-108 · E2E-3 · un tercero no ve el pedido', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas);
  // CA14: pedido entre B y A; el tercero aquí es A en un pedido entre B y el centro sin confirmar.
  const ajeno = await insertarPedido(db, {
    anuncioId: (await nuevoPedido()).anuncioId, compradorId: centros.tercero.id, vendedorId: centros.a.id,
  });
  const res = await getPedido(request, tokens.b, ajeno);
  expect(res.status()).toBe(404);
  expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
  expect(await res.text()).not.toContain('direccion');

  // CA3: en la web, mismo mensaje para inexistente y ajeno.
  await alPedido(page, cuentas, id);
  for (const otro of [ajeno, INEXISTENTE]) {
    await page.goto(`/pedidos/${otro}`);
    await expect(page.getByText(SIN_ACCESO)).toBeVisible();
    await boton(page, 'Ir a pedidos').click();
    await expect(page).toHaveURL(/\/pedidos(\?|$)/);
  }
});

test('US-108 · E2E-4 · sin sesión lleva a entrar y vuelve al pedido', async ({ page, cuentas }) => {
  const { id } = await nuevoPedido();
  await alPedido(page, cuentas, id);
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  await page.goto(`/pedidos/${id}`);
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel('Email', { exact: false }).fill(cuentas.centroB);
  await page.getByLabel('Contraseña', { exact: false }).fill(cuentas.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(`/pedidos/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A1.titulo}` })).toBeVisible();
});

// ---------------------------------------------------------------- pantalla

test('US-108 · CA2 · «Volver a pedidos» según el papel', async ({ page, cuentas }) => {
  const { id } = await nuevoPedido();
  await alPedido(page, cuentas, id);
  await boton(page, '← Volver a pedidos').click();
  await expect(page).toHaveURL('/pedidos?pestana=realizados');

  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/pedidos/${id}`);
  await boton(page, '← Volver a pedidos').click();
  await expect(page).toHaveURL('/pedidos?pestana=recibidos');
});

test('US-108 · CA4 · cargando y reintentar', async ({ page, cuentas }) => {
  const { id } = await nuevoPedido();
  await alPedido(page, cuentas, id);
  let fallar = true;
  await page.route(`**/api/pedidos/${id}`, async (ruta) => {
    await new Promise((resolver) => { setTimeout(resolver, 500); });
    if (fallar) await ruta.fulfill({ status: 500, json: { error: { code: 'ERROR_INTERNO', message: 'x' } } });
    else await ruta.continue();
  });
  await page.reload();
  await expect(page.getByText('Cargando…')).toBeVisible();
  await expect(page.getByText(/No se ha podido cargar\./)).toBeVisible();
  fallar = false;
  await boton(page, 'Reintentar').click();
  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A1.titulo}` })).toBeVisible();
});

test('US-108 · CA5, CA7 y CA8 · frase, contacto y anuncio retirado según el estado', async ({ page, cuentas }) => {
  const casos = [
    [{ estado: 'aceptado', respondido_en: new Date().toISOString() }, 'Pedido aceptado. Acordad la entrega y el pago.', true],
    [{ estado: 'rechazado', respondido_en: new Date().toISOString(), cerrado_por: 'vendedor', motivo_codigo: 'sin_unidades' }, `${centros.a.nombre} ha rechazado el pedido.`, false],
    [{ estado: 'cancelado', cancelado_en: new Date().toISOString(), cerrado_por: 'comprador', motivo_codigo: 'ya_no_necesario' }, `Pedido cancelado por ${centros.b.nombre}.`, false],
    [{ estado: 'recibido' }, 'Material recibido. Pedido cerrado.', true],
  ];
  let primero = true;
  for (const [cambios, frase, conContacto] of casos) {
    const { id } = await nuevoPedido(cambios);
    if (primero) await alPedido(page, cuentas, id);
    primero = false;
    await page.goto(`/pedidos/${id}`);
    const main = page.getByRole('main');
    await expect(main.getByText(frase)).toBeVisible();
    // El email de A solo se ve aceptado o recibido (A no tiene email de contacto distinto en la semilla).
    if (conContacto) await expect(main.getByText(cuentas.centroA)).toBeVisible();
    else await expect(main.getByText(cuentas.centroA)).toHaveCount(0);
  }

  // CA8: anuncio retirado, título sin enlace.
  const { id } = await nuevoPedido({}, { estadoAnuncio: 'retirado' });
  await page.goto(`/pedidos/${id}`);
  const main = page.getByRole('main');
  await expect(main.getByText('(anuncio retirado)')).toBeVisible();
  await expect(main.getByRole('link', { name: A1.titulo })).toHaveCount(0);
});

test('US-108 · CA6 · formato de miles y donación', async ({ page, cuentas }) => {
  const { id } = await nuevoPedido({ unidades: 10, precio_unitario_centimos: 12345, total_centimos: 123450 },
    { anuncio: { ...A1, precio_unitario_centimos: 12345 } });
  await alPedido(page, cuentas, id);
  await expect(page.getByRole('main').getByText('1.234,50 €')).toBeVisible();

  const donacion = await nuevoPedido({ unidades: 10 }, { anuncio: A2 });
  await page.goto(`/pedidos/${donacion.id}`);
  await expect(page.getByRole('main').getByText('Donación: sin coste')).toBeVisible();
});

// ---------------------------------------------------------------- API

test('US-108 · CA10, CA12 y CA13 · GET /api/pedidos/:id para cada papel', async ({ request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido({ mensaje: 'Hola' });
  const tokens = await conApi(request, cuentas);

  const comprador = await getPedido(request, tokens.b, id);
  expect(comprador.status()).toBe(200);
  const { pedido } = await comprador.json();
  expect(pedido).toMatchObject({
    id, anuncio: { id: anuncioId, titulo: A1.titulo, estado: 'activo' },
    comprador: { id: centros.b.id, nombre: centros.b.nombre }, vendedor: { id: centros.a.id, nombre: centros.a.nombre },
    mi_papel: 'comprador', unidades: 4, modalidad: 'venta', precio_unitario_centimos: 850, total_centimos: 3400,
    mensaje: 'Hola', estado: 'pendiente', motivo_codigo: null, pagado_en: null, creado_en: '2026-10-21T08:30:00.000Z',
  });
  expect(pedido.acciones).not.toContain('aceptar');
  expect(pedido.acciones).not.toContain('rechazar');
  // CA12: en pendiente no vienen las claves de contacto.
  for (const centro of [pedido.comprador, pedido.vendedor]) {
    expect(centro).not.toHaveProperty('email');
    expect(centro).not.toHaveProperty('telefono');
  }

  const vendedor = (await (await getPedido(request, tokens.a, id)).json()).pedido;
  expect(vendedor.mi_papel).toBe('vendedor');
  expect(vendedor.acciones).toEqual(expect.arrayContaining(['aceptar', 'rechazar']));

  // Aceptado: contacto visible y sin acciones de vendedor.
  await db.query("UPDATE public.pedidos SET estado = 'aceptado' WHERE id = $1", [id]);
  const aceptado = (await (await getPedido(request, tokens.b, id)).json()).pedido;
  expect(aceptado.vendedor).toHaveProperty('email');
  expect(aceptado.vendedor).toHaveProperty('telefono');
  const aceptadoVendedor = (await (await getPedido(request, tokens.a, id)).json()).pedido;
  expect(aceptadoVendedor.acciones).not.toContain('aceptar');
});

test('US-108 · CA11 · 404, 401 y 403', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  for (const id of ['no-es-uuid', INEXISTENTE]) {
    const res = await getPedido(request, tokens.b, id);
    expect(res.status(), id).toBe(404);
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
  }
  const sinToken = await getPedido(request, null, INEXISTENTE);
  expect(sinToken.status()).toBe(401);
  expect((await sinToken.json()).error.code).toBe('NO_AUTENTICADO');

  const login = await request.post('/api/auth/login', { data: { email: cuentas.sinConfirmar, password: cuentas.password } });
  const tokenSinConfirmar = login.ok() ? (await login.json()).sesion?.access_token : null;
  test.skip(!tokenSinConfirmar, 'El centro sin confirmar no obtiene token en este entorno.');
  const sinConfirmar = await getPedido(request, tokenSinConfirmar, INEXISTENTE);
  expect(sinConfirmar.status()).toBe(403);
  expect((await sinConfirmar.json()).error.code).toBe('EMAIL_NO_CONFIRMADO');
});
