// T42-3 · E2E de US-42 (#221): «Marcar como cobrado» (US-80, docs/especificacion/E06) y «He recibido el material»
// (US-42, docs/especificacion/E07-E09). Los pedidos se insertan en la BD ya aceptados: B (comprador) pide 4 balones
// de A1 (o 10 petos de A2) a A (vendedor). Cada anuncio lleva un título propio para encontrar su fila en /pedidos.
// Sin omisiones por detección de pieza (decisión de QA, #316 y #321): si falta una pieza, el caso falla.
// Fuera de esta historia, sin caso propio: la cita de entrega (US-42 CA5 y E2E-2, US-41), las incidencias (US-42 CA2,
// CA10 y E2E-4, US-43 y US-115), el aviso al vendedor (US-42 CA8, US-83) y cancelar un pedido cobrado (US-80 CA7, US-39).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import {
  A1, A2, INEXISTENTE, anuncio, autorizacion, boton, datosCentro, getPedido, retirarAnuncios, tokenDe,
} from '../pedidos.js';
import { SIN_PERMISO, TRANSICION, anuncioConPedido, cambiarEstado, errorDe, pedido, tokenSinConfirmar } from '../pedidos-respuesta.js';

const YA_PAGADO = 'Este pedido ya consta como cobrado.';
const DONACION = 'Las donaciones no se cobran.';
const FECHA_HORA = String.raw`\d{2}/\d{2}/\d{4} \d{2}:\d{2}`;

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

// Pedido aceptado de B a A, con título propio y fecha de hoy (sale el primero de los no pendientes en /pedidos).
async function pedidoAceptado({ anuncio: datos = A1, estado = 'aceptado', ...cambios } = {}) {
  const titulo = `${datos.titulo} · QA US-42 ${crypto.randomUUID().slice(0, 8)}`;
  const ahora = new Date().toISOString();
  const { id, anuncioId } = await anuncioConPedido(db, creados, {
    vendedor: centros.a, comprador: centros.b, anuncio: { ...datos, titulo },
    unidades: datos === A2 ? 10 : 4, creado_en: ahora, actualizado_en: ahora, ...cambios,
  });
  // Rechazado y cancelado llevan siempre motivo (check `pedidos_motivo_al_cerrar`).
  const cierre = {
    rechazado: { motivo: 'sin_unidades', cerradoPor: 'vendedor' },
    cancelado: { motivo: 'ya_no_necesario', cerradoPor: 'comprador' },
  }[estado];
  if (estado !== 'pendiente') await cambiarEstado(db, id, estado === 'recibido' ? 'aceptado' : estado, cierre);
  if (estado === 'recibido') {
    await db.query("UPDATE public.pedidos SET estado = 'recibido', recibido_en = now() WHERE id = $1", [id]);
  }
  return { id, anuncioId, titulo };
}

function marcarPagado(request, token, id) {
  return request.post(`/api/pedidos/${id}/marcar-pagado`, { headers: autorizacion(token) });
}

function recibir(request, token, id) {
  return request.post(`/api/pedidos/${id}/recibir`, { headers: autorizacion(token) });
}

async function tokens(request, cuentas) {
  return {
    a: await tokenDe(request, cuentas.centroA, cuentas.password),
    b: await tokenDe(request, cuentas.centroB, cuentas.password),
  };
}

async function acciones(request, token, id) {
  const res = await getPedido(request, token, id);
  expect(res.status()).toBe(200);
  return (await res.json()).pedido.acciones;
}

async function alPedido(page, email, password, id) {
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await entrar(page, email, password);
  await page.goto(`/pedidos/${id}`);
  await expect(page.getByRole('heading', { level: 1, name: /^Pedido de / })).toBeVisible();
  return page.getByRole('main');
}

function dialogo(page, titulo) {
  return page.getByRole('dialog').filter({ hasText: titulo });
}

