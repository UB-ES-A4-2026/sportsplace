// T65-3 · E2E de US-65 (ver todas mis conversaciones en una bandeja). Casos: docs/especificacion/E05 (US-65).
// Papeles de la base común de E05 (e2e/conversaciones.js): A hace de CNS, B de CEG y el centro sin confirmar de
// EET, que no puede entrar y solo sirve para tener en la BD conversaciones ajenas a B. Las conversaciones se
// insertan en la BD; cada caso borra al acabar las suyas y retira sus anuncios.
// Los casos se omiten mientras no estén en la rama `GET /api/conversaciones` y `/no-leidas` (T65-1, #402),
// `POST /api/conversaciones/:id/leida` (T77-1, de US-77) o la pantalla `/mensajes` (T65-2, #403).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, autorizacion, boton, campoMensaje, datosCentro, esperarError, insertarAnuncio, insertarConversacion,
  limpiarAnuncios, tokenDe,
} from '../conversaciones.js';

const VACIA = 'Todavía no tienes conversaciones. Cuando escribas a un centro desde un anuncio, aparecerá aquí.';
const VACIA_VENDEDOR = 'Nadie te ha escrito todavía sobre tus anuncios.';
const VACIA_COMPRADOR = 'Todavía no has escrito a ningún centro.';
const PAGINA_NO_VALIDA = 'La página debe ser un número mayor que 0.';
const PAGINACION = 'US-65 paginación';

let db;
let centros;
let creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    otro: await datosCentro(db, cuentas.sinConfirmar),
  };
});

test.afterEach(async () => {
  if (db) await limpiarAnuncios(db, creados);
  creados = [];
});

test.afterAll(async () => {
  if (db) await db.close();
});

function listaConversaciones(request, token, query = {}) {
  return request.get(`/api/conversaciones?${new URLSearchParams(query)}`, { headers: autorizacion(token) });
}

function noLeidas(request, token) {
  return request.get('/api/conversaciones/no-leidas', { headers: autorizacion(token) });
}

function marcarLeida(request, token, id) {
  return request.post(`/api/conversaciones/${id}/leida`, { headers: autorizacion(token) });
}

