// T32-6 · E2E de US-40 (elegir al pedir si recojo o me lo envían, y la dirección de envío).
// Casos: docs/especificacion/E07-E09 (US-40). En el S2 va dentro de US-32, sobre el mismo formulario.
// A vende y B pide; el centro sin confirmar hace de tercero en el pedido ajeno. Cada caso parte de las
// direcciones de la historia (A en «Carrer de l'Estadi 40», B en «Carrer de Verdi 12») y al acabar se deja
// la ubicación de los dos centros como estaba en la semilla.
// Los casos se omiten mientras no estén en la rama las columnas de entrega (T32-1), su validación en
// `POST /api/pedidos` y el objeto `entrega` del detalle (T32-2), el bloque «Entrega» del formulario (T32-4)
// o la sección «Entrega» de `/pedidos/:id` (T32-5).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, DIRECCION, boton, campoUnidades, columnasDe, contarEnvios, cuerpoPedido, datosCentro, getPedido,
  hayFormularioPedir, hayGetPedido, hayPantallaPedido, hayPostPedidos, hayTablaPedidos, idDeUrl, insertarAnuncio,
  insertarPedido, pedidosDe, postPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';

const UBICACION = ['direccion', 'codigo_postal', 'localidad', 'provincia', 'telefono'];
const DATOS_A = { direccion: "Carrer de l'Estadi 40", codigo_postal: '08038', localidad: 'Barcelona', provincia: 'Barcelona', telefono: null };
const DATOS_B = { direccion: 'Carrer de Verdi 12', codigo_postal: '08012', localidad: 'Barcelona', provincia: 'Barcelona', telefono: '612345678' };

const ELIGE = 'Elige cómo quieres recibir el material.';
const CP_PROVINCIA = 'El código postal no corresponde a la provincia elegida.';
const TELEFONO = 'Introduce un teléfono español de 9 cifras.';
const ESPERA_RECOGIDA = 'Verás la dirección de recogida cuando el vendedor acepte el pedido.';
const SIN_DIRECCION = 'El vendedor aún no ha indicado su dirección. Escríbele para acordarla.';
const RECOGIDA_A = /Dirección de recogida:?\s*Carrer de l'Estadi 40, 08038 Barcelona/;

let db;
let centros;
let columnas = new Set();
const originales = {};
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    tercero: await datosCentro(db, cuentas.sinConfirmar),
  };
  for (const clave of ['a', 'b']) {
    const { rows } = await db.query(`SELECT ${UBICACION.join(', ')} FROM public.centros WHERE id = $1`, [centros[clave].id]);
    originales[clave] = rows[0];
  }
  if (await hayTablaPedidos(db)) columnas = await columnasDe(db, 'pedidos');
});

test.beforeEach(async () => {
  await ponerUbicacion(centros.a.id, DATOS_A);
  await ponerUbicacion(centros.b.id, DATOS_B);
});

test.afterAll(async () => {
  if (!db) return;
  await retirarAnuncios(db, creados);
  if (centros) {
    await ponerUbicacion(centros.a.id, originales.a);
    await ponerUbicacion(centros.b.id, originales.b);
  }
  await db.close();
});

// ---------------------------------------------------------------- utilidades

async function ponerUbicacion(id, datos) {
  await db.query(
    `UPDATE public.centros SET ${UBICACION.map((campo, i) => `${campo} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...UBICACION.map((campo) => datos[campo] ?? null)],
  );
}

async function nuevoAnuncio(cambios = {}) {
  const id = await insertarAnuncio(db, { centro_id: centros.a.id, ...cambios });
  creados.push(id);
  return id;
}

async function borrarPedidos(anuncioId) {
  await db.query('DELETE FROM public.pedidos WHERE anuncio_id = $1', [anuncioId]);
}

function envio(cambios = {}) {
  return { metodo_entrega: 'envio', direccion_envio: { ...DIRECCION, ...cambios } };
}

async function conApi(request, cuentas) {
  test.skip(!columnas.has('metodo_entrega'), 'Las columnas de entrega de pedidos (T32-1) aún no están en esta rama.');
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  test.skip(!(await hayPostPedidos(request, token)), 'POST /api/pedidos (T32-2) aún no está en esta rama.');
  return token;
}

