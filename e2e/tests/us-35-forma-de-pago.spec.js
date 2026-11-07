// T32-6 · E2E de US-35 (indicar cómo voy a pagar un pedido de venta). Casos: docs/especificacion/E06 (US-35).
// Se elige en el formulario de US-32. Los casos se omiten mientras no estén en la rama la columna
// `metodo_pago` (T32-1), su validación en `POST /api/pedidos` (T32-2), el bloque del formulario (T32-4)
// o la fila del detalle (T32-5).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A2, boton, campoUnidades, columnasDe, contarEnvios, cuerpoPedido, datosCentro, hayFormularioPedir,
  hayGetPedido, hayPantallaPedido, hayPostPedidos, hayTablaPedidos, insertarAnuncio, pedidosDe, postPedido, retirarAnuncios,
  tokenDe, getPedido, idDeUrl,
} from '../pedidos.js';

const ELIGE = 'Elige una forma de pago.';

let db;
let centros;
let columnas = new Set();
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = { a: await datosCentro(db, cuentas.centroA), b: await datosCentro(db, cuentas.centroB) };
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

async function conApi(request, cuentas) {
  test.skip(!columnas.has('metodo_pago'), 'La columna pedidos.metodo_pago (T32-1) aún no está en esta rama.');
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayPostPedidos(request, token)), 'POST /api/pedidos (T32-2) aún no está en esta rama.');
  return token;
}

async function alFormulario(page, cuentas, anuncioId) {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFormularioPedir(page, anuncioId)), 'El formulario /anuncios/:id/pedir (T32-4) aún no está en esta rama.');
}

async function elegirRecogida(page) {
  const recogida = page.getByRole('radio', { name: /^(Paso a recogerlo|Recogida|Lo recojo)/ });
  if (await recogida.count()) await recogida.first().check();
}

// ---------------------------------------------------------------- flujos e2e

