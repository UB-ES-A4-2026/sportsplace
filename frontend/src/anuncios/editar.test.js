import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  AVISO_GUARDADO,
  cuerpoDeLaEdicion,
  DIALOGO_DESCARTAR,
  fotosDelAnuncio,
  MENSAJE_NO_EDITABLE,
  puedeEditar,
  textoDelPrecio,
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
  test('los campos del formulario con los datos actuales, como texto (con modalidad y precio de US-14)', () => {
    assert.deepEqual(valoresDelAnuncio(ANUNCIO), {
      titulo: 'Balones de fútbol talla 5', descripcion: 'Doce balones usados una temporada.',
      categoria: 'balones', deporte: 'futbol', unidades_disponibles: '12', estado_material: 'buen_estado',
      modalidad: 'venta', precio: '8,50',
    });
  });

  test('donación: precio vacío', () => {
    const valores = valoresDelAnuncio({ ...ANUNCIO, modalidad: 'donacion', precio_unitario_centimos: null });
    assert.equal(valores.modalidad, 'donacion');
    assert.equal(valores.precio, '');
  });
});

describe('textoDelPrecio', () => {
  test('céntimos → texto del campo, sin separador de miles', () => {
    assert.equal(textoDelPrecio(850), '8,50');
    assert.equal(textoDelPrecio(805), '8,05');
    assert.equal(textoDelPrecio(1), '0,01');
    assert.equal(textoDelPrecio(9999999), '99999,99');
    assert.equal(textoDelPrecio(null), '');
    assert.equal(textoDelPrecio(undefined), '');
  });
});

describe('fotosDelAnuncio (CA2, CA8)', () => {
  test('las actuales en su orden, con su URL y su principal', () => {
    assert.deepEqual(fotosDelAnuncio(ANUNCIO), {
      fotos: [
        { id: 'f1', existente: true, vista: 'https://x/f1.jpg', nombre: 'Foto 1' },
        { id: 'f2', existente: true, vista: 'https://x/f2.jpg', nombre: 'Foto 2' },
      ],
      principalId: 'f1',
    });
  });

  test('sin fotos: estado vacío', () => {
    assert.deepEqual(fotosDelAnuncio({ ...ANUNCIO, fotos: undefined }), { fotos: [], principalId: null });
  });
});

describe('cuerpoDeLaEdicion (CA11, CA12)', () => {
  const cuerpo = { titulo: 'Balones', descripcion: 'Doce balones usados una temporada.', categoria: 'balones',
    deporte: 'futbol', unidades_disponibles: 10, estado_material: 'buen_estado', modalidad: 'venta',
    precio_unitario_centimos: 700 };
  const nueva = (id, nombre) => ({ id, archivo: new File(['x'], nombre, { type: 'image/jpeg' }), vista: null });

  test('sin tocar las fotos: se conservan todas en su orden y la principal es existente', () => {
    const formulario = cuerpoDeLaEdicion(cuerpo, fotosDelAnuncio(ANUNCIO));
    assert.deepEqual(JSON.parse(formulario.get('datos')), { ...cuerpo, fotos_conservar: ['f1', 'f2'] });
    assert.equal(formulario.get('foto_principal'), 'existente:f1');
    assert.equal(formulario.getAll('fotos').length, 0);
  });

  test('E2E-1: quita F1, añade nueva.jpg y la marca como principal → nueva:1', () => {
    const { fotos } = fotosDelAnuncio(ANUNCIO);
    const estado = { fotos: [fotos[1], nueva('n1', 'nueva.jpg')], principalId: 'n1' };
    const formulario = cuerpoDeLaEdicion(cuerpo, estado);
    assert.deepEqual(JSON.parse(formulario.get('datos')).fotos_conservar, ['f2']);
    assert.deepEqual(formulario.getAll('fotos').map((archivo) => archivo.name), ['nueva.jpg']);
    assert.equal(formulario.get('foto_principal'), 'nueva:1');
  });

  test('cambiar todas las fotos: fotos_conservar vacío y la principal es la segunda nueva', () => {
    const estado = { fotos: [nueva('n1', 'a.jpg'), nueva('n2', 'b.jpg')], principalId: 'n2' };
    const formulario = cuerpoDeLaEdicion(cuerpo, estado);
    assert.deepEqual(JSON.parse(formulario.get('datos')).fotos_conservar, []);
    assert.deepEqual(formulario.getAll('fotos').map((archivo) => archivo.name), ['a.jpg', 'b.jpg']);
    assert.equal(formulario.get('foto_principal'), 'nueva:2');
  });

  test('CA19: donación sin precio_unitario_centimos (el servidor guarda null)', () => {
    const donacion = { ...cuerpo, modalidad: 'donacion' };
    delete donacion.precio_unitario_centimos;
    const formulario = cuerpoDeLaEdicion(donacion, fotosDelAnuncio(ANUNCIO));
    const datos = JSON.parse(formulario.get('datos'));
    assert.equal(datos.modalidad, 'donacion');
    assert.equal('precio_unitario_centimos' in datos, false);
  });
});