// Con T32-2 el detalle trae `entrega`; antes solo hay `metodo_entrega` suelto (T32-3).
async function entregaDe(request, token, id) {
  test.skip(!(await hayGetPedido(request)), 'GET /api/pedidos/:id (T32-3) aún no está en esta rama.');
  const res = await getPedido(request, token, id);
  expect(res.status()).toBe(200);
  const { pedido } = await res.json();
  test.skip(!('entrega' in pedido), 'El objeto entrega de GET /api/pedidos/:id (T32-2) aún no está en esta rama.');
  return pedido.entrega;
}

async function nuevoPedido(cambios = {}) {
  test.skip(!columnas.has('metodo_entrega'), 'Las columnas de entrega de pedidos (T32-1) aún no están en esta rama.');
  const anuncioId = await nuevoAnuncio();
  const id = await insertarPedido(db, { anuncioId, compradorId: centros.b.id, vendedorId: centros.a.id, ...cambios });
  return { id, anuncioId };
}

async function alFormulario(page, cuentas, anuncioId) {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayFormularioPedir(page, anuncioId)), 'El formulario /anuncios/:id/pedir (T32-4) aún no está en esta rama.');
  test.skip(!(await opcionEnvio(page).count()), 'El bloque «Entrega» del formulario (T32-4) aún no está en esta rama.');
}

