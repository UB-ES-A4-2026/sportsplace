// T33-6 · E2E de US-33 (aceptar un pedido que recibo). Casos: docs/especificacion/E06 (US-33).
// Los pedidos se insertan en la BD como pendientes: B pide 4 balones de A1 a A. Para el tercero (404),
// A mira un pedido entre el centro sin confirmar (comprador) y B (vendedor). Los casos se omiten mientras
// no estén en la rama la tabla `pedidos` (T32-1), `POST /api/pedidos/:id/aceptar` (T33-2),
// `GET /api/pedidos/:id` (T32-3), la pantalla `/pedidos/:id` (T32-5) o sus botones (T33-5).
// CA11 simula la cancelación de US-39 (otro sprint) cambiando el estado en la BD.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, INEXISTENTE, anuncio, boton, datosCentro, getPedido, hayGetPedido, hayPantallaPedido,
  hayTablaPedidos, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import {
  SIN_PERMISO, TRANSICION, aceptar, anuncioConPedido, cambiarEstado, contadorPedidos, errorDe, hayContador,
  hayBotonesVendedor, hayRuta, pedido, telefonoDe, tokenSinConfirmar,
} from '../pedidos-respuesta.js';

const DIALOGO = '¿Aceptar el pedido?';

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

async function nuevoPedido(cambios = {}) {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  return anuncioConPedido(db, creados, { vendedor: centros.a, comprador: centros.b, anuncio: A1, ...cambios });
}

async function conApi(request, cuentas, pedidoId) {
  const tokens = {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
  test.skip(!(await hayRuta(request, tokens.b, pedidoId, 'aceptar')), 'POST /api/pedidos/:id/aceptar (T33-2) aún no está en esta rama.');
  return tokens;
}

async function alPedido(page, cuentas, id, email = cuentas.centroA) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayPantallaPedido(page, id)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
}

async function comoVendedor(page, cuentas, id) {
  await alPedido(page, cuentas, id);
  test.skip(!(await hayBotonesVendedor(page)), 'Aceptar y rechazar en /pedidos/:id (T33-5) aún no están en esta rama.');
}

function dialogo(page) {
  return page.getByRole('dialog').filter({ hasText: DIALOGO });
}

// ---------------------------------------------------------------- flujos e2e

