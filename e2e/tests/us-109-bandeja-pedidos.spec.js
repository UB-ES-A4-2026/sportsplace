// T33-6 · E2E de US-109 (ver los pedidos que recibo y los que hago). Casos: docs/especificacion/E06 (US-109).
// Los pedidos se insertan en la BD: B pide a A y el centro sin confirmar hace de tercero. Cada caso borra al
// acabar los suyos, así los recuentos de A y de B solo incluyen lo que siembra el propio caso. Los casos se
// omiten mientras no estén en la rama la tabla `pedidos` (T32-1), `GET /api/pedidos` y el contador (T33-1)
// o la pantalla `/pedidos` (T33-4).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, boton, datosCentro, hayTablaPedidos, insertarAnuncio, insertarPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import {
  anuncioConPedido, cambiarEstado, contadorPedidos, enlacePedidosCabecera, errorDe, hayBandeja, hayContador,
  hayLista, listaPedidos, pedidosComo, pendientesRecibidos, pestana, tokenSinConfirmar,
} from '../pedidos-respuesta.js';

const VACIO_RECIBIDOS = 'Todavía no has recibido pedidos. Cuando otro centro pida tu material, aparecerá aquí.';
const VACIO_REALIZADOS = 'Todavía no has hecho pedidos.';

let db;
let centros;
let creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    tercero: await datosCentro(db, cuentas.sinConfirmar),
  };
});

test.afterEach(async () => {
  if (db) await retirarAnuncios(db, creados);
  creados = [];
});

test.afterAll(async () => {
  if (db) await db.close();
});

function hace(minutos) {
  return new Date(Date.now() - minutos * 60_000).toISOString();
}

async function nuevoPedido(cambios = {}) {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  return anuncioConPedido(db, creados, { vendedor: centros.a, comprador: centros.b, anuncio: A1, ...cambios });
}

async function conApi(request, cuentas) {
  const tokens = {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
  test.skip(!(await hayLista(request, tokens.a)), 'GET /api/pedidos (T33-1) aún no está en esta rama.');
  return tokens;
}

async function aLaBandeja(page, cuentas, email = cuentas.centroA) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayBandeja(page)), 'La pantalla /pedidos (T33-4) aún no está en esta rama.');
}

function fila(page, texto) {
  const main = page.getByRole('main');
  return main.getByRole('row').or(main.getByRole('listitem')).or(main.getByRole('article')).filter({ hasText: texto });
}

// ---------------------------------------------------------------- flujos e2e

test('US-109 · E2E-1 · el vendedor ve el pedido pendiente y el contador', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido();
  await conApi(request, cuentas);
  const pendientes = await pendientesRecibidos(db, centros.a.id);
  await aLaBandeja(page, cuentas);

  // CA9 y CA1: contador en la cabecera; el enlace lleva a Recibidos.
  const enlace = enlacePedidosCabecera(page);
  await expect(enlace).toContainText(String(pendientes));
  await page.goto('/perfil');
  await enlace.click();
  await expect(page).toHaveURL(/\/pedidos\?pestana=recibidos$/);
  await expect(pestana(page, new RegExp(`^Recibidos \\(${pendientes} pendientes?\\)`))).toBeVisible();

  const linea = fila(page, A1.titulo);
  for (const texto of [centros.b.nombre, '4', '34,00 €', 'Pendiente', '21/10/2026']) await expect(linea).toContainText(texto);

  // CA6: toda la fila lleva al detalle.
  await linea.click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(new RegExp(`/pedidos/${id}$`));
});