async function alPedido(page, cuentas, id, email = cuentas.centroB) {
  await entrar(page, email, cuentas.password);
  test.skip(!(await hayPantallaPedido(page, id)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
  test.skip(!(await page.getByText(/^Método:/).count()), 'La sección «Entrega» de /pedidos/:id (T32-5) aún no está en esta rama.');
}

function opcionEnvio(page) {
  return page.getByRole('radio', { name: 'Que me lo envíen' });
}

function opcionRecogida(page) {
  return page.getByRole('radio', { name: 'Paso a recogerlo' });
}

function campo(page, etiqueta) {
  return page.getByLabel(etiqueta, { exact: true });
}

async function elegirPago(page) {
  const transferencia = page.getByRole('radio', { name: 'Transferencia bancaria' });
  if (await transferencia.count()) await transferencia.check();
}

// ---------------------------------------------------------------- flujos e2e

test('US-40 · E2E-1 · envío con la dirección del centro prerrellenada', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  const main = page.getByRole('main');

  // Bloque «Entrega»: nada marcado y el texto fijo.
  await expect(main.getByText('Entrega', { exact: true }).first()).toBeVisible();
  await expect(opcionEnvio(page)).not.toBeChecked();
  await expect(opcionRecogida(page)).not.toBeChecked();
  await expect(main.getByText('El coste y la forma del envío los acordáis entre los dos centros.')).toBeVisible();
  // CA2: sin envío no hay campos de dirección.
  await expect(campo(page, 'Código postal')).toHaveCount(0);

  await campoUnidades(page).fill('4');
  await elegirPago(page);
  await opcionEnvio(page).check();
  // CA3: prerrelleno con los datos del centro; persona y provincia vacías.
  await expect(campo(page, 'Persona de contacto')).toHaveValue('');
  await expect(campo(page, 'Dirección')).toHaveValue('Carrer de Verdi 12');
  await expect(campo(page, 'Código postal')).toHaveValue('08012');
  await expect(campo(page, 'Localidad')).toHaveValue('Barcelona');
  await expect(campo(page, 'Teléfono de contacto')).toHaveValue('612345678');
  await expect(campo(page, 'Provincia')).toHaveValue('');

  await campo(page, 'Persona de contacto').fill('Marta Puig');
  await campo(page, 'Provincia').selectOption('Barcelona');
  await campo(page, 'Indicaciones para la entrega (opcional)').fill('Entrada por el pabellón');
  await boton(page, 'Enviar pedido').click();

  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
  const pedidoId = idDeUrl(page);
  const [pedido] = await pedidosDe(db, a1);
  expect(pedido.metodo_entrega).toBe('envio');
  expect(pedido.direccion_envio).toMatchObject({
    destinatario: 'Marta Puig', calle_numero: 'Carrer de Verdi 12', piso_puerta: null, codigo_postal: '08012',
    localidad: 'Barcelona', provincia: 'Barcelona', telefono_contacto: '612345678', indicaciones: 'Entrada por el pabellón',
  });
  // CA3: el perfil del centro no cambia.
  const { rows: [perfil] } = await db.query('SELECT direccion, telefono FROM public.centros WHERE id = $1', [centros.b.id]);
  expect(perfil).toEqual({ direccion: DATOS_B.direccion, telefono: DATOS_B.telefono });

  // Detalle para el comprador y para el vendedor.
  test.skip(!(await hayPantallaPedido(page, pedidoId)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
  const lineas = ['Marta Puig', 'Carrer de Verdi 12', /08012 Barcelona \(Barcelona\)/, '612345678', /Indicaciones:\s*Entrada por el pabellón/];
  await expect(main.getByText('Método: Envío a tu dirección')).toBeVisible();
  for (const linea of lineas) await expect(main.getByText(linea).first()).toBeVisible();
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/pedidos/${pedidoId}`);
  await expect(main.getByText('Método: Envío a la dirección del comprador')).toBeVisible();
  for (const linea of lineas) await expect(main.getByText(linea).first()).toBeVisible();
});

test('US-40 · E2E-2 · recogida: la dirección del vendedor sale al aceptar', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  await elegirPago(page);
  await opcionRecogida(page).check();
  await boton(page, 'Enviar pedido').click();
  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
  const pedidoId = idDeUrl(page);
  const [pedido] = await pedidosDe(db, a1);
  expect(pedido).toMatchObject({ metodo_entrega: 'recogida', direccion_envio: null });

  test.skip(!(await hayPantallaPedido(page, pedidoId)), 'La pantalla /pedidos/:id (T32-5) aún no está en esta rama.');
  const main = page.getByRole('main');
  await expect(main.getByText('Método: Recogida en el centro vendedor')).toBeVisible();
  await expect(main.getByText(ESPERA_RECOGIDA)).toBeVisible();
  await expect(main.getByText(RECOGIDA_A)).toHaveCount(0);

  // A acepta (US-33 llega por su story: aquí se pasa a aceptado en la BD).
  await db.query("UPDATE public.pedidos SET estado = 'aceptado', respondido_en = now() WHERE id = $1", [pedidoId]);
  await page.reload();
  await expect(main.getByText(RECOGIDA_A)).toBeVisible();
  await expect(main.getByText(ESPERA_RECOGIDA)).toHaveCount(0);
});

test('US-40 · E2E-3 · validación de CP, provincia y teléfono en la web', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await alFormulario(page, cuentas, a1);
  await elegirPago(page);
  await opcionEnvio(page).check();
  await campo(page, 'Persona de contacto').fill('Marta Puig');
  await campo(page, 'Provincia').selectOption('Girona');
  const envios = contarEnvios(page);

  // CA10: el error sale bajo el CP.
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText(CP_PROVINCIA)).toBeVisible();
  await campo(page, 'Provincia').selectOption('Barcelona');
  await expect(page.getByText(CP_PROVINCIA)).toHaveCount(0);

  // CA11.
  await campo(page, 'Teléfono de contacto').fill('512345678');
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText(TELEFONO)).toBeVisible();
  expect(envios).toHaveLength(0);
  expect(await pedidosDe(db, a1)).toHaveLength(0);
});

test('US-40 · E2E-4 · sin método no se envía y la API responde 400', async ({ page, request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();

  // CA1 en la API: ausente o con otro valor.
  for (const metodo of [undefined, 'mensajero']) {
    const res = await postPedido(request, token, { ...cuerpoPedido(a1, { columnas }), metodo_entrega: metodo });
    expect(res.status(), String(metodo)).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details.metodo_entrega).toBe(ELIGE);
  }

  // CA1 en la web.
  await alFormulario(page, cuentas, a1);
  await elegirPago(page);
  const envios = contarEnvios(page);
  await boton(page, 'Enviar pedido').click();
  await expect(page.getByText(ELIGE)).toBeVisible();
  expect(envios).toHaveLength(0);
  expect(await pedidosDe(db, a1)).toHaveLength(0);
});

test('US-40 · E2E-5 · vendedor sin dirección', async ({ page, request, cuentas }) => {
  const { id } = await nuevoPedido({ estado: 'aceptado', respondido_en: new Date().toISOString() });
  await ponerUbicacion(centros.a.id, { ...DATOS_A, direccion: null });

  // CA14 en la API: con el pedido aceptado no hay dirección que dar.
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  if (await hayGetPedido(request)) {
    const res = await getPedido(request, token, id);
    const { pedido } = await res.json();
    if ('entrega' in pedido) expect(pedido.entrega.direccion_recogida ?? null).toBeNull();
  }

  await alPedido(page, cuentas, id);
  await expect(page.getByRole('main').getByText(SIN_DIRECCION)).toBeVisible();
  await expect(page.getByRole('main').getByText(RECOGIDA_A)).toHaveCount(0);
});

// ---------------------------------------------------------------- resto de CA

test('US-40 · CA2 · con recogida la API ignora la dirección', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const res = await postPedido(request, token, cuerpoPedido(a1, {
    columnas, metodo_entrega: 'recogida', direccion_envio: { ...DIRECCION, codigo_postal: 'no vale' },
  }));
  expect(res.status()).toBe(201);
  expect((await pedidosDe(db, a1))[0]).toMatchObject({ metodo_entrega: 'recogida', direccion_envio: null });
});

test('US-40 · CA4 a CA12 y CA19 · límites de cada campo de la dirección', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const x = (n) => 'x'.repeat(n);
  const calle = (n) => `C ${'x'.repeat(n - 2)}`;
  const mensajes = {
    destinatario: 'Indica la persona de contacto (entre 2 y 100 caracteres).',
    calle_numero: 'Indica la calle y el número (entre 5 y 150 caracteres).',
    piso_puerta: 'Máximo 50 caracteres.',
    codigo_postal: 'Introduce un código postal español de 5 cifras.',
    localidad: 'Indica la localidad (entre 2 y 120 caracteres).',
    provincia: 'Elige una provincia.',
    telefono_contacto: TELEFONO,
    indicaciones: 'Máximo 300 caracteres.',
  };
  const validos = [
    { destinatario: 'MP' }, { destinatario: x(100) },
    { calle_numero: calle(5) }, { calle_numero: calle(150) },
    { piso_puerta: x(50) },
    { codigo_postal: '52001', provincia: 'Melilla' },
    { localidad: 'Ea' }, { localidad: x(120) },
    { indicaciones: x(300) },
  ];
  const invalidos = [
    [{ destinatario: 'M' }, 'destinatario'], [{ destinatario: x(101) }, 'destinatario'], [{ destinatario: undefined }, 'destinatario'],
    [{ calle_numero: calle(4) }, 'calle_numero'], [{ calle_numero: calle(151) }, 'calle_numero'],
    [{ piso_puerta: x(51) }, 'piso_puerta'],
    [{ codigo_postal: '8012' }, 'codigo_postal'], [{ codigo_postal: '00123' }, 'codigo_postal'],
    [{ codigo_postal: '53001' }, 'codigo_postal'], [{ codigo_postal: '08A12' }, 'codigo_postal'],
    [{ localidad: 'B' }, 'localidad'], [{ localidad: x(121) }, 'localidad'],
    [{ provincia: 'Barna' }, 'provincia'], [{ provincia: undefined }, 'provincia'],
    [{ telefono_contacto: '512345678' }, 'telefono_contacto'], [{ telefono_contacto: '61234567' }, 'telefono_contacto'],
    [{ indicaciones: x(301) }, 'indicaciones'],
  ];

  for (const cambios of validos) {
    const res = await postPedido(request, token, cuerpoPedido(a1, { columnas, ...envio(cambios) }));
    expect(res.status(), JSON.stringify(cambios).slice(0, 80)).toBe(201);
    await borrarPedidos(a1);
  }
  for (const [cambios, clave] of invalidos) {
    const res = await postPedido(request, token, cuerpoPedido(a1, { columnas, ...envio(cambios) }));
    expect(res.status(), JSON.stringify(cambios).slice(0, 80)).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('DATOS_INVALIDOS');
    expect(error.details[`direccion_envio.${clave}`]).toBe(mensajes[clave]);
  }
  // CA10: CP de otra provincia, error en el CP.
  const cruzado = await postPedido(request, token, cuerpoPedido(a1, { columnas, ...envio({ provincia: 'Girona' }) }));
  expect(cruzado.status()).toBe(400);
  expect((await cruzado.json()).error.details['direccion_envio.codigo_postal']).toBe(CP_PROVINCIA);
  expect(await pedidosDe(db, a1)).toHaveLength(0);

  // CA6 y CA11: piso vacío se guarda null y el teléfono sin espacios.
  const res = await postPedido(request, token, cuerpoPedido(a1, {
    columnas, ...envio({ piso_puerta: '', telefono_contacto: '612 345 678' }),
  }));
  expect(res.status()).toBe(201);
  expect((await pedidosDe(db, a1))[0].direccion_envio).toMatchObject({ piso_puerta: null, telefono_contacto: '612345678' });
});

test('US-40 · CA13 · la dirección se copia en el pedido', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const { pedido } = await (await postPedido(request, token, cuerpoPedido(a1, { columnas, ...envio() }))).json();
  await ponerUbicacion(centros.b.id, { ...DATOS_B, direccion: 'Carrer Gran de Gràcia 100', telefono: '699999999' });
  expect((await pedidosDe(db, a1))[0].direccion_envio).toMatchObject({ calle_numero: DIRECCION.calle_numero, telefono_contacto: '612345678' });
  const entrega = await entregaDe(request, token, pedido.id);
  expect(entrega).toMatchObject({ metodo: 'envio', direccion_envio: { calle_numero: DIRECCION.calle_numero } });
});

test('US-40 · CA14, CA15, CA16 y CA20 · quién ve cada dirección según el estado', async ({ request, cuentas }) => {
  test.skip(!columnas.has('metodo_entrega'), 'Las columnas de entrega de pedidos (T32-1) aún no están en esta rama.');
  const tokens = {
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
  };
  const recogidaA = { direccion: DATOS_A.direccion, codigo_postal: DATOS_A.codigo_postal, localidad: DATOS_A.localidad };
  const estados = [
    [{ estado: 'pendiente' }, false],
    [{ estado: 'aceptado', respondido_en: new Date().toISOString() }, true],
    [{ estado: 'recibido', respondido_en: new Date().toISOString() }, true],
    [{ estado: 'rechazado', respondido_en: new Date().toISOString(), cerrado_por: 'vendedor', motivo_codigo: 'sin_unidades' }, false],
    [{ estado: 'cancelado', cancelado_en: new Date().toISOString(), cerrado_por: 'comprador', motivo_codigo: 'ya_no_necesario' }, false],
  ];
  for (const [cambios, ve] of estados) {
    const { id } = await nuevoPedido({ metodo_entrega: 'recogida', ...cambios });
    const comprador = await entregaDe(request, tokens.b, id);
    expect(comprador.metodo, cambios.estado).toBe('recogida');
    if (ve) expect(comprador.direccion_recogida, cambios.estado).toMatchObject(recogidaA);
    else expect(comprador.direccion_recogida, cambios.estado).toBeNull();
    // CA20: el vendedor nunca recibe la dirección de recogida (es la suya).
    expect((await entregaDe(request, tokens.a, id)).direccion_recogida, cambios.estado).toBeNull();

    // CA16: el vendedor ve la dirección de envío en cualquier estado.
    const conEnvio = await nuevoPedido({ ...cambios, ...envio() });
    expect((await entregaDe(request, tokens.a, conEnvio.id)).direccion_envio, cambios.estado).toMatchObject({
      destinatario: DIRECCION.destinatario, codigo_postal: DIRECCION.codigo_postal,
    });
  }
  // CA14: la dirección de recogida se lee al mostrarla.
  const { id } = await nuevoPedido({ metodo_entrega: 'recogida', estado: 'aceptado', respondido_en: new Date().toISOString() });
  await ponerUbicacion(centros.a.id, { ...DATOS_A, direccion: 'Carrer de Numància 10' });
  expect((await entregaDe(request, tokens.b, id)).direccion_recogida).toMatchObject({ direccion: 'Carrer de Numància 10' });
});

test('US-40 · CA15 y CA16 · textos de la sección «Entrega» según el estado', async ({ page, cuentas }) => {
  const pendiente = await nuevoPedido({ metodo_entrega: 'recogida' });
  await alPedido(page, cuentas, pendiente.id);
  const main = page.getByRole('main');
  await expect(main.getByText(ESPERA_RECOGIDA)).toBeVisible();

  for (const cambios of [
    { estado: 'rechazado', respondido_en: new Date().toISOString(), cerrado_por: 'vendedor', motivo_codigo: 'sin_unidades' },
    { estado: 'cancelado', cancelado_en: new Date().toISOString(), cerrado_por: 'comprador', motivo_codigo: 'ya_no_necesario' },
  ]) {
    const { id } = await nuevoPedido({ metodo_entrega: 'recogida', ...cambios });
    await page.goto(`/pedidos/${id}`);
    await expect(main.getByText(/^Método:/)).toBeVisible();
    await expect(main.getByText(RECOGIDA_A)).toHaveCount(0);
    await expect(main.getByText(ESPERA_RECOGIDA)).toHaveCount(0);
  }

  // CA16: el vendedor ve la dirección de envío con el pedido pendiente.
  const conEnvio = await nuevoPedido(envio());
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/pedidos/${conEnvio.id}`);
  await expect(main.getByText('Método: Envío a la dirección del comprador')).toBeVisible();
  await expect(main.getByText(DIRECCION.destinatario)).toBeVisible();
  await expect(main.getByText(/08012 Barcelona \(Barcelona\)/)).toBeVisible();
});

test('US-40 · CA17 · el método y la dirección no se cambian después', async ({ request, cuentas }) => {
  const token = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const { pedido } = await (await postPedido(request, token, cuerpoPedido(a1, { columnas, ...envio() }))).json();
  for (const metodo of ['patch', 'put']) {
    const res = await request[metodo](`/api/pedidos/${pedido.id}`, {
      headers: { Authorization: `Bearer ${token}` }, data: { metodo_entrega: 'recogida', direccion_envio: null },
    });
    expect([404, 405]).toContain(res.status());
  }
  expect((await pedidosDe(db, a1))[0]).toMatchObject({ metodo_entrega: 'envio', direccion_envio: { codigo_postal: '08012' } });
});

test('US-40 · CA18 · la lista de pedidos marca «Recogida» o «Envío»', async ({ page, cuentas }) => {
  await nuevoPedido({ metodo_entrega: 'recogida' });
  await nuevoPedido(envio());
  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto('/pedidos');
  const lista = page.getByRole('heading', { level: 1, name: 'Pedidos' });
  test.skip(!(await lista.waitFor({ timeout: 5_000 }).then(() => true, () => false)),
    'La lista /pedidos (US-109, en la story de US-33) aún no está en esta rama.');
  const filas = page.getByRole('main').getByRole('listitem').filter({ hasText: A1.titulo });
  await expect(filas.filter({ hasText: 'Recogida' }).first()).toBeVisible();
  await expect(filas.filter({ hasText: 'Envío' }).first()).toBeVisible();
});

test('US-40 · CA21 · checks de metodo_entrega y direccion_envio', async () => {
  test.skip(!columnas.has('metodo_entrega'), 'Las columnas de entrega de pedidos (T32-1) aún no están en esta rama.');
  const anuncioId = await nuevoAnuncio();
  const base = { anuncioId, compradorId: centros.b.id, vendedorId: centros.a.id };
  const falla = (cambios) => expect(insertarPedido(db, { ...base, ...cambios })).rejects.toThrow();
  await falla({ metodo_entrega: null });
  await falla({ metodo_entrega: 'mensajero' });
  await falla({ metodo_entrega: 'envio', direccion_envio: null });
  await falla({ metodo_entrega: 'recogida', direccion_envio: DIRECCION });
  await insertarPedido(db, { ...base, ...envio() });
  expect((await pedidosDe(db, anuncioId))[0].direccion_envio).toMatchObject({ codigo_postal: '08012' });
});

test('US-40 · CA22 · un centro ajeno no ve ninguna dirección', async ({ request, cuentas }) => {
  test.skip(!columnas.has('metodo_entrega'), 'Las columnas de entrega de pedidos (T32-1) aún no están en esta rama.');
  test.skip(!(await hayGetPedido(request)), 'GET /api/pedidos/:id (T32-3) aún no está en esta rama.');
  // Pedido entre A y el tercero, con envío: B no es parte.
  const anuncioId = await nuevoAnuncio();
  const id = await insertarPedido(db, {
    anuncioId, compradorId: centros.tercero.id, vendedorId: centros.a.id, estado: 'aceptado', ...envio(),
  });
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  const res = await getPedido(request, token, id);
  expect(res.status()).toBe(404);
  const cuerpo = await res.text();
  expect(JSON.parse(cuerpo).error.code).toBe('NO_ENCONTRADO');
  for (const dato of [DIRECCION.calle_numero, DIRECCION.destinatario, DATOS_A.direccion]) expect(cuerpo).not.toContain(dato);
});