test('US-35 · E2E-1 · transferencia, en la BD y en el detalle para los dos', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);

  // CA1: el bloque sale en venta, sin nada marcado y con sus ayudas.
  const transferencia = page.getByRole('radio', { name: 'Transferencia bancaria' });
  const efectivo = page.getByRole('radio', { name: 'Efectivo al recoger' });
  await expect(page.getByText('Forma de pago', { exact: true })).toBeVisible();
  await expect(transferencia).not.toBeChecked();
  await expect(efectivo).not.toBeChecked();
  await expect(page.getByText('Pediréis los datos bancarios al vendedor cuando acepte el pedido.')).toBeVisible();
  await expect(page.getByText('Pagas en mano al recoger el material.')).toBeVisible();

  await campoUnidades(page).fill('4');
  await transferencia.check();
  await elegirRecogida(page);
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText('Pedido enviado. El vendedor lo revisará.')).toBeVisible();
  const pedidoId = idDeUrl(page);
  expect((await pedidosDe(db, a1))[0].metodo_pago).toBe('transferencia');

  // CA6: lo ven comprador y vendedor.
  test.skip(!(await hayPantallaPedido(page, pedidoId)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
  await expect(page.getByText(/Forma de pago:?\s*Transferencia bancaria/)).toBeVisible();
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/pedidos/${pedidoId}`);
  await expect(page.getByText(/Forma de pago:?\s*Transferencia bancaria/)).toBeVisible();
  // CA9: ningún dato bancario en el pedido.
  await expect(page.getByRole('main').getByText(/IBAN|ES\d{2}\s?\d{4}/)).toHaveCount(0);
});

test('US-35 · E2E-2 · sin elegir no se envía y la API responde 400', async ({ page, request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();

  // CA3: ausente o con otro valor.
  for (const metodo of [undefined, 'bizum']) {
    const res = await postPedido(request, token, { ...cuerpoPedido(a1, { columnas }), metodo_pago: metodo });
    expect(res.status(), String(metodo)).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.metodo_pago).toBe(ELIGE);
  }
  // Los dos valores válidos.
  const efectivo = await postPedido(request, token, cuerpoPedido(a1, { columnas, metodo_pago: 'efectivo_recogida' }));
  expect(efectivo.status()).toBe(201);
  expect((await efectivo.json()).pedido.metodo_pago).toBe('efectivo_recogida');

  // CA2: en la web, sin elegir sale el error y no hay petición.
  const otro = await nuevoAnuncio();
  await alFormulario(page, cuentas, otro);
  await elegirRecogida(page);
  const envios = contarEnvios(page);
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText(ELIGE)).toBeVisible();
  expect(envios).toHaveLength(0);
});

test('US-35 · E2E-3 · en donación no hay forma de pago', async ({ page, request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a2 = await nuevoAnuncio(A2);

  // CA4.
  const res = await postPedido(request, token, cuerpoPedido(a2, { columnas, venta: false, metodo_pago: 'transferencia' }));
  expect(res.status()).toBe(400);
  const { error } = await res.json();
  expect(error.code).toBe('DATOS_INVALIDOS');
  expect(error.details.metodo_pago).toBe('Las donaciones no tienen forma de pago.');
  const bien = await postPedido(request, token, cuerpoPedido(a2, { columnas, venta: false }));
  expect(bien.status()).toBe(201);
  expect((await bien.json()).pedido.metodo_pago).toBeNull();

  // CA1: el bloque no aparece.
  const otro = await nuevoAnuncio(A2);
  await alFormulario(page, cuentas, otro);
  await expect(page.getByText('Forma de pago', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Transferencia bancaria' })).toHaveCount(0);
});

// ---------------------------------------------------------------- resto de CA

test('US-35 · CA5 · check de la columna metodo_pago', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const { pedido } = await (await postPedido(request, token, cuerpoPedido(a1, { columnas }))).json();
  // Venta sin método o con un valor fuera de la lista: la BD lo impide.
  await expect(db.query('UPDATE public.pedidos SET metodo_pago = NULL WHERE id = $1', [pedido.id])).rejects.toThrow();
  await expect(db.query("UPDATE public.pedidos SET metodo_pago = 'bizum' WHERE id = $1", [pedido.id])).rejects.toThrow();
});

test('US-35 · CA6 y CA7 · el detalle lo devuelve y no se puede cambiar', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const { pedido } = await (await postPedido(request, token, cuerpoPedido(a1, { columnas, metodo_pago: 'efectivo_recogida' }))).json();

  test.skip(!(await hayGetPedido(request)), 'GET /api/pedidos/:id (T32-3) aún no está en esta rama.');
  const tokenA = await tokenDe(request, cuentas.centroA, cuentas.password);
  for (const t of [token, tokenA]) {
    const res = await getPedido(request, t, pedido.id);
    expect(res.status()).toBe(200);
    expect((await res.json()).pedido.metodo_pago).toBe('efectivo_recogida');
  }
  // CA7: no hay ruta para cambiarlo.
  for (const metodo of ['patch', 'put']) {
    const res = await request[metodo](`/api/pedidos/${pedido.id}`, {
      headers: { Authorization: `Bearer ${token}` }, data: { metodo_pago: 'transferencia' },
    });
    expect([404, 405]).toContain(res.status());
  }
  expect((await pedidosDe(db, a1))[0].metodo_pago).toBe('efectivo_recogida');
});

test('US-35 · CA8 · efectivo con envío avisa sin bloquear', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  test.skip(!columnas.has('metodo_entrega'), 'La entrega (US-40) aún no está en esta rama.');
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  await page.getByRole('radio', { name: 'Efectivo al recoger' }).check();
  await page.getByRole('radio', { name: /^Que me lo envíen/ }).check();
  await expect(page.getByText('Con envío, acordad con el vendedor cómo pagar en efectivo.')).toBeVisible();
  await expect(boton(page, 'Enviar pedido')).toBeEnabled();
});
