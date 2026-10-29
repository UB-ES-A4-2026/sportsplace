import assert from 'node:assert/strict';
import test from 'node:test';
import { marcarEnterosConDecimales, validarAnuncio } from '../src/validation/anuncios.js';

// US-12: reglas y mensajes de la «Tabla de campos» de E03.
const valido = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: 12,
  estado_material: 'buen_estado',
  modalidad: 'venta',
  precio_unitario_centimos: 850,
};

function errores(cuerpo) {
  try {
    validarAnuncio(cuerpo);
  } catch (error) {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'DATOS_INVALIDOS');
    assert.equal(error.message, 'Revisa los campos marcados.');
    return error.details;
  }
  return {};
}

const parseJson = (texto) => JSON.parse(texto, marcarEnterosConDecimales);

test('US-12 CA5/CA22: un anuncio correcto devuelve solo sus campos, recortados', () => {
  assert.deepEqual(validarAnuncio({ ...valido, titulo: '   Balón   ' }), { ...valido, titulo: 'Balón' });
});

test('US-12 CA17/E2E-2: sin datos devuelve los errores de todos los campos a la vez', () => {
  assert.deepEqual(errores({}), {
    titulo: 'El título es obligatorio.',
    descripcion: 'La descripción es obligatoria.',
    categoria: 'Elige una categoría.',
    deporte: 'Elige un deporte.',
    unidades_disponibles: 'Indica las unidades disponibles.',
    estado_material: 'Elige el estado del material.',
    modalidad: 'Elige si es venta o donación.',
  });
});

test('US-12 CA18: un cuerpo que no es un objeto cuenta como vacío', () => {
  for (const cuerpo of [[], null, undefined, 'texto', 42]) {
    assert.deepEqual(Object.keys(errores(cuerpo)), [
      'titulo', 'descripcion', 'categoria', 'deporte', 'unidades_disponibles', 'estado_material', 'modalidad',
    ]);
  }
});

test('US-12 CA26: título de 5 y 80 caracteres se acepta; 4 y 81 no', () => {
  assert.equal(validarAnuncio({ ...valido, titulo: 'Balón' }).titulo, 'Balón');
  assert.equal(validarAnuncio({ ...valido, titulo: 't'.repeat(80) }).titulo.length, 80);
  for (const titulo of ['Bola', 't'.repeat(81)]) {
    assert.deepEqual(errores({ ...valido, titulo }), { titulo: 'El título debe tener entre 5 y 80 caracteres.' });
  }
});

test('US-12 «Tabla de campos»: un emoji o una «ñ» cuentan como un carácter', () => {
  assert.equal(validarAnuncio({ ...valido, titulo: '⚽⚽⚽⚽⚽' }).titulo, '⚽⚽⚽⚽⚽');
  assert.ok(validarAnuncio({ ...valido, descripcion: '😀'.repeat(1000) }));
  assert.deepEqual(errores({ ...valido, descripcion: '😀'.repeat(1001) }), {
    descripcion: 'La descripción debe tener entre 20 y 1000 caracteres.',
  });
});

test('US-12 CA27: un título con salto de línea se rechaza con su mensaje', () => {
  assert.deepEqual(errores({ ...valido, titulo: 'Balones\nde fútbol' }), {
    titulo: 'El título no puede tener saltos de línea.',
  });
});

test('US-12: descripción de 20 y 1000 caracteres se acepta; 19 y 1001 no; admite saltos de línea', () => {
  assert.ok(validarAnuncio({ ...valido, descripcion: 'd'.repeat(20) }));
  assert.ok(validarAnuncio({ ...valido, descripcion: 'd'.repeat(1000) }));
  assert.ok(validarAnuncio({ ...valido, descripcion: 'Primera línea.\nSegunda línea.' }));
  for (const descripcion of ['d'.repeat(19), 'd'.repeat(1001)]) {
    assert.deepEqual(errores({ ...valido, descripcion }), {
      descripcion: 'La descripción debe tener entre 20 y 1000 caracteres.',
    });
  }
});

test('US-12 CA29: una descripción solo de espacios es obligatoria', () => {
  assert.deepEqual(errores({ ...valido, descripcion: '     ' }), {
    descripcion: 'La descripción es obligatoria.',
  });
});

test('US-12 CA28: unidades 1 y 9999 se aceptan; 0, 10000, decimales, texto y negativos no', () => {
  assert.equal(validarAnuncio({ ...valido, unidades_disponibles: 1 }).unidades_disponibles, 1);
  assert.equal(validarAnuncio({ ...valido, unidades_disponibles: 9999 }).unidades_disponibles, 9999);
  for (const unidades of [0, 10000, 2.5, -1, '3', 'abc', true]) {
    assert.deepEqual(errores({ ...valido, unidades_disponibles: unidades }), {
      unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
    });
  }
});

test('US-12: solo entero JSON; `3.0` y `1e3` se rechazan aunque JavaScript los lea como enteros', () => {
  for (const texto of ['3.0', '1e3', '12.50']) {
    const cuerpo = parseJson(`{"unidades_disponibles": ${texto}}`);
    assert.equal(
      errores({ ...valido, ...cuerpo }).unidades_disponibles,
      'Las unidades deben ser un número entero entre 1 y 9999.',
    );
  }
  assert.equal(parseJson('{"unidades_disponibles": 12}').unidades_disponibles, 12);
  // Las demás claves numéricas no se tocan.
  assert.equal(parseJson('{"otra": 3.0}').otra, 3);
});

test('US-12: categoría, deporte y estado solo aceptan sus valores en minúsculas', () => {
  assert.deepEqual(errores({ ...valido, categoria: 'Balones', deporte: 'golf', estado_material: 'roto' }), {
    categoria: 'La categoría no es válida.',
    deporte: 'El deporte no es válido.',
    estado_material: 'El estado del material no es válido.',
  });
  assert.deepEqual(errores({ ...valido, categoria: '', deporte: null }), {
    categoria: 'Elige una categoría.',
    deporte: 'Elige un deporte.',
  });
});

test('US-12 E2E-5: datos incorrectos y claves de más devuelven los errores de cada campo', () => {
  assert.deepEqual(errores({ titulo: 'Bal', unidades_disponibles: '3', estado: 'entregado' }), {
    titulo: 'El título debe tener entre 5 y 80 caracteres.',
    descripcion: 'La descripción es obligatoria.',
    categoria: 'Elige una categoría.',
    deporte: 'Elige un deporte.',
    unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
    estado_material: 'Elige el estado del material.',
    modalidad: 'Elige si es venta o donación.',
  });
});

test('US-12 CA21: estado, centro_id, id y publicado_en del cuerpo se ignoran', () => {
  const resultado = validarAnuncio({
    ...valido, estado: 'entregado', centro_id: 'otro', id: 'x', publicado_en: '2020-01-01',
  });
  assert.deepEqual(resultado, valido);
});

test('US-12 CA25: el texto se guarda tal cual, sin interpretar HTML', () => {
  const descripcion = '<script>alert(1)</script> balones de fútbol';
  assert.equal(validarAnuncio({ ...valido, descripcion }).descripcion, descripcion);
});
