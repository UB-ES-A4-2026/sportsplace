// Utilidades comunes de los E2E de US-32 (pedir material, con US-108, US-35 y US-40 juntas en el S2).
// Papeles de la base común de E06: A hace de vendedor («Les Corts»), B de comprador («Gràcia») y el centro
// sin confirmar de tercero sin relación. A1 y A2 son anuncios de A creados por cada spec; al acabar se
// retiran y se borran los pedidos que se hayan hecho sobre ellos.
import { expect } from './fixtures.js';
import { fixtureAnuncios } from '../tools/scripts/e2e-fixtures.js';

// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = fixtureAnuncios()[0].id;
export const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

export const A1 = { titulo: 'Balones de baloncesto talla 7', modalidad: 'venta', precio_unitario_centimos: 850, unidades_disponibles: 12 };
export const A2 = { titulo: 'Petos de entrenamiento reversibles', modalidad: 'donacion', precio_unitario_centimos: null, unidades_disponibles: 30 };

export async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

export function autorizacion(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function datosCentro(db, email) {
  const { rows } = await db.query('SELECT id, nombre, localidad FROM public.centros WHERE email = $1', [email]);
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

// Copia la fila plantilla con los cambios indicados (por defecto, A1 activo de A).
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

export async function anuncio(db, id) {
  const { rows } = await db.query('SELECT estado, unidades_disponibles FROM public.anuncios WHERE id = $1', [id]);
  return rows[0];
}

export async function retirarAnuncios(db, ids) {
  if (ids.length === 0) return;
  if (await hayTablaPedidos(db)) {
    await db.query('DELETE FROM public.pedidos WHERE anuncio_id = ANY($1::uuid[])', [ids]);
  }
  await db.query(
    "UPDATE public.anuncios SET estado = 'retirado', retirado_en = coalesce(retirado_en, now()), entregado_en = NULL WHERE id = ANY($1::uuid[])",
    [ids],
  );
}

export async function pedidosDe(db, anuncioId) {
  const { rows } = await db.query(
    'SELECT to_jsonb(p) AS fila FROM public.pedidos p WHERE anuncio_id = $1 ORDER BY creado_en',
    [anuncioId],
  );
  return rows.map((fila) => fila.fila);
}

// Dirección de envío válida de US-40 (CA4-CA12).
export const DIRECCION = {
  destinatario: 'Marta Puig',
  calle_numero: 'Carrer de Verdi, 12',
  piso_puerta: '2º 1ª',
  codigo_postal: '08012',
  localidad: 'Barcelona',
  provincia: 'Barcelona',
  telefono_contacto: '612345678',
  indicaciones: 'Portería abierta de 9 a 13 h.',
};

// Inserta un pedido en la BD (sin pasar por la API) para probar el detalle (US-108) en cada estado.
// Rellena las columnas de pago y entrega solo si su migración ya está en la rama.
export async function insertarPedido(db, { anuncioId, compradorId, vendedorId, anuncio: datos = A1, ...cambios }) {
  const columnas = await columnasDe(db, 'pedidos');
  const unidades = cambios.unidades ?? 4;
  const fila = {
    id: crypto.randomUUID(),
    anuncio_id: anuncioId,
    comprador_centro_id: compradorId,
    vendedor_centro_id: vendedorId,
    titulo_anuncio: datos.titulo,
    unidades,
    modalidad: datos.modalidad,
    precio_unitario_centimos: datos.precio_unitario_centimos,
    total_centimos: datos.modalidad === 'venta' ? unidades * datos.precio_unitario_centimos : 0,
    mensaje: null,
    estado: 'pendiente',
    creado_en: new Date(Date.UTC(2026, 9, 21, 8, 30)).toISOString(),
    actualizado_en: new Date(Date.UTC(2026, 9, 21, 8, 30)).toISOString(),
  };
  if (columnas.has('metodo_pago')) fila.metodo_pago = datos.modalidad === 'venta' ? 'transferencia' : null;
  if (columnas.has('metodo_entrega')) fila.metodo_entrega = 'recogida';
  Object.assign(fila, cambios);
  const nombres = Object.keys(fila).filter((nombre) => columnas.has(nombre));
  const valores = nombres.map((nombre) => (nombre === 'direccion_envio' && fila[nombre] ? JSON.stringify(fila[nombre]) : fila[nombre]));
  await db.query(
    `INSERT INTO public.pedidos (${nombres.join(', ')}) VALUES (${nombres.map((_, i) => `$${i + 1}`).join(', ')})`,
    valores,
  );
  return fila.id;
}

// Mientras la pieza no esté fusionada en la rama de la historia, sus casos se omiten con el motivo.
// QA (T32-6) quita estas comprobaciones antes de la PR story → dev: allí todo tiene que ejecutarse.
export async function hayTablaPedidos(db) {
  const { rows: [{ existe }] } = await db.query("SELECT to_regclass('public.pedidos') IS NOT NULL AS existe");
  return existe;
}

// Con T32-2, un cuerpo vacío responde 400 DATOS_INVALIDOS; sin la ruta, 404.
export async function hayPostPedidos(request, token) {
  const res = await request.post('/api/pedidos', { headers: autorizacion(token), data: {} });
  return res.status() === 400;
}

// Con T32-3 la ruta exige sesión (401); sin ella, 404 genérico.
export async function hayGetPedido(request) {
  return (await request.get(`/api/pedidos/${INEXISTENTE}`)).status() === 401;
}

export function postPedido(request, token, datos) {
  return request.post('/api/pedidos', { headers: autorizacion(token), data: datos });
}

export function getPedido(request, token, id) {
  return request.get(`/api/pedidos/${id}`, { headers: autorizacion(token) });
}

// Cuerpo mínimo válido según lo que ya acepte la API: forma de pago en venta (US-35) y entrega (US-40).
export function cuerpoPedido(anuncioId, { venta = true, columnas, ...resto } = {}) {
  const cuerpo = { anuncio_id: anuncioId, unidades: 4, mensaje: '' };
  if (venta && columnas?.has('metodo_pago')) cuerpo.metodo_pago = 'transferencia';
  if (columnas?.has('metodo_entrega')) cuerpo.metodo_entrega = 'recogida';
  return { ...cuerpo, ...resto };
}

export function boton(page, nombre) {
  return page.getByRole('button', { name: nombre, exact: true })
    .or(page.getByRole('link', { name: nombre, exact: true }));
}

// T32-4: la pantalla `/anuncios/:id/pedir` se titula «Hacer un pedido».
export async function hayFormularioPedir(page, anuncioId) {
  await page.goto(`/anuncios/${anuncioId}/pedir`);
  return page.getByRole('heading', { level: 1, name: 'Hacer un pedido' })
    .waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

// T32-4: «Pedir» en el detalle de un anuncio de otro centro (sobre la pantalla de T24-2).
export async function hayBotonPedir(page, anuncioId) {
  await page.goto(`/anuncios/${anuncioId}`);
  return boton(page, 'Pedir').waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

// T32-5: la pantalla `/pedidos/:id` se titula «Pedido de <titulo_anuncio>».
export async function hayPantallaPedido(page, pedidoId) {
  await page.goto(`/pedidos/${pedidoId}`);
  return page.getByRole('heading', { level: 1, name: /^Pedido de / })
    .waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

export function campoUnidades(page) {
  return page.getByRole('spinbutton', { name: 'Unidades' }).or(page.getByLabel('Unidades', { exact: true })).first();
}

export function campoMensaje(page) {
  return page.getByLabel(/^Mensaje para el vendedor/);
}

// Cuenta los POST a /api/pedidos para comprobar que la validación de la web no envía nada.
export function contarEnvios(page) {
  const envios = [];
  page.on('request', (peticion) => {
    if (peticion.method() === 'POST' && new URL(peticion.url()).pathname === '/api/pedidos') envios.push(peticion);
  });
  return envios;
}

export function idDeUrl(page) {
  return new URL(page.url()).pathname.split('/').pop();
}
