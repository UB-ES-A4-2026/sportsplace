import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AVISO_GUARDADO,
  cuerpoDeLaEdicion,
  DIALOGO_DESCARTAR,
  MENSAJE_NO_EDITABLE,
  puedeEditar,
  valoresDelAnuncio,
} from './editar.js';

const ANUNCIO = {
  id: 'a1', titulo: 'Balones de fútbol talla 5', descripcion: 'Doce balones usados una temporada.',
  categoria: 'balones', deporte: 'futbol', unidades_disponibles: 12, estado_material: 'buen_estado',
  estado: 'activo', modalidad: 'venta', precio_unitario_centimos: 850,
  fotos: [
    { id: 'f2', url: 'https://x/f2.jpg', orden: 2, es_principal: false },
    { id: 'f1', url: 'https://x/f1.jpg', orden: 1, es_principal: true },
  ],
};

describe('textos de US-15', () => {
  test('CA2, CA3 y CA4 exactos', () => {
    assert.equal(AVISO_GUARDADO, 'Cambios guardados.');
    assert.equal(MENSAJE_NO_EDITABLE, 'Este anuncio ya no se puede editar.');
    assert.deepEqual(DIALOGO_DESCARTAR, {
      titulo: '¿Descartar los cambios?',
      texto: 'Los cambios que no has guardado se perderán.',
      confirmar: 'Descartar',
      cancelar: 'Seguir editando',
    });
  });
});

describe('puedeEditar (CA1)', () => {
  test('activo, pausado y reservado sí; entregado, borrador y retirado no', () => {
    for (const estado of ['activo', 'pausado', 'reservado']) assert.equal(puedeEditar(estado), true, estado);
    for (const estado of ['entregado', 'borrador', 'retirado']) assert.equal(puedeEditar(estado), false, estado);
  });
});

describe('valoresDelAnuncio', () => {
  test('los campos del formulario con los datos actuales, como texto', () => {
    assert.deepEqual(valoresDelAnuncio(ANUNCIO), {
      titulo: 'Balones de fútbol talla 5', descripcion: 'Doce balones usados una temporada.',
      categoria: 'balones', deporte: 'futbol', unidades_disponibles: '12', estado_material: 'buen_estado',
    });
  });
});

describe('cuerpoDeLaEdicion (CA11)', () => {
  const cuerpo = { titulo: 'Balones', descripcion: 'Doce balones usados una temporada.', categoria: 'balones',
    deporte: 'futbol', unidades_disponibles: 10, estado_material: 'buen_estado' };

  test('`datos` completo con modalidad y precio actuales y las fotos conservadas en su orden', () => {
    const formulario = cuerpoDeLaEdicion(cuerpo, ANUNCIO);
    assert.deepEqual(JSON.parse(formulario.get('datos')), {
      ...cuerpo, modalidad: 'venta', precio_unitario_centimos: 850, fotos_conservar: ['f1', 'f2'],
    });
    assert.equal(formulario.get('foto_principal'), 'existente:f1');
    assert.equal(formulario.getAll('fotos').length, 0);
  });

  test('sin fotos ni modalidad (antes de US-13 y US-14): donación sin precio y sin foto_principal', () => {
    const formulario = cuerpoDeLaEdicion(cuerpo, { ...ANUNCIO, fotos: undefined, modalidad: undefined, precio_unitario_centimos: undefined });
    assert.deepEqual(JSON.parse(formulario.get('datos')), {
      ...cuerpo, modalidad: 'donacion', precio_unitario_centimos: null, fotos_conservar: [],
    });
    assert.equal(formulario.get('foto_principal'), null);
  });
});
