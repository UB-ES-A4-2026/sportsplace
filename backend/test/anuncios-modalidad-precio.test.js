import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { anuncioNoEncontrado } from '../src/repositories/anuncios.js';
import { marcarEnterosConDecimales, validarAnuncio } from '../src/validation/anuncios.js';
import { postJson, startApi } from './helpers.js';

// US-14: modalidad y precio por unidad (CA1, CA2, CA8, CA9, CA11, E2E-5).
const base = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
};
const venta = { ...base, modalidad: 'venta', precio_unitario_centimos: 850 };
const donacion = { ...base, modalidad: 'donacion' };

const RANGO = 'El precio debe estar entre 0,01 € y 99.999,99 €.';

function errores(cuerpo) {
  try {
    validarAnuncio(cuerpo);
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'DATOS_INVALIDOS');
    return error.details;
  }
  return {};
}

test('US-14 CA8/E2E-1: una venta con precio devuelve modalidad y céntimos', () => {
  const datos = validarAnuncio(venta);
  assert.equal(datos.modalidad, 'venta');
  assert.equal(datos.precio_unitario_centimos, 850);
});

test('US-14 E2E-2: una donación sin precio, o con null, se guarda con precio null', () => {
  assert.equal(validarAnuncio(donacion).precio_unitario_centimos, null);
  assert.equal(validarAnuncio({ ...donacion, precio_unitario_centimos: null }).precio_unitario_centimos, null);
});

test('US-14 CA1/CA9: sin modalidad o con una que no existe', () => {
  assert.deepEqual(errores(base), { modalidad: 'Elige si es venta o donación.' });
  assert.deepEqual(errores({ ...base, modalidad: '' }), { modalidad: 'Elige si es venta o donación.' });
  for (const modalidad of ['regalo', 'Venta', 'DONACION', 1, true]) {
    assert.deepEqual(errores({ ...base, modalidad }), { modalidad: 'La modalidad no es válida.' });
  }
});

test('US-14 CA9: venta sin precio o con null pide el precio', () => {
  assert.deepEqual(errores({ ...base, modalidad: 'venta' }), {
    precio_unitario_centimos: 'Indica el precio por unidad.',
  });
  assert.deepEqual(errores({ ...venta, precio_unitario_centimos: null }), {
    precio_unitario_centimos: 'Indica el precio por unidad.',
  });
});

test('US-14 CA9/CA11: precio 1 y 9999999 se aceptan; 0, 10000000, 8.5, "850" y negativos no', () => {
  assert.equal(validarAnuncio({ ...venta, precio_unitario_centimos: 1 }).precio_unitario_centimos, 1);
  assert.equal(validarAnuncio({ ...venta, precio_unitario_centimos: 9999999 }).precio_unitario_centimos, 9999999);
  for (const precio of [0, 10000000, 8.5, '850', -5, true, Number.NaN]) {
    assert.deepEqual(errores({ ...venta, precio_unitario_centimos: precio }), { precio_unitario_centimos: RANGO });
  }
});

test('US-14 CA9: en el JSON, 850.0 o 8.5e2 se rechazan; solo entero JSON', () => {
  for (const texto of ['850.0', '8.5e2']) {
    const cuerpo = JSON.parse(`{"precio_unitario_centimos": ${texto}}`, marcarEnterosConDecimales);
    assert.deepEqual(errores({ ...venta, ...cuerpo }), { precio_unitario_centimos: RANGO });
  }
});

test('US-14 CA9/E2E-5: una donación con cualquier precio distinto de null se rechaza', () => {
  for (const precio of [500, 0, '', 'abc']) {
    assert.deepEqual(errores({ ...donacion, precio_unitario_centimos: precio }), {
      precio_unitario_centimos: 'Una donación no puede tener precio.',
    });
  }
});

test('US-14 CA2: sin una modalidad válida, el precio no se valida', () => {
  assert.deepEqual(errores({ ...base, modalidad: 'regalo', precio_unitario_centimos: 'abc' }), {
    modalidad: 'La modalidad no es válida.',
  });
});