test('US-109 · E2E-2 · el comprador ve sus pedidos, pendientes primero', async ({ page, request, cuentas }) => {
  // Un aceptado más reciente y dos pendientes más antiguos: los pendientes van delante (CA4).
  await nuevoPedido({ anuncio: { ...A1, titulo: 'Conos de señalización' }, unidades: 2, creado_en: hace(5) })
    .then(({ id }) => cambiarEstado(db, id, 'aceptado'));
  await nuevoPedido({ creado_en: hace(60) });
  await nuevoPedido({ anuncio: A2, unidades: 10, creado_en: hace(30) });
  await conApi(request, cuentas);
  await aLaBandeja(page, cuentas, cuentas.centroB);

  await pestana(page, /^Realizados/).click();
  await expect(page).toHaveURL(/pestana=realizados/);
  const main = page.getByRole('main');
  await expect(fila(page, A2.titulo)).toContainText('Donación');
  await expect(fila(page, A2.titulo)).toContainText(centros.a.nombre);
  await expect(fila(page, A1.titulo)).toContainText('34,00 €');
  const texto = await main.innerText();
  const orden = [A2.titulo, A1.titulo, 'Conos de señalización'].map((titulo) => texto.indexOf(titulo));
  expect(orden.every((posicion) => posicion >= 0)).toBe(true);
  expect(orden).toEqual([...orden].sort((x, y) => x - y));
});

test('US-109 · E2E-3 · sin pedidos, los textos vacíos', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  // A no ha comprado nada y B no ha recibido nada (los casos de pedidos siempre van de B a A).
  test.skip(await pedidosComo(db, 'comprador_centro_id', centros.a.id) > 0, 'A tiene pedidos realizados en este entorno.');
  test.skip(await pedidosComo(db, 'vendedor_centro_id', centros.b.id) > 0, 'B tiene pedidos recibidos en este entorno.');

  await aLaBandeja(page, cuentas, cuentas.centroB);
  await expect(page.getByText(VACIO_RECIBIDOS)).toBeVisible();
  // CA9: con 0 pendientes no hay contador.
  await expect(enlacePedidosCabecera(page)).toHaveText(/^\s*Pedidos\s*$/);

  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await aLaBandeja(page, cuentas);
  await pestana(page, /^Realizados/).click();
  await expect(page.getByText(VACIO_REALIZADOS)).toBeVisible();
  await boton(page, 'Ir al catálogo').click();
  await expect(page).toHaveURL(/\/catalogo(\?|$)/);
});