function filaDeLista(page, titulo) {
  const main = page.getByRole('main');
  return main.getByRole('row').or(main.getByRole('listitem')).or(main.getByRole('article')).filter({ hasText: titulo });
}

// US-42 CA14: lanza las peticiones con la fila del pedido bloqueada desde otra conexión y solo la suelta cuando todas
// esperan ese bloqueo, para que se solapen de verdad. Es la misma técnica que `aLaVez` (#328), pero `recibir` bloquea
// el pedido y no el anuncio. Depende de `max: 2` en el pool de database.js y de `workers: 1`.
async function aLaVezSobrePedido(pedidoId, peticiones) {
  let enVuelo = [];
  await db.transaction(async (client) => {
    await client.query('SELECT 1 FROM public.pedidos WHERE id = $1 FOR UPDATE', [pedidoId]);
    const { rows: [{ pid }] } = await client.query('SELECT pg_backend_pid() AS pid');
    enVuelo = peticiones.map((peticion) => peticion());
    await expect.poll(async () => {
      const { rows: [{ n }] } = await db.query(
        `WITH RECURSIVE esperan(pid) AS (
           SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
           UNION SELECT a.pid FROM pg_stat_activity a JOIN esperan e ON e.pid = ANY(pg_blocking_pids(a.pid))
         ) SELECT count(*)::int AS n FROM esperan`,
        [pid],
      );
      return n;
    }, { message: 'las peticiones esperan el bloqueo del pedido', intervals: [50, 100, 200], timeout: 3_000 })
      .toBe(peticiones.length);
  }).catch(async (error) => {
    await Promise.allSettled(enVuelo);
    throw error;
  });
  return Promise.all(enVuelo);
}

// ================================================================ US-80 · Marcar un pedido como cobrado

test('US-80 · E2E-1 · el vendedor marca como cobrado y el comprador lo ve (CA1, CA2, CA3)', async ({ page, cuentas }) => {
  const { id } = await pedidoAceptado();
  let main = await alPedido(page, cuentas.centroA, cuentas.password, id);

  await boton(page, 'Marcar como cobrado').click();
  const ventana = dialogo(page, '¿Has cobrado este pedido?');
  await expect(ventana).toBeVisible();
  await expect(ventana.getByText(
    `Confirma que has recibido 34,00 € de ${centros.b.nombre} por transferencia bancaria. No se puede deshacer.`,
  )).toBeVisible();
  await ventana.getByRole('button', { name: 'Sí, lo he cobrado', exact: true }).click();

  // CA2.
  await expect(page.getByText('Pedido marcado como cobrado.', { exact: true })).toBeVisible();
  await expect(main.getByText('Pagado', { exact: true })).toBeVisible();
  await expect(main.getByText(new RegExp(`^Marcado como pagado el ${FECHA_HORA}$`))).toBeVisible();
  await expect(boton(page, 'Marcar como cobrado')).toHaveCount(0);
  expect((await pedido(db, id)).pagado_en).not.toBeNull();

  // CA3: el comprador ve la etiqueta y la línea, sin botón de pago.
  main = await alPedido(page, cuentas.centroB, cuentas.password, id);
  await expect(main.getByText('Pagado', { exact: true })).toBeVisible();
  await expect(main.getByText(new RegExp(`^Marcado como pagado el ${FECHA_HORA}$`))).toBeVisible();
  await expect(boton(page, 'Marcar como cobrado')).toHaveCount(0);
});

test('US-80 · E2E-2 · marcar dos veces responde 409 YA_PAGADO', async ({ request, cuentas }) => {
  const { id } = await pedidoAceptado();
  const { a } = await tokens(request, cuentas);
  expect((await marcarPagado(request, a, id)).status()).toBe(200);
  const primero = (await pedido(db, id)).pagado_en;
  const error = await errorDe(await marcarPagado(request, a, id), 409, 'YA_PAGADO');
  expect(error.message).toBe(YA_PAGADO);
  expect((await pedido(db, id)).pagado_en).toBe(primero);
});

