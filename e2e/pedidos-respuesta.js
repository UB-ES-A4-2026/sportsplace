// Utilidades de los E2E de US-33 (aceptar, con US-109, US-79 y US-34 juntas en el S2). Se apoyan en
// e2e/pedidos.js (T32-6): mismos papeles de la base común de E06 (A vende, B compra y el centro sin
// confirmar hace de tercero) y mismos anuncios A1 y A2.
import { expect } from './fixtures.js';
import { autorizacion, boton, columnasDe, insertarAnuncio, insertarPedido } from './pedidos.js';

export const TRANSICION = 'El pedido ya no está en un estado que permita esta acción.';
export const SIN_PERMISO = 'No puedes realizar esta acción en este pedido.';

// Textos de la lista fija de motivos de rechazo (E06, base común).
export const MOTIVOS_RECHAZO = {
  sin_unidades: 'Ya no tengo unidades suficientes',
  comprometido_otro_centro: 'El material está comprometido con otro centro',
  entrega_inviable: 'No puedo hacer la entrega que se pide',
  condiciones_pago: 'No acepto las condiciones de pago',
  otro: 'Otro motivo',
};
export const SIN_STOCK = 'Se han agotado las unidades del anuncio';
export const EXPLICA = 'Explica el motivo (entre 10 y 300 caracteres).';
export const LARGO = 'El texto no puede superar 300 caracteres.';

export function aceptar(request, token, id) {
  return request.post(`/api/pedidos/${id}/aceptar`, { headers: autorizacion(token) });
}

export function rechazar(request, token, id, datos) {
  return request.post(`/api/pedidos/${id}/rechazar`, { headers: autorizacion(token), data: datos });
}

export function listaPedidos(request, token, query) {
  return request.get(`/api/pedidos?${new URLSearchParams(query)}`, { headers: autorizacion(token) });
}

export function contadorPedidos(request, token) {
  return request.get('/api/pedidos/contador', { headers: autorizacion(token) });
}

export async function errorDe(res, status, code) {
  expect(res.status()).toBe(status);
  const { error } = await res.json();
  expect(error.code).toBe(code);
  return error;
}

// Token del centro sin confirmar; null si el entorno no le deja entrar.
export async function tokenSinConfirmar(request, cuentas) {
  const login = await request.post('/api/auth/login', { data: { email: cuentas.sinConfirmar, password: cuentas.password } });
  return login.ok() ? (await login.json()).sesion?.access_token ?? null : null;
}

export async function telefonoDe(db, centroId) {
  const { rows } = await db.query('SELECT telefono FROM public.centros WHERE id = $1', [centroId]);
  return rows[0]?.telefono ?? null;
}

export async function pedido(db, id) {
  const { rows } = await db.query('SELECT to_jsonb(p) AS fila FROM public.pedidos p WHERE id = $1', [id]);
  return rows[0]?.fila;
}

export async function pendientesRecibidos(db, centroId) {
  const { rows: [{ n }] } = await db.query(
    "SELECT count(*)::int AS n FROM public.pedidos WHERE vendedor_centro_id = $1 AND estado = 'pendiente'",
    [centroId],
  );
  return n;
}

export async function pedidosComo(db, columna, centroId) {
  const { rows: [{ n }] } = await db.query(
    `SELECT count(*)::int AS n FROM public.pedidos WHERE ${columna} = $1`,
    [centroId],
  );
  return n;
}

// Cambia el estado de un pedido en la BD (otra pestaña u otro usuario «a la vez»), rellenando las columnas
// de motivo y fechas que exija el check de US-79 si su migración ya está en la rama.
export async function cambiarEstado(db, id, estado, { motivo = null, cerradoPor = null } = {}) {
  const columnas = await columnasDe(db, 'pedidos');
  const cambios = { estado, actualizado_en: new Date().toISOString() };
  if (columnas.has('respondido_en') && ['aceptado', 'rechazado'].includes(estado)) cambios.respondido_en = cambios.actualizado_en;
  if (columnas.has('cancelado_en') && estado === 'cancelado') cambios.cancelado_en = cambios.actualizado_en;
  if (columnas.has('motivo_codigo') && motivo) cambios.motivo_codigo = motivo;
  if (columnas.has('cerrado_por') && cerradoPor) cambios.cerrado_por = cerradoPor;
  const nombres = Object.keys(cambios);
  await db.query(
    `UPDATE public.pedidos SET ${nombres.map((nombre, i) => `${nombre} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...nombres.map((nombre) => cambios[nombre])],
  );
}

// Anuncio de `vendedor` con un pedido de `comprador` (por defecto, A1 de A con 4 balones de B).
export async function anuncioConPedido(db, creados, { vendedor, comprador, anuncio, estadoAnuncio = 'activo', ...pedidoCambios }) {
  const anuncioId = await insertarAnuncio(db, {
    centro_id: vendedor.id, ...anuncio, estado: estadoAnuncio,
    retirado_en: estadoAnuncio === 'retirado' ? new Date().toISOString() : null,
    entregado_en: estadoAnuncio === 'entregado' ? new Date().toISOString() : null,
  });
  creados.push(anuncioId);
  const id = await insertarPedido(db, {
    anuncioId, compradorId: comprador.id, vendedorId: vendedor.id, anuncio, ...pedidoCambios,
  });
  return { id, anuncioId };
}

// Mientras la pieza no esté fusionada en la rama de la historia, sus casos se omiten con el motivo.
// QA (T33-6) quita estas comprobaciones antes de la PR story → dev: allí todo tiene que ejecutarse.

// T33-2: con la ruta, el comprador recibe 403 (o 400 si valida antes); sin ella, 404.
export async function hayRuta(request, tokenComprador, pedidoId, accion) {
  const res = await request.post(`/api/pedidos/${pedidoId}/${accion}`, { headers: autorizacion(tokenComprador), data: {} });
  return res.status() !== 404;
}

// T33-1: con la ruta, la lista responde 200.
export async function hayLista(request, token) {
  return (await listaPedidos(request, token, { rol: 'recibidos' })).status() === 200;
}

export async function hayContador(request, token) {
  return (await contadorPedidos(request, token)).status() === 200;
}

// T33-4: la pantalla `/pedidos` se titula «Pedidos».
export async function hayBandeja(page) {
  await page.goto('/pedidos');
  return page.getByRole('heading', { level: 1, name: 'Pedidos', exact: true })
    .waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

// T33-5: «Aceptar» y «Rechazar» en `/pedidos/:id` (la página ya abierta como vendedor de un pendiente).
export async function hayBotonesVendedor(page) {
  return boton(page, 'Rechazar').waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

export function pestana(page, nombre) {
  return page.getByRole('tab', { name: nombre })
    .or(page.getByRole('button', { name: nombre }))
    .or(page.getByRole('link', { name: nombre }));
}

export function enlacePedidosCabecera(page) {
  return page.getByRole('banner').getByRole('link', { name: /^Pedidos/ });
}

// Cuenta los POST a una acción del pedido (para comprobar que la validación de la web no envía nada).
export function contarAcciones(page, accion) {
  const envios = [];
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && new URL(peticion.url()).pathname.endsWith(`/${accion}`)) envios.push(peticion);
  });
  return envios;
}