test('US-12 CA17 y US-14: los errores de modalidad y precio salen junto a los demás', () => {
  assert.deepEqual(errores({ ...venta, titulo: 'Bola', precio_unitario_centimos: 0 }), {
    titulo: 'El título debe tener entre 5 y 80 caracteres.',
    precio_unitario_centimos: RANGO,
  });
});

// API: POST /api/anuncios y GET /api/anuncios/:id con un repositorio simulado.
const fakeAuth = {
  getUser: async (token) => (token === 'token-a' ? { id: 'usuario-a', email: 'a@example.com', email_confirmado: true } : null),
};
let filas;
const fakeAnuncios = {
  async crear(usuarioId, datos) {
    const ahora = '2026-11-03T10:15:00.000Z';
    const anuncio = {
      id: randomUUID(), centro_id: 'centro-a', ...datos, estado: 'activo', fotos: [],
      publicado_en: ahora, creado_en: ahora, actualizado_en: ahora,
    };
    filas.push(anuncio);
    return anuncio;
  },
  async obtener(usuarioId, id) {
    const anuncio = filas.find((fila) => fila.id === id);
    if (!anuncio) throw anuncioNoEncontrado();
    return anuncio;
  },
};

let api;
before(async () => { api = await startApi({ auth: fakeAuth, anuncios: fakeAnuncios }); });
after(() => api.close());
beforeEach(() => { filas = []; });

const conToken = { Authorization: 'Bearer token-a' };
const publicar = (cuerpo) => postJson(`${api.baseUrl}/api/anuncios`, cuerpo, conToken);
const publicarTexto = (texto) => fetch(`${api.baseUrl}/api/anuncios`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...conToken },
  body: texto,
});

test('US-14 E2E-1 (API): publicar una venta de 8,50 € responde 201 con 850 céntimos y la ficha lo muestra', async () => {
  const response = await publicar(venta);
  assert.equal(response.status, 201);
  const { anuncio } = await response.json();
  assert.equal(anuncio.modalidad, 'venta');
  assert.equal(anuncio.precio_unitario_centimos, 850);

  const ficha = await (await fetch(`${api.baseUrl}/api/anuncios/${anuncio.id}`, { headers: conToken })).json();
  assert.equal(ficha.anuncio.modalidad, 'venta');
  assert.equal(ficha.anuncio.precio_unitario_centimos, 850);
});

test('US-14 E2E-2 (API): publicar una donación responde 201 con precio null', async () => {
  const response = await publicar(donacion);
  assert.equal(response.status, 201);
  const { anuncio } = await response.json();
  assert.equal(anuncio.modalidad, 'donacion');
  assert.equal(anuncio.precio_unitario_centimos, null);
});

test('US-14 E2E-5 (API): una donación con precio 500 responde 400 y no se crea', async () => {
  const response = await publicar({ ...donacion, precio_unitario_centimos: 500 });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los campos marcados.',
      details: { precio_unitario_centimos: 'Una donación no puede tener precio.' },
    },
  });
  assert.deepEqual(filas, []);
});

test('US-14 CA9 (API): sin modalidad, venta sin precio, 850.0 y "850" responden 400 con su mensaje', async () => {
  const casos = [
    [JSON.stringify(base), { modalidad: 'Elige si es venta o donación.' }],
    [JSON.stringify({ ...base, modalidad: 'venta' }), { precio_unitario_centimos: 'Indica el precio por unidad.' }],
    [JSON.stringify(venta).replace('"precio_unitario_centimos":850', '"precio_unitario_centimos":850.0'), { precio_unitario_centimos: RANGO }],
    [JSON.stringify({ ...venta, precio_unitario_centimos: '850' }), { precio_unitario_centimos: RANGO }],
  ];
  for (const [texto, details] of casos) {
    const response = await publicarTexto(texto);
    assert.equal(response.status, 400);
    assert.deepEqual((await response.json()).error.details, details);
  }
  assert.deepEqual(filas, []);
});