test('US-33 · E2E-1 · el vendedor acepta y los dos ven el contacto', async ({ page, request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await comoVendedor(page, cuentas, id);
  const main = page.getByRole('main');

  await boton(page, 'Aceptar').click();
  // CA2 y US-34: textos exactos del diálogo.
  const ventana = dialogo(page);
  await expect(ventana).toBeVisible();
  await expect(ventana.getByText(
    `Te comprometes a entregar 4 unidades de «${A1.titulo}» a ${centros.b.nombre}. Después tendréis que acordar la entrega y el pago.`,
  )).toBeVisible();
  await expect(ventana.getByText('Quedarán 8 unidades disponibles en el anuncio.')).toBeVisible();
  await ventana.getByRole('button', { name: 'Aceptar pedido', exact: true }).click();

  // CA4.
  await expect(page.getByText('Pedido aceptado.', { exact: true })).toBeVisible();
  await expect(main.getByText('Aceptado', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(cuentas.centroB)).toBeVisible();
  const telefonoB = await telefonoDe(db, centros.b.id);
  if (telefonoB) await expect(main.getByText(telefonoB)).toBeVisible();
  await expect(main.getByText(/Aceptado el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeVisible();
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
  await expect(boton(page, 'Rechazar')).toHaveCount(0);

  // CA6 en la BD y US-34 CA1.
  const fila = await pedido(db, id);
  expect(fila.estado).toBe('aceptado');
  expect(fila.respondido_en).not.toBeNull();
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 8 });

  // CA5: el comprador.
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await alPedido(page, cuentas, id, cuentas.centroB);
  await expect(main.getByText('Aceptado', { exact: true }).first()).toBeVisible();
  await expect(main.getByText('Pedido aceptado. Acordad la entrega y el pago.')).toBeVisible();
  await expect(main.getByText(cuentas.centroA)).toBeVisible();
  const telefonoA = await telefonoDe(db, centros.a.id);
  if (telefonoA) await expect(main.getByText(telefonoA)).toBeVisible();
});

test('US-33 · E2E-2 · el comprador no puede aceptar su pedido', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const error = await errorDe(await aceptar(request, tokens.b, id), 403, 'SIN_PERMISO');
  expect(error.message).toBe(SIN_PERMISO);
  expect((await pedido(db, id)).estado).toBe('pendiente');

  await alPedido(page, cuentas, id, cuentas.centroB);
  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A1.titulo}` })).toBeVisible();
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
});

test('US-33 · E2E-3 · aceptar dos veces responde 409', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  expect((await aceptar(request, tokens.a, id)).status()).toBe(200);
  const error = await errorDe(await aceptar(request, tokens.a, id), 409, 'TRANSICION_NO_PERMITIDA');
  expect(error).toMatchObject({ message: TRANSICION, details: { estado_actual: 'aceptado' } });
});

test('US-33 · E2E-4 · un tercero recibe 404', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  // A no es parte de un pedido entre el centro sin confirmar (comprador) y B (vendedor).
  const ajeno = await anuncioConPedido(db, creados, { vendedor: centros.b, comprador: centros.tercero, anuncio: A1 });
  for (const otro of [ajeno.id, INEXISTENTE, 'no-es-un-uuid']) {
    await errorDe(await aceptar(request, tokens.a, otro), 404, 'NO_ENCONTRADO');
  }
  expect((await pedido(db, ajeno.id)).estado).toBe('pendiente');
});

// ---------------------------------------------------------------- criterios de aceptación

test('US-33 · CA1 · «Aceptar» solo con la acción en la lista', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  test.skip(!(await hayGetPedido(request)), 'GET /api/pedidos/:id (T32-3) aún no está en esta rama.');
  expect((await (await getPedido(request, tokens.a, id)).json()).pedido.acciones).toContain('aceptar');
  expect((await (await getPedido(request, tokens.b, id)).json()).pedido.acciones).not.toContain('aceptar');

  await comoVendedor(page, cuentas, id);
  await expect(boton(page, 'Aceptar')).toBeVisible();
  // Ya aceptado: sin acción y sin botón.
  await cambiarEstado(db, id, 'aceptado');
  expect((await (await getPedido(request, tokens.a, id)).json()).pedido.acciones).not.toContain('aceptar');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A1.titulo}` })).toBeVisible();
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
});

test('US-33 · CA2 · «Cancelar» cierra el diálogo sin cambios', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await comoVendedor(page, cuentas, id);
  const envios = [];
  page.on('request', (peticion) => { if (peticion.url().endsWith('/aceptar')) envios.push(peticion); });

  await boton(page, 'Aceptar').click();
  await dialogo(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialogo(page)).toHaveCount(0);
  expect(envios).toHaveLength(0);
  expect((await pedido(db, id)).estado).toBe('pendiente');
  await expect(boton(page, 'Aceptar')).toBeVisible();
});

test('US-33 · CA3 · «Aceptando…» mientras envía', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await comoVendedor(page, cuentas, id);
  let soltar;
  const espera = new Promise((resolver) => { soltar = resolver; });
  await page.route('**/api/pedidos/*/aceptar', async (ruta) => { await espera; await ruta.continue(); });

  await boton(page, 'Aceptar').click();
  await dialogo(page).getByRole('button', { name: 'Aceptar pedido', exact: true }).click();
  const enviando = page.getByRole('button', { name: 'Aceptando…' });
  await expect(enviando).toBeVisible();
  await expect(enviando).toBeDisabled();
  soltar();
  await expect(page.getByText('Pedido aceptado.', { exact: true })).toBeVisible();
});

test('US-33 · CA6 · la API responde el pedido aceptado', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const antes = Date.now();
  const res = await aceptar(request, tokens.a, id);
  expect(res.status()).toBe(200);
  const { pedido: respuesta } = await res.json();
  expect(respuesta).toMatchObject({ id, estado: 'aceptado', mi_papel: 'vendedor' });
  expect(respuesta.acciones).not.toContain('aceptar');
  expect(respuesta.acciones).not.toContain('rechazar');
  expect(Math.abs(new Date(respuesta.respondido_en).getTime() - antes)).toBeLessThan(60_000);
  // US-108 CA7: con el pedido aceptado ya van el email y el teléfono del comprador.
  expect(respuesta.comprador.email).toBe(cuentas.centroB);
  expect(respuesta.comprador).toHaveProperty('telefono');
});

