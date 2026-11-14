import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  TEXTOS, estaNoDisponible, textoEstadoYUnidades, textoOrigen, textoPrecio, textoPublicado,
} from './tarjeta.js';

describe('textoPrecio (CA12)', () => {
  test('venta: precio por unidad con coma decimal', () => {
    assert.equal(textoPrecio({ modalidad: 'venta', precio_unitario_centimos: 1250 }), '12,50 € / unidad');
  });

  test('venta: los miles llevan punto, también con 4 cifras', () => {
    assert.equal(textoPrecio({ modalidad: 'venta', precio_unitario_centimos: 123450 }), '1.234,50 € / unidad');
  });

  test('venta de 0 €', () => {
    assert.equal(textoPrecio({ modalidad: 'venta', precio_unitario_centimos: 0 }), '0,00 € / unidad');
  });

  test('donación: «Gratis · Donación» aunque llegue un precio', () => {
    assert.equal(textoPrecio({ modalidad: 'donacion', precio_unitario_centimos: null }), 'Gratis · Donación');
    assert.equal(textoPrecio({ modalidad: 'donacion', precio_unitario_centimos: 500 }), TEXTOS.donacion);
  });
});

describe('textoEstadoYUnidades', () => {
  test('estado del material y unidades en plural', () => {
    assert.equal(textoEstadoYUnidades({ estado_material: 'buen_estado', unidades_disponibles: 12 }), 'Buen estado · 12 unidades');
  });

  test('una unidad en singular', () => {
    assert.equal(textoEstadoYUnidades({ estado_material: 'como_nuevo', unidades_disponibles: 1 }), 'Como nuevo · 1 unidad');
  });

  test('todos los estados del material de E03', () => {
    const estados = { nuevo: 'Nuevo', como_nuevo: 'Como nuevo', buen_estado: 'Buen estado', usado: 'Usado', para_reparar: 'Para reparar' };
    for (const [slug, texto] of Object.entries(estados)) {
      assert.equal(textoEstadoYUnidades({ estado_material: slug, unidades_disponibles: 2 }), `${texto} · 2 unidades`);
    }
  });
});

describe('textoOrigen', () => {
  test('«Nombre del centro · Localidad»', () => {
    assert.equal(textoOrigen({ id: 'c1', nombre: 'CE Montjuïc', localidad: 'Barcelona' }), 'CE Montjuïc · Barcelona');
  });
});

describe('textoPublicado', () => {
  test('«Publicado el dd/mm/aaaa»', () => {
    assert.equal(textoPublicado('2026-10-20T09:15:00.000Z'), 'Publicado el 20/10/2026');
  });

  test('usa la hora de España: las 23:30 UTC del 20/10 ya son el 21/10', () => {
    assert.equal(textoPublicado('2026-10-20T23:30:00Z'), 'Publicado el 21/10/2026');
  });
});

describe('estaNoDisponible (CA6)', () => {
  test('solo los reservados llevan «No disponible»', () => {
    assert.equal(estaNoDisponible({ estado: 'reservado' }), true);
    assert.equal(estaNoDisponible({ estado: 'activo' }), false);
  });
});
