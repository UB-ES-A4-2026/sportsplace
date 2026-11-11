// T33-6 · E2E de US-79 (rechazar un pedido que recibo indicando el motivo). Casos: docs/especificacion/E06
// (US-79). Los pedidos se insertan en la BD como pendientes: B pide 10 petos de A2 (o 4 balones de A1) a A.
// Los casos se omiten mientras no estén en la rama la tabla `pedidos` (T32-1),
// `POST /api/pedidos/:id/rechazar` (T33-2), la pantalla `/pedidos/:id` (T32-5) o sus botones (T33-5).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, INEXISTENTE, anuncio, boton, columnasDe, cuerpoPedido, datosCentro, hayPantallaPedido, hayPostPedidos,
  hayTablaPedidos, postPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import {
  EXPLICA, LARGO, MOTIVOS_RECHAZO, SIN_PERMISO, TRANSICION, aceptar, anuncioConPedido, cambiarEstado,
  contarAcciones, errorDe, hayBotonesVendedor, hayRuta, pedido, rechazar, tokenSinConfirmar,
} from '../pedidos-respuesta.js';

const DIALOGO = 'Rechazar el pedido';
const EXPLICACION = 'Solo entregamos en Barcelona.';

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
  return anuncioConPedido(db, creados, { vendedor: centros.a, comprador: centros.b, anuncio: A2, unidades: 10, ...cambios });
}

async function conApi(request, cuentas, pedidoId) {
  const tokens = {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
  test.skip(!(await hayRuta(request, tokens.b, pedidoId, 'rechazar')), 'POST /api/pedidos/:id/rechazar (T33-2) aún no está en esta rama.');
  return tokens;
}

async function alPedido(page, cuentas, id, email = cuentas.centroA) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayPantallaPedido(page, id)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
}

async function abrirDialogo(page, cuentas, id) {
  await alPedido(page, cuentas, id);
  test.skip(!(await hayBotonesVendedor(page)), 'Aceptar y rechazar en /pedidos/:id (T33-5) aún no están en esta rama.');
  await boton(page, 'Rechazar').click();
  const ventana = page.getByRole('dialog').filter({ hasText: DIALOGO });
  await expect(ventana).toBeVisible();
  return ventana;
}

function campoMotivo(ventana) {
  return ventana.getByLabel('Motivo', { exact: true });
}

function campoExplicacion(ventana) {
  return ventana.getByLabel(/^Explicación/);
}

async function salirYEntrarComo(page, cuentas, id, email) {
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await alPedido(page, cuentas, id, email);
}

// ---------------------------------------------------------------- flujos e2e

