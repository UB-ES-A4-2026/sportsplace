// T32-6 · E2E de US-32 (pedir unidades de un anuncio). Casos: docs/especificacion/E06 (US-32).
// A vende (A1, venta de 8,50 € con 12 unidades; A2, donación con 30) y B pide. Cada caso crea sus anuncios
// y al acabar se retiran y se borran sus pedidos.
// Los casos se omiten mientras su pieza no esté en la rama: tabla `pedidos` (T32-1), `POST /api/pedidos`
// (T32-2), «Pedir» y el formulario `/anuncios/:id/pedir` (T32-4) y la pantalla `/pedidos/:id` (T32-5).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, INEXISTENTE, anuncio, autorizacion, boton, campoMensaje, campoUnidades, columnasDe, contarEnvios,
  cuerpoPedido, datosCentro, hayBotonPedir, hayFormularioPedir, hayPostPedidos, hayTablaPedidos, idDeUrl,
  insertarAnuncio, insertarPedido, pedidosDe, postPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';

const NO_DISPONIBLE_PEDIDOS = 'Este anuncio no está disponible para pedidos.';
const YA_PENDIENTE = 'Ya tienes un pedido pendiente en este anuncio.';
const ENVIADO = 'Pedido enviado. El vendedor lo revisará.';

let db;
let centros;
let columnas = new Set();
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    tercero: await datosCentro(db, cuentas.sinConfirmar),
  };
  if (await hayTablaPedidos(db)) columnas = await columnasDe(db, 'pedidos');
});

test.afterAll(async () => {
  if (!db) return;
  await retirarAnuncios(db, creados);
  await db.close();
});

async function nuevoAnuncio(cambios = {}) {
  const id = await insertarAnuncio(db, { centro_id: centros.a.id, ...cambios });
  creados.push(id);
  return id;
}

// Comprueba que la API de pedidos está en la rama y devuelve el token de B.
async function conApi(request, cuentas) {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayPostPedidos(request, token)), 'POST /api/pedidos (T32-2) aún no está en esta rama.');
  return token;
}

async function alFormulario(page, cuentas, anuncioId) {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFormularioPedir(page, anuncioId)), 'El formulario /anuncios/:id/pedir (T32-4) aún no está en esta rama.');
}

// La forma de pago (US-35) y la entrega (US-40) se piden en el mismo formulario: si ya están, se rellenan.
async function completarPagoYEntrega(page, { venta = true } = {}) {
  const transferencia = page.getByRole('radio', { name: 'Transferencia bancaria' });
  if (venta && await transferencia.count()) await transferencia.check();
  const recogida = page.getByRole('radio', { name: /^(Paso a recogerlo|Recogida|Lo recojo)/ });
  if (await recogida.count()) await recogida.first().check();
}

// ---------------------------------------------------------------- flujos e2e

test('US-32 · E2E-1 · venta, camino feliz', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBotonPedir(page, a1)), '«Pedir» en el detalle del anuncio (T32-4) aún no está en esta rama.');

  await boton(page, 'Pedir').click();
  await expect(page).toHaveURL(`/anuncios/${a1}/pedir`);
  const main = page.getByRole('main');
  // Tarjeta resumen.
  await expect(main.getByText(A1.titulo)).toBeVisible();
  await expect(main.getByText(centros.a.nombre)).toBeVisible();
  await expect(main.getByText('Venta · 8,50 € por unidad')).toBeVisible();
  await expect(main.getByText('Disponibles: 12')).toBeVisible();
  await expect(campoUnidades(page)).toHaveValue('1');

  await campoUnidades(page).fill('4');
  await campoMensaje(page).fill('Los necesitamos para el torneo de junio.');
  await completarPagoYEntrega(page);
  await expect(main.getByText('Total: 34,00 €')).toBeVisible();
  await expect(main.getByText('El pago y la entrega se acuerdan entre los dos centros. Sportsplace no cobra ni gestiona el dinero.')).toBeVisible();
  await boton(page, 'Enviar pedido').click();

  // CA14: detalle del pedido con el aviso verde.
  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
  await expect(page.getByText(ENVIADO)).toBeVisible();
  await expect(main.getByText('Pendiente', { exact: true }).first()).toBeVisible();

  const [pedido] = await pedidosDe(db, a1);
  expect(pedido).toMatchObject({
    id: idDeUrl(page), comprador_centro_id: centros.b.id, vendedor_centro_id: centros.a.id, unidades: 4,
    modalidad: 'venta', precio_unitario_centimos: 850, total_centimos: 3400, estado: 'pendiente',
    titulo_anuncio: A1.titulo, mensaje: 'Los necesitamos para el torneo de junio.',
  });
  // CA12: pedir no reserva.
  expect(await anuncio(db, a1)).toEqual({ estado: 'activo', unidades_disponibles: 12 });
});

