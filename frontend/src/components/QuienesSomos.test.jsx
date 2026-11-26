// Inicio (#386): sección «Quiénes somos» con Testing Library sobre jsdom.
import '../../pruebas/dom.js';
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { cleanup, render, screen, within } from '@testing-library/react';
import QuienesSomos from './QuienesSomos.jsx';
import { FILAS_EQUIPO, iniciales } from './equipo.js';

afterEach(cleanup);

describe('QuienesSomos', () => {
  test('tiene el título «Quiénes somos» y tres filas de 1, 3 y 3 personas', () => {
    render(<QuienesSomos />);
    const seccion = screen.getByRole('region', { name: 'Quiénes somos' });
    const filas = within(seccion).getAllByRole('list');
    assert.deepEqual(filas.map((fila) => within(fila).getAllByRole('listitem').length), [1, 3, 3]);
  });

  test('enseña los siete nombres completos en orden', () => {
    const { container } = render(<QuienesSomos />);
    const nombres = [...container.querySelectorAll('.equipo-nombre')].map((nombre) => nombre.textContent);
    assert.deepEqual(nombres, [
      'Claude',
      'Alex Yang Ji', 'Lucía Nuez Hernández', 'Anass Baki Achkoukar',
      'Carlos Moya Paniza', 'Asier Sánchez', 'Marta Herranz Lozano',
    ]);
  });

  test('quien tiene foto la enseña con texto alternativo y quien no, sus iniciales', () => {
    render(<QuienesSomos />);
    const fotos = screen.getAllByRole('img');
    assert.deepEqual(fotos.map((foto) => foto.getAttribute('alt')), [
      'Foto de Alex Yang Ji', 'Foto de Lucía Nuez Hernández', 'Foto de Anass Baki Achkoukar', 'Foto de Asier Sánchez',
    ]);
    assert.equal(screen.getByAltText('Foto de Asier Sánchez').getAttribute('src'), '/equipo/asier.webp');
    assert.ok(screen.getByText('CM'));
    assert.ok(screen.getByText('MH'));
  });

  test('Claude va solo en la primera fila con un icono decorativo', () => {
    const { container } = render(<QuienesSomos />);
    const icono = container.querySelector('.equipo-esfera-icono');
    assert.equal(icono.getAttribute('aria-hidden'), 'true');
    assert.ok(icono.querySelector('svg'));
    assert.equal(FILAS_EQUIPO[0].length, 1);
  });

  test('iniciales toma la primera letra del nombre y del primer apellido', () => {
    assert.equal(iniciales('Marta Herranz Lozano'), 'MH');
    assert.equal(iniciales('Claude'), 'C');
  });
});
