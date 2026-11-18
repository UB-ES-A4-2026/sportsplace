// T10-3 · E2E y tests de API de US-10 (ver el perfil de otro centro).
// Casos: docs/especificacion/E01-E02-registro-y-perfil.md (US-10, E2E-1 a E2E-5, CA1-CA19).
// Para que los recuentos no dependan del resto de specs (que publican anuncios de A y B), se crean tres centros de
// prueba sin usuario de Auth (usuario_id es opcional) con sus anuncios. B los consulta; A consulta su propio perfil.
// Al acabar se borran sus anuncios y los tres centros.
// CA1 (enlace desde el detalle del anuncio) depende de US-24, que aún no está en esta story: ver la PR.
// CA9 «centro eliminado» depende de US-11 (no existe la columna); se comprueban inexistente e id no UUID.
// El 403 EMAIL_NO_CONFIRMADO, el 405 y el 503 de la API los cubren los tests del backend
// (backend/test/centros-perfil-publico.test.js).
import { test, expect, entrar } from '../fixtures.js';
import { createDatabase } from '../../backend/src/database.js';
import { loadTestEnvironment } from '../environment.js';
import { fixtureAnuncios } from '../../tools/scripts/e2e-fixtures.js';

const PLANTILLA = fixtureAnuncios()[0].id;
const INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const TEXTOS = {
  titulo: 'Perfil de centro',
  sinContacto: 'Este centro no ha indicado datos de contacto.',
  sinAnuncios: 'Este centro no tiene anuncios activos ahora mismo.',
  noEncontrado: 'Centro no encontrado',
  noEncontradoTexto: 'Este centro no existe o ya no está en Sportsplace.',
  irAlCatalogo: 'Ir al catálogo',
  bandaPropia: 'Así ven tu perfil los demás centros.',
  verComoMeVen: 'Ver cómo ven mi perfil',
  noDisponible: 'No disponible',
  cargando: 'Cargando…',
  error: 'No se ha podido cargar.',
};

// Centro completo del flujo E2E-1 / E2E-2: con dirección, CP y coordenadas que nunca deben salir (CA14).
const CLUB = {
  id: crypto.randomUUID(),
  nombre: 'Club Natació Exemple QA',
  email: 'piscina-qa-us10@example.test',
  localidad: 'Barcelona',
  provincia: 'Barcelona',
  direccion: 'Carrer de la Piscina 12',
  codigo_postal: '08025',
  latitud: 41.40338,
  longitud: 2.17403,
  telefono: '+34 931 234 567',
  email_contacto: 'material@clubnatacio-qa.cat',
  web: 'https://clubnatacio-qa.cat',
  descripcion: 'Club de natación del barrio.\nPrestamos material a otros centros.',
  creado_en: '2026-10-09T10:00:00.000Z',
};
// 20 activos + 1 reservado (el más antiguo, en la página 2) y anuncios que nunca se listan (CA15, CA17).
const PAGINADO = {
  id: crypto.randomUUID(), nombre: 'Centro paginado QA', email: 'paginado-qa-us10@example.test', localidad: 'Girona',
  provincia: 'Girona', creado_en: '2026-10-01T10:00:00.000Z',
};
// Sin contacto, sin código postal ni provincia, sin anuncios y con HTML en la descripción (CA7, CA18, CA19).
const VACIO = {
  id: crypto.randomUUID(), nombre: 'Centro vacío QA', email: 'vacio-qa-us10@example.test', localidad: 'Badalona',
  descripcion: '<b>Hola</b> <a href="https://malicioso.example">pulsa aquí</a>', creado_en: '2026-10-02T10:00:00.000Z',
};
const CENTROS_QA = [CLUB, PAGINADO, VACIO];

const CLAVES_CENTRO = ['creado_en', 'descripcion', 'email_contacto', 'es_mio', 'id', 'localidad', 'nombre', 'provincia',
  'telefono', 'web'];
const PRIVADAS = ['email', 'usuario_id', 'direccion', 'codigo_postal', 'latitud', 'longitud',
  'politica_privacidad_aceptada', 'politica_privacidad_aceptada_en', 'email_confirmado_en', 'email_confirmado'];

