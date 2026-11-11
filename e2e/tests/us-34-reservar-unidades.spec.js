// T33-6 · E2E de US-34 (reservar las unidades de un pedido aceptado), con la concurrencia. Casos:
// docs/especificacion/E06 (US-34). A vende A1; B y el centro sin confirmar (en el papel de «Sabadell»)
// tienen pedidos pendientes insertados en la BD (un pendiente por centro y anuncio). Los casos se omiten
// mientras no estén en la rama la tabla `pedidos` (T32-1), `POST /api/pedidos/:id/aceptar` (T33-2, que usa
// la transacción de T33-3), `GET /api/pedidos/:id` (T32-3) o la pantalla `/pedidos/:id` (T32-5 y T33-5).
// Fuera de este sprint: devolver unidades al cancelar (CA6 y E2E-4, US-39), editar el anuncio (CA10, la
// validación de US-15 ya está en dev) y la recepción (CA12, US-42). El «No disponible» del catálogo (E2E-3)
// lo comprueban los E2E de US-96 (T21-7); aquí se comprueba el estado `reservado` que lo provoca.
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, anuncio, boton, columnasDe, cuerpoPedido, datosCentro, getPedido, hayGetPedido, hayPantallaPedido,
  hayPostPedidos, hayTablaPedidos, insertarAnuncio, insertarPedido, postPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import {
  SIN_STOCK, aceptar, errorDe, hayBotonesVendedor, hayRuta, pedido, pedidosComo,
} from '../pedidos-respuesta.js';

const AUTOMATICO = 'El pedido se ha rechazado automáticamente porque ya no quedan unidades suficientes.';

let db;
let centros;
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    sabadell: await datosCentro(db, cuentas.sinConfirmar),
  };
});

test.afterAll(async () => {
  if (!db) return;
  await retirarAnuncios(db, creados);
  await db.close();
});

// A1 de A con las disponibles indicadas y un pedido pendiente por cada comprador ({ b: 4, sabadell: 4 }).
async function escenario(disponibles, pedidos, { estadoAnuncio = 'activo' } = {}) {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  const anuncioId = await insertarAnuncio(db, { centro_id: centros.a.id, ...A1, unidades_disponibles: disponibles, estado: estadoAnuncio });
  creados.push(anuncioId);
  const ids = {};
  let minuto = 0;
  for (const [quien, unidades] of Object.entries(pedidos)) {
    minuto += 1;
    ids[quien] = await insertarPedido(db, {
      anuncioId, compradorId: centros[quien].id, vendedorId: centros.a.id, unidades,
      creado_en: new Date(Date.UTC(2026, 9, 21, 8, minuto)).toISOString(),
    });
  }
  return { anuncioId, ids };
}

async function conApi(request, cuentas, pedidoCompradorB) {
  const tokens = {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
  test.skip(!(await hayRuta(request, tokens.b, pedidoCompradorB, 'aceptar')), 'POST /api/pedidos/:id/aceptar (T33-2) aún no está en esta rama.');
  return tokens;
}

async function alPedido(page, cuentas, id, email) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayPantallaPedido(page, id)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
}

// ---------------------------------------------------------------- flujos e2e

test('US-34 · E2E-1 · aceptar resta las unidades', async ({ request, cuentas }) => {
  const { anuncioId, ids } = await escenario(12, { b: 4 });
  const tokens = await conApi(request, cuentas, ids.b);
  const res = await aceptar(request, tokens.a, ids.b);
  expect(res.status()).toBe(200);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 8 });
  // CA9: el objeto pedido trae las disponibles del anuncio.
  expect((await res.json()).pedido.anuncio).toMatchObject({ id: anuncioId, unidades_disponibles: 8 });
});

test('US-34 · E2E-2 · las últimas unidades rechazan solos los pendientes que no caben', async ({ page, request, cuentas }) => {
  const { anuncioId, ids } = await escenario(5, { sabadell: 4, b: 4 });
  const tokens = await conApi(request, cuentas, ids.b);
  expect((await aceptar(request, tokens.a, ids.sabadell)).status()).toBe(200);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 1 });

  // CA4: el de B ya no cabe y lo rechaza el sistema.
  const rechazado = await pedido(db, ids.b);
  expect(rechazado).toMatchObject({ estado: 'rechazado', motivo_codigo: 'anuncio_sin_stock', cerrado_por: 'sistema' });
  expect(rechazado.respondido_en).not.toBeNull();
  await errorDe(await aceptar(request, tokens.a, ids.b), 409, 'TRANSICION_NO_PERMITIDA');

  // CA5: el comprador lo ve con el motivo automático.
  await alPedido(page, cuentas, ids.b, cuentas.centroB);
  const main = page.getByRole('main');
  await expect(main.getByText('Rechazado', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(SIN_STOCK)).toBeVisible();
  await expect(main.getByText(AUTOMATICO)).toBeVisible();
});

test('US-34 · E2E-3 · agotar el anuncio lo deja reservado', async ({ request, cuentas }) => {
  const { anuncioId, ids } = await escenario(4, { b: 4 });
  const tokens = await conApi(request, cuentas, ids.b);
  expect((await aceptar(request, tokens.a, ids.b)).status()).toBe(200);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'reservado', unidades_disponibles: 0 });
  // CA11: pedir valida contra las disponibles ya restadas.
  test.skip(!(await hayPostPedidos(request, tokens.b)), 'POST /api/pedidos (T32-2) aún no está en esta rama.');
  const columnas = await columnasDe(db, 'pedidos');
  const res = await postPedido(request, tokens.b, cuerpoPedido(anuncioId, { columnas, unidades: 1 }));
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect((await pedidosComo(db, 'anuncio_id', anuncioId))).toBe(1);
});