test('US-109 · E2E-4 · con 21 pedidos recibidos, dos páginas', async ({ page, request, cuentas }) => {
  test.skip(!(await hayTablaPedidos(db)), 'La tabla pedidos (T32-1) aún no está en esta rama.');
  const tokens = await conApi(request, cuentas);
  for (let i = 0; i < 21; i += 1) {
    const anuncioId = await insertarAnuncio(db, { centro_id: centros.a.id, ...A1 });
    creados.push(anuncioId);
    await insertarPedido(db, { anuncioId, compradorId: centros.b.id, vendedorId: centros.a.id, creado_en: hace(i) });
  }
  const total = await pedidosComo(db, 'vendedor_centro_id', centros.a.id);
  test.skip(total !== 21, `A ya tenía ${total - 21} pedidos recibidos en este entorno.`);

  // CA10 y CA11 por la API.
  const pagina1 = await (await listaPedidos(request, tokens.a, { rol: 'recibidos', pagina: 1 })).json();
  expect(pagina1).toMatchObject({ pagina: 1, total: 21, por_pagina: 20 });
  expect(pagina1.pedidos).toHaveLength(20);
  const pagina2 = await (await listaPedidos(request, tokens.a, { rol: 'recibidos', pagina: 2 })).json();
  expect(pagina2.pedidos).toHaveLength(1);
  const pagina3 = await listaPedidos(request, tokens.a, { rol: 'recibidos', pagina: 3 });
  expect(pagina3.status()).toBe(200);
  expect((await pagina3.json()).pedidos).toEqual([]);

  // CA5 en la web.
  await aLaBandeja(page, cuentas);
  const main = page.getByRole('main');
  await expect(main.getByText(A1.titulo, { exact: true })).toHaveCount(20);
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(main.getByText(A1.titulo, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeEnabled();
});

// ---------------------------------------------------------------- criterios de aceptación

test('US-109 · CA1 y CA2 · pestaña por defecto y cambio sin recargar', async ({ page, request, cuentas }) => {
  await nuevoPedido();
  await conApi(request, cuentas);
  await aLaBandeja(page, cuentas);
  for (const ruta of ['/pedidos', '/pedidos?pestana=otra']) {
    await page.goto(ruta);
    await expect(fila(page, A1.titulo)).toContainText(centros.b.nombre);
  }
  await page.evaluate(() => { globalThis.sinRecargar = true; });
  await pestana(page, /^Realizados/).click();
  await expect(page).toHaveURL(/pestana=realizados/);
  expect(await page.evaluate(() => globalThis.sinRecargar)).toBe(true);
  await expect(fila(page, A1.titulo)).toHaveCount(0);
});

test('US-109 · CA8 · carga y error con «Reintentar»', async ({ page, request, cuentas }) => {
  await nuevoPedido();
  await conApi(request, cuentas);
  await aLaBandeja(page, cuentas);
  let soltar;
  const espera = new Promise((resolver) => { soltar = resolver; });
  let fallar = true;
  await page.route(/\/api\/pedidos\?/, async (ruta) => {
    await espera;
    if (fallar) await ruta.fulfill({ status: 503, json: { error: { code: 'BASE_DATOS_NO_DISPONIBLE', message: 'x' } } });
    else await ruta.continue();
  });
  await page.reload();
  await expect(page.getByText('Cargando…')).toBeVisible();
  soltar();
  await expect(page.getByText('No se ha podido cargar.')).toBeVisible();
  fallar = false;
  await boton(page, 'Reintentar').click();
  await expect(fila(page, A1.titulo)).toContainText(centros.b.nombre);
});

test('US-109 · CA9 · el contador se refresca y pasa de 99 a «99+»', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  await aLaBandeja(page, cuentas);
  // Un pedido nuevo aparece al cargar otra pantalla privada.
  await nuevoPedido();
  const pendientes = await pendientesRecibidos(db, centros.a.id);
  await page.goto('/mis-anuncios');
  await expect(enlacePedidosCabecera(page)).toContainText(String(pendientes));

  await page.route('**/api/pedidos/contador', (ruta) => ruta.fulfill({ json: { recibidos_pendientes: 150 } }));
  await page.goto('/perfil');
  await expect(enlacePedidosCabecera(page)).toContainText('99+');
});

test('US-109 · CA10 · forma de la respuesta y orden', async ({ request, cuentas }) => {
  const { id } = await nuevoPedido({ creado_en: hace(120) });
  const reciente = await nuevoPedido({ creado_en: hace(10) });
  await cambiarEstado(db, reciente.id, 'aceptado');
  const tokens = await conApi(request, cuentas);

  const res = await listaPedidos(request, tokens.a, { rol: 'recibidos', pagina: 1 });
  expect(res.status()).toBe(200);
  const cuerpo = await res.json();
  expect(cuerpo).toMatchObject({ pagina: 1, por_pagina: 20 });
  expect(Object.keys(cuerpo.pedidos[0]).sort()).toEqual([
    'anuncio', 'creado_en', 'estado', 'id', 'modalidad', 'otro_centro', 'pagado_en', 'total_centimos', 'unidades',
  ]);
  const resumen = cuerpo.pedidos.find((p) => p.id === id);
  expect(resumen).toMatchObject({
    anuncio: { titulo: A1.titulo }, otro_centro: { id: centros.b.id, nombre: centros.b.nombre },
    unidades: 4, modalidad: 'venta', total_centimos: 3400, estado: 'pendiente', pagado_en: null,
  });
  expect(Object.keys(resumen.anuncio).sort()).toEqual(['foto_principal_url', 'id', 'titulo']);
  expect(Object.keys(resumen.otro_centro).sort()).toEqual(['id', 'nombre']);

  // CA4: pendientes primero; dentro de cada grupo, del más nuevo al más antiguo.
  const pedidos = cuerpo.pedidos;
  const primerNoPendiente = pedidos.findIndex((p) => p.estado !== 'pendiente');
  if (primerNoPendiente >= 0) expect(pedidos.slice(primerNoPendiente).every((p) => p.estado !== 'pendiente')).toBe(true);
  for (const grupo of [pedidos.filter((p) => p.estado === 'pendiente'), pedidos.filter((p) => p.estado !== 'pendiente')]) {
    const fechas = grupo.map((p) => p.creado_en);
    expect(fechas).toEqual([...fechas].sort().reverse());
  }

  // CA3: el mismo pedido en Realizados de B, con A como otro centro.
  const realizados = await (await listaPedidos(request, tokens.b, { rol: 'realizados' })).json();
  expect(realizados.pedidos.find((p) => p.id === id).otro_centro).toEqual({ id: centros.a.id, nombre: centros.a.nombre });
  expect(realizados.pedidos.some((p) => p.id === reciente.id)).toBe(true);
});

test('US-109 · CA11 · parámetros inválidos', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  for (const query of [{}, { rol: 'todos' }, { rol: '' }]) {
    const error = await errorDe(await listaPedidos(request, tokens.a, query), 400, 'DATOS_INVALIDOS');
    expect(error.details.rol).toBe('Indica recibidos o realizados.');
  }
  for (const pagina of ['0', '-1', '1.5', 'uno']) {
    await errorDe(await listaPedidos(request, tokens.a, { rol: 'recibidos', pagina }), 400, 'DATOS_INVALIDOS');
  }
});

