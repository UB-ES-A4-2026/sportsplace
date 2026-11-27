// T39-3 · E2E de US-39 (cancelar un pedido indicando el motivo). Casos: docs/especificacion/E06 (US-39).
// Los pedidos se insertan en la BD como pendientes (B pide 10 petos de A2 o 4 balones de A1 a A) y, cuando el
// caso lo pide, se aceptan y se cobran por la API para que la reserva de unidades (US-34) sea la real.
// Los casos se omiten mientras no estén en la rama la tabla `pedidos` (T32-1),
// `POST /api/pedidos/:id/cancelar` (T39-1) o la pantalla `/pedidos/:id` (T32-5).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, INEXISTENTE, anuncio, autorizacion, boton, columnasDe, cuerpoPedido, datosCentro, hayPantallaPedido,
  hayTablaPedidos, postPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import {
  EXPLICA, LARGO, TRANSICION, aLaVez, aceptar, anuncioConPedido, cambiarEstado, contarAcciones, errorDe,
  hayRuta, pedido, tokenSinConfirmar,
} from '../pedidos-respuesta.js';

const DIALOGO = 'Cancelar el pedido';
const EXPLICACION = 'No coincidimos en horarios.';
const PAGADO = 'No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.';

// Textos de la lista fija de motivos de cancelación (E06, base común) por papel.
const MOTIVOS = {
  ya_no_necesario: 'Ya no necesitamos el material',
  otra_opcion: 'Hemos encontrado otra opción',
  material_no_disponible: 'El material ya no está disponible',
  sin_acuerdo_entrega: 'No hemos podido acordar la entrega',
  sin_respuesta: 'La otra parte no responde',
  error_pedido: 'El pedido tenía un error',
  otro: 'Otro motivo',
};
const AMBOS = ['sin_acuerdo_entrega', 'sin_respuesta', 'error_pedido', 'otro'];
const DEL_COMPRADOR = ['ya_no_necesario', 'otra_opcion', ...AMBOS];
const DEL_VENDEDOR = ['material_no_disponible', ...AMBOS];

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
  test.skip(!(await hayRuta(request, tokens.b, pedidoId, 'cancelar')), 'POST /api/pedidos/:id/cancelar (T39-1) aún no está en esta rama.');
  return tokens;
}

function cancelar(request, token, id, datos) {
  return request.post(`/api/pedidos/${id}/cancelar`, { headers: autorizacion(token), data: datos });
}

function marcarPagado(request, token, id) {
  return request.post(`/api/pedidos/${id}/marcar-pagado`, { headers: autorizacion(token) });
}

// Pedido de 4 balones de A1 aceptado por A con la API: A1 pasa de 12 a 8 disponibles (US-34).
async function pedidoAceptado(request, cuentas) {
  const creado = await nuevoPedido({ anuncio: A1, unidades: 4 });
  const tokens = await conApi(request, cuentas, creado.id);
  expect((await aceptar(request, tokens.a, creado.id)).status()).toBe(200);
  expect(await anuncio(db, creado.anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 8 });
  return { ...creado, tokens };
}

async function alPedido(page, cuentas, id, email) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayPantallaPedido(page, id)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
}

async function salirYEntrarComo(page, cuentas, id, email) {
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await alPedido(page, cuentas, id, email);
}

function botonCancelar(page) {
  return page.getByRole('main').getByRole('button', { name: 'Cancelar pedido', exact: true });
}