test('US-80 · E2E-3 · comprador 403, pendiente 409 y donación 409', async ({ request, cuentas }) => {
  const { a, b } = await tokens(request, cuentas);
  const venta = await pedidoAceptado();
  expect((await errorDe(await marcarPagado(request, b, venta.id), 403, 'SIN_PERMISO')).message).toBe(SIN_PERMISO);

  const pendiente = await pedidoAceptado({ estado: 'pendiente' });
  const error = await errorDe(await marcarPagado(request, a, pendiente.id), 409, 'TRANSICION_NO_PERMITIDA');
  expect(error.message).toBe(TRANSICION);

  const donacion = await pedidoAceptado({ anuncio: A2 });
  expect((await errorDe(await marcarPagado(request, a, donacion.id), 409, 'PEDIDO_DONACION')).message).toBe(DONACION);
  for (const { id } of [venta, pendiente, donacion]) expect((await pedido(db, id)).pagado_en).toBeNull();
});

test('US-80 · CA1 · «marcar_pagado» solo para el vendedor de una venta aceptada o recibida sin cobrar', async ({ page, request, cuentas }) => {
  const { a, b } = await tokens(request, cuentas);
  const aceptado = await pedidoAceptado();
  expect(await acciones(request, a, aceptado.id)).toContain('marcar_pagado');
  expect(await acciones(request, b, aceptado.id)).not.toContain('marcar_pagado');

  const recibido = await pedidoAceptado({ estado: 'recibido' });
  expect(await acciones(request, a, recibido.id)).toContain('marcar_pagado');

  for (const caso of [await pedidoAceptado({ anuncio: A2 }), await pedidoAceptado({ estado: 'pendiente' })]) {
    expect(await acciones(request, a, caso.id)).not.toContain('marcar_pagado');
  }
  await marcarPagado(request, a, aceptado.id);
  expect(await acciones(request, a, aceptado.id)).not.toContain('marcar_pagado');

  // En la web, una donación aceptada no tiene el botón.
  const donacion = await pedidoAceptado({ anuncio: A2 });
  await alPedido(page, cuentas.centroA, cuentas.password, donacion.id);
  await expect(boton(page, 'Marcar como cobrado')).toHaveCount(0);
});

test('US-80 · CA4 · 200 con el pedido y su «pagado_en»; también desde «recibido»', async ({ request, cuentas }) => {
  const { a } = await tokens(request, cuentas);
  for (const estado of ['aceptado', 'recibido']) {
    const { id } = await pedidoAceptado({ estado });
    const antes = Date.now();
    const res = await marcarPagado(request, a, id);
    expect(res.status()).toBe(200);
    const { pedido: respuesta } = await res.json();
    expect(respuesta).toMatchObject({ id, estado });
    expect(Math.abs(new Date(respuesta.pagado_en).getTime() - antes)).toBeLessThan(60_000);
  }
});

test('US-80 · CA5 · 401, 403 sin confirmar, 404 y 409 en rechazado o cancelado', async ({ request, cuentas }) => {
  const { a } = await tokens(request, cuentas);
  const { id } = await pedidoAceptado();
  await errorDe(await marcarPagado(request, null, id), 401, 'NO_AUTENTICADO');

  // 404: un pedido entre el centro sin confirmar (comprador) y B (vendedor), visto por A; uno inexistente; un id roto.
  const ajeno = await anuncioConPedido(db, creados, { vendedor: centros.b, comprador: centros.tercero, anuncio: A1 });
  await cambiarEstado(db, ajeno.id, 'aceptado');
  for (const otro of [ajeno.id, INEXISTENTE, 'no-es-un-uuid']) {
    await errorDe(await marcarPagado(request, a, otro), 404, 'NO_ENCONTRADO');
  }

  for (const estado of ['rechazado', 'cancelado']) {
    const caso = await pedidoAceptado({ estado });
    await errorDe(await marcarPagado(request, a, caso.id), 409, 'TRANSICION_NO_PERMITIDA');
  }
  expect((await pedido(db, id)).pagado_en).toBeNull();

  const sinConfirmar = await tokenSinConfirmar(request, cuentas);
  test.skip(!sinConfirmar, 'El centro sin confirmar no obtiene token en este entorno.');
  await errorDe(await marcarPagado(request, sinConfirmar, id), 403, 'EMAIL_NO_CONFIRMADO');
});

