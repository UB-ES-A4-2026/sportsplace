import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CAMPOS_ANUNCIO,
  CAMPOS_CON_ERROR,
  cuerpoDelAnuncio,
  erroresDelServidor,
  haCambiado,
  longitud,
  validarAnuncio,
  validarCampo,
  VALORES_VACIOS,
} from './anuncio.js';

const CORRECTO = {
  titulo: 'Balones de fútbol talla 5',
  descripcion: 'Doce balones Mikasa usados una temporada, sin pinchazos.',
  categoria: 'balones',
  deporte: 'futbol',
  unidades_disponibles: '12',
  estado_material: 'buen_estado',
  modalidad: 'venta',
  precio: '8,50',
};

const repetir = (n, caracter = 'a') => caracter.repeat(n);

describe('validarAnuncio', () => {
  test('el anuncio de E2E-1 no tiene errores', () => {
    assert.deepEqual(validarAnuncio(CORRECTO), {});
  });

  test('E2E-2: formulario vacío → los mensajes «si falta» en el orden del formulario (sin precio: aún no hay «Venta»)', () => {
    const errores = validarAnuncio(VALORES_VACIOS);
    assert.deepEqual(Object.keys(errores), [...CAMPOS_ANUNCIO, 'modalidad']);
    assert.deepEqual(errores, {
      titulo: 'El título es obligatorio.',
      descripcion: 'La descripción es obligatoria.',
      categoria: 'Elige una categoría.',
      deporte: 'Elige un deporte.',
      unidades_disponibles: 'Indica las unidades disponibles.',
      estado_material: 'Elige el estado del material.',
      modalidad: 'Elige si es venta o donación.',
    });
  });

  test('US-14 CA2: «Venta» sin precio → error de precio; «Donación» no valida el precio aunque haya texto', () => {
    assert.deepEqual(validarAnuncio({ ...CORRECTO, precio: '' }), {
      precio_unitario_centimos: 'Indica el precio por unidad.',
    });
    assert.deepEqual(validarAnuncio({ ...CORRECTO, modalidad: 'donacion', precio: 'abc' }), {});
  });

  test('el orden de CAMPOS_CON_ERROR es el del formulario (el foco va al primero)', () => {
    assert.deepEqual(CAMPOS_CON_ERROR, [...CAMPOS_ANUNCIO, 'modalidad', 'precio_unitario_centimos']);
  });

  test('E2E-3: «Bola» y 10000 unidades', () => {
    assert.deepEqual(validarAnuncio({ ...CORRECTO, titulo: 'Bola', unidades_disponibles: '10000' }), {
      titulo: 'El título debe tener entre 5 y 80 caracteres.',
      unidades_disponibles: 'Las unidades deben ser un número entero entre 1 y 9999.',
    });
  });
});

describe('Título (CA26, CA27)', () => {
  const rango = 'El título debe tener entre 5 y 80 caracteres.';

  test('5 y 80 caracteres se aceptan; 4 y 81 se rechazan', () => {
    assert.equal(validarCampo('titulo', 'Balón'), undefined);
    assert.equal(validarCampo('titulo', repetir(80)), undefined);
    assert.equal(validarCampo('titulo', 'Balo'), rango);
    assert.equal(validarCampo('titulo', repetir(81)), rango);
  });

  test('«   Balón   » cuenta 5 (sin espacios alrededor) y se envía recortado', () => {
    assert.equal(validarCampo('titulo', '   Balón   '), undefined);
    assert.equal(cuerpoDelAnuncio({ ...CORRECTO, titulo: '   Balón   ' }).titulo, 'Balón');
  });

  test('solo espacios → obligatorio', () => {
    assert.equal(validarCampo('titulo', '     '), 'El título es obligatorio.');
  });

  test('con salto de línea → mensaje propio', () => {
    assert.equal(validarCampo('titulo', 'Balones\nde fútbol'), 'El título no puede tener saltos de línea.');
  });

  test('un emoji o una «ñ» cuentan 1', () => {
    assert.equal(longitud('⚽⚽⚽⚽'), 4);
    assert.equal(validarCampo('titulo', '⚽⚽⚽⚽'), rango);
    assert.equal(validarCampo('titulo', 'ñññññ'), undefined);
  });
});

describe('Descripción (CA29)', () => {
  const rango = 'La descripción debe tener entre 20 y 1000 caracteres.';

  test('20 y 1000 se aceptan; 19 y 1001 se rechazan', () => {
    assert.equal(validarCampo('descripcion', repetir(20)), undefined);
    assert.equal(validarCampo('descripcion', repetir(1000)), undefined);
    assert.equal(validarCampo('descripcion', repetir(19)), rango);
    assert.equal(validarCampo('descripcion', repetir(1001)), rango);
  });

  test('admite saltos de línea y cada uno cuenta 1', () => {
    const texto = `${repetir(9)}\n${repetir(10)}`; // 20 caracteres
    assert.equal(longitud(texto), 20);
    assert.equal(validarCampo('descripcion', texto), undefined);
  });

  test('solo espacios → «La descripción es obligatoria.»', () => {
    assert.equal(validarCampo('descripcion', '      \n   '), 'La descripción es obligatoria.');
  });
});

