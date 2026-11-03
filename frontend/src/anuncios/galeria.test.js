import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fotoInicial, fotosOrdenadas, textoAlternativo } from './galeria.js';

const FOTOS = [
  { id: 'a', url: 'https://x/a.jpg', orden: 1, es_principal: false },
  { id: 'b', url: 'https://x/b.png', orden: 2, es_principal: true },
  { id: 'c', url: 'https://x/c.webp', orden: 3, es_principal: false },
];

describe('fotosOrdenadas', () => {
  test('ordena por `orden` sin tocar el original', () => {
    const desordenadas = [FOTOS[2], FOTOS[0], FOTOS[1]];
    assert.deepEqual(fotosOrdenadas(desordenadas).map((f) => f.id), ['a', 'b', 'c']);
    assert.deepEqual(desordenadas.map((f) => f.id), ['c', 'a', 'b']);
  });

  test('sin fotos (o sin el campo) → lista vacía', () => {
    assert.deepEqual(fotosOrdenadas([]), []);
    assert.deepEqual(fotosOrdenadas(undefined), []);
  });
});

describe('fotoInicial (CA9)', () => {
  test('es la principal, aunque no sea la primera', () => {
    assert.equal(fotoInicial(FOTOS), 'b');
  });

  test('si ninguna está marcada, la primera por orden', () => {
    assert.equal(fotoInicial(FOTOS.map((f) => ({ ...f, es_principal: false }))), 'a');
  });

  test('sin fotos → null', () => {
    assert.equal(fotoInicial([]), null);
  });
});

describe('textoAlternativo (CA10)', () => {
  test('la principal usa el título', () => {
    assert.equal(textoAlternativo('Balones de fútbol', FOTOS[1], FOTOS), 'Balones de fútbol');
  });

  test('el resto usa «título · foto n» con su posición', () => {
    assert.equal(textoAlternativo('Balones de fútbol', FOTOS[0], FOTOS), 'Balones de fútbol · foto 1');
    assert.equal(textoAlternativo('Balones de fútbol', FOTOS[2], FOTOS), 'Balones de fútbol · foto 3');
  });

  test('no se guarda el nombre original del archivo (CA22)', () => {
    assert.ok(!textoAlternativo('Conos', { ...FOTOS[0], nombre: 'IMG_001.jpg' }, FOTOS).includes('IMG_001'));
  });
});
