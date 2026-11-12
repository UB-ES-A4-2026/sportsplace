// T28-4 · E2E y tests de API de US-28 (escribir al centro de un anuncio). Casos: docs/especificacion/E05 (US-28).
// A vende (A1, venta de 12,00 € con 20 unidades; A2, donación con 4) y B escribe. Cada caso crea sus anuncios
// y al acabar se borran sus conversaciones y se retiran.
// Los casos se omiten mientras su pieza no esté en la rama: tablas (T28-1), API de conversaciones (T28-2) y
// botón «Escribir al centro» y pantallas `/mensajes/nueva` y `/mensajes/:id` (T28-3).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, FECHA, INEXISTENTE, autorizacion, boton, cambiarEstado, campoMensaje, columnasDe, conversacionesDe,
  crearConversacion, datosCentro, enviarMensaje, esperarError, getConversacion, getConversacionDeAnuncio,
  hayApiConversaciones, hayBotonEscribir, hayPantallaConversacion, hayPantallaNueva, hayTablaConversaciones,
  idDeUrl, insertarAnuncio, insertarConversacion, lado, limpiarAnuncios, mensajesDe, tokenDe,
} from '../conversaciones.js';

const PREGUNTA = 'Hola, ¿los balones tienen la presión correcta? ¿Podemos recogerlos el sábado?';
const NO_DISPONIBLE = 'Este anuncio ya no está disponible.';
const BANDA_NO_DISPONIBLE = 'Este anuncio ya no está disponible en el catálogo.';
const BANDA_RETIRADO = 'El vendedor ha retirado este anuncio.';
const VACIO = 'Escribe un mensaje.';
const DEMASIADO_LARGO = 'El mensaje no puede superar los 2000 caracteres.';

let db;
let centros;
const creados = [];

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  centros = {
    a: await datosCentro(db, cuentas.centroA),
    b: await datosCentro(db, cuentas.centroB),
    otro: await datosCentro(db, cuentas.sinConfirmar),
  };
});

test.afterAll(async () => {
  if (!db) return;
  await limpiarAnuncios(db, creados);
  await db.close();
});

async function nuevoAnuncio(cambios = {}) {
  const id = await insertarAnuncio(db, { centro_id: centros.a.id, ...cambios });
  creados.push(id);
  return id;
}

// Conversación de B (comprador) con A (vendedor) creada en la BD, con un primer mensaje de B.
function conversacionDeB(anuncioId, texto = PREGUNTA) {
  return insertarConversacion(db, {
    anuncioId, comprador: centros.b, vendedor: centros.a, mensajes: [{ autor: centros.b, texto }],
  });
}

// Comprueba que la API de conversaciones está en la rama y devuelve los tokens de A y B.
async function conApi(request, cuentas) {
  test.skip(!(await hayTablaConversaciones(db)), 'Las tablas de conversaciones (T28-1) aún no están en esta rama.');
  test.skip(!(await hayApiConversaciones(request)), 'La API de conversaciones (T28-2) aún no está en esta rama.');
  return {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
}

async function conPantallaNueva(page, cuentas, anuncioId) {
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayPantallaNueva(page, anuncioId)), 'La pantalla /mensajes/nueva (T28-3) aún no está en esta rama.');
}

async function conPantallaConversacion(page, email, password, conversacionId) {
  await entrar(page, email, password);
  test.skip(!(await hayPantallaConversacion(page, conversacionId)), 'La pantalla /mensajes/:id (T28-3) aún no está en esta rama.');
}

// ---------------------------------------------------------------- flujos e2e

