import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  RUTA_CATALOGO,
  TEXTOS,
  botonesDelDetalle,
  destinoDeVolver,
  esDelPropioCentro,
  fotoAnterior,
  fotoConTecla,
  fotoSiguiente,
  fotosDelDetalle,
  hayNavegacion,
  precioDelDetalle,
  textoAlternativoDeFoto,
  textoUnidades,
} from './detalleOtroCentro.js';

const FOTOS = [
  { url: 'https://x/1.jpg', orden: 1, es_principal: false },
  { url: 'https://x/2.png', orden: 2, es_principal: false },
  { url: 'https://x/3.webp', orden: 3, es_principal: true },
];

describe('esDelPropioCentro (CA2, CA14)', () => {
  test('solo con `es_propio: true`', () => {
    assert.equal(esDelPropioCentro({ es_propio: true }), true);
    assert.equal(esDelPropioCentro({ es_propio: false }), false);
    assert.equal(esDelPropioCentro(null), false);
  });
});

describe('fotosDelDetalle (CA6, CA12)', () => {
  test('la principal primero y después por `orden`, sin tocar el original', () => {
    const desordenadas = [FOTOS[1], FOTOS[2], FOTOS[0]];
    assert.deepEqual(fotosDelDetalle(desordenadas).map((foto) => foto.orden), [3, 1, 2]);
    assert.deepEqual(desordenadas.map((foto) => foto.orden), [2, 3, 1]);
  });

  test('sin fotos (o sin el campo) → lista vacía', () => {
    assert.deepEqual(fotosDelDetalle([]), []);
    assert.deepEqual(fotosDelDetalle(undefined), []);
  });
});

describe('navegación de la galería (CA6)', () => {
  test('con 0 o 1 foto no hay flechas ni miniaturas', () => {
    assert.equal(hayNavegacion(0), false);
    assert.equal(hayNavegacion(1), false);
    assert.equal(hayNavegacion(2), true);
  });

  test('«›» avanza en bucle: 1 → 2 → 3 → 1', () => {
    assert.deepEqual([0, 1, 2].map((indice) => fotoSiguiente(indice, 3)), [1, 2, 0]);
  });

  test('«‹» retrocede en bucle: 1 → 3 → 2 → 1', () => {
    assert.deepEqual([0, 2, 1].map((indice) => fotoAnterior(indice, 3)), [2, 1, 0]);
  });

  test('sin fotos se queda en 0', () => {
    assert.equal(fotoSiguiente(0, 0), 0);
    assert.equal(fotoAnterior(0, 0), 0);
  });

  test('← y → del teclado cambian de foto; otras teclas no', () => {
    assert.equal(fotoConTecla('ArrowRight', 2, 3), 0);
    assert.equal(fotoConTecla('ArrowLeft', 0, 3), 2);
    assert.equal(fotoConTecla('Enter', 0, 3), null);
  });

  test('con 1 foto el teclado no hace nada', () => {
    assert.equal(fotoConTecla('ArrowRight', 0, 1), null);
  });
});

describe('textoAlternativoDeFoto (CA7)', () => {
  test('«Foto N de M: <título>»', () => {
    assert.equal(textoAlternativoDeFoto(2, 3, 'Balones de fútbol talla 5'), 'Foto 2 de 3: Balones de fútbol talla 5');
  });
});

describe('formatos (CA9 y pantalla)', () => {
  test('«1 unidad» / «N unidades»', () => {
    assert.equal(textoUnidades(1), '1 unidad');
    assert.equal(textoUnidades(12), '12 unidades');
  });

  test('venta: «12,50 € / unidad»', () => {
    assert.equal(precioDelDetalle({ modalidad: 'venta', precio_unitario_centimos: 1250 }), '12,50 € / unidad');
  });

  test('donación: «Gratis · Donación»', () => {
    assert.equal(precioDelDetalle({ modalidad: 'donacion', precio_unitario_centimos: null }), 'Gratis · Donación');
  });
});

describe('botonesDelDetalle (CA3, CA4, CA10)', () => {
  test('sin US-32 ni US-28: los dos deshabilitados con «Disponible próximamente»', () => {
    assert.deepEqual(botonesDelDetalle({ estado: 'activo' }), {
      pedir: { habilitado: false, ayuda: TEXTOS.proximamente },
      escribir: { habilitado: false, ayuda: TEXTOS.proximamente },
    });
  });

  test('activo con las dos historias: los dos habilitados', () => {
    const botones = botonesDelDetalle({ estado: 'activo' }, { pedidos: true, mensajes: true });
    assert.deepEqual(botones, { pedir: { habilitado: true, ayuda: null }, escribir: { habilitado: true, ayuda: null } });
  });

  test('reservado: «Pedir material» deshabilitado y «Escribir al centro» habilitado', () => {
    const botones = botonesDelDetalle({ estado: 'reservado' }, { pedidos: true, mensajes: true });
    assert.equal(botones.pedir.habilitado, false);
    assert.equal(botones.escribir.habilitado, true);
  });
});

describe('destinoDeVolver (CA1, T24-3)', () => {
  test('vuelve a la URL del catálogo de la que se vino, con `q`, filtros y `pagina`', () => {
    const desde = '/catalogo?q=balones&categoria=balones&pagina=2';
    assert.equal(destinoDeVolver({ desde }), desde);
    assert.equal(destinoDeVolver({ desde: RUTA_CATALOGO }), RUTA_CATALOGO);
  });

  test('si se entró por el enlace (sin estado), a /catalogo', () => {
    assert.equal(destinoDeVolver(null), RUTA_CATALOGO);
    assert.equal(destinoDeVolver({}), RUTA_CATALOGO);
  });

  test('una URL que no es del catálogo no se acepta', () => {
    assert.equal(destinoDeVolver({ desde: '/mis-anuncios' }), RUTA_CATALOGO);
    assert.equal(destinoDeVolver({ desde: '/catalogos-falsos' }), RUTA_CATALOGO);
    assert.equal(destinoDeVolver({ desde: 'https://otra.web/catalogo' }), RUTA_CATALOGO);
  });
});
