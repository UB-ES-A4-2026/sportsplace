// Utilidades comunes de los E2E de US-28 (escribir al centro de un anuncio).
// Papeles de la base común de E05: A hace de vendedor (CNS en la especificación), B de comprador (CEG) y el
// centro sin confirmar solo sirve para crear en la BD una conversación ajena a B, que entonces hace de
// tercer centro (EET). Cada spec crea sus anuncios; al acabar se borran sus conversaciones y se retiran.
import { expect } from './fixtures.js';
import { fixtureAnuncios } from '../tools/scripts/e2e-fixtures.js';

// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = fixtureAnuncios()[0].id;
export const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

export const A1 = { titulo: 'Balones de baloncesto Molten talla 7', modalidad: 'venta', precio_unitario_centimos: 1200, unidades_disponibles: 20 };
export const A2 = { titulo: 'Corcheras de competición 25 m', modalidad: 'donacion', precio_unitario_centimos: null, unidades_disponibles: 4 };

export async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

export function autorizacion(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function datosCentro(db, email) {
  const { rows } = await db.query('SELECT id, nombre, usuario_id FROM public.centros WHERE email = $1', [email]);
  expect(rows).toHaveLength(1);
  return rows[0];
}

export async function columnasDe(db, tabla) {
  const { rows } = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [tabla],
  );
  return new Set(rows.map((fila) => fila.column_name));
}

// Copia la fila plantilla con los cambios indicados (por defecto, A1 activo).
export async function insertarAnuncio(db, cambios) {
  const ahora = new Date().toISOString();
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify({
      id: crypto.randomUUID(), ...A1, estado: 'activo', publicado_en: ahora, creado_en: ahora,
      actualizado_en: ahora, retirado_en: null, entregado_en: null, ...cambios,
    })],
  );
  return rows[0].id;
}

export async function cambiarEstado(db, id, estado) {
  await db.query(
    `UPDATE public.anuncios SET estado = $2,
       retirado_en = CASE WHEN $2 = 'retirado' THEN now() ELSE retirado_en END,
       entregado_en = CASE WHEN $2 = 'entregado' THEN now() ELSE entregado_en END
     WHERE id = $1`,
    [id, estado],
  );
}

// Borra las conversaciones (y sus mensajes) de los anuncios creados y los retira.
export async function limpiarAnuncios(db, ids) {
  if (ids.length === 0) return;
  if (await hayTablaConversaciones(db)) {
    await db.query(
      'DELETE FROM public.mensajes WHERE conversacion_id IN (SELECT id FROM public.conversaciones WHERE anuncio_id = ANY($1::uuid[]))',
      [ids],
    );
    await db.query('DELETE FROM public.conversaciones WHERE anuncio_id = ANY($1::uuid[])', [ids]);
  }
  await db.query(
    "UPDATE public.anuncios SET estado = 'retirado', retirado_en = now() WHERE id = ANY($1::uuid[])",
    [ids],
  );
}

// Crea en la BD (sin pasar por la API) una conversación con sus mensajes, en orden y separados 1 s.
export async function insertarConversacion(db, { anuncioId, comprador, vendedor, mensajes = [] }) {
  const id = crypto.randomUUID();
  const inicio = Date.now() - (mensajes.length + 1) * 1000;
  await db.query(
    `INSERT INTO public.conversaciones (id, anuncio_id, centro_comprador_id, centro_vendedor_id, creada_en)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, anuncioId, comprador.id, vendedor.id, new Date(inicio).toISOString()],
  );
  for (const [i, { autor, texto }] of mensajes.entries()) {
    await db.query(
      `INSERT INTO public.mensajes (conversacion_id, centro_autor_id, autor_usuario_id, texto, creado_en)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, autor.id, autor.usuario_id, texto, new Date(inicio + (i + 1) * 1000).toISOString()],
    );
  }
  return id;
}

export async function conversacionesDe(db, anuncioId) {
  const { rows } = await db.query(
    'SELECT id, centro_comprador_id, centro_vendedor_id FROM public.conversaciones WHERE anuncio_id = $1',
    [anuncioId],
  );
  return rows;
}

export async function mensajesDe(db, conversacionId) {
  const { rows } = await db.query(
    'SELECT centro_autor_id, autor_usuario_id, tipo, texto FROM public.mensajes WHERE conversacion_id = $1 ORDER BY creado_en, id',
    [conversacionId],
  );
  return rows;
}

// Mientras la pieza no esté fusionada en la rama de la historia, sus casos se omiten con el motivo.
// QA (T28-4) quita estas comprobaciones antes de la PR story → dev: allí todo tiene que ejecutarse.
export async function hayTablaConversaciones(db) {
  const { rows: [{ existe }] } = await db.query("SELECT to_regclass('public.conversaciones') IS NOT NULL AS existe");
  return existe;
}

// Con T28-2 las rutas exigen sesión (401); sin ellas, 404 genérico.
export async function hayApiConversaciones(request) {
  const [crear, leer] = await Promise.all([
    request.post('/api/conversaciones', { data: {} }),
    request.get(`/api/conversaciones/${INEXISTENTE}`),
  ]);
  return crear.status() === 401 && leer.status() === 401;
}

export function crearConversacion(request, token, datos) {
  return request.post('/api/conversaciones', { headers: autorizacion(token), data: datos });
}

export function getConversacion(request, token, id) {
  return request.get(`/api/conversaciones/${id}`, { headers: autorizacion(token) });
}

export function enviarMensaje(request, token, id, texto) {
  return request.post(`/api/conversaciones/${id}/mensajes`, { headers: autorizacion(token), data: { texto } });
}

export function getConversacionDeAnuncio(request, token, anuncioId) {
  return request.get(`/api/anuncios/${anuncioId}/conversacion`, { headers: autorizacion(token) });
}

export async function esperarError(res, status, code) {
  expect(res.status()).toBe(status);
  const cuerpo = await res.json();
  expect(cuerpo.error.code).toBe(code);
  return cuerpo.error;
}

export function boton(page, nombre) {
  return page.getByRole('button', { name: nombre, exact: true });
}

export function campoMensaje(page) {
  return page.getByPlaceholder('Escribe tu mensaje…');
}

export function idDeUrl(page) {
  return new URL(page.url()).pathname.split('/').at(-1);
}

// Con T28-3 el detalle del anuncio de otro centro muestra «Escribir al centro».
export async function hayBotonEscribir(page, anuncioId) {
  await page.goto(`/anuncios/${anuncioId}`);
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 5_000 }).catch(() => {});
  return (await boton(page, 'Escribir al centro').count()) > 0;
}

// Con T28-3 existe la pantalla «Nueva conversación».
export async function hayPantallaNueva(page, anuncioId) {
  await page.goto(`/mensajes/nueva?anuncio=${anuncioId}`);
  return page.getByRole('heading', { name: 'Nueva conversación' }).isVisible({ timeout: 5_000 }).catch(() => false);
}

// Con T28-3 existe la pantalla «Conversación» con su pie de escritura.
export async function hayPantallaConversacion(page, conversacionId) {
  await page.goto(`/mensajes/${conversacionId}`);
  return page.getByRole('heading', { name: 'Conversación' }).isVisible({ timeout: 5_000 }).catch(() => false);
}

// Mensajes propios a la derecha y del otro centro a la izquierda (posición respecto al centro del hilo).
export async function lado(page, texto) {
  const caja = await page.getByText(texto, { exact: true }).last().boundingBox();
  const main = await page.getByRole('main').boundingBox();
  return caja.x + caja.width / 2 > main.x + main.width / 2 ? 'derecha' : 'izquierda';
}

export const FECHA = /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/;