test('US-28 · E2E-1 · camino feliz', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBotonEscribir(page, a1)), '«Escribir al centro» en el detalle del anuncio (T28-3) aún no está en esta rama.');

  // CA3: sin conversación, el botón lleva a la pantalla de nueva conversación.
  await boton(page, 'Escribir al centro').click();
  await expect(page).toHaveURL(`/mensajes/nueva?anuncio=${a1}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Nueva conversación' })).toBeVisible();
  await expect(main.getByRole('link', { name: A1.titulo })).toHaveAttribute('href', `/anuncios/${a1}`);
  await expect(main.getByText('12,00 € / unidad')).toBeVisible();
  await expect(main.getByText(`Escribe tu pregunta a ${centros.a.nombre}. Solo vosotros dos veréis esta conversación.`)).toBeVisible();
  await expect(main.getByText('0/2000')).toBeVisible();

  await campoMensaje(page).fill(PREGUNTA);
  await boton(page, 'Enviar').click();

  // CA6 y CA16: aviso verde y llegada a la conversación con el mensaje como último del hilo, a la derecha.
  await expect(page.getByText('Mensaje enviado.')).toBeVisible();
  await expect(page).toHaveURL(/\/mensajes\/[0-9a-f-]{36}$/);
  const c1 = idDeUrl(page);
  await expect(main.getByText(PREGUNTA, { exact: true })).toBeVisible();
  await expect(main.getByText(FECHA).last()).toBeVisible();
  expect(await lado(page, PREGUNTA)).toBe('derecha');

  // BD: una conversación (A1, B, A) y un mensaje de B.
  expect(await conversacionesDe(db, a1)).toEqual([
    { id: c1, centro_comprador_id: centros.b.id, centro_vendedor_id: centros.a.id },
  ]);
  expect(await mensajesDe(db, c1)).toEqual([
    { centro_autor_id: centros.b.id, autor_usuario_id: centros.b.usuario_id, tipo: 'texto', texto: PREGUNTA },
  ]);

  // CA19, CA22-CA24: la API devuelve la conversación con el formato especificado.
  expect(await (await getConversacionDeAnuncio(request, tokens.b, a1)).json()).toEqual({ conversacion: { id: c1 } });
  const res = await getConversacion(request, tokens.b, c1);
  expect(res.status()).toBe(200);
  const cuerpo = await res.json();
  expect(cuerpo.hay_anteriores).toBe(false);
  expect(cuerpo.conversacion).toMatchObject({
    id: c1, soy: 'comprador', puede_escribir: true,
    anuncio: { id: a1, titulo: A1.titulo, modalidad: 'venta', precio_unitario_centimos: 1200, estado: 'activo' },
    otro_centro: { id: centros.a.id, nombre: centros.a.nombre, eliminado: false },
  });
  expect(Object.keys(cuerpo.mensajes[0]).sort()).toEqual(['creado_en', 'es_mio', 'id', 'texto', 'tipo']);
  expect(cuerpo.mensajes[0]).toMatchObject({ texto: PREGUNTA, es_mio: true, tipo: 'texto' });
  // El vendedor ve el mismo mensaje como ajeno.
  const deA = await (await getConversacion(request, tokens.a, c1)).json();
  expect(deA.conversacion.soy).toBe('vendedor');
  expect(deA.mensajes[0].es_mio).toBe(false);
});

test('US-28 · E2E-2 · conversación existente', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const res = await crearConversacion(request, tokens.b, { anuncio_id: a1, texto: PREGUNTA });
  expect(res.status()).toBe(201);
  const c1 = (await res.json()).conversacion.id;

  await entrar(page, cuentas.centroB, cuentas.password);
  test.skip(!(await hayBotonEscribir(page, a1)), '«Escribir al centro» en el detalle del anuncio (T28-3) aún no está en esta rama.');
  await boton(page, 'Escribir al centro').click();
  await expect(page).toHaveURL(`/mensajes/${c1}`);
  await expect(page.getByRole('main').getByText(PREGUNTA, { exact: true })).toBeVisible();
  expect(await conversacionesDe(db, a1)).toHaveLength(1);

  // CA4: la pantalla de nueva conversación redirige (replace) a la existente.
  await page.goto(`/mensajes/nueva?anuncio=${a1}`);
  await expect(page).toHaveURL(`/mensajes/${c1}`);
});

test('US-28 · E2E-3 · anuncio propio', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();

  // CA12 de US-77 y CA32: el vendedor no puede iniciar conversaciones.
  const error = await esperarError(await crearConversacion(request, tokens.a, { anuncio_id: a1, texto: PREGUNTA }), 409, 'ANUNCIO_PROPIO');
  expect(error.message).toBe('No puedes escribirte sobre tu propio anuncio.');
  expect(await conversacionesDe(db, a1)).toHaveLength(0);

  // CA2: en su propio anuncio no aparece el botón.
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto(`/anuncios/${a1}`);
  await expect(page.getByRole('main').getByText(A1.titulo).first()).toBeVisible();
  await expect(boton(page, 'Escribir al centro')).toHaveCount(0);
});

test('US-28 · E2E-4 · validación del texto', async ({ page, request, cuentas }) => {
  await conApi(request, cuentas);
  const a2 = await nuevoAnuncio(A2);
  await conPantallaNueva(page, cuentas, a2);

  const main = page.getByRole('main');
  await expect(main.getByText('Donación', { exact: true })).toBeVisible();
  const enviar = boton(page, 'Enviar');
  // CA8: vacío o solo espacios, «Enviar» deshabilitado.
  await expect(enviar).toBeDisabled();
  await campoMensaje(page).fill('   ');
  await expect(enviar).toBeDisabled();

  // CA10: contador normal por debajo de 1900.
  await campoMensaje(page).fill('Hola');
  const contadorNormal = await main.getByText('4/2000').evaluate((el) => globalThis.getComputedStyle(el).color);

  // CA9 y CA10: pegar 2001 caracteres deja 2000 y el contador en rojo.
  await expect(campoMensaje(page)).toHaveAttribute('maxlength', '2000');
  await campoMensaje(page).fill('');
  await campoMensaje(page).focus();
  await page.keyboard.insertText('x'.repeat(2001));
  await expect(campoMensaje(page)).toHaveValue('x'.repeat(2000));
  const contador = main.getByText('2000/2000');
  await expect(contador).toBeVisible();
  const color = await contador.evaluate((el) => globalThis.getComputedStyle(el).color);
  expect(color).not.toBe(contadorNormal);
  const [r, g, b] = color.match(/\d+/g).map(Number);
  expect(r).toBeGreaterThan(g);
  expect(r).toBeGreaterThan(b);

  // CA9: 2000 caracteres se aceptan.
  await enviar.click();
  await expect(page).toHaveURL(/\/mensajes\/[0-9a-f-]{36}$/);
  const [conversacion] = await conversacionesDe(db, a2);
  expect((await mensajesDe(db, conversacion.id))[0].texto).toHaveLength(2000);
});

test('US-28 · E2E-5 · tercer centro', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  // Conversación entre A y otro centro: B no participa y hace de tercero.
  const ajena = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.otro, vendedor: centros.a, mensajes: [{ autor: centros.otro, texto: PREGUNTA }],
  });

  // CA31: leer, escribir y consultar los mensajes posteriores responden 404.
  await esperarError(await getConversacion(request, tokens.b, ajena), 404, 'NO_ENCONTRADO');
  await esperarError(await request.get(`/api/conversaciones/${ajena}?despues=${INEXISTENTE}`, { headers: autorizacion(tokens.b) }), 404, 'NO_ENCONTRADO');
  await esperarError(await enviarMensaje(request, tokens.b, ajena, 'Me cuelo'), 404, 'NO_ENCONTRADO');
  expect(await mensajesDe(db, ajena)).toHaveLength(1);

  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/mensajes/${ajena}`);
  const main = page.getByRole('main');
  test.skip(
    !(await main.getByText('Esta conversación no existe.').isVisible({ timeout: 5_000 }).catch(() => false)),
    'La pantalla /mensajes/:id (T28-3) aún no está en esta rama.',
  );
  await expect(main.getByRole('link', { name: 'Ir a mensajes' })).toHaveAttribute('href', '/mensajes');
  await expect(main.getByText(PREGUNTA)).toHaveCount(0);
});