test('US-33 · CA7 · sesión y email confirmado', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await errorDe(await aceptar(request, null, id), 401, 'NO_AUTENTICADO');
  const token = await tokenSinConfirmar(request, cuentas);
  test.skip(!token, 'El centro sin confirmar no obtiene token en este entorno.');
  await errorDe(await aceptar(request, token, id), 403, 'EMAIL_NO_CONFIRMADO');
  expect((await pedido(db, id)).estado).toBe('pendiente');
});

test('US-33 · CA8 · anuncio retirado o entregado; pausado sí', async ({ request, cuentas }) => {
  const { id: primero } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, primero);
  for (const estadoAnuncio of ['retirado', 'entregado']) {
    const { id, anuncioId } = await nuevoPedido({ estadoAnuncio });
    const error = await errorDe(await aceptar(request, tokens.a, id), 409, 'ANUNCIO_NO_DISPONIBLE');
    expect(error.message).toBe('Este anuncio ya no está disponible.');
    expect((await pedido(db, id)).estado).toBe('pendiente');
    expect((await anuncio(db, anuncioId)).unidades_disponibles).toBe(12);
  }
  const { id } = await nuevoPedido({ estadoAnuncio: 'pausado' });
  expect((await aceptar(request, tokens.a, id)).status()).toBe(200);
});

test('US-33 · CA9 · ante 409 la web avisa y recarga el pedido', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await comoVendedor(page, cuentas, id);
  // Se acepta en otra pestaña mientras esta sigue abierta.
  await cambiarEstado(db, id, 'aceptado');
  await boton(page, 'Aceptar').click();
  await dialogo(page).getByRole('button', { name: 'Aceptar pedido', exact: true }).click();
  await expect(page.getByText(TRANSICION)).toBeVisible();
  await expect(page.getByRole('main').getByText('Aceptado', { exact: true }).first()).toBeVisible();
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
});

test('US-33 · CA10 · dos aceptaciones a la vez: una 200 y otra 409', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const respuestas = await Promise.all([aceptar(request, tokens.a, id), aceptar(request, tokens.a, id)]);
  const estados = respuestas.map((res) => res.status()).sort();
  expect(estados).toEqual([200, 409]);
  const perdedora = respuestas.find((res) => res.status() === 409);
  expect((await perdedora.json()).error.code).toBe('TRANSICION_NO_PERMITIDA');
  const ganadora = (await respuestas.find((res) => res.status() === 200).json()).pedido;
  // respondido_en se escribe una sola vez: el de la BD es el de la respuesta correcta.
  expect(new Date((await pedido(db, id)).respondido_en).toISOString()).toBe(ganadora.respondido_en);
});

test('US-33 · CA11 · si el comprador cancela con el diálogo abierto, 409 y «Cancelado»', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await comoVendedor(page, cuentas, id);
  await boton(page, 'Aceptar').click();
  await expect(dialogo(page)).toBeVisible();
  // US-39 llega en otro sprint: la cancelación del comprador se hace en la BD.
  await cambiarEstado(db, id, 'cancelado', { motivo: 'ya_no_necesario', cerradoPor: 'comprador' });
  await dialogo(page).getByRole('button', { name: 'Aceptar pedido', exact: true }).click();
  await expect(page.getByText(TRANSICION)).toBeVisible();
  await expect(page.getByRole('main').getByText('Cancelado', { exact: true }).first()).toBeVisible();
});

test('US-33 · CA12 · el contador de pendientes baja en 1', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  test.skip(!(await hayContador(request, tokens.a)), 'GET /api/pedidos/contador (T33-1) aún no está en esta rama.');
  const antes = (await (await contadorPedidos(request, tokens.a)).json()).recibidos_pendientes;
  expect((await aceptar(request, tokens.a, id)).status()).toBe(200);
  expect((await (await contadorPedidos(request, tokens.a)).json()).recibidos_pendientes).toBe(antes - 1);
});

test('US-33 · CA13 · migración de respondido_en', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  const { rows } = await db.query(
    "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pedidos' AND column_name = 'respondido_en'",
  );
  expect(rows).toEqual([{ data_type: 'timestamp with time zone' }]);
  expect((await pedido(db, id)).respondido_en).toBeNull();
});