async function abrirDialogo(page) {
  await botonCancelar(page).click();
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

async function opcionesDe(ventana) {
  return (await campoMotivo(ventana).locator('option').allTextContents()).map((texto) => texto.trim());
}

// ---------------------------------------------------------------- flujos e2e

test('US-39 · E2E-1 · el comprador cancela un pedido pendiente y el vendedor ve el motivo', async ({ page, request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await alPedido(page, cuentas, id, cuentas.centroB);
  const main = page.getByRole('main');
  const ventana = await abrirDialogo(page);

  // Pantalla: texto del diálogo (pendiente: sin la línea de las unidades) y CA2, motivos del comprador.
  await expect(ventana.getByText(`${centros.a.nombre} verá el motivo. No se puede deshacer.`)).toBeVisible();
  await expect(ventana.getByText('Las unidades volverán a estar disponibles en el anuncio.')).toHaveCount(0);
  expect(await opcionesDe(ventana)).toEqual(['Elige un motivo', ...DEL_COMPRADOR.map((codigo) => MOTIVOS[codigo])]);
  await expect(ventana.getByText('0/300')).toBeVisible();

  await campoMotivo(ventana).selectOption({ label: MOTIVOS.otra_opcion });
  await ventana.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();

  // CA3.
  await expect(page.getByText('Pedido cancelado.', { exact: true })).toBeVisible();
  await expect(main.getByText('Cancelado', { exact: true }).first()).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Motivo', exact: true })).toBeVisible();
  await expect(main.getByText(MOTIVOS.otra_opcion)).toBeVisible();
  await expect(main.getByText(/Cancelado el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por comprador/)).toBeVisible();
  await expect(botonCancelar(page)).toHaveCount(0);

  // CA5 en la BD y CA9: un pendiente cancelado no cambia el anuncio.
  const fila = await pedido(db, id);
  expect(fila).toMatchObject({ estado: 'cancelado', motivo_codigo: 'otra_opcion', motivo_texto: null, cerrado_por: 'comprador' });
  expect(fila.cancelado_en).not.toBeNull();
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 30 });

  // CA4: el vendedor.
  await salirYEntrarComo(page, cuentas, id, cuentas.centroA);
  await expect(main.getByText('Cancelado', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(`Pedido cancelado por ${centros.b.nombre}.`)).toBeVisible();
  await expect(main.getByText(MOTIVOS.otra_opcion)).toBeVisible();
  await expect(boton(page, 'Aceptar')).toHaveCount(0);
  await expect(boton(page, 'Rechazar')).toHaveCount(0);
});

test('US-39 · E2E-2 · el vendedor cancela un pedido aceptado y vuelven las unidades', async ({ page, request, cuentas }) => {
  const { id, anuncioId } = await pedidoAceptado(request, cuentas);
  await alPedido(page, cuentas, id, cuentas.centroA);
  const main = page.getByRole('main');
  const ventana = await abrirDialogo(page);

  await expect(ventana.getByText(
    `${centros.b.nombre} verá el motivo. No se puede deshacer. Las unidades volverán a estar disponibles en el anuncio.`,
  )).toBeVisible();
  expect(await opcionesDe(ventana)).toEqual(['Elige un motivo', ...DEL_VENDEDOR.map((codigo) => MOTIVOS[codigo])]);

  await campoMotivo(ventana).selectOption({ label: MOTIVOS.sin_acuerdo_entrega });
  await campoExplicacion(ventana).fill(EXPLICACION);
  await expect(ventana.getByText(`${EXPLICACION.length}/300`)).toBeVisible();
  await ventana.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();

  await expect(page.getByText('Pedido cancelado.', { exact: true })).toBeVisible();
  await expect(main.getByText(MOTIVOS.sin_acuerdo_entrega)).toBeVisible();
  await expect(main.getByText(EXPLICACION)).toBeVisible();
  await expect(main.getByText(/Cancelado el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por vendedor/)).toBeVisible();
  // El historial conserva «Aceptado el …».
  await expect(main.getByText(/Aceptado el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeVisible();

  // CA9: A1 recupera las 4 unidades en la misma transacción.
  expect(await pedido(db, id)).toMatchObject({
    estado: 'cancelado', motivo_codigo: 'sin_acuerdo_entrega', motivo_texto: EXPLICACION, cerrado_por: 'vendedor',
  });
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 12 });

  // CA4: el comprador.
  await salirYEntrarComo(page, cuentas, id, cuentas.centroB);
  await expect(main.getByText(`Pedido cancelado por ${centros.a.nombre}.`)).toBeVisible();
  await expect(main.getByText(MOTIVOS.sin_acuerdo_entrega)).toBeVisible();
  await expect(main.getByText(EXPLICACION)).toBeVisible();
});

test('US-39 · E2E-3 · un pedido cobrado no se puede cancelar', async ({ page, request, cuentas }) => {
  const { id, anuncioId, tokens } = await pedidoAceptado(request, cuentas);
  expect((await marcarPagado(request, tokens.a, id)).status()).toBe(200);

  // CA1: sin botón para ninguno de los dos.
  await alPedido(page, cuentas, id, cuentas.centroA);
  for (const [email, token] of [[cuentas.centroA, tokens.a], [cuentas.centroB, tokens.b]]) {
    if (email !== cuentas.centroA) await salirYEntrarComo(page, cuentas, id, email);
    await expect(page.getByRole('main').getByText('Pagado', { exact: true }).first()).toBeVisible();
    await expect(botonCancelar(page)).toHaveCount(0);

    // CA8: POST directo.
    const error = await errorDe(
      await cancelar(request, token, id, { motivo_codigo: 'sin_respuesta', motivo_texto: '' }), 409, 'PEDIDO_PAGADO',
    );
    expect(error.message).toBe(PAGADO);
  }
  expect((await pedido(db, id)).estado).toBe('aceptado');
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: 8 });
});