test('US-28 · E2E-6 · anuncio pausado', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const c1 = await conversacionDeB(a1);
  const a3 = await nuevoAnuncio({ titulo: 'Conos de entrenamiento' });

  // CA18: B prepara un mensaje sobre a3 y A lo pausa antes de que lo envíe.
  await conPantallaNueva(page, cuentas, a3);
  await campoMensaje(page).fill('¿Cuántos conos hay de cada color?');
  const pausa = await request.post(`/api/anuncios/${a3}/pausar`, { headers: autorizacion(tokens.a) });
  expect(pausa.status()).toBe(200);
  const respuesta = page.waitForResponse((res) => res.url().endsWith('/api/conversaciones') && res.request().method() === 'POST');
  await boton(page, 'Enviar').click();
  expect((await (await respuesta).json()).error.code).toBe('ANUNCIO_NO_DISPONIBLE');
  await expect(page.getByText(NO_DISPONIBLE, { exact: true })).toBeVisible();
  await expect(campoMensaje(page)).toHaveValue('¿Cuántos conos hay de cada color?');
  expect(await conversacionesDe(db, a3)).toHaveLength(0);

  // CA33: con a1 pausado, B sigue escribiendo en su conversación y ve la banda.
  expect((await request.post(`/api/anuncios/${a1}/pausar`, { headers: autorizacion(tokens.a) })).status()).toBe(200);
  await page.goto(`/mensajes/${c1}`);
  const main = page.getByRole('main');
  await expect(main.getByText(BANDA_NO_DISPONIBLE)).toBeVisible();
  await campoMensaje(page).fill('¿Lo volveréis a activar?');
  await boton(page, 'Enviar').click();
  // CA12: el cuadro se vacía y el mensaje se añade al final sin recargar.
  await expect(main.getByText('¿Lo volveréis a activar?', { exact: true })).toBeVisible();
  await expect(campoMensaje(page)).toHaveValue('');
  expect((await mensajesDe(db, c1)).map((mensaje) => mensaje.texto)).toEqual([PREGUNTA, '¿Lo volveréis a activar?']);
});