test('US-80 · CA6 · la marca no se puede quitar', async ({ request, cuentas }) => {
  const { a } = await tokens(request, cuentas);
  const { id } = await pedidoAceptado();
  await marcarPagado(request, a, id);
  const marca = (await pedido(db, id)).pagado_en;
  // La ruta solo admite POST y no hay ninguna para desmarcar.
  expect((await request.delete(`/api/pedidos/${id}/marcar-pagado`, { headers: autorizacion(a) })).status()).toBe(405);
  for (const ruta of ['desmarcar-pagado', 'quitar-pagado', 'marcar-no-pagado']) {
    expect((await request.post(`/api/pedidos/${id}/${ruta}`, { headers: autorizacion(a) })).status()).toBe(404);
  }
  expect((await pedido(db, id)).pagado_en).toBe(marca);
});

test('US-80 · CA8 · la BD no deja marcar como cobrada una donación', async () => {
  const { id } = await pedidoAceptado({ anuncio: A2 });
  await expect(db.query('UPDATE public.pedidos SET pagado_en = now() WHERE id = $1', [id]))
    .rejects.toMatchObject({ code: '23514' });
  expect((await pedido(db, id)).pagado_en).toBeNull();
});

test('US-80 · CA9 · «Pagado» junto al estado en /pedidos, para los dos centros', async ({ page, request, cuentas }) => {
  const { a } = await tokens(request, cuentas);
  const { id, titulo } = await pedidoAceptado();
  await marcarPagado(request, a, id);

  await alPedido(page, cuentas.centroA, cuentas.password, id);
  await page.goto('/pedidos?pestana=recibidos');
  await expect(filaDeLista(page, titulo)).toContainText('Aceptado');
  await expect(filaDeLista(page, titulo)).toContainText('Pagado');

  await alPedido(page, cuentas.centroB, cuentas.password, id);
  await page.goto('/pedidos?pestana=realizados');
  await expect(filaDeLista(page, titulo)).toContainText('Pagado');
});

// ================================================================ US-42 · Confirmo que he recibido el material

test('US-42 · E2E-1 · el comprador confirma la recepción y el vendedor lo ve (CA1, CA4, CA7)', async ({ page, cuentas }) => {
  const { id, anuncioId, titulo } = await pedidoAceptado();
  const unidadesAntes = (await anuncio(db, anuncioId)).unidades_disponibles;
  let main = await alPedido(page, cuentas.centroB, cuentas.password, id);

  await boton(page, 'He recibido el material').click();
  const ventana = dialogo(page, '¿Confirmas que has recibido el material?');
  await expect(ventana).toBeVisible();
  await expect(ventana.getByText(`Confirmas que has recibido 4 unidades de «${titulo}».`)).toBeVisible();
  // Decisión de la PO (17/11, T42-4): el diálogo ya no dice que el pedido queda cerrado.
  await expect(ventana.getByText(/quedará cerrado/)).toHaveCount(0);
  await ventana.getByRole('button', { name: 'Sí, lo he recibido', exact: true }).click();

  // CA4.
  await expect(page.getByText('Pedido marcado como recibido.', { exact: true })).toBeVisible();
  await expect(main.getByText('Recibido', { exact: true }).first()).toBeVisible();
  await expect(main.getByText(new RegExp(`^Recibido el ${FECHA_HORA}\\.$`))).toBeVisible();
  await expect(boton(page, 'He recibido el material')).toHaveCount(0);
  const fila = await pedido(db, id);
  expect(fila.estado).toBe('recibido');
  expect(fila.recibido_en).not.toBeNull();
  // CA7: confirmar no cambia las unidades del anuncio.
  expect((await anuncio(db, anuncioId)).unidades_disponibles).toBe(unidadesAntes);

  // El vendedor recarga y lo ve «Recibido»; no tiene el botón.
  main = await alPedido(page, cuentas.centroA, cuentas.password, id);
  await expect(main.getByText('Recibido', { exact: true }).first()).toBeVisible();
  await expect(boton(page, 'He recibido el material')).toHaveCount(0);
});