// Tokens de A y B, con el caso omitido si la bandeja de la API aún no está en la rama.
async function conApi(request, cuentas) {
  const tokens = {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
  test.skip((await listaConversaciones(request, tokens.a)).status() !== 200, 'GET /api/conversaciones (T65-1) aún no está en esta rama.');
  test.skip((await noLeidas(request, tokens.a)).status() !== 200, 'GET /api/conversaciones/no-leidas (T65-1) aún no está en esta rama.');
  return tokens;
}

// T65-2: la pantalla `/mensajes` se titula «Mensajes».
async function aLaBandeja(page, email, password) {
  await entrar(page, email, password);
  await page.goto('/mensajes');
  const hay = await page.getByRole('heading', { level: 1, name: 'Mensajes', exact: true })
    .waitFor({ timeout: 5_000 }).then(() => true, () => false);
  test.skip(!hay, 'La pantalla /mensajes (T65-2) aún no está en esta rama.');
}

// Las conversaciones de los centros de prueba son solo las que siembra cada caso (los demás specs borran las
// suyas al acabar). Si quedan otras en este entorno, los recuentos no serían los de la especificación.
async function sinOtrasConversaciones(...ids) {
  const { rows: [{ n }] } = await db.query(
    `SELECT count(*)::int AS n FROM public.conversaciones
     WHERE (centro_comprador_id = ANY($1::uuid[]) OR centro_vendedor_id = ANY($1::uuid[]))
       AND NOT (anuncio_id = ANY($2::uuid[]))`,
    [ids, creados],
  );
  test.skip(n > 0, `Hay ${n} conversaciones de los centros de prueba que no son de este caso.`);
}

async function nuevoAnuncio(centro, cambios = {}) {
  const id = await insertarAnuncio(db, { centro_id: centro.id, ...cambios });
  creados.push(id);
  return id;
}

async function marcarLeidaEnBd(conversacionId, rol) {
  await db.query(`UPDATE public.conversaciones SET leida_hasta_${rol} = now() WHERE id = $1`, [conversacionId]);
}

async function leidaHasta(conversacionId, rol) {
  const { rows: [fila] } = await db.query(`SELECT leida_hasta_${rol} AS leida FROM public.conversaciones WHERE id = $1`, [conversacionId]);
  return fila.leida;
}

function enlaceMensajesCabecera(page) {
  return page.getByRole('banner').getByRole('link', { name: /^Mensajes/ });
}

function pestana(page, nombre) {
  return page.getByRole('tab', { name: nombre, exact: true })
    .or(page.getByRole('button', { name: nombre, exact: true }))
    .or(page.getByRole('link', { name: nombre, exact: true }));
}

function fila(page, texto) {
  const main = page.getByRole('main');
  return main.getByRole('row').or(main.getByRole('listitem')).or(main.getByRole('article')).filter({ hasText: texto });
}

// CA5 y pantalla: el nombre del otro centro va en negrita si la conversación está sin leer.
async function enNegrita(page, textoFila, nombre) {
  const peso = await fila(page, textoFila).getByText(nombre, { exact: true }).first()
    .evaluate((elemento) => Number.parseInt(elemento.ownerDocument.defaultView.getComputedStyle(elemento).fontWeight, 10));
  return peso >= 600;
}

// ---------------------------------------------------------------- flujos e2e

test('US-65 · E2E-1 · camino feliz: contador, orden, negrita y leída al abrir', async ({ page, request, cuentas }) => {
  const a1 = await nuevoAnuncio(centros.a);
  const a2 = await nuevoAnuncio(centros.a, A2);
  const tokens = await conApi(request, cuentas);
  await sinOtrasConversaciones(centros.a.id);

  // 1) A tiene C1 (A1 con B) y C2 (A2 con el tercero, ya leída); B escribe un mensaje nuevo en C1.
  const c2 = await insertarConversacion(db, {
    anuncioId: a2, comprador: centros.otro, vendedor: centros.a, mensajes: [{ autor: centros.otro, texto: '¿Siguen disponibles?' }],
  });
  await marcarLeidaEnBd(c2, 'vendedor');
  const c1 = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.b, vendedor: centros.a, mensajes: [{ autor: centros.b, texto: 'Hola, ¿los balones están bien?' }],
  });
  await marcarLeidaEnBd(c1, 'vendedor');
  const nuevo = 'Hola, ¿podemos recogerlos el sábado?';
  expect((await request.post(`/api/conversaciones/${c1}/mensajes`, { headers: autorizacion(tokens.b), data: { texto: nuevo } })).status()).toBe(201);

  // CA13: una conversación sin leer.
  expect(await (await noLeidas(request, tokens.a)).json()).toEqual({ total: 1 });

  // 2) CA1 y CA7: «Mensajes (1)» en la cabecera, que lleva a /mensajes.
  await aLaBandeja(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil');
  const enlace = enlaceMensajesCabecera(page);
  await expect(enlace).toContainText('1');
  await enlace.click();
  await expect(page).toHaveURL(/\/mensajes$/);

  // 3) CA4 y CA5: C1 primera y en negrita; C2 segunda y en normal.
  await expect(fila(page, A1.titulo)).toContainText(centros.b.nombre);
  await expect(fila(page, A1.titulo)).toContainText(nuevo);
  await expect(fila(page, A2.titulo)).toContainText(centros.otro.nombre);
  const texto = await page.getByRole('main').innerText();
  expect(texto.indexOf(A1.titulo)).toBeGreaterThanOrEqual(0);
  expect(texto.indexOf(A1.titulo)).toBeLessThan(texto.indexOf(A2.titulo));
  expect(await enNegrita(page, A1.titulo, centros.b.nombre)).toBe(true);
  expect(await enNegrita(page, A2.titulo, centros.otro.nombre)).toBe(false);

  // 4) CA2 y CA6: la fila abre C1 y la marca como leída para el vendedor; al volver, la burbuja ha desaparecido.
  const antes = Date.now();
  await fila(page, A1.titulo).click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(new RegExp(`/mensajes/${c1}$`));
  await expect(page.getByText(nuevo, { exact: true })).toBeVisible();
  await expect.poll(async () => (await leidaHasta(c1, 'vendedor'))?.getTime() ?? 0).toBeGreaterThanOrEqual(antes - 5_000);
  await page.getByRole('link', { name: '← Mensajes' }).click();
  await expect(page).toHaveURL(/\/mensajes$/);
  await expect(enlace).toHaveText(/^\s*Mensajes\s*$/);
  expect(await (await noLeidas(request, tokens.a)).json()).toEqual({ total: 0 });
});

