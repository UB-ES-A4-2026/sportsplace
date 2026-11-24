import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { inicialesDe } from './iniciales.js';

describe('inicialesDe (avatar del centro, #361)', () => {
  test('primera letra de las dos primeras palabras', () => {
    assert.equal(inicialesDe('Club Natació Sabadell'), 'CN');
    assert.equal(inicialesDe('CE Montjuïc'), 'CM');
  });

  test('salta artículos y preposiciones, también tras un apóstrofo', () => {
    assert.equal(inicialesDe('Escola de Bàsquet Gràcia'), 'EB');
    assert.equal(inicialesDe("Club d'Esgrima de la Ribera"), 'CE');
    assert.equal(inicialesDe('Club Atlètic de les Corts'), 'CA');
  });

  test('pasa a mayúsculas y conserva las letras con tilde', () => {
    assert.equal(inicialesDe('ágora deportiva'), 'ÁD');
  });

  test('una sola palabra da una letra; sin nombre, cadena vacía', () => {
    assert.equal(inicialesDe('Polideportivo'), 'P');
    assert.equal(inicialesDe(''), '');
    assert.equal(inicialesDe(null), '');
    assert.equal(inicialesDe(undefined), '');
  });

  test('ignora signos sueltos y usa números si el nombre empieza por ellos', () => {
    assert.equal(inicialesDe('· 3x3 Basket Club'), '3B');
    assert.equal(inicialesDe('Club - Natació'), 'CN');
  });
});