let db;
let centroA;
const anunciosClub = {};
const anunciosPaginado = { activos: [], reservado: null };

test.beforeAll(async ({ cuentas }) => {
  db = createDatabase({ environment: loadTestEnvironment() });
  ({ rows: [centroA] } = await db.query('SELECT id, nombre FROM public.centros WHERE email = $1', [cuentas.centroA]));

  for (const centro of CENTROS_QA) {
    const columnas = Object.keys(centro);
    await db.query(
      `INSERT INTO public.centros (${columnas.join(', ')}, politica_privacidad_aceptada, politica_privacidad_aceptada_en,
         email_confirmado_en)
       VALUES (${columnas.map((_, i) => `$${i + 1}`).join(', ')}, true, now(), now())`,
      columnas.map((columna) => centro[columna]),
    );
  }

  // E2E-1: tres activos y uno pausado (no debe aparecer).
  for (const [clave, estado, minuto] of [['a1', 'activo', 1], ['a2', 'activo', 2], ['a3', 'activo', 3], ['pausado', 'pausado', 4]]) {
    anunciosClub[clave] = await nuevoAnuncio(CLUB.id, {
      titulo: `Anuncio ${clave} del club`, estado, publicado_en: momento(minuto),
    });
  }

  // E2E-3 / CA17: 20 activos (del 1, más reciente, al 20) + 1 reservado más antiguo → 20 + 1.
  for (let n = 1; n <= 20; n += 1) {
    anunciosPaginado.activos.push(await nuevoAnuncio(PAGINADO.id, {
      titulo: `Activo ${String(n).padStart(2, '0')}`, publicado_en: momento(100 - n),
    }));
  }
  anunciosPaginado.reservado = await nuevoAnuncio(PAGINADO.id, {
    titulo: 'Reservado más antiguo', estado: 'reservado', publicado_en: momento(10),
  });
  // CA15: nunca se listan.
  await nuevoAnuncio(PAGINADO.id, { titulo: 'Pausado oculto', estado: 'pausado', publicado_en: momento(200) });
  await nuevoAnuncio(PAGINADO.id, {
    titulo: 'Entregado oculto', estado: 'entregado', entregado_en: momento(201), publicado_en: momento(201),
  });
  await nuevoAnuncio(PAGINADO.id, {
    titulo: 'Retirado oculto', estado: 'retirado', retirado_en: momento(202), publicado_en: momento(202),
  });
});

test.afterAll(async () => {
  if (!db) return;
  const ids = CENTROS_QA.map((centro) => centro.id);
  await db.query('DELETE FROM public.anuncios WHERE centro_id = ANY($1::uuid[])', [ids]);
  await db.query('DELETE FROM public.centros WHERE id = ANY($1::uuid[])', [ids]);
  await db.close();
});

// ---------------------------------------------------------------- utilidades

function momento(minutos) {
  return new Date(Date.UTC(2026, 10, 1, 9, 0) + minutos * 60_000).toISOString();
}

async function nuevoAnuncio(centroId, cambios) {
  const { rows } = await db.query(
    `INSERT INTO public.anuncios
     SELECT (jsonb_populate_record(NULL::public.anuncios, to_jsonb(a) || $2::jsonb)).*
     FROM public.anuncios a WHERE a.id = $1
     RETURNING id`,
    [PLANTILLA, JSON.stringify({
      id: crypto.randomUUID(), centro_id: centroId, estado: 'activo', retirado_en: null, entregado_en: null,
      ...cambios, creado_en: cambios.publicado_en, actualizado_en: cambios.publicado_en,
    })],
  );
  return rows[0].id;
}

async function tokenDe(request, email, password) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).sesion.access_token;
}