test('US-65 · E2E-2 · pestañas «Como comprador» y «Como vendedor»', async ({ page, request, cuentas }) => {
  const a1 = await nuevoAnuncio(centros.a);
  const b1 = await nuevoAnuncio(centros.b, { titulo: 'Petos de entrenamiento talla M' });
  const a2 = await nuevoAnuncio(centros.a, A2);
  const tokens = await conApi(request, cuentas);
  await sinOtrasConversaciones(centros.b.id);

  // B tiene C1 como comprador (A1) y C3 como vendedor (B1). C2 es de A con el tercero: nunca aparece para B.
  const c1 = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.b, vendedor: centros.a, mensajes: [{ autor: centros.b, texto: 'Pregunta de B' }],
  });
  const c3 = await insertarConversacion(db, {
    anuncioId: b1, comprador: centros.a, vendedor: centros.b, mensajes: [{ autor: centros.a, texto: 'Pregunta de A' }],
  });
  await insertarConversacion(db, {
    anuncioId: a2, comprador: centros.otro, vendedor: centros.a, mensajes: [{ autor: centros.otro, texto: 'Pregunta del tercero' }],
  });

  // CA11 y CA16 en la API.
  const ids = async (query) => (await (await listaConversaciones(request, tokens.b, query)).json()).conversaciones.map((c) => c.id);
  expect(await ids({ rol: 'comprador' })).toEqual([c1]);
  expect(await ids({ rol: 'vendedor' })).toEqual([c3]);
  expect((await ids({ rol: 'todas' })).sort()).toEqual([c1, c3].sort());
  // CA3: un rol desconocido se trata como «Todas».
  expect((await ids({ rol: 'otro' })).sort()).toEqual([c1, c3].sort());

  // CA3 en la web: las pestañas cambian la URL y filtran.
  await aLaBandeja(page, cuentas.centroB, cuentas.password);
  await pestana(page, 'Como comprador').click();
  await expect(page).toHaveURL(/\/mensajes\?rol=comprador$/);
  await expect(fila(page, A1.titulo)).toBeVisible();
  await expect(fila(page, 'Petos de entrenamiento talla M')).toHaveCount(0);

  await pestana(page, 'Como vendedor').click();
  await expect(page).toHaveURL(/\/mensajes\?rol=vendedor$/);
  await expect(fila(page, 'Petos de entrenamiento talla M')).toBeVisible();
  await expect(fila(page, A1.titulo)).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(A2.titulo);

  await pestana(page, 'Todas').click();
  await expect(page).toHaveURL(/\/mensajes$/);
  await expect(fila(page, A1.titulo)).toBeVisible();
  await expect(fila(page, 'Petos de entrenamiento talla M')).toBeVisible();
});