test('US-109 · CA12 · contador de pendientes recibidos', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  test.skip(!(await hayContador(request, tokens.a)), 'GET /api/pedidos/contador (T33-1) aún no está en esta rama.');
  await nuevoPedido();
  const aceptado = await nuevoPedido();
  await cambiarEstado(db, aceptado.id, 'aceptado');
  const res = await contadorPedidos(request, tokens.a);
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ recibidos_pendientes: await pendientesRecibidos(db, centros.a.id) });
  // B es comprador: sus pedidos hechos no cuentan.
  expect(await (await contadorPedidos(request, tokens.b)).json()).toEqual({
    recibidos_pendientes: await pendientesRecibidos(db, centros.b.id),
  });
});

test('US-109 · CA13 · nunca aparecen pedidos de terceros', async ({ request, cuentas }) => {
  const propio = await nuevoPedido();
  // Pedido entre el centro sin confirmar (comprador) y B (vendedor): A no es parte.
  const ajeno = await anuncioConPedido(db, creados, { vendedor: centros.b, comprador: centros.tercero, anuncio: A2 });
  const tokens = await conApi(request, cuentas);
  const ids = [];
  for (const rol of ['recibidos', 'realizados']) {
    const { pedidos } = await (await listaPedidos(request, tokens.a, { rol })).json();
    ids.push(...pedidos.map((p) => p.id));
  }
  expect(ids).toContain(propio.id);
  expect(ids).not.toContain(ajeno.id);
  const { rows } = await db.query(
    'SELECT count(*)::int AS n FROM public.pedidos WHERE id = ANY($1::uuid[]) AND $2::uuid NOT IN (comprador_centro_id, vendedor_centro_id)',
    [ids, centros.a.id],
  );
  expect(rows[0].n).toBe(0);
});

test('US-109 · CA14 · sesión y email confirmado', async ({ request, cuentas }) => {
  await conApi(request, cuentas);
  await errorDe(await listaPedidos(request, null, { rol: 'recibidos' }), 401, 'NO_AUTENTICADO');
  await errorDe(await contadorPedidos(request, null), 401, 'NO_AUTENTICADO');
  const token = await tokenSinConfirmar(request, cuentas);
  test.skip(!token, 'El centro sin confirmar no obtiene token en este entorno.');
  await errorDe(await listaPedidos(request, token, { rol: 'recibidos' }), 403, 'EMAIL_NO_CONFIRMADO');
  await errorDe(await contadorPedidos(request, token), 403, 'EMAIL_NO_CONFIRMADO');
});