test('US-34 · E2E-5 · dos aceptaciones a la vez sobre las últimas unidades', async ({ request, cuentas }) => {
  // Se repite para que la carrera no dependa de la suerte de una sola ejecución.
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const { anuncioId, ids } = await escenario(5, { sabadell: 4, b: 4 });
    const tokens = await conApi(request, cuentas, ids.b);
    const respuestas = await Promise.all([aceptar(request, tokens.a, ids.sabadell), aceptar(request, tokens.a, ids.b)]);
    const estados = respuestas.map((res) => res.status());
    expect(estados.filter((estado) => estado === 200), `vuelta ${vuelta}`).toHaveLength(1);
    const perdedora = respuestas.find((res) => res.status() !== 200);
    expect(perdedora.status()).toBe(409);
    expect(['UNIDADES_INSUFICIENTES', 'TRANSICION_NO_PERMITIDA']).toContain((await perdedora.json()).error.code);

    // CA8: quedan 1 y nunca negativas; un aceptado y el otro rechazado por el sistema.
    expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 1 });
    const filas = [await pedido(db, ids.sabadell), await pedido(db, ids.b)];
    expect(filas.map((fila) => fila.estado).sort()).toEqual(['aceptado', 'rechazado']);
    expect(filas.find((fila) => fila.estado === 'rechazado')).toMatchObject({ motivo_codigo: 'anuncio_sin_stock', cerrado_por: 'sistema' });
  }
});

// ---------------------------------------------------------------- criterios de aceptación

test('US-34 · CA2 · sin unidades suficientes no cambia nada', async ({ request, cuentas }) => {
  const { anuncioId, ids } = await escenario(12, { b: 4 });
  const tokens = await conApi(request, cuentas, ids.b);
  // El vendedor baja las disponibles después de recibir el pedido.
  await db.query('UPDATE public.anuncios SET unidades_disponibles = 3 WHERE id = $1', [anuncioId]);
  const error = await errorDe(await aceptar(request, tokens.a, ids.b), 409, 'UNIDADES_INSUFICIENTES');
  expect(error).toMatchObject({ message: 'Solo quedan 3 unidades disponibles.', details: { unidades_disponibles: 3 } });
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 3 });
  expect((await pedido(db, ids.b)).estado).toBe('pendiente');
});

test('US-34 · CA3 · un anuncio pausado sigue pausado al agotarse', async ({ request, cuentas }) => {
  const { anuncioId, ids } = await escenario(4, { b: 4 }, { estadoAnuncio: 'pausado' });
  const tokens = await conApi(request, cuentas, ids.b);
  expect((await aceptar(request, tokens.a, ids.b)).status()).toBe(200);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'pausado', unidades_disponibles: 0 });
});

test('US-34 · CA4 · los pendientes que caben siguen pendientes', async ({ request, cuentas }) => {
  const { anuncioId, ids } = await escenario(5, { sabadell: 4, b: 1 });
  const tokens = await conApi(request, cuentas, ids.b);
  expect((await aceptar(request, tokens.a, ids.sabadell)).status()).toBe(200);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 1 });
  const cabe = await pedido(db, ids.b);
  expect(cabe.estado).toBe('pendiente');
  expect(cabe.respondido_en).toBeNull();
  // Y se puede aceptar: deja el anuncio reservado.
  expect((await aceptar(request, tokens.a, ids.b)).status()).toBe(200);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'reservado', unidades_disponibles: 0 });
});

test('US-34 · CA7 · la BD no admite disponibles negativas', async ({ request, cuentas }) => {
  const { anuncioId, ids } = await escenario(4, { b: 4 });
  await conApi(request, cuentas, ids.b);
  await expect(db.query('UPDATE public.anuncios SET unidades_disponibles = -1 WHERE id = $1', [anuncioId]))
    .rejects.toMatchObject({ code: '23514' });
});

test('US-34 · CA9 · sin unidades suficientes no se ofrece aceptar', async ({ page, request, cuentas }) => {
  const { anuncioId, ids } = await escenario(12, { b: 4 });
  const tokens = await conApi(request, cuentas, ids.b);
  await db.query('UPDATE public.anuncios SET unidades_disponibles = 3 WHERE id = $1', [anuncioId]);
  test.skip(!(await hayGetPedido(request)), 'GET /api/pedidos/:id (T32-3) aún no está en esta rama.');
  const { pedido: detalle } = await (await getPedido(request, tokens.a, ids.b)).json();
  expect(detalle.anuncio.unidades_disponibles).toBe(3);
  expect(detalle.acciones).not.toContain('aceptar');
  expect(detalle.acciones).toContain('rechazar');

  await alPedido(page, cuentas, ids.b, cuentas.centroA);
  test.skip(!(await hayBotonesVendedor(page)), 'Aceptar y rechazar en /pedidos/:id (T33-5) aún no están en esta rama.');
  await expect(page.getByText('Este pedido pide 4 unidades y solo te quedan 3.')).toBeVisible();
  const botonAceptar = page.getByRole('button', { name: 'Aceptar', exact: true });
  if (await botonAceptar.count()) await expect(botonAceptar).toBeDisabled();
  await expect(boton(page, 'Rechazar')).toBeEnabled();
});