function conToken(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

async function esperarNoEncontrado(res) {
  expect(res.status()).toBe(404);
  expect((await res.json()).error.code).toBe('NO_ENCONTRADO');
}

function tarjetas(page) {
  return page.getByRole('region', { name: /^Anuncios activos/ }).getByRole('listitem');
}

// ---------------------------------------------------------------- flujos e2e

test('US-10 · E2E-1 · camino feliz: perfil con zona, descripción, contacto y 3 anuncios activos', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/centros/${CLUB.id}`);
  const main = page.getByRole('main');

  // Cabecera y CA5.
  await expect(main.getByText(TEXTOS.titulo, { exact: true })).toBeVisible();
  await expect(main.getByRole('heading', { level: 1, name: CLUB.nombre })).toBeVisible();
  await expect(main.getByText('Zona: Barcelona (Barcelona)', { exact: true })).toBeVisible();
  await expect(main.getByText('En Sportsplace desde 09/10/2026', { exact: true })).toBeVisible();
  const sobre = main.getByRole('region', { name: 'Sobre nosotros' });
  await expect(sobre.locator('p')).toHaveText(CLUB.descripcion);
  // Sin banda de propietario: no es mi centro.
  await expect(main.getByText(TEXTOS.bandaPropia)).toHaveCount(0);

  // CA8: teléfono como tel:, email como mailto: y web en pestaña nueva con rel="noopener noreferrer".
  const contacto = main.getByRole('region', { name: 'Contacto' });
  await expect(contacto.getByRole('link', { name: CLUB.telefono })).toHaveAttribute('href', 'tel:+34931234567');
  await expect(contacto.getByRole('link', { name: CLUB.email_contacto }))
    .toHaveAttribute('href', `mailto:${CLUB.email_contacto}`);
  const web = contacto.getByRole('link', { name: CLUB.web });
  await expect(web).toHaveAttribute('href', CLUB.web);
  await expect(web).toHaveAttribute('target', '_blank');
  await expect(web).toHaveAttribute('rel', 'noopener noreferrer');

  // CA6: tres activos, del más reciente al más antiguo; el pausado no aparece.
  await expect(main.getByRole('heading', { name: 'Anuncios activos (3)' })).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(3);
  await expect(tarjetas(page).locator('.tarjeta-centro-titulo'))
    .toHaveText(['Anuncio a3 del club', 'Anuncio a2 del club', 'Anuncio a1 del club']);
  await expect(main.getByText('Anuncio pausado del club')).toHaveCount(0);

  // CA14: nada privado en la pantalla.
  for (const privado of [CLUB.email, CLUB.direccion, CLUB.codigo_postal]) {
    await expect(main.getByText(privado)).toHaveCount(0);
  }

  // CA3: la tarjeta lleva al anuncio.
  await tarjetas(page).filter({ hasText: 'Anuncio a2 del club' }).getByRole('link').click();
  await expect(page).toHaveURL(`/anuncios/${anunciosClub.a2}`);
});

test('US-10 · E2E-2 · la API no devuelve datos privados', async ({ request, cuentas }) => {
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  const res = await request.get(`/api/centros/${CLUB.id}`, conToken(token));
  expect(res.status()).toBe(200);
  const texto = await res.text();
  // Lo que pide E2E-2 literalmente: ni el email de acceso ni la dirección.
  expect(texto).not.toContain(CLUB.email);
  expect(texto).not.toContain(CLUB.direccion);

  // CA11 y CA14: exactamente los campos públicos, con es_mio.
  const { centro } = JSON.parse(texto);
  expect(Object.keys(centro).sort()).toEqual(CLAVES_CENTRO);
  for (const clave of PRIVADAS) expect(centro).not.toHaveProperty(clave);
  expect(centro).toEqual({
    id: CLUB.id, nombre: CLUB.nombre, localidad: CLUB.localidad, provincia: CLUB.provincia,
    descripcion: CLUB.descripcion, telefono: CLUB.telefono, email_contacto: CLUB.email_contacto, web: CLUB.web,
    creado_en: CLUB.creado_en, es_mio: false,
  });

  // CA12 y CA14: la lista de anuncios tampoco arrastra datos del centro.
  const lista = await request.get(`/api/centros/${CLUB.id}/anuncios`, conToken(token));
  expect(lista.status()).toBe(200);
  const textoLista = await lista.text();
  for (const privado of [CLUB.email, CLUB.direccion, CLUB.codigo_postal]) expect(textoLista).not.toContain(privado);
});

test('US-10 · E2E-3 · paginación: 21 anuncios → 20 + 1', async ({ page, request, cuentas }) => {
  // API (CA12, CA15, CA17).
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  const pagina = async (n) => {
    const res = await request.get(`/api/centros/${PAGINADO.id}/anuncios${n ? `?pagina=${n}` : ''}`, conToken(token));
    expect(res.status()).toBe(200);
    return res.json();
  };
  const p1 = await pagina();
  expect(p1).toMatchObject({ pagina: 1, total: 21 });
  expect(p1.anuncios.map((a) => a.id)).toEqual(anunciosPaginado.activos);
  const p2 = await pagina(2);
  expect(p2).toMatchObject({ pagina: 2, total: 21 });
  expect(p2.anuncios.map(({ id, estado }) => ({ id, estado })))
    .toEqual([{ id: anunciosPaginado.reservado, estado: 'reservado' }]);
  expect(await pagina(3)).toEqual({ anuncios: [], pagina: 3, total: 21 });
  for (const malo of ['0', 'abc']) {
    const res = await request.get(`/api/centros/${PAGINADO.id}/anuncios?pagina=${malo}`, conToken(token));
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('DATOS_INVALIDOS');
  }

  // Web (CA3, CA6, CA17).
  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/centros/${PAGINADO.id}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Anuncios activos (21)' })).toBeVisible();
  await expect(tarjetas(page)).toHaveCount(20);
  const anterior = main.getByRole('button', { name: 'Anterior', exact: true });
  const siguiente = main.getByRole('button', { name: 'Siguiente', exact: true });
  await expect(anterior).toBeDisabled();
  await siguiente.click();
  await expect(page).toHaveURL(`/centros/${PAGINADO.id}?pagina=2`);
  await expect(tarjetas(page)).toHaveCount(1);
  await expect(tarjetas(page).first()).toContainText('Reservado más antiguo');
  await expect(tarjetas(page).first().getByText(TEXTOS.noDisponible, { exact: true })).toBeVisible();
  await expect(siguiente).toBeDisabled();
  await expect(anterior).toBeEnabled();
  await anterior.click();
  await expect(page).toHaveURL(`/centros/${PAGINADO.id}`);
  await expect(tarjetas(page)).toHaveCount(20);
  for (const oculto of ['Pausado oculto', 'Entregado oculto', 'Retirado oculto']) {
    await expect(main.getByText(oculto)).toHaveCount(0);
  }
});

test('US-10 · E2E-4 · centro inexistente o id no válido', async ({ page, request, cuentas }) => {
  await entrar(page, cuentas.centroB, cuentas.password);
  for (const id of [INEXISTENTE, 'no-es-un-uuid']) {
    await page.goto(`/centros/${id}`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1, name: TEXTOS.noEncontrado })).toBeVisible();
    await expect(main.getByText(TEXTOS.noEncontradoTexto, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: TEXTOS.irAlCatalogo })).toHaveAttribute('href', '/catalogo');
  }

  // CA13: la API responde 404 igual en los dos casos y en su lista de anuncios.
  const token = await tokenDe(request, cuentas.centroB, cuentas.password);
  for (const id of [INEXISTENTE, 'no-es-un-uuid']) {
    await esperarNoEncontrado(await request.get(`/api/centros/${id}`, conToken(token)));
    await esperarNoEncontrado(await request.get(`/api/centros/${id}/anuncios`, conToken(token)));
  }
});

test('US-10 · E2E-5 · perfil propio: banda y «Editar perfil»; CA4 y CA15', async ({ page, request, cuentas }) => {
  // CA4: desde /perfil, «Ver cómo ven mi perfil» → /centros/<mi id>.
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.goto('/perfil');
  await page.getByRole('link', { name: TEXTOS.verComoMeVen }).click();
  await expect(page).toHaveURL(`/centros/${centroA.id}`);

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: centroA.nombre })).toBeVisible();
  await expect(main.getByText(TEXTOS.bandaPropia, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Editar perfil', exact: true })).toHaveAttribute('href', '/perfil/editar');

  // API: es_mio y, también para el propio centro, solo activos y reservados (CA15). La semilla de A tiene
  // anuncios pausados, entregados y uno retirado.
  const token = await tokenDe(request, cuentas.centroA, cuentas.password);
  const { centro } = await (await request.get(`/api/centros/${centroA.id}`, conToken(token))).json();
  expect(centro.es_mio).toBe(true);
  let total = Infinity;
  const vistos = [];
  for (let n = 1; vistos.length < total; n += 1) {
    const res = await request.get(`/api/centros/${centroA.id}/anuncios?pagina=${n}`, conToken(token));
    const cuerpo = await res.json();
    total = cuerpo.total;
    if (cuerpo.anuncios.length === 0) break;
    vistos.push(...cuerpo.anuncios);
  }
  expect(vistos.length).toBe(total);
  expect(new Set(vistos.map((a) => a.estado))).toEqual(new Set(['activo', 'reservado']));
  // CA6: orden por publicación descendente.
  const fechas = vistos.map((a) => a.publicado_en);
  expect([...fechas].sort().reverse()).toEqual(fechas);
});

// ---------------------------------------------------------------- resto de CA

test('US-10 · CA2 · sin sesión → /entrar y vuelve al perfil tras entrar', async ({ page, cuentas }) => {
  await page.goto(`/centros/${CLUB.id}`);
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel('Email', { exact: false }).fill(cuentas.centroB);
  await page.getByLabel('Contraseña', { exact: false }).fill(cuentas.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(`/centros/${CLUB.id}`);
  await expect(page.getByRole('heading', { level: 1, name: CLUB.nombre })).toBeVisible();
});

test('US-10 · CA7, CA8, CA18 y CA19 · centro sin contacto, sin provincia, sin anuncios y con HTML', async ({ page, cuentas }) => {
  const dialogos = [];
  page.on('dialog', async (dialogo) => { dialogos.push(dialogo.message()); await dialogo.dismiss(); });
  await entrar(page, cuentas.centroB, cuentas.password);
  await page.goto(`/centros/${VACIO.id}`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: VACIO.nombre })).toBeVisible();
  await expect(main.getByText('Zona: Badalona', { exact: true })).toBeVisible(); // CA19
  await expect(main.getByText(TEXTOS.sinContacto, { exact: true })).toBeVisible(); // CA8
  await expect(main.getByRole('heading', { name: 'Anuncios activos (0)' })).toBeVisible();
  await expect(main.getByText(TEXTOS.sinAnuncios, { exact: true })).toBeVisible(); // CA7
  await expect(main.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
  // CA18: el HTML se ve como texto y no hay enlace ni negrita.
  const sobre = main.getByRole('region', { name: 'Sobre nosotros' });
  await expect(sobre.getByText(VACIO.descripcion)).toBeVisible();
  await expect(sobre.locator('a, b')).toHaveCount(0);
  expect(dialogos).toEqual([]);
});

test('US-10 · CA10 · «Cargando…», error y «Reintentar»', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroB, cuentas.password);
  let liberar;
  const retenida = new Promise((resolve) => { liberar = resolve; });
  const ruta = `**/api/centros/${CLUB.id}`;
  await page.route(ruta, async (route) => {
    await retenida;
    await route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'BASE_DATOS_NO_DISPONIBLE', message: 'No disponible.' } }),
    }).catch(() => {});
  });
  await page.goto(`/centros/${CLUB.id}`);
  const main = page.getByRole('main');
  await expect(main.getByText(TEXTOS.cargando)).toBeVisible();
  liberar();
  await expect(main.getByText(TEXTOS.error)).toBeVisible();

  await page.unroute(ruta);
  await main.getByRole('button', { name: 'Reintentar' }).click();
  await expect(main.getByRole('heading', { level: 1, name: CLUB.nombre })).toBeVisible();
});

test('US-10 · API · CA13 · sin sesión responde 401', async ({ request }) => {
  for (const ruta of [`/api/centros/${CLUB.id}`, `/api/centros/${CLUB.id}/anuncios`]) {
    const res = await request.get(ruta);
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO');
  }
});