// ---------------------------------------------------------------- API (CA7-CA9, CA21, CA26, CA31-CA36)

test('US-28 · API · CA7-CA9 · texto del mensaje', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);

  for (const [texto, mensaje] of [['', VACIO], ['   \n  ', VACIO], ['x'.repeat(2001), DEMASIADO_LARGO]]) {
    const a1 = await nuevoAnuncio();
    const error = await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: a1, texto }), 400, 'DATOS_INVALIDOS');
    expect(error.details.texto).toBe(mensaje);
    expect(await conversacionesDe(db, a1)).toHaveLength(0);
  }
  const sinTexto = await nuevoAnuncio();
  await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: sinTexto }), 400, 'DATOS_INVALIDOS');

  // CA7: se recortan los espacios de los extremos (2000 caracteres útiles) y se aceptan saltos de línea.
  const a1 = await nuevoAnuncio();
  const largo = `  ${'x'.repeat(2000)}  `;
  const res = await crearConversacion(request, tokens.b, { anuncio_id: a1, texto: largo });
  expect(res.status()).toBe(201);
  const { conversacion, mensaje } = await res.json();
  expect(mensaje.texto).toBe('x'.repeat(2000));

  const conSaltos = await enviarMensaje(request, tokens.b, conversacion.id, 'Primera línea\nSegunda línea');
  expect(conSaltos.status()).toBe(201);
  expect((await conSaltos.json()).mensaje).toMatchObject({ texto: 'Primera línea\nSegunda línea', es_mio: true, tipo: 'texto' });

  // CA8 y CA9 también al responder en una conversación existente (CA25).
  expect((await esperarError(await enviarMensaje(request, tokens.a, conversacion.id, '  '), 400, 'DATOS_INVALIDOS')).details.texto).toBe(VACIO);
  expect((await esperarError(await enviarMensaje(request, tokens.a, conversacion.id, 'y'.repeat(2001)), 400, 'DATOS_INVALIDOS')).details.texto).toBe(DEMASIADO_LARGO);
  expect(await mensajesDe(db, conversacion.id)).toHaveLength(2);

  // CA15: el texto se guarda y se devuelve tal cual, sin interpretar HTML.
  const html = await enviarMensaje(request, tokens.a, conversacion.id, '<b>hola</b>');
  expect((await html.json()).mensaje.texto).toBe('<b>hola</b>');
});