test('US-39 · E2E-4 · motivo de otro papel, pedido rechazado y tercero', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);

  // CA6: el comprador con un motivo del vendedor (y al revés).
  const delVendedor = await errorDe(await cancelar(request, tokens.b, id, { motivo_codigo: 'material_no_disponible' }), 400, 'DATOS_INVALIDOS');
  expect(delVendedor.details).toHaveProperty('motivo_codigo');
  const delComprador = await errorDe(await cancelar(request, tokens.a, id, { motivo_codigo: 'ya_no_necesario' }), 400, 'DATOS_INVALIDOS');
  expect(delComprador.details).toHaveProperty('motivo_codigo');
  expect((await pedido(db, id)).estado).toBe('pendiente');

  // CA8: rechazado.
  const { id: rechazado } = await nuevoPedido();
  await cambiarEstado(db, rechazado, 'rechazado', { motivo: 'entrega_inviable', cerradoPor: 'vendedor' });
  const error = await errorDe(await cancelar(request, tokens.b, rechazado, { motivo_codigo: 'otra_opcion' }), 409, 'TRANSICION_NO_PERMITIDA');
  expect(error).toMatchObject({ message: TRANSICION, details: { estado_actual: 'rechazado' } });

  // CA7: Sabadell (tercero sin relación) no ve el pedido: un pedido ajeno a A da 404, igual que uno inexistente.
  const ajeno = await anuncioConPedido(db, creados, { vendedor: centros.b, comprador: centros.tercero, anuncio: A2 });
  for (const otro of [ajeno.id, INEXISTENTE]) {
    await errorDe(await cancelar(request, tokens.a, otro, { motivo_codigo: 'sin_respuesta' }), 404, 'NO_ENCONTRADO');
  }
  expect((await pedido(db, ajeno.id)).estado).toBe('pendiente');
});

// ---------------------------------------------------------------- criterios de aceptación

test('US-39 · CA2 · motivo obligatorio y «Otro motivo» con explicación, sin enviar nada', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  await alPedido(page, cuentas, id, cuentas.centroB);
  const ventana = await abrirDialogo(page);
  const envios = contarAcciones(page, 'cancelar');

  await ventana.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
  await expect(ventana.getByText('Elige un motivo.', { exact: true })).toBeVisible();

  await campoMotivo(ventana).selectOption({ label: MOTIVOS.otro });
  await campoExplicacion(ventana).fill('No sé');
  await ventana.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
  await expect(ventana.getByText(EXPLICA)).toBeVisible();
  expect(envios).toHaveLength(0);
  expect((await pedido(db, id)).estado).toBe('pendiente');

  // «Volver» cierra sin cambios.
  await ventana.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(ventana).toBeHidden();
  await expect(botonCancelar(page)).toBeVisible();
  expect(envios).toHaveLength(0);
});

test('US-39 · CA2 y CA6 · límites de la explicación en la API', async ({ request, cuentas }) => {
  const { id: primero } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, primero);
  const casos = [
    // [motivo, texto, error esperado en details.motivo_texto o null si se acepta]
    ['otro', 'a'.repeat(9), EXPLICA],
    ['otro', `   ${'a'.repeat(9)}   `, EXPLICA], // los espacios de los extremos no cuentan
    ['otro', '', EXPLICA],
    ['otro', 'a'.repeat(301), LARGO],
    ['sin_respuesta', 'a'.repeat(301), LARGO],
    ['otro', 'a'.repeat(10), null],
    ['otro', 'a'.repeat(300), null],
    ['ya_no_necesario', '', null],
  ];
  for (const [motivo, texto, esperado] of casos) {
    const { id } = await nuevoPedido();
    const res = await cancelar(request, tokens.b, id, { motivo_codigo: motivo, motivo_texto: texto });
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
  // Motivo ausente, inventado o del sistema.
  for (const datos of [{}, { motivo_codigo: 'inventado' }, { motivo_codigo: 'anuncio_sin_stock' }]) {
    const { id } = await nuevoPedido();
    const error = await errorDe(await cancelar(request, tokens.b, id, datos), 400, 'DATOS_INVALIDOS');
    expect(error.details).toHaveProperty('motivo_codigo');
  }
});