test('US-42 · E2E-3 · vendedor 403, tercero 404, repetir 409 y pendiente 409 (CA12)', async ({ request, cuentas }) => {
  const { a, b } = await tokens(request, cuentas);
  const { id } = await pedidoAceptado();
  expect((await errorDe(await recibir(request, a, id), 403, 'SIN_PERMISO')).message).toBe(SIN_PERMISO);

  const ajeno = await anuncioConPedido(db, creados, { vendedor: centros.b, comprador: centros.tercero, anuncio: A1 });
  await cambiarEstado(db, ajeno.id, 'aceptado');
  for (const otro of [ajeno.id, INEXISTENTE, 'no-es-un-uuid']) {
    await errorDe(await recibir(request, a, otro), 404, 'NO_ENCONTRADO');
  }
  expect((await pedido(db, ajeno.id)).estado).toBe('aceptado');

  expect((await recibir(request, b, id)).status()).toBe(200);
  const recibidoEn = (await pedido(db, id)).recibido_en;
  const repetido = await errorDe(await recibir(request, b, id), 409, 'TRANSICION_NO_PERMITIDA');
  expect(repetido).toMatchObject({ message: TRANSICION, details: { estado_actual: 'recibido' } });
  expect((await pedido(db, id)).recibido_en).toBe(recibidoEn);

  for (const estado of ['pendiente', 'rechazado', 'cancelado']) {
    const caso = await pedidoAceptado({ estado });
    await errorDe(await recibir(request, b, caso.id), 409, 'TRANSICION_NO_PERMITIDA');
    expect((await pedido(db, caso.id)).estado).toBe(estado);
  }
});

test('US-42 · CA1 · «recibir» solo para el comprador de un pedido aceptado', async ({ page, request, cuentas }) => {
  const { a, b } = await tokens(request, cuentas);
  const aceptado = await pedidoAceptado();
  expect(await acciones(request, b, aceptado.id)).toContain('recibir');
  expect(await acciones(request, a, aceptado.id)).not.toContain('recibir');
  for (const estado of ['pendiente', 'recibido']) {
    const caso = await pedidoAceptado({ estado });
    expect(await acciones(request, b, caso.id)).not.toContain('recibir');
  }
  // El vendedor no ve el botón en la web.
  await alPedido(page, cuentas.centroA, cuentas.password, aceptado.id);
  await expect(boton(page, 'He recibido el material')).toHaveCount(0);
});

test('US-42 · CA3 · se confirma sin la marca de cobrado y con ella (pago y recepción, independientes)', async ({ request, cuentas }) => {
  const { a, b } = await tokens(request, cuentas);
  const sinCobrar = await pedidoAceptado();
  expect((await recibir(request, b, sinCobrar.id)).status()).toBe(200);
  const cobrado = await pedidoAceptado();
  await marcarPagado(request, a, cobrado.id);
  expect((await recibir(request, b, cobrado.id)).status()).toBe(200);
  expect((await pedido(db, cobrado.id)).pagado_en).not.toBeNull();
});