test('US-28 · API · CA21 · errores al crear la conversación', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);

  // 400: anuncio_id que no es un uuid.
  await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: 'no-es-un-uuid', texto: PREGUNTA }), 400, 'DATOS_INVALIDOS');
  // 404: anuncio inexistente o retirado (CA19: también al consultar la conversación del anuncio).
  await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: INEXISTENTE, texto: PREGUNTA }), 404, 'NO_ENCONTRADO');
  await esperarError(await getConversacionDeAnuncio(request, tokens.b, INEXISTENTE), 404, 'NO_ENCONTRADO');
  const retirado = await nuevoAnuncio({ estado: 'retirado', retirado_en: new Date().toISOString() });
  await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: retirado, texto: PREGUNTA }), 404, 'NO_ENCONTRADO');
  await esperarError(await getConversacionDeAnuncio(request, tokens.b, retirado), 404, 'NO_ENCONTRADO');

  // 409 ANUNCIO_NO_DISPONIBLE: pausado o entregado (CA33).
  for (const estado of ['pausado', 'entregado']) {
    const id = await nuevoAnuncio();
    await cambiarEstado(db, id, estado);
    await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: id, texto: PREGUNTA }), 409, 'ANUNCIO_NO_DISPONIBLE');
    expect(await conversacionesDe(db, id)).toHaveLength(0);
  }

  // 409 CONVERSACION_YA_EXISTE con el id de la existente (CA19: ya no es null).
  const a1 = await nuevoAnuncio();
  expect(await (await getConversacionDeAnuncio(request, tokens.b, a1)).json()).toEqual({ conversacion: null });
  const c1 = await conversacionDeB(a1);
  const error = await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: a1, texto: 'Otra vez' }), 409, 'CONVERSACION_YA_EXISTE');
  expect(error.details.conversacion_id).toBe(c1);
  expect(await mensajesDe(db, c1)).toHaveLength(1);

  // Sin sesión: 401.
  await esperarError(await crearConversacion(request, null, { anuncio_id: a1, texto: PREGUNTA }), 401, 'NO_AUTENTICADO');
});

