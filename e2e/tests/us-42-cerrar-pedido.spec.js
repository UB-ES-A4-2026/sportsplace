// E2E de US-42 (confirmo que he recibido el material) y US-80 (marcar un pedido como cobrado), dentro de US-42.
// Casos: docs/especificacion/E06 (US-80) y E07-E09 (US-42). A vende y B compra; los pedidos se insertan en la BD
// ya aceptados, como si A hubiera aceptado (US-33), con las unidades del anuncio ya restadas (US-34).
// Cada anuncio lleva un título propio para encontrar su fila en la bandeja de /pedidos (US-109).
import crypto from 'node:crypto';
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, autorizacion, boton, cambiarDeCuenta, datosCentro, hayPantallaPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import { SIN_PERMISO, TRANSICION, anuncioConPedido, errorDe, pedido } from '../pedidos-respuesta.js';

const COBRAR = 'Marcar como cobrado';
const RECIBIR = 'He recibido el material';
const FECHA = String.raw`\d{2}/\d{2}/\d{4} \d{2}:\d{2}`;
const POR_PAGINA = 20;

let db;
let centros;
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = { a: await datosCentro(db, cuentas.centroA), b: await datosCentro(db, cuentas.centroB) };
});

test.afterAll(async () => {
  if (!db) return;
  await retirarAnuncios(db, creados);
  await db.close();
});

// Pedido aceptado de 4 unidades, el más reciente de la bandeja. El anuncio tiene 8 unidades: las 12 de la semilla
// menos las 4 que se restaron al aceptar.
async function pedidoAceptado(datos = A1) {
  const titulo = `${datos.titulo} · US-42 ${crypto.randomUUID().slice(0, 8)}`;
  const ahora = new Date().toISOString();
  const { id, anuncioId } = await anuncioConPedido(db, creados, {
    vendedor: centros.a, comprador: centros.b, anuncio: { ...datos, titulo, unidades_disponibles: 8 },
    unidades: 4, estado: 'aceptado', respondido_en: ahora, creado_en: ahora, actualizado_en: ahora,
  });
  return { id, anuncioId, titulo };
}

async function alPedido(page, email, password, id) {
  await entrar(page, email, password);
  expect(await hayPantallaPedido(page, id), 'pantalla /pedidos/:id (T32-5)').toBe(true);
}

function dialogo(page, titulo) {
  return page.getByRole('dialog').filter({ hasText: titulo });
}

function etiqueta(page, texto) {
  return page.getByRole('main').locator('.pedido-estado').getByText(texto, { exact: true });
}

function postAccion(request, token, id, accion) {
  return request.post(`/api/pedidos/${id}/${accion}`, { headers: autorizacion(token) });
}