test('US-65 · E2E-3 · paginación de 20 en 20', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  await sinOtrasConversaciones(centros.a.id);

  // 25 conversaciones de A como vendedor, cada una en su anuncio.
  for (let i = 1; i <= 25; i += 1) {
    const anuncioId = await nuevoAnuncio(centros.a, { titulo: `${PAGINACION} ${String(i).padStart(2, '0')}` });
    await insertarConversacion(db, {
      anuncioId, comprador: centros.b, vendedor: centros.a, mensajes: [{ autor: centros.b, texto: `Mensaje ${i}` }],
    });
  }

  // CA11: página 1 con 20, página 2 con 5; CA12: más allá de la última, lista vacía.
  const pagina1 = await (await listaConversaciones(request, tokens.a, { pagina: '1' })).json();
  expect(pagina1).toMatchObject({ pagina: 1, total: 25, por_pagina: 20 });
  expect(pagina1.conversaciones).toHaveLength(20);
  expect(Object.keys(pagina1.conversaciones[0]).sort())
    .toEqual(['anuncio', 'id', 'otro_centro', 'sin_leer', 'soy', 'ultimo_mensaje']);
  expect(pagina1.conversaciones[0]).toMatchObject({
    soy: 'vendedor', sin_leer: true,
    otro_centro: { id: centros.b.id, nombre: centros.b.nombre, eliminado: false },
    ultimo_mensaje: { es_mio: false },
  });
  const pagina2 = await (await listaConversaciones(request, tokens.a, { pagina: '2' })).json();
  expect(pagina2.conversaciones).toHaveLength(5);
  // CA4: orden por último mensaje descendente, sin repetir entre páginas.
  const todas = [...pagina1.conversaciones, ...pagina2.conversaciones];
  expect(new Set(todas.map((c) => c.id)).size).toBe(25);
  const fechas = todas.map((c) => c.ultimo_mensaje.creado_en);
  expect(fechas).toEqual([...fechas].sort().reverse());
  expect((await (await listaConversaciones(request, tokens.a, { pagina: '3' })).json()).conversaciones).toEqual([]);

  // 2) CA12: página no válida.
  for (const pagina of ['0', '-1', 'abc']) {
    const error = await esperarError(await listaConversaciones(request, tokens.a, { pagina }), 400, 'DATOS_INVALIDOS');
    expect(error.details.pagina).toBe(PAGINA_NO_VALIDA);
  }

  // 1) En la web: 20 filas y «Siguiente»; en la 2, 5 filas y «Anterior».
  await aLaBandeja(page, cuentas.centroA, cuentas.password);
  await expect(fila(page, PAGINACION)).toHaveCount(20);
  await boton(page, 'Siguiente').or(page.getByRole('link', { name: 'Siguiente', exact: true })).click();
  await expect(page).toHaveURL(/pagina=2/);
  await expect(fila(page, PAGINACION)).toHaveCount(5);
  await expect(boton(page, 'Anterior').or(page.getByRole('link', { name: 'Anterior', exact: true }))).toBeVisible();

  // CA2: «← Mensajes» de la conversación vuelve a la misma página.
  await fila(page, PAGINACION).first().click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(/\/mensajes\/[0-9a-f-]{36}$/);
  await page.getByRole('link', { name: '← Mensajes' }).click();
  await expect(page).toHaveURL(/\/mensajes\?.*pagina=2/);
});

test('US-65 · E2E-4 · mis mensajes no la ponen como no leída', async ({ page, request, cuentas }) => {
  const a1 = await nuevoAnuncio(centros.a);
  const tokens = await conApi(request, cuentas);
  await sinOtrasConversaciones(centros.b.id);

  // C1 con la pregunta de B y la respuesta de A, ya leída por B.
  const c1 = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.b, vendedor: centros.a,
    mensajes: [{ autor: centros.b, texto: '¿Están revisados?' }, { autor: centros.a, texto: 'Sí, todos.' }],
  });
  await marcarLeidaEnBd(c1, 'comprador');

  // 1) B envía un mensaje en C1 y vuelve a /mensajes.
  await aLaBandeja(page, cuentas.centroB, cuentas.password);
  await fila(page, A1.titulo).click({ position: { x: 5, y: 5 } });
  await expect(page).toHaveURL(new RegExp(`/mensajes/${c1}$`));
  const mio = 'Perfecto, pasamos el sábado.';
  await campoMensaje(page).fill(mio);
  await boton(page, 'Enviar').click();
  await expect(page.getByText(mio, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← Mensajes' }).click();

  // CA5: para B, C1 no está en negrita ni cuenta como no leída, y el resumen lleva «Tú: ».
  await expect(fila(page, A1.titulo)).toContainText(`Tú: ${mio}`);
  expect(await enNegrita(page, A1.titulo, centros.a.nombre)).toBe(false);
  await expect(enlaceMensajesCabecera(page)).toHaveText(/^\s*Mensajes\s*$/);
  const deB = (await (await listaConversaciones(request, tokens.b)).json()).conversaciones.find((c) => c.id === c1);
  expect(deB).toMatchObject({ soy: 'comprador', sin_leer: false, ultimo_mensaje: { es_mio: true } });
  // Para A, en cambio, sí está sin leer.
  const deA = (await (await listaConversaciones(request, tokens.a)).json()).conversaciones.find((c) => c.id === c1);
  expect(deA).toMatchObject({ soy: 'vendedor', sin_leer: true, ultimo_mensaje: { es_mio: false } });
});