test('US-79 · E2E-1 · el vendedor rechaza con motivo y el comprador lo ve', async ({ page, request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido();
  await conApi(request, cuentas, id);
  const ventana = await abrirDialogo(page, cuentas, id);
  const main = page.getByRole('main');

  await expect(ventana.getByText(`${centros.b.nombre} verá el motivo.`)).toBeVisible();
  // El desplegable tiene la lista fija de rechazo, sin el motivo del sistema.
  const opciones = (await campoMotivo(ventana).locator('option').allTextContents()).map((texto) => texto.trim());
  expect(opciones).toEqual(['Elige un motivo', ...Object.values(MOTIVOS_RECHAZO)]);
  await expect(ventana.getByText('0/300')).toBeVisible();

  await campoMotivo(ventana).selectOption({ label: MOTIVOS_RECHAZO.entrega_inviable });
  await campoExplicacion(ventana).fill(EXPLICACION);
  await expect(ventana.getByText(`${EXPLICACION.length}/300`)).toBeVisible();
  await ventana.getByRole('button', { name: 'Rechazar pedido', exact: true }).click();

  // CA4.
  await expect(page.getByText('Pedido rechazado.', { exact: true })).toBeVisible();
  await expect(main.getByText('Rechazado', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(MOTIVOS_RECHAZO.entrega_inviable)).toBeVisible();
  await expect(main.getByText(EXPLICACION)).toBeVisible();
  await expect(main.getByText(/Rechazado el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeVisible();
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
  await expect(boton(page, 'Rechazar')).toHaveCount(0);

  // CA7 en la BD y CA6: el anuncio no cambia.
  expect(await pedido(db, id)).toMatchObject({
    estado: 'rechazado', motivo_codigo: 'entrega_inviable', motivo_texto: EXPLICACION, cerrado_por: 'vendedor',
  });
  expect((await pedido(db, id)).respondido_en).not.toBeNull();
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 30 });

  // CA5: el comprador.
  await salirYEntrarComo(page, cuentas, id, cuentas.centroB);
  await expect(main.getByText('Rechazado', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(`${centros.a.nombre} ha rechazado el pedido.`)).toBeVisible();
  await expect(main.getByText(MOTIVOS_RECHAZO.entrega_inviable)).toBeVisible();
  await expect(main.getByText(EXPLICACION)).toBeVisible();
  await boton(page, 'Buscar material parecido').click();
  await expect(page).toHaveURL(/\/catalogo(\?|$)/);
});

test('US-79 · E2E-2 · «Otro motivo» exige la explicación y no envía nada', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  const ventana = await abrirDialogo(page, cuentas, id);
  const envios = contarAcciones(page, 'rechazar');

  // CA2: sin motivo.
  await ventana.getByRole('button', { name: 'Rechazar pedido', exact: true }).click();
  await expect(ventana.getByText('Elige un motivo.', { exact: true })).toBeVisible();

  // CA3: con «Otro motivo» la explicación pasa a obligatoria.
  await campoMotivo(ventana).selectOption({ label: MOTIVOS_RECHAZO.otro });
  await expect(ventana.getByText('Explicación (obligatoria)')).toBeVisible();
  await campoExplicacion(ventana).fill('No sé');
  await ventana.getByRole('button', { name: 'Rechazar pedido', exact: true }).click();
  await expect(ventana.getByText(EXPLICA)).toBeVisible();
  expect(envios).toHaveLength(0);
  expect((await pedido(db, id)).estado).toBe('pendiente');

  // Con 10 caracteres ya se envía.
  await campoExplicacion(ventana).fill('a'.repeat(10));
  await ventana.getByRole('button', { name: 'Rechazar pedido', exact: true }).click();
  await expect(page.getByText('Pedido rechazado.', { exact: true })).toBeVisible();
  expect(envios).toHaveLength(1);
});

test('US-79 · E2E-3 · el motivo del sistema no se acepta', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  // CA8: ausente, fuera de la lista o el del sistema.
  for (const datos of [{}, { motivo_codigo: 'anuncio_sin_stock' }, { motivo_codigo: 'inventado' }, { motivo_codigo: '' }]) {
    const error = await errorDe(await rechazar(request, tokens.a, id, datos), 400, 'DATOS_INVALIDOS');
    expect(error.details.motivo_codigo).toBe('Elige un motivo.');
  }
  expect((await pedido(db, id)).estado).toBe('pendiente');
});

test('US-79 · E2E-4 · rechazar un pedido ya aceptado responde 409', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido({ anuncio: A1, unidades: 4 });
  const tokens = await conApi(request, cuentas, id);
  expect((await aceptar(request, tokens.a, id)).status()).toBe(200);
  const error = await errorDe(
    await rechazar(request, tokens.a, id, { motivo_codigo: 'entrega_inviable', motivo_texto: EXPLICACION }),
    409, 'TRANSICION_NO_PERMITIDA',
  );
  expect(error).toMatchObject({ message: TRANSICION, details: { estado_actual: 'aceptado' } });
  expect((await pedido(db, id)).estado).toBe('aceptado');
});

// ---------------------------------------------------------------- criterios de aceptación

test('US-79 · CA3 · límites de la explicación', async ({ request, cuentas }) => {
  const { id: primero } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, primero);
  const casos = [
    // [motivo, texto, error esperado en details.motivo_texto o null si se acepta]
    ['otro', 'a'.repeat(9), EXPLICA],
    ['otro', `   ${'a'.repeat(9)}   `, EXPLICA], // los espacios de los extremos no cuentan
    ['otro', '', EXPLICA],
    ['otro', 'a'.repeat(301), LARGO],
    ['entrega_inviable', 'a'.repeat(301), LARGO],
    ['otro', 'a'.repeat(10), null],
    ['otro', 'a'.repeat(300), null],
    ['sin_unidades', '', null],
    ['condiciones_pago', 'a'.repeat(300), null],
  ];
  for (const [motivo, texto, esperado] of casos) {
    const { id } = await nuevoPedido();
    const res = await rechazar(request, tokens.a, id, { motivo_codigo: motivo, motivo_texto: texto });
    if (esperado) {
      const error = await errorDe(res, 400, 'DATOS_INVALIDOS');
      expect(error.details.motivo_texto, `${motivo} con ${texto.length} caracteres`).toBe(esperado);
      expect((await pedido(db, id)).estado).toBe('pendiente');
    } else {
      expect(res.status(), `${motivo} con ${texto.length} caracteres`).toBe(200);
      const { pedido: respuesta } = await res.json();
      expect(respuesta.motivo_texto ?? '').toBe(texto.trim());
    }
  }
});

test('US-79 · CA7 · la API responde el pedido rechazado', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const res = await rechazar(request, tokens.a, id, { motivo_codigo: 'entrega_inviable', motivo_texto: EXPLICACION });
  expect(res.status()).toBe(200);
  const { pedido: respuesta } = await res.json();
  expect(respuesta).toMatchObject({
    id, estado: 'rechazado', motivo_codigo: 'entrega_inviable', motivo_texto: EXPLICACION, cerrado_por: 'vendedor',
  });
  expect(respuesta.respondido_en).not.toBeNull();
  expect(respuesta.acciones).toEqual([]);
  // US-108 CA7: rechazado no da datos de contacto.
  expect(respuesta.comprador).not.toHaveProperty('email');
});