test('US-39 · CA5 · la API responde el pedido cancelado', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  expect((await (await request.get(`/api/pedidos/${id}`, { headers: autorizacion(tokens.b) })).json()).pedido.acciones)
    .toContain('cancelar');
  const res = await cancelar(request, tokens.b, id, { motivo_codigo: 'ya_no_necesario', motivo_texto: '  Cambio de planes.  ' });
  expect(res.status()).toBe(200);
  const { pedido: respuesta } = await res.json();
  expect(respuesta).toMatchObject({
    id, estado: 'cancelado', motivo_codigo: 'ya_no_necesario', motivo_texto: 'Cambio de planes.', cerrado_por: 'comprador',
  });
  expect(respuesta.cancelado_en).not.toBeNull();
  expect(respuesta.acciones).toEqual([]);
});

test('US-39 · CA7 y CA8 · resto de errores', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  const tokens = await conApi(request, cuentas, id);
  const datos = { motivo_codigo: 'sin_respuesta' };
  await errorDe(await cancelar(request, null, id, datos), 401, 'NO_AUTENTICADO');
  const token = await tokenSinConfirmar(request, cuentas);
  if (token) await errorDe(await cancelar(request, token, id, datos), 403, 'EMAIL_NO_CONFIRMADO');

  // CA8: cancelado y recibido tampoco admiten la transición.
  for (const estado of ['cancelado', 'recibido']) {
    const { id: cerrado } = await nuevoPedido({ anuncio: A1, unidades: 4 });
    if (estado === 'cancelado') await cambiarEstado(db, cerrado, estado, { motivo: 'sin_respuesta', cerradoPor: 'vendedor' });
    else {
      await cambiarEstado(db, cerrado, 'aceptado');
      await db.query("UPDATE public.pedidos SET estado = 'recibido', recibido_en = now() WHERE id = $1", [cerrado]);
    }
    const error = await errorDe(await cancelar(request, tokens.b, cerrado, datos), 409, 'TRANSICION_NO_PERMITIDA');
    expect(error.details).toEqual({ estado_actual: estado });
  }
  expect((await pedido(db, id)).estado).toBe('pendiente');
});

test('US-39 · CA10 · cancelar y aceptar a la vez: gana el primero', async ({ request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido({ anuncio: A1, unidades: 4 });
  const tokens = await conApi(request, cuentas, id);
  const [cancelacion, aceptacion] = await aLaVez(db, anuncioId, [
    () => cancelar(request, tokens.b, id, { motivo_codigo: 'sin_respuesta' }),
    () => aceptar(request, tokens.a, id),
  ]);
  const estados = [cancelacion.status(), aceptacion.status()].sort();
  expect(estados).toEqual([200, 409]);
  const perdedora = cancelacion.status() === 409 ? cancelacion : aceptacion;
  expect((await perdedora.json()).error.code).toBe('TRANSICION_NO_PERMITIDA');

  // Las unidades cuadran con el ganador.
  const fila = await pedido(db, id);
  const disponibles = fila.estado === 'aceptado' ? 8 : 12;
  expect(['aceptado', 'cancelado']).toContain(fila.estado);
  expect(await anuncio(db, anuncioId)).toEqual({ estado: 'activo', unidades_disponibles: disponibles });
});

test('US-39 · CA11 · migración de cancelado_en', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas, id);
  const columnas = await columnasDe(db, 'pedidos');
  expect(columnas.has('cancelado_en')).toBe(true);
  const { rows } = await db.query(`
    SELECT e.enumlabel FROM pg_attribute a
    JOIN pg_enum e ON e.enumtypid = a.atttypid
    WHERE a.attrelid = 'public.pedidos'::regclass AND a.attname = 'motivo_codigo'`);
  const valores = new Set(rows.map((fila) => fila.enumlabel));
  for (const valor of Object.keys(MOTIVOS)) expect(valores.has(valor), valor).toBe(true);
});

test('US-39 · CA12 · tras cancelar, el comprador puede volver a pedir', async ({ request, cuentas }) => {
  const { id, anuncioId } = await nuevoPedido({ anuncio: A1, unidades: 4 });
  const tokens = await conApi(request, cuentas, id);
  const columnas = await columnasDe(db, 'pedidos');
  await errorDe(await postPedido(request, tokens.b, cuerpoPedido(anuncioId, { columnas })), 409, 'PEDIDO_YA_PENDIENTE');
  expect((await cancelar(request, tokens.b, id, { motivo_codigo: 'error_pedido' })).status()).toBe(200);
  expect((await postPedido(request, tokens.b, cuerpoPedido(anuncioId, { columnas }))).status()).toBe(201);
});