test('US-65 · E2E-5 · bandeja vacía', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  await sinOtrasConversaciones(centros.b.id);

  // CA11 y CA13 sin conversaciones.
  expect(await (await listaConversaciones(request, tokens.b)).json())
    .toEqual({ conversaciones: [], pagina: 1, total: 0, por_pagina: 20 });
  expect(await (await noLeidas(request, tokens.b)).json()).toEqual({ total: 0 });

  // Pantalla vacía con «Ir al catálogo»; CA10, textos de las pestañas vacías; CA7, sin burbuja con 0.
  await aLaBandeja(page, cuentas.centroB, cuentas.password);
  await expect(page.getByText(VACIA)).toBeVisible();
  await expect(enlaceMensajesCabecera(page)).toHaveText(/^\s*Mensajes\s*$/);
  await pestana(page, 'Como vendedor').click();
  await expect(page.getByText(VACIA_VENDEDOR)).toBeVisible();
  await pestana(page, 'Como comprador').click();
  await expect(page.getByText(VACIA_COMPRADOR)).toBeVisible();
  await pestana(page, 'Todas').click();
  await boton(page, 'Ir al catálogo').or(page.getByRole('link', { name: 'Ir al catálogo', exact: true })).click();
  await expect(page).toHaveURL(/\/catalogo(\?|$)/);
});

// ---------------------------------------------------------------- API

test('US-65 · CA14 · marcar leída: 204 para mi centro y 404 para otro', async ({ request, cuentas }) => {
  const a1 = await nuevoAnuncio(centros.a);
  const a2 = await nuevoAnuncio(centros.a, A2);
  const tokens = await conApi(request, cuentas);
  const c1 = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.b, vendedor: centros.a, mensajes: [{ autor: centros.b, texto: 'Hola' }],
  });
  const ajena = await insertarConversacion(db, {
    anuncioId: a2, comprador: centros.otro, vendedor: centros.a, mensajes: [{ autor: centros.otro, texto: 'Hola' }],
  });
  const res = await marcarLeida(request, tokens.a, c1);
  test.skip([404, 405].includes(res.status()), 'POST /api/conversaciones/:id/leida (T77-1) aún no está en esta rama.');
  expect(res.status()).toBe(204);
  expect(await leidaHasta(c1, 'vendedor')).not.toBeNull();
  // Solo cambia la lectura de mi centro.
  expect(await leidaHasta(c1, 'comprador')).toBeNull();
  await esperarError(await marcarLeida(request, tokens.b, ajena), 404, 'NO_ENCONTRADO');
  expect(await leidaHasta(ajena, 'comprador')).toBeNull();
});

test('US-65 · sin sesión, la bandeja y el contador responden 401 NO_AUTENTICADO', async ({ request }) => {
  await esperarError(await request.get('/api/conversaciones'), 401, 'NO_AUTENTICADO');
  await esperarError(await request.get('/api/conversaciones/no-leidas'), 401, 'NO_AUTENTICADO');
});