test('US-42 · CA6 · en «recibido» no hay ninguna acción para volver a «aceptado»', async ({ request, cuentas }) => {
  const { a, b } = await tokens(request, cuentas);
  const { id } = await pedidoAceptado();
  await recibir(request, b, id);
  expect(await acciones(request, b, id)).toEqual([]);
  // Al vendedor solo le queda cobrar (US-80 CA1).
  expect(await acciones(request, a, id)).toEqual(['marcar_pagado']);
  for (const ruta of ['aceptar', 'recibir']) {
    for (const token of [a, b]) {
      expect([403, 409]).toContain((await request.post(`/api/pedidos/${id}/${ruta}`, { headers: autorizacion(token) })).status());
    }
  }
  expect((await pedido(db, id)).estado).toBe('recibido');
});

test('US-42 · CA9 · «Recibido» en /pedidos para los dos centros', async ({ page, request, cuentas }) => {
  const { b } = await tokens(request, cuentas);
  const { id, titulo } = await pedidoAceptado();
  await recibir(request, b, id);

  await alPedido(page, cuentas.centroB, cuentas.password, id);
  await page.goto('/pedidos?pestana=realizados');
  await expect(filaDeLista(page, titulo)).toContainText('Recibido');

  await alPedido(page, cuentas.centroA, cuentas.password, id);
  await page.goto('/pedidos?pestana=recibidos');
  await expect(filaDeLista(page, titulo)).toContainText('Recibido');
});

test('US-42 · CA11 · 200 con id, estado «recibido» y «recibido_en»', async ({ request, cuentas }) => {
  const { b } = await tokens(request, cuentas);
  const { id } = await pedidoAceptado();
  const antes = Date.now();
  const res = await recibir(request, b, id);
  expect(res.status()).toBe(200);
  const { pedido: respuesta } = await res.json();
  expect(respuesta).toMatchObject({ id, estado: 'recibido' });
  expect(Math.abs(new Date(respuesta.recibido_en).getTime() - antes)).toBeLessThan(60_000);
});

test('US-42 · CA12 · 401 sin sesión y 403 con el email sin confirmar', async ({ request, cuentas }) => {
  const { id } = await pedidoAceptado();
  await errorDe(await recibir(request, null, id), 401, 'NO_AUTENTICADO');
  expect((await pedido(db, id)).estado).toBe('aceptado');
  const sinConfirmar = await tokenSinConfirmar(request, cuentas);
  test.skip(!sinConfirmar, 'El centro sin confirmar no obtiene token en este entorno.');
  await errorDe(await recibir(request, sinConfirmar, id), 403, 'EMAIL_NO_CONFIRMADO');
});

test('US-42 · CA13 · la BD no deja un pedido «recibido» sin «recibido_en»', async () => {
  const { id } = await pedidoAceptado();
  await expect(db.query("UPDATE public.pedidos SET estado = 'recibido', recibido_en = NULL WHERE id = $1", [id]))
    .rejects.toMatchObject({ code: '23514' });
  expect((await pedido(db, id)).estado).toBe('aceptado');
});

test('US-42 · CA14 · dos confirmaciones a la vez: una 200 y otra 409', async ({ request, cuentas }) => {
  const { b } = await tokens(request, cuentas);
  const { id } = await pedidoAceptado();
  const respuestas = await aLaVezSobrePedido(id, [() => recibir(request, b, id), () => recibir(request, b, id)]);
  expect(respuestas.map((res) => res.status()).sort()).toEqual([200, 409]);
  const perdedora = respuestas.find((res) => res.status() === 409);
  expect((await perdedora.json()).error.code).toBe('TRANSICION_NO_PERMITIDA');
  const ganadora = await respuestas.find((res) => res.status() === 200).json();
  // «recibido_en» es el de la primera confirmación; la segunda no lo cambia.
  expect(new Date((await pedido(db, id)).recibido_en).toISOString()).toBe(ganadora.pedido.recibido_en);
});