test('US-28 · API · CA26 · límite de 30 mensajes por minuto', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const c1 = await conversacionDeB(a1);
  // Completa en la BD los 30 mensajes del último minuto de B (los de otros casos también cuentan).
  const { rows: [{ recientes }] } = await db.query(
    "SELECT count(*)::int AS recientes FROM public.mensajes WHERE centro_autor_id = $1 AND creado_en > now() - interval '1 minute'",
    [centros.b.id],
  );
  const relleno = [];
  try {
    for (let i = recientes; i < 30; i += 1) {
      const { rows } = await db.query(
        `INSERT INTO public.mensajes (conversacion_id, centro_autor_id, autor_usuario_id, texto)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [c1, centros.b.id, centros.b.usuario_id, `Mensaje ${i + 1}`],
      );
      relleno.push(rows[0].id);
    }
    const error = await esperarError(await enviarMensaje(request, tokens.b, c1, 'El 31.º'), 429, 'DEMASIADOS_INTENTOS');
    expect(error.message).toBe('Has enviado demasiados mensajes seguidos. Espera un minuto.');
    // El límite es de todo el centro: tampoco puede abrir conversaciones nuevas.
    const a2 = await nuevoAnuncio(A2);
    await esperarError(await crearConversacion(request, tokens.b, { anuncio_id: a2, texto: PREGUNTA }), 429, 'DEMASIADOS_INTENTOS');
    // Y es por centro: A sigue pudiendo responder.
    expect((await enviarMensaje(request, tokens.a, c1, 'Respuesta de A')).status()).toBe(201);
  } finally {
    // Se sacan los mensajes de relleno del último minuto para no bloquear los casos siguientes.
    await db.query("UPDATE public.mensajes SET creado_en = creado_en - interval '2 minutes' WHERE id = ANY($1::uuid[])", [relleno]);
  }
});

test('US-28 · API · CA31 y CA32 · solo los dos centros, y solo el comprador inicia', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const c1 = await conversacionDeB(a1);

  // Los dos participantes leen y escriben.
  expect((await getConversacion(request, tokens.a, c1)).status()).toBe(200);
  expect((await enviarMensaje(request, tokens.a, c1, 'Sí, están revisados. El sábado de 10 a 13 h.')).status()).toBe(201);
  expect((await enviarMensaje(request, tokens.b, c1, 'Perfecto, gracias.')).status()).toBe(201);
  // CA29: cada mensaje actualiza ultimo_mensaje_en.
  const { rows: [fila] } = await db.query(
    'SELECT c.ultimo_mensaje_en = max(m.creado_en) AS al_dia FROM public.conversaciones c JOIN public.mensajes m ON m.conversacion_id = c.id WHERE c.id = $1 GROUP BY c.id',
    [c1],
  );
  expect(fila.al_dia).toBe(true);

  // Un tercero no ve la conversación: B frente a una conversación entre A y otro centro.
  const ajena = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.otro, vendedor: centros.a, mensajes: [{ autor: centros.otro, texto: PREGUNTA }],
  });
  await esperarError(await getConversacion(request, tokens.b, ajena), 404, 'NO_ENCONTRADO');
  await esperarError(await enviarMensaje(request, tokens.b, ajena, 'Hola'), 404, 'NO_ENCONTRADO');
  await esperarError(await getConversacion(request, tokens.b, INEXISTENTE), 404, 'NO_ENCONTRADO');
  // Sin sesión: 401.
  await esperarError(await getConversacion(request, null, c1), 401, 'NO_AUTENTICADO');
  await esperarError(await enviarMensaje(request, null, c1, 'Hola'), 401, 'NO_AUTENTICADO');

  // CA32: el vendedor no inicia conversaciones sobre su anuncio.
  await esperarError(await crearConversacion(request, tokens.a, { anuncio_id: a1, texto: 'Hola' }), 409, 'ANUNCIO_PROPIO');
  expect(await conversacionesDe(db, a1)).toHaveLength(2);
});

test('US-28 · API · CA33 · anuncio reservado, pausado o entregado', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);

  // Reservado: se puede crear la conversación.
  const reservado = await nuevoAnuncio();
  await cambiarEstado(db, reservado, 'reservado');
  expect((await crearConversacion(request, tokens.b, { anuncio_id: reservado, texto: PREGUNTA })).status()).toBe(201);

  // Pausado o entregado: en las existentes se sigue escribiendo.
  for (const estado of ['pausado', 'entregado']) {
    const id = await nuevoAnuncio();
    const c1 = await conversacionDeB(id);
    await cambiarEstado(db, id, estado);
    expect((await enviarMensaje(request, tokens.b, c1, '¿Lo volveréis a activar?')).status()).toBe(201);
    expect((await enviarMensaje(request, tokens.a, c1, 'Sí, la semana que viene.')).status()).toBe(201);
    const { conversacion } = await (await getConversacion(request, tokens.b, c1)).json();
    expect(conversacion).toMatchObject({ puede_escribir: true, anuncio: { estado } });
  }
});

test('US-28 · API · CA34 · anuncio retirado con conversación', async ({ page, request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();
  const c1 = await conversacionDeB(a1);
  await cambiarEstado(db, a1, 'retirado');

  const res = await getConversacion(request, tokens.b, c1);
  expect(res.status()).toBe(200);
  expect((await res.json()).conversacion).toMatchObject({ puede_escribir: true, anuncio: { estado: 'retirado' } });
  expect((await enviarMensaje(request, tokens.b, c1, '¿Ya no lo tenéis?')).status()).toBe(201);
  expect((await enviarMensaje(request, tokens.a, c1, 'No, lo siento.')).status()).toBe(201);

  // En la web: banda y el título deja de ser enlace.
  await conPantallaConversacion(page, cuentas.centroB, cuentas.password, c1);
  const main = page.getByRole('main');
  await expect(main.getByText(BANDA_RETIRADO)).toBeVisible();
  await expect(main.getByText(A1.titulo).first()).toBeVisible();
  await expect(main.getByRole('link', { name: A1.titulo })).toHaveCount(0);
  await expect(main.getByText('No, lo siento.', { exact: true })).toBeVisible();
  expect(await lado(page, 'No, lo siento.')).toBe('izquierda');
  expect(await lado(page, '¿Ya no lo tenéis?')).toBe('derecha');
});

test('US-28 · API · CA35 · centro eliminado', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const columnas = await columnasDe(db, 'centros');
  test.skip(!columnas.has('eliminado_en'), 'La eliminación de centros (US-11) aún no existe; este CA depende de ella.');
  const a1 = await nuevoAnuncio();
  const c1 = await insertarConversacion(db, {
    anuncioId: a1, comprador: centros.otro, vendedor: centros.a, mensajes: [{ autor: centros.otro, texto: PREGUNTA }],
  });
  await db.query('UPDATE public.centros SET eliminado_en = now() WHERE id = $1', [centros.otro.id]);
  try {
    const { conversacion } = await (await getConversacion(request, tokens.a, c1)).json();
    expect(conversacion).toMatchObject({ puede_escribir: false, otro_centro: { id: centros.otro.id, nombre: 'Centro eliminado', eliminado: true } });
    await esperarError(await enviarMensaje(request, tokens.a, c1, 'Hola'), 409, 'CENTRO_ELIMINADO');
  } finally {
    await db.query('UPDATE public.centros SET eliminado_en = NULL WHERE id = $1', [centros.otro.id]);
  }
});

test('US-28 · API · CA36 · dos primeros mensajes simultáneos', async ({ request, cuentas }) => {
  const tokens = await conApi(request, cuentas);
  const a1 = await nuevoAnuncio();

  const respuestas = await Promise.all([
    crearConversacion(request, tokens.b, { anuncio_id: a1, texto: 'Primera pestaña' }),
    crearConversacion(request, tokens.b, { anuncio_id: a1, texto: 'Segunda pestaña' }),
  ]);
  const estados = respuestas.map((res) => res.status()).sort();
  expect(estados).toEqual([201, 409]);
  const conflicto = respuestas.find((res) => res.status() === 409);
  const creada = respuestas.find((res) => res.status() === 201);
  const error = (await conflicto.json()).error;
  expect(error.code).toBe('CONVERSACION_YA_EXISTE');
  expect(error.details.conversacion_id).toBe((await creada.json()).conversacion.id);

  // Una sola conversación con un solo mensaje: la transacción no deja mensajes sueltos (CA20).
  const conversaciones = await conversacionesDe(db, a1);
  expect(conversaciones).toHaveLength(1);
  expect(await mensajesDe(db, conversaciones[0].id)).toHaveLength(1);
});