test('US-32 · E2E-2 · donación', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a2 = await nuevoAnuncio(A2);
  await alFormulario(page, cuentas, a2);

  const main = page.getByRole('main');
  await expect(main.getByText('Donación', { exact: true })).toBeVisible();
  await campoUnidades(page).fill('10');
  await completarPagoYEntrega(page, { venta: false });
  await expect(main.getByText('Donación: sin coste')).toBeVisible();
  // El aviso del dinero solo sale en venta.
  await expect(main.getByText(/Sportsplace no cobra ni gestiona el dinero/)).toHaveCount(0);
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText(ENVIADO)).toBeVisible();

  const [pedido] = await pedidosDe(db, a2);
  expect(pedido).toMatchObject({
    unidades: 10, modalidad: 'donacion', precio_unitario_centimos: null, total_centimos: 0, mensaje: null,
  });
});

test('US-32 · E2E-3 · validación en la web', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  await completarPagoYEntrega(page);
  const envios = contarEnvios(page);
  const enviar = boton(page, 'Enviar pedido');
  const unidades = campoUnidades(page);

  // CA7: 0, 13, 2,5 y vacío se rechazan con el máximo real; CA10: el botón sigue habilitado y no envía.
  for (const valor of ['13', '0', '2.5', '']) {
    await unidades.fill(valor);
    await expect(enviar).toBeEnabled();
    await enviar.click();
    await expect(page.getByText('Indica entre 1 y 12 unidades.')).toBeVisible();
  }
  // CA8: 501 caracteres tras quitar espacios.
  await unidades.fill('4');
  await campoMensaje(page).fill(`  ${'m'.repeat(501)}  `);
  await enviar.click();
  await expect(page.getByText('El mensaje no puede superar 500 caracteres.')).toBeVisible();
  expect(envios).toHaveLength(0);
  expect(await pedidosDe(db, a1)).toHaveLength(0);
});

test('US-32 · E2E-4 · las unidades cambian con el formulario abierto', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  await completarPagoYEntrega(page);
  await campoUnidades(page).fill('4');

  // A edita A1 a 3 unidades mientras B tiene el formulario abierto.
  await db.query('UPDATE public.anuncios SET unidades_disponibles = 3 WHERE id = $1', [a1]);
  const respuesta = page.waitForResponse((res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/pedidos');
  await boton(page, 'Enviar pedido').click();
  expect((await respuesta).status()).toBe(409);

  // CA19: el mensaje sale bajo «Unidades» y el máximo pasa a 3.
  await expect(page.getByText('Solo quedan 3 unidades disponibles.')).toBeVisible();
  await expect(page).toHaveURL(`/anuncios/${a1}/pedir`);
  await campoUnidades(page).fill('4');
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText('Indica entre 1 y 3 unidades.')).toBeVisible();
  expect(await pedidosDe(db, a1)).toHaveLength(0);
});

test('US-32 · E2E-5 · pedido duplicado y anuncio propio', async ({ page, request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const res = await postPedido(request, token, cuerpoPedido(a1, { columnas }));
  expect(res.status()).toBe(201);
  const { pedido } = await res.json();

  // CA3: B vuelve a A1 y ve su pedido pendiente en lugar de «Pedir».
  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/anuncios/${a1}`);
  const aviso = page.getByText(YA_PENDIENTE);
  test.skip(!(await aviso.waitFor({ timeout: 5_000 }).then(() => true, () => false)), 'Los estados de «Pedir» (T32-4) aún no están en esta rama.');
  await expect(boton(page, 'Pedir')).toHaveCount(0);
  await boton(page, 'Ver mi pedido').click();
  await expect(page).toHaveURL(`/pedidos/${pedido.id}`);

  // CA2 y CA21: A no ve «Pedir» en su anuncio y la API se lo impide.
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/anuncios/${a1}`);
  await expect(page.getByRole('heading', { level: 1, name: A1.titulo })).toBeVisible();
  await expect(boton(page, 'Pedir')).toHaveCount(0);
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const propio = await postPedido(request, tokenA, cuerpoPedido(a1, { columnas }));
  expect(propio.status()).toBe(403);
  expect((await propio.json()).error).toMatchObject({ code: 'PEDIDO_PROPIO', message: 'No puedes pedir tu propio anuncio.' });
});

// ---------------------------------------------------------------- navegación

