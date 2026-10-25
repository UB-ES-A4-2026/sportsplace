import { createRequire } from 'node:module';
import { createDatabase } from '../../backend/src/database.js';
import { test, expect } from '../fixtures.js';

// T13-2 · Integración de POST /api/anuncios con el Storage real del Supabase
// aislado (T12-8). No sustituye los E2E de QA (T13-5): solo comprueba por API que
// las fotos llegan al bucket tal cual y que un rechazo no deja nada guardado.
// Cada prueba borra lo que crea para no alterar la semilla de US-18.
// supabase-js es dependencia del backend; el paquete e2e no la duplica.
const { createClient } = createRequire(new URL('../../backend/package.json', import.meta.url))('@supabase/supabase-js');
const API = 'http://127.0.0.1:4300';
const PREFIJO_PUBLICO = '/storage/v1/object/public/anuncios/';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]);
const datos = {
  titulo: 'Prueba de fotos en Storage',
  descripcion: 'Anuncio temporal de la prueba de integración de T13-2.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 2,
  estado_material: 'buen_estado',
};

let database;
let bucket;

test.beforeAll(() => {
  database = createDatabase({ environment: process.env });
  bucket = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from('anuncios');
});

test.afterAll(async () => {
  await database?.close();
});

async function entrarPorApi(email, password) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(200);
  return (await response.json()).access_token;
}

function publicar(token, fotos, fotoPrincipal) {
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify(datos));
  for (const { contenido, tipo, nombre } of fotos) {
    formulario.append('fotos', new Blob([contenido], { type: tipo }), nombre);
  }
  if (fotoPrincipal !== undefined) formulario.append('foto_principal', String(fotoPrincipal));
  return fetch(`${API}/api/anuncios`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formulario });
}

async function centroDe(email) {
  const { rows: [centro] } = await database.query('SELECT id FROM public.centros WHERE email = $1', [email]);
  return centro.id;
}

async function objetosDelCentro(centroId) {
  const { data: carpetas, error } = await bucket.list(centroId, { limit: 1000 });
  expect(error).toBeNull();
  let total = 0;
  for (const carpeta of carpetas) {
    const { data } = await bucket.list(`${centroId}/${carpeta.name}`, { limit: 1000 });
    total += data.length;
  }
  return total;
}

test('T13-2 · CA17-CA19/CA21: las fotos publicadas se guardan sin cambios y se descargan por URL pública', async ({ cuentas }) => {
  const token = await entrarPorApi(cuentas.centroA, cuentas.password);
  const centroId = await centroDe(cuentas.centroA);
  const response = await publicar(token, [
    { contenido: jpg, tipo: 'image/jpeg', nombre: 'balones-originales.jpg' },
    // CA13: el tipo sale de la cabecera binaria, no del nombre.
    { contenido: png, tipo: 'image/jpeg', nombre: 'en-realidad-png.jpg' },
  ], 2);
  expect(response.status).toBe(201);
  const { anuncio } = await response.json();
  const rutas = anuncio.fotos.map((foto) => new URL(foto.url).pathname.slice(PREFIJO_PUBLICO.length));

  try {
    expect(anuncio.fotos.map(({ orden, es_principal }) => ({ orden, es_principal })))
      .toEqual([{ orden: 1, es_principal: false }, { orden: 2, es_principal: true }]);
    expect(rutas[0]).toMatch(new RegExp(`^${centroId}/${anuncio.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(rutas[1]).toMatch(new RegExp(`^${centroId}/${anuncio.id}/[0-9a-f-]{36}\\.png$`));
    expect(anuncio.fotos.map((foto) => foto.url).join(' ')).not.toContain('balones-originales');

    // Descarga sin sesión: mismo contenido byte a byte y el tipo detectado.
    for (const [indice, contenido, tipo] of [[0, jpg, 'image/jpeg'], [1, png, 'image/png']]) {
      const descarga = await fetch(anuncio.fotos[indice].url);
      expect(descarga.status).toBe(200);
      expect(descarga.headers.get('content-type')).toBe(tipo);
      expect(Buffer.from(await descarga.arrayBuffer()).equals(contenido)).toBe(true);
    }

    const { rows } = await database.query(
      'SELECT ruta, tipo_mime, bytes, orden, es_principal FROM public.anuncio_fotos WHERE anuncio_id = $1 ORDER BY orden',
      [anuncio.id],
    );
    expect(rows).toEqual([
      { ruta: rutas[0], tipo_mime: 'image/jpeg', bytes: jpg.length, orden: 1, es_principal: false },
      { ruta: rutas[1], tipo_mime: 'image/png', bytes: png.length, orden: 2, es_principal: true },
    ]);

    const ficha = await fetch(`${API}/api/anuncios/${anuncio.id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(ficha.status).toBe(200);
    expect((await ficha.json()).anuncio.fotos).toEqual(anuncio.fotos);
  } finally {
    await database.query('DELETE FROM public.anuncios WHERE id = $1', [anuncio.id]);
    const { error } = await bucket.remove(rutas);
    expect(error).toBeNull();
  }
});

test('T13-2 · CA13/CA20: una publicación rechazada no deja fotos en Storage ni filas', async ({ cuentas }) => {
  const token = await entrarPorApi(cuentas.centroB, cuentas.password);
  const centroId = await centroDe(cuentas.centroB);
  const objetosAntes = await objetosDelCentro(centroId);
  const { rows: [{ total: anunciosAntes }] } = await database.query(
    'SELECT count(*)::int AS total FROM public.anuncios WHERE centro_id = $1', [centroId],
  );

  const response = await publicar(token, [
    { contenido: png, tipo: 'image/png', nombre: 'valida.png' },
    { contenido: Buffer.from('no soy una imagen'), tipo: 'image/jpeg', nombre: 'falsa.jpg' },
  ]);
  expect(response.status).toBe(400);
  expect((await response.json()).error.details).toHaveProperty('fotos');

  expect(await objetosDelCentro(centroId)).toBe(objetosAntes);
  const { rows: [{ total: anunciosDespues }] } = await database.query(
    'SELECT count(*)::int AS total FROM public.anuncios WHERE centro_id = $1', [centroId],
  );
  expect(anunciosDespues).toBe(anunciosAntes);
});