describe('Unidades disponibles (CA28)', () => {
  const rango = 'Las unidades deben ser un número entero entre 1 y 9999.';

  test('1 y 9999 se aceptan', () => {
    assert.equal(validarCampo('unidades_disponibles', '1'), undefined);
    assert.equal(validarCampo('unidades_disponibles', '9999'), undefined);
  });

  for (const valor of ['0', '10000', '2,5', '2.5', '-1', 'abc']) {
    test(`«${valor}» se rechaza`, () => {
      assert.equal(validarCampo('unidades_disponibles', valor), rango);
    });
  }

  test('texto que el navegador no entiende como número (value vacío + badInput) → error de formato', () => {
    assert.equal(validarCampo('unidades_disponibles', '', { ilegible: true }), rango);
    assert.equal(validarAnuncio({ ...CORRECTO, unidades_disponibles: '' }, { unidadesIlegibles: true })
      .unidades_disponibles, rango);
  });

  test('se envía como entero JSON', () => {
    assert.equal(cuerpoDelAnuncio({ ...CORRECTO, unidades_disponibles: ' 12 ' }).unidades_disponibles, 12);
  });
});

describe('Desplegables', () => {
  test('solo los valores de la tabla, en minúsculas', () => {
    assert.equal(validarCampo('categoria', 'Balones'), 'La categoría no es válida.');
    assert.equal(validarCampo('deporte', 'golf'), 'El deporte no es válido.');
    assert.equal(validarCampo('estado_material', 'roto'), 'El estado del material no es válido.');
    assert.equal(validarCampo('categoria', 'porterias_redes'), undefined);
    assert.equal(validarCampo('deporte', 'gimnasio_fitness'), undefined);
    assert.equal(validarCampo('estado_material', 'para_reparar'), undefined);
  });
});

describe('cuerpoDelAnuncio (US-12 CA15 y US-14 CA3, CA5, CA8, CA12, CA13)', () => {
  const { precio, modalidad, ...base } = CORRECTO;

  test('venta: los seis campos recortados + modalidad y precio en céntimos enteros', () => {
    assert.deepEqual(cuerpoDelAnuncio({ ...CORRECTO, descripcion: `  ${CORRECTO.descripcion}\n` }), {
      ...base,
      unidades_disponibles: 12,
      modalidad: 'venta',
      precio_unitario_centimos: 850,
    });
  });

  test('donación: no se envía precio_unitario_centimos aunque haya texto escrito (CA5)', () => {
    const cuerpo = cuerpoDelAnuncio({ ...CORRECTO, modalidad: 'donacion', precio: '8,50' });
    assert.equal(cuerpo.modalidad, 'donacion');
    assert.equal('precio_unitario_centimos' in cuerpo, false);
  });

  for (const [texto, centimos] of [['8,5', 850], ['8,05', 805], ['0,01', 1], ['99999,99', 9999999],
    ['8.50', 850], ['  8,50  ', 850]]) {
    test(`precio «${texto}» → ${centimos} céntimos`, () => {
      assert.equal(cuerpoDelAnuncio({ ...CORRECTO, precio: texto }).precio_unitario_centimos, centimos);
    });
  }
});

describe('haCambiado (CA9)', () => {
  test('sin tocar → no; con algún valor → sí', () => {
    assert.equal(haCambiado(VALORES_VACIOS), false);
    assert.equal(haCambiado({ ...VALORES_VACIOS, titulo: 'Conos' }), true);
    assert.equal(haCambiado({ ...VALORES_VACIOS, categoria: 'otros' }), true);
  });

  test('marcar una modalidad o escribir un precio cuenta como dato escrito', () => {
    assert.equal(haCambiado({ ...VALORES_VACIOS, modalidad: 'donacion' }), true);
    assert.equal(haCambiado({ ...VALORES_VACIOS, precio: '8' }), true);
  });

  test('texto ilegible en unidades cuenta como dato escrito', () => {
    assert.equal(haCambiado(VALORES_VACIOS, VALORES_VACIOS, { unidadesIlegibles: true }), true);
  });

  test('con valores iniciales (US-15), compara con ellos', () => {
    assert.equal(haCambiado(CORRECTO, CORRECTO), false);
    assert.equal(haCambiado({ ...CORRECTO, titulo: 'Otro título' }, CORRECTO), true);
  });
});

describe('erroresDelServidor (CA12)', () => {
  test('se queda con los campos del formulario e ignora el resto', () => {
    assert.deepEqual(
      erroresDelServidor({ titulo: 'El título no puede tener saltos de línea.', fotos: 'Añade al menos una foto.' }),
      { titulo: 'El título no puede tener saltos de línea.' },
    );
  });

  test('US-14 CA9: modalidad y precio caen bajo su campo', () => {
    assert.deepEqual(
      erroresDelServidor({
        modalidad: 'La modalidad no es válida.',
        precio_unitario_centimos: 'Una donación no puede tener precio.',
      }),
      { modalidad: 'La modalidad no es válida.', precio_unitario_centimos: 'Una donación no puede tener precio.' },
    );
  });

  test('sin details → vacío', () => {
    assert.deepEqual(erroresDelServidor(undefined), {});
  });
});