test('US-32 · CA1, CA2 y CA4 · «Pedir» solo en anuncios activos de otro centro', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const activo = await nuevoAnuncio();
  const reservado = await nuevoAnuncio({ estado: 'reservado' });
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBotonPedir(page, activo)), '«Pedir» en el detalle del anuncio (T32-4) aún no está en esta rama.');

  await boton(page, 'Pedir').click();
  await expect(page).toHaveURL(`/anuncios/${activo}/pedir`);

  // CA2: reservado → deshabilitado con «No disponible».
  await page.goto(`/anuncios/${reservado}`);
  await expect(page.getByRole('button', { name: /Pedir|No disponible/ })).toBeDisabled();
  await expect(page.getByText('No disponible', { exact: true })).toBeVisible();
});

test('US-32 · CA4 · sin sesión, /pedir lleva a entrar y vuelve', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFormularioPedir(page, a1)), 'El formulario /anuncios/:id/pedir (T32-4) aún no está en esta rama.');
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  await page.goto(`/anuncios/${a1}/pedir`);
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel('Email', { exact: false }).fill(cuentas.centroB);
  await page.getByLabel('Contraseña', { exact: false }).fill(cuentas.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(`/anuncios/${a1}/pedir`);
  await expect(page.getByRole('heading', { level: 1, name: 'Hacer un pedido' })).toBeVisible();
});