test('US-79 · CA9 · resto de errores como al aceptar', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const datos = { motivo_codigo: 'entrega_inviable', motivo_texto: EXPLICACION };
  await errorDe(await rechazar(request, null, id, datos), 401, 'NO_AUTENTICADO');
  const sinPermiso = await errorDe(await rechazar(request, tokens.b, id, datos), 403, 'SIN_PERMISO');
  expect(sinPermiso.message).toBe(SIN_PERMISO);
  const ajeno = await anuncioConPedido(db, creados, { vendedor: centros.b, comprador: centros.tercero, anuncio: A2 });
  for (const otro of [ajeno.id, INEXISTENTE]) {
    await errorDe(await rechazar(request, tokens.a, otro, datos), 404, 'NO_ENCONTRADO');
  }
  const token = await tokenSinConfirmar(request, cuentas);
  if (token) await errorDe(await rechazar(request, token, id, datos), 403, 'EMAIL_NO_CONFIRMADO');
  expect((await pedido(db, id)).estado).toBe('pendiente');
});

test('US-79 · CA10 · migración de las columnas de motivo', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  const columnas = await columnasDe(db, 'pedidos');
  for (const columna of ['motivo_codigo', 'motivo_texto', 'cerrado_por']) expect(columnas.has(columna), columna).toBe(true);

  // El enum incluye los motivos de rechazo, el del sistema y los de cancelación (US-39).
  const { rows } = await db.query(`
    SELECT e.enumlabel FROM pg_attribute a
    JOIN pg_enum e ON e.enumtypid = a.atttypid
    WHERE a.attrelid = 'public.pedidos'::regclass AND a.attname = 'motivo_codigo'`);
  const valores = new Set(rows.map((fila) => fila.enumlabel));
  for (const valor of [
    ...Object.keys(MOTIVOS_RECHAZO), 'anuncio_sin_stock', 'ya_no_necesario', 'otra_opcion', 'material_no_disponible',
    'sin_acuerdo_entrega', 'sin_respuesta', 'error_pedido',
  ]) expect(valores.has(valor), valor).toBe(true);

  // Check: rechazado o cancelado sin motivo no se puede guardar; texto de más de 300 tampoco.
  for (const estado of ['rechazado', 'cancelado']) {
    await expect(db.query('UPDATE public.pedidos SET estado = $2 WHERE id = $1', [id, estado]))
      .rejects.toMatchObject({ code: '23514' });
  }
  await expect(db.query(
    "UPDATE public.pedidos SET estado = 'rechazado', motivo_codigo = 'otro', cerrado_por = 'vendedor', motivo_texto = $2 WHERE id = $1",
    [id, 'a'.repeat(301)],
  )).rejects.toMatchObject({ code: expect.stringMatching(/^(23514|22001)$/) });
  expect((await pedido(db, id)).estado).toBe('pendiente');
});

test('US-79 · CA11 · el texto se muestra como texto plano', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const texto = '<b>Solo</b> entregamos <img src=x onerror=alert(1)> en Barcelona.';
  expect((await rechazar(request, tokens.a, id, { motivo_codigo: 'entrega_inviable', motivo_texto: texto })).status()).toBe(200);
  await alPedido(page, cuentas, id, cuentas.centroB);
  const main = page.getByRole('main');
  await expect(main.getByText(texto)).toBeVisible();
  await expect(main.locator('b, img[src="x"]')).toHaveCount(0);
});

test('US-79 · CA12 · tras un rechazo el comprador puede volver a pedir', async ({ request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  test.skip(!(await hayPostPedidos(request, tokens.b)), 'POST /api/pedidos (T32-2) aún no está en esta rama.');
  expect((await rechazar(request, tokens.a, id, { motivo_codigo: 'sin_unidades' })).status()).toBe(200);
  const columnas = await columnasDe(db, 'pedidos');
  const res = await postPedido(request, tokens.b, cuerpoPedido(anuncioId, { venta: false, columnas, unidades: 10 }));
  expect(res.status()).toBe(201);
});

test('US-79 · CA1 · «Rechazar» solo para el vendedor de un pendiente', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await alPedido(page, cuentas, id, cuentas.centroB);
  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A2.titulo}` })).toBeVisible();
  await expect(boton(page, 'Rechazar')).toHaveCount(0);

  await cambiarEstado(db, id, 'aceptado');
  await salirYEntrarComo(page, cuentas, id, cuentas.centroA);
  await expect(page.getByRole('heading', { level: 1, name: `Pedido de ${A2.titulo}` })).toBeVisible();
  await expect(boton(page, 'Rechazar')).toHaveCount(0);
});