// US-109: la bandeja pone primero los pendientes y después el resto, del más nuevo al más antiguo. Un pedido
// cerrado y recién creado va justo detrás de los pendientes del centro: se abre la página donde cae.
async function filaEnBandeja(page, { columna, pestana, centroId, titulo }) {
  const { rows: [{ n }] } = await db.query(
    `SELECT count(*)::integer AS n FROM public.pedidos WHERE ${columna} = $1 AND estado = 'pendiente'`,
    [centroId],
  );
  const pagina = Math.floor(n / POR_PAGINA) + 1;
  await page.goto(`/pedidos?pestana=${pestana}${pagina > 1 ? `&pagina=${pagina}` : ''}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeVisible();
  return page.getByRole('main').getByRole('row').filter({ hasText: titulo });
}

// ---------------------------------------------------------------- flujos e2e

test('US-42 · E2E-1 · el vendedor marca como cobrado y el comprador confirma la recepción', async ({ page, cuentas }) => {
  const { id, anuncioId, titulo } = await pedidoAceptado();
  const main = page.getByRole('main');

  // US-80 CA1 y CA2: el vendedor ve «Marcar como cobrado» y no el botón del comprador.
  await alPedido(page, cuentas.centroA, cuentas.password, id);
  await expect(boton(page, RECIBIR)).toHaveCount(0);
  await expect(etiqueta(page, 'Pagado')).toHaveCount(0);
  await boton(page, COBRAR).click();
  const cobrar = dialogo(page, '¿Has cobrado este pedido?');
  await expect(cobrar).toBeVisible();
  await expect(cobrar.getByText(
    `Confirma que has recibido 34,00 € de ${centros.b.nombre} por transferencia bancaria. No se puede deshacer.`,
  )).toBeVisible();
  await cobrar.getByRole('button', { name: 'Sí, lo he cobrado' }).click();

  await expect(main.getByText('Pedido marcado como cobrado.')).toBeVisible();
  await expect(etiqueta(page, 'Pagado')).toBeVisible();
  await expect(main.getByText(new RegExp(`^Marcado como pagado el ${FECHA}$`))).toBeVisible();
  await expect(boton(page, COBRAR)).toHaveCount(0);

  // US-80 CA3 y US-42 CA1: el comprador ve «Pagado», no tiene botón de pago y sí «He recibido el material».
  await cambiarDeCuenta(page, entrar, cuentas.centroB, cuentas.password);
  await page.goto(`/pedidos/${id}`);
  await expect(etiqueta(page, 'Pagado')).toBeVisible();
  await expect(main.getByText(new RegExp(`^Marcado como pagado el ${FECHA}$`))).toBeVisible();
  await expect(boton(page, COBRAR)).toHaveCount(0);
  await boton(page, RECIBIR).click();
  const recibir = dialogo(page, '¿Confirmas que has recibido el material?');
  await expect(recibir).toBeVisible();
  // T42-4: el diálogo ya no dice que el pedido quedará cerrado.
  await expect(recibir.getByText(`Confirmas que has recibido 4 unidades de «${titulo}».`, { exact: true })).toBeVisible();
  await recibir.getByRole('button', { name: 'Sí, lo he recibido' }).click();

  // US-42 CA4: estado «Recibido», aviso y «Recibido el …» en la sección «Entrega».
  await expect(main.getByText('Pedido marcado como recibido.')).toBeVisible();
  await expect(etiqueta(page, 'Recibido')).toBeVisible();
  await expect(etiqueta(page, 'Pagado')).toBeVisible();
  await expect(main.getByText('Material recibido.', { exact: true })).toBeVisible();
  await expect(main.getByText(new RegExp(`^Recibido el ${FECHA}\\.$`))).toBeVisible();
  await expect(boton(page, RECIBIR)).toHaveCount(0);

  // US-42 CA4, CA7 y US-80 CA4: en la BD, recibido con las dos fechas y el stock del anuncio sin cambiar.
  const fila = await pedido(db, id);
  expect(fila.estado).toBe('recibido');
  expect(fila.pagado_en).not.toBeNull();
  expect(fila.recibido_en).not.toBeNull();
  const { rows: [anuncio] } = await db.query('SELECT unidades_disponibles FROM public.anuncios WHERE id = $1', [anuncioId]);
  expect(anuncio.unidades_disponibles).toBe(8);

  // US-80 CA9 y US-42 CA9: en /pedidos, «Recibido» y «Pagado» para los dos centros.
  const deB = await filaEnBandeja(page, {
    columna: 'comprador_centro_id', pestana: 'realizados', centroId: centros.b.id, titulo,
  });
  await expect(deB.getByText('Recibido', { exact: true })).toBeVisible();
  await expect(deB.getByText('Pagado', { exact: true })).toBeVisible();

  await cambiarDeCuenta(page, entrar, cuentas.centroA, cuentas.password);
  const deA = await filaEnBandeja(page, {
    columna: 'vendedor_centro_id', pestana: 'recibidos', centroId: centros.a.id, titulo,
  });
  await expect(deA.getByText('Recibido', { exact: true })).toBeVisible();
  await expect(deA.getByText('Pagado', { exact: true })).toBeVisible();
});

test('US-42 · E2E-2 · una donación no se cobra y el comprador confirma la recepción', async ({ page, cuentas }) => {
  const { id } = await pedidoAceptado(A2);
  const main = page.getByRole('main');

  // US-80 CA1: sin «Marcar como cobrado» en una donación.
  await alPedido(page, cuentas.centroA, cuentas.password, id);
  await expect(main.getByText('Pedido aceptado. Acordad la entrega.')).toBeVisible();
  await expect(boton(page, COBRAR)).toHaveCount(0);
  await expect(boton(page, RECIBIR)).toHaveCount(0);

  // US-42 CA3: se confirma igual sin cobro.
  await cambiarDeCuenta(page, entrar, cuentas.centroB, cuentas.password);
  await page.goto(`/pedidos/${id}`);
  await boton(page, RECIBIR).click();
  await dialogo(page, '¿Confirmas que has recibido el material?').getByRole('button', { name: 'Sí, lo he recibido' }).click();
  await expect(main.getByText('Pedido marcado como recibido.')).toBeVisible();
  await expect(etiqueta(page, 'Recibido')).toBeVisible();
  await expect(etiqueta(page, 'Pagado')).toHaveCount(0);
  expect((await pedido(db, id)).pagado_en).toBeNull();
});

test('US-42 · E2E-3 · la API rechaza repetir, cambiar de papel y cobrar una donación', async ({ request, cuentas }) => {
  const a = await tokenDe(request, cuentas.centroA, cuentas.password);
  const b = await tokenDe(request, cuentas.centroB, cuentas.password);
  const venta = await pedidoAceptado();
  const donacion = await pedidoAceptado(A2);

  // US-80 CA5: el comprador no marca el cobro, no se cobra una donación y no se cobra dos veces.
  expect((await errorDe(await postAccion(request, b, venta.id, 'marcar-pagado'), 403, 'SIN_PERMISO')).message).toBe(SIN_PERMISO);
  const noSeCobra = await errorDe(await postAccion(request, a, donacion.id, 'marcar-pagado'), 409, 'PEDIDO_DONACION');
  expect(noSeCobra.message).toBe('Las donaciones no se cobran.');
  expect((await postAccion(request, a, venta.id, 'marcar-pagado')).status()).toBe(200);
  const yaPagado = await errorDe(await postAccion(request, a, venta.id, 'marcar-pagado'), 409, 'YA_PAGADO');
  expect(yaPagado.message).toBe('Este pedido ya consta como cobrado.');

  // US-42 CA12: el vendedor no confirma la recepción y no se confirma dos veces.
  expect((await errorDe(await postAccion(request, a, venta.id, 'recibir'), 403, 'SIN_PERMISO')).message).toBe(SIN_PERMISO);
  const recibido = await postAccion(request, b, venta.id, 'recibir');
  expect(recibido.status()).toBe(200);
  const { pedido: cuerpo } = await recibido.json();
  expect(cuerpo).toMatchObject({ id: venta.id, estado: 'recibido' });
  expect(cuerpo.recibido_en).toEqual(expect.any(String));
  const primera = (await pedido(db, venta.id)).recibido_en;
  const otraVez = await errorDe(await postAccion(request, b, venta.id, 'recibir'), 409, 'TRANSICION_NO_PERMITIDA');
  expect(otraVez.message).toBe(TRANSICION);
  // US-42 CA14: recibido_en no cambia con la segunda confirmación.
  expect((await pedido(db, venta.id)).recibido_en).toBe(primera);
});