test('US-32 · CA5 · anuncio propio, no activo o inexistente', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const activo = await nuevoAnuncio();
  const pausado = await nuevoAnuncio({ estado: 'pausado' });
  await alFormulario(page, cuentas, activo);

  for (const id of [pausado, INEXISTENTE]) {
    await page.goto(`/anuncios/${id}/pedir`);
    await expect(page.getByText(NO_DISPONIBLE_PEDIDOS)).toBeVisible();
    await boton(page, 'Volver al catálogo').click();
    await expect(page).toHaveURL('/catalogo');
  }
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/anuncios/${activo}/pedir`);
  await expect(page.getByText(NO_DISPONIBLE_PEDIDOS)).toBeVisible();
});

test('US-32 · CA6 · «Cancelar» y el diálogo de salir sin enviar', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);

  // Sin cambios: vuelve directamente.
  await boton(page, 'Cancelar').click();
  await expect(page).toHaveURL(`/anuncios/${a1}`);

  // Con cambios: pregunta primero.
  await page.goto(`/anuncios/${a1}/pedir`);
  await campoUnidades(page).fill('3');
  await boton(page, 'Cancelar').click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText('¿Salir sin enviar el pedido?')).toBeVisible();
  await expect(dialogo.getByText('Se perderán los datos.')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Seguir aquí' }).click();
  await expect(page).toHaveURL(`/anuncios/${a1}/pedir`);
  await expect(campoUnidades(page)).toHaveValue('3');
  await boton(page, 'Cancelar').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(`/anuncios/${a1}`);
  expect(await pedidosDe(db, a1)).toHaveLength(0);
});

// ---------------------------------------------------------------- campos

test('US-32 · CA7 a CA9 · límites de unidades, contador y total', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  const main = page.getByRole('main');
  const menos = page.getByRole('button', { name: /^(−|-|Quitar una unidad|Menos)$/ });
  const mas = page.getByRole('button', { name: /^(\+|Añadir una unidad|Más)$/ });

  // CA7: − deshabilitado en 1 y + en el máximo. CA9: el total sigue a las unidades.
  await expect(menos).toBeDisabled();
  await expect(main.getByText('Total: 8,50 €')).toBeVisible();
  await mas.click();
  await expect(campoUnidades(page)).toHaveValue('2');
  await expect(main.getByText('Total: 17,00 €')).toBeVisible();
  await campoUnidades(page).fill('12');
  await expect(mas).toBeDisabled();
  await expect(main.getByText('Total: 102,00 €')).toBeVisible();
  await campoUnidades(page).fill('4');
  await expect(main.getByText('Total: 34,00 €')).toBeVisible();

  // CA8: el contador sigue al texto y 500 caracteres se aceptan.
  await expect(main.getByText('0/500')).toBeVisible();
  await campoMensaje(page).fill('Hola');
  await expect(main.getByText('4/500')).toBeVisible();
  await campoMensaje(page).fill('m'.repeat(500));
  await expect(main.getByText('500/500')).toBeVisible();
  await completarPagoYEntrega(page);
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText(ENVIADO)).toBeVisible();
  expect((await pedidosDe(db, a1))[0].mensaje).toHaveLength(500);
});

test('US-32 · CA10 y CA27 · doble clic solo crea un pedido', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  await completarPagoYEntrega(page);
  // Frena la respuesta para ver «Enviando…».
  await page.route('**/api/pedidos', async (ruta) => {
    await new Promise((resolver) => { setTimeout(resolver, 800); });
    await ruta.continue();
  });
  await boton(page, 'Enviar pedido').dblclick();
  await expect(page.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  await expect(page.getByText(ENVIADO)).toBeVisible();
  expect(await pedidosDe(db, a1)).toHaveLength(1);
});

// ---------------------------------------------------------------- API

test('US-32 · CA11, CA12, CA16, CA25 y CA26 · POST /api/pedidos crea el pedido con los datos del servidor', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const res = await postPedido(request, token, cuerpoPedido(a1, {
    columnas, mensaje: '   ',
    // CA26: se ignoran.
    comprador_centro_id: centros.a.id, estado: 'aceptado', precio_unitario_centimos: 1, total_centimos: 1,
  }));
  expect(res.status()).toBe(201);
  const { pedido } = await res.json();
  expect(pedido).toMatchObject({
    anuncio: { id: a1, titulo: A1.titulo }, comprador: { id: centros.b.id }, vendedor: { id: centros.a.id },
    mi_papel: 'comprador', unidades: 4, modalidad: 'venta', precio_unitario_centimos: 850, total_centimos: 3400,
    mensaje: null, estado: 'pendiente',
  });
  const [fila] = await pedidosDe(db, a1);
  expect(fila).toMatchObject({ comprador_centro_id: centros.b.id, estado: 'pendiente', total_centimos: 3400, mensaje: null });
  expect(await anuncio(db, a1)).toEqual({ estado: 'activo', unidades_disponibles: 12 });

  // CA11: el título copiado no cambia si después se edita el anuncio.
  await db.query("UPDATE public.anuncios SET titulo = 'Balones editados', precio_unitario_centimos = 900 WHERE id = $1", [a1]);
  expect((await pedidosDe(db, a1))[0]).toMatchObject({ titulo_anuncio: A1.titulo, precio_unitario_centimos: 850 });
});

test('US-32 · CA15 · se cobra el precio que hay en la BD al enviar', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await db.query('UPDATE public.anuncios SET precio_unitario_centimos = 1000 WHERE id = $1', [a1]);
  const res = await postPedido(request, token, cuerpoPedido(a1, { columnas }));
  expect(res.status()).toBe(201);
  expect((await res.json()).pedido).toMatchObject({ precio_unitario_centimos: 1000, total_centimos: 4000 });
});

test('US-32 · CA16 · sesión y email confirmado', async ({ request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const sinToken = await postPedido(request, null, cuerpoPedido(a1, { columnas }));
  expect(sinToken.status()).toBe(401);
  expect((await sinToken.json()).error.code).toBe('NO_AUTENTICADO');
  const login = await request.post('/api/auth/login', { data: { email: cuentas.sinConfirmar, password: cuentas.password } });
  const tokenSinConfirmar = login.ok() ? (await login.json()).sesion?.access_token : null;
  test.skip(!tokenSinConfirmar, 'El centro sin confirmar no obtiene token en este entorno.');
  const sinConfirmar = await postPedido(request, tokenSinConfirmar, cuerpoPedido(a1, { columnas }));
  expect(sinConfirmar.status()).toBe(403);
  expect((await sinConfirmar.json()).error.code).toBe('EMAIL_NO_CONFIRMADO');
});

test('US-32 · CA17 · 400 DATOS_INVALIDOS por campo', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const casos = [
    [{ anuncio_id: undefined }, 'anuncio_id', 'Anuncio no válido.'],
    [{ anuncio_id: 'no-es-uuid' }, 'anuncio_id', 'Anuncio no válido.'],
    [{ unidades: 0 }, 'unidades', 'Indica al menos 1 unidad.'],
    [{ unidades: 2.5 }, 'unidades', 'Indica al menos 1 unidad.'],
    [{ unidades: '4' }, 'unidades', 'Indica al menos 1 unidad.'],
    [{ mensaje: 'm'.repeat(501) }, 'mensaje', 'El mensaje no puede superar 500 caracteres.'],
  ];
  for (const [cambios, campo, mensaje] of casos) {
    const cuerpo = cuerpoPedido(a1, { columnas, ...cambios });
    const res = await postPedido(request, token, cuerpo);
    expect(res.status(), JSON.stringify(cambios).slice(0, 60)).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details[campo]).toBe(mensaje);
  }
  expect(await pedidosDe(db, a1)).toHaveLength(0);
});

test('US-32 · CA18 a CA21 · errores según el anuncio', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const retirado = await nuevoAnuncio({ estado: 'retirado', retirado_en: new Date().toISOString() });
  for (const id of [INEXISTENTE, retirado]) {
    const res = await postPedido(request, token, cuerpoPedido(id, { columnas }));
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
  }

  const a1 = await nuevoAnuncio();
  const insuficientes = await postPedido(request, token, cuerpoPedido(a1, { columnas, unidades: 13 }));
  expect(insuficientes.status()).toBe(409);
  expect((await insuficientes.json()).error).toMatchObject({
    code: 'UNIDADES_INSUFICIENTES', message: 'Solo quedan 12 unidades disponibles.', details: { unidades_disponibles: 12 },
  });
  // 12 de 12 se acepta.
  expect((await postPedido(request, token, cuerpoPedido(a1, { columnas, unidades: 12 }))).status()).toBe(201);

  for (const estado of ['pausado', 'reservado', 'entregado']) {
    const id = await nuevoAnuncio({ estado, entregado_en: estado === 'entregado' ? new Date().toISOString() : null });
    const res = await postPedido(request, token, cuerpoPedido(id, { columnas }));
    expect(res.status(), estado).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: 'ANUNCIO_NO_DISPONIBLE', message: 'Este anuncio ya no está disponible.' });
  }

  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  const propio = await postPedido(request, tokenA, cuerpoPedido(a1, { columnas }));
  expect(propio.status()).toBe(403);
  expect((await propio.json()).error).toMatchObject({ code: 'PEDIDO_PROPIO', message: 'No puedes pedir tu propio anuncio.' });
});

test('US-32 · CA13, CA22 y CA28 · pendientes a la vez, duplicado y volver a pedir', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  // CA13: otro centro ya tiene 12 pendientes; B puede pedir otras 12.
  await insertarPedido(db, { anuncioId: a1, compradorId: centros.tercero.id, vendedorId: centros.a.id, unidades: 12 });
  const primero = await postPedido(request, token, cuerpoPedido(a1, { columnas, unidades: 12 }));
  expect(primero.status()).toBe(201);
  const { pedido } = await primero.json();

  // CA22: el segundo pendiente de B se rechaza con el id del primero.
  const duplicado = await postPedido(request, token, cuerpoPedido(a1, { columnas }));
  expect(duplicado.status()).toBe(409);
  expect((await duplicado.json()).error).toMatchObject({
    code: 'PEDIDO_YA_PENDIENTE', message: YA_PENDIENTE, details: { pedido_id: pedido.id },
  });

  // CA28: rechazado o cancelado no impide pedir otra vez.
  for (const estado of ['rechazado', 'cancelado']) {
    await db.query("UPDATE public.pedidos SET estado = $2 WHERE anuncio_id = $1 AND comprador_centro_id = $3 AND estado = 'pendiente'", [a1, estado, centros.b.id]);
    expect((await postPedido(request, token, cuerpoPedido(a1, { columnas }))).status(), estado).toBe(201);
  }
});

test('US-32 · CA23 · el detalle del anuncio trae mi_pedido_pendiente_id', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const detalle = async () => {
    for (const ruta of [`/api/catalogo/${a1}`, `/api/anuncios/${a1}`]) {
      const res = await request.get(ruta, { headers: autorizacion(token) });
      if (!res.ok()) continue;
      const cuerpo = await res.json();
      const datos = cuerpo.anuncio ?? cuerpo;
      if ('mi_pedido_pendiente_id' in datos) return datos;
    }
    return null;
  };
  test.skip(!(await detalle()), 'mi_pedido_pendiente_id (T32-2) aún no está en el detalle del anuncio.');
  expect((await detalle()).mi_pedido_pendiente_id).toBeNull();
  const { pedido } = await (await postPedido(request, token, cuerpoPedido(a1, { columnas }))).json();
  expect((await detalle()).mi_pedido_pendiente_id).toBe(pedido.id);
});

test('US-32 · CA24 · checks e índice único de la tabla pedidos', async () => {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  const a1 = await nuevoAnuncio();
  const base = { anuncioId: a1, compradorId: centros.b.id, vendedorId: centros.a.id };
  const falla = (cambios) => expect(insertarPedido(db, { ...base, ...cambios })).rejects.toThrow();

  await falla({ unidades: 0 });
  await falla({ compradorId: centros.a.id });
  await falla({ estado: 'en_camino' });
  await insertarPedido(db, base);
  // Índice único parcial: un solo pendiente por anuncio y comprador…
  await falla({});
  // …pero no cuenta para los que ya no están pendientes.
  await insertarPedido(db, { ...base, estado: 'cancelado' });
  expect((await pedidosDe(db, a1)).map((p) => p.estado).sort()).toEqual(['cancelado', 'pendiente']);
});
