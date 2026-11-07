// Utilidades comunes de los E2E de E04 (catálogo, búsqueda y filtros: US-96, US-21, US-22, US-73 y US-74).
// Cada caso deja el catálogo vacío y crea solo sus anuncios; al terminar, la semilla vuelve a su estado inicial.
import { expect } from './fixtures.js';
import { fixtureAnuncios, seedAnuncios } from '../tools/scripts/e2e-fixtures.js';

const IDS_SEMILLA = fixtureAnuncios().map((anuncio) => anuncio.id);
// Fila activa de A de la semilla: sirve de plantilla para copiar todas las columnas del esquema.
const PLANTILLA = IDS_SEMILLA[0];
const DESCRIPCION = 'Material deportivo en buen estado, listo para entregar.';

export async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

export async function datosCentro(db, email) {
  const { rows } = await db.query('SELECT id, nombre, localidad FROM public.centros WHERE email = $1', [email]);
  expect(rows).toHaveLength(1);
  return rows[0];
}

// Ningún anuncio queda en el catálogo: así los totales de cada caso no dependen de otros specs.
export async function vaciarCatalogo(db) {
  await db.query(
    `UPDATE public.anuncios SET estado = 'retirado', retirado_en = now(), entregado_en = NULL
     WHERE estado <> 'retirado'`,
  );
}

// Los anuncios creados por los casos se quedan retirados y la semilla vuelve a su estado inicial.
export async function restablecerSemilla(db) {
  await db.query(
    `UPDATE public.anuncios SET estado = 'retirado', retirado_en = now(), entregado_en = NULL
     WHERE NOT (id = ANY($1::uuid[])) AND estado <> 'retirado'`,
    [IDS_SEMILLA],
  );
  await seedAnuncios(db, { requireAnuncios: true });
}

// Fecha fija (UTC) para que el orden y «Publicado el dd/mm/aaaa» sean deterministas.
export function fecha(dia, minutos = 0) {
  return new Date(Date.UTC(2026, 9, dia, 9, 15 + minutos)).toISOString();
}

// Copia la fila plantilla con los cambios indicados. Por defecto, una venta activa de 12,50 € con 3 unidades.
export async function insertarAnuncio(db, cambios) {
  const momento = cambios.publicado_en ?? fecha(20);
  const fila = {
    id: crypto.randomUUID(),
    descripcion: DESCRIPCION,
    categoria: 'balones',
    deporte: 'futbol',
    estado: 'activo',
    estado_material: 'buen_estado',
    unidades_disponibles: 3,
    modalidad: 'venta',
    precio_unitario_centimos: 1250,
    publicado_en: momento,
    creado_en: momento,
    actualizado_en: momento,
    retirado_en: null,
    entregado_en: null,
    ...cambios,
  };
  if (fila.estado === 'retirado' && !fila.retirado_en) fila.retirado_en = momento;
  if (fila.estado === 'entregado' && !fila.entregado_en) fila.entregado_en = momento;
  if (fila.modalidad === 'donacion') fila.precio_unitario_centimos = null;
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify(fila)],
  );
  return rows[0].id;
}

export async function getCatalogo(request, token, consulta = '') {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return request.get(`/api/catalogo${consulta ? `?${consulta}` : ''}`, { headers });
}

// Mientras la pieza no esté fusionada en la rama de la historia, sus casos se omiten con el motivo.
// QA (T21-7) quita estas comprobaciones antes de la PR story → dev: allí todo tiene que ejecutarse.
export async function hayApiCatalogo(request, token) {
  return (await getCatalogo(request, token)).status() !== 404;
}

// Con `q` implementado, «a» responde 400 (US-21 CA20); sin implementar, el parámetro se ignora (200).
export async function hayBusquedaEnApi(request, token) {
  return (await getCatalogo(request, token, 'q=a')).status() === 400;
}

// Con los filtros de US-22 implementados, una categoría desconocida responde 400; sin ellos, se ignora.
export async function hayFiltrosEnApi(request, token) {
  return (await getCatalogo(request, token, 'categoria=no_existe')).status() === 400;
}

export async function hayPantallaCatalogo(page) {
  await page.goto('/catalogo');
  return page.getByRole('heading', { level: 1, name: 'Catálogo' })
    .waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

export async function hayCuadroBusqueda(page) {
  return (await hayPantallaCatalogo(page))
    && page.getByPlaceholder('Buscar material…').waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

// Cada tarjeta es un enlace a la ficha del anuncio (US-96 CA3).
export function tarjetas(page) {
  return page.getByRole('main').locator('a[href^="/anuncios/"]:not([href="/anuncios/nuevo"])');
}

export function tarjeta(page, titulo) {
  return tarjetas(page).filter({ hasText: titulo });
}

export function boton(page, nombre) {
  return page.getByRole('button', { name: nombre, exact: true })
    .or(page.getByRole('link', { name: nombre, exact: true }));
}

// Cuenta las peticiones a la API del catálogo para comprobar cuándo se busca y cuándo no.
export function contarPeticiones(page) {
  const urls = [];
  page.on('request', (peticion) => {
    if (new URL(peticion.url()).pathname === '/api/catalogo') urls.push(peticion.url());
  });
  return urls;
}

// Con cada filtro implementado, un valor no aceptado responde 400 (US-22 CA12, US-73 CA11, US-74 CA6).
export async function hayFiltroEnApi(request, token, consulta) {
  return (await getCatalogo(request, token, consulta)).status() === 400;
}

// La barra de filtros (T21-6) empieza por el desplegable «Categoría» (US-22).
export async function hayBarraFiltros(page) {
  return (await hayPantallaCatalogo(page))
    && page.getByRole('combobox', { name: 'Categoría' }).waitFor({ timeout: 5_000 }).then(() => true, () => false);
}

// Ruta y parámetros de la URL actual, sin depender del orden ni de si la coma va como «%2C».
export function consulta(page) {
  const url = new URL(page.url());
  return { ruta: url.pathname, ...Object.fromEntries(url.searchParams) };
}

export function desplegable(page, nombre) {
  return page.getByRole('combobox', { name: nombre, exact: true });
}

// Etiqueta de filtro activo «Nombre: Valor ×» (US-22 CA6).
export function etiqueta(page, texto) {
  return page.getByRole('main').getByText(texto, { exact: false }).first();
}

// Su «×»: o la etiqueta entera es un botón con ese texto, o el elemento más interno que la contiene lleva un botón.
export function quitarEtiqueta(page, texto) {
  const inicio = new RegExp(`^(quitar( filtro)?:? )?${texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  const contenedor = page.getByRole('main').locator('*')
    .filter({ hasText: texto, has: page.getByRole('button') }).last();
  return page.getByRole('button', { name: inicio }).or(contenedor.getByRole('button').last()).first();
}

// «Limpiar filtros» sale en la barra y, sin resultados, también como botón (US-22 CA10): vale cualquiera.
export function limpiarFiltros(page) {
  return boton(page, 'Limpiar filtros').first();
}
