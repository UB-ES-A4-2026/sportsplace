// Diseño con vida (#361): IconoDeporte y CirculoDeporte con Testing Library sobre jsdom.
import '../../pruebas/dom.js';
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { cleanup, render, screen } from '@testing-library/react';
import { CirculoDeporte, IconoDeporte } from './IconoDeporte.jsx';
import { COLORES_DEPORTE, TRAZOS } from './iconosDeporte.js';

afterEach(cleanup);

describe('IconoDeporte', () => {
  test('sin etiqueta es decorativo: aria-hidden y sin rol de imagen', () => {
    const { container } = render(<IconoDeporte nombre="futbol" />);
    const svg = container.querySelector('svg');
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal(svg.getAttribute('role'), null);
    assert.equal(svg.getAttribute('focusable'), 'false');
  });

  test('con etiqueta se anuncia como imagen con ese nombre', () => {
    render(<IconoDeporte nombre="natacion" etiqueta="Natación" />);
    assert.ok(screen.getByRole('img', { name: 'Natación' }));
  });

  test('pinta los trazos del deporte con el tamaño, el color y el grosor pedidos', () => {
    const { container } = render(<IconoDeporte nombre="baloncesto" tamano={30} color="#fff" grosor={3} />);
    const svg = container.querySelector('svg');
    assert.equal(svg.getAttribute('width'), '30');
    assert.equal(svg.getAttribute('stroke'), '#fff');
    assert.equal(svg.getAttribute('stroke-width'), '3');
    assert.equal(svg.children.length, TRAZOS.baloncesto.length);
  });

  test('un nombre desconocido pinta el icono de «varios»', () => {
    const { container } = render(<IconoDeporte nombre="golf" />);
    assert.equal(container.querySelector('svg').children.length, TRAZOS.varios.length);
  });
});

describe('CirculoDeporte', () => {
  test('círculo decorativo con el color del deporte y el icono blanco al 58 % del tamaño', () => {
    const { container } = render(<CirculoDeporte deporte="natacion" tamano={50} />);
    const circulo = container.firstChild;
    assert.equal(circulo.getAttribute('aria-hidden'), 'true');
    assert.equal(circulo.style.width, '50px');
    assert.equal(circulo.style.background, 'rgb(29, 78, 216)'); // COLORES_DEPORTE.natacion.color, #1D4ED8
    assert.equal(COLORES_DEPORTE.natacion.color, '#1D4ED8');
    const svg = circulo.querySelector('svg');
    assert.equal(svg.getAttribute('width'), '29');
    assert.equal(svg.getAttribute('stroke'), '#fff');
  });

  test('`icono` permite pintar el icono de una categoría sobre el color del deporte', () => {
    const { container } = render(<CirculoDeporte deporte="futbol" icono="porterias" />);
    assert.equal(container.querySelector('svg').children.length, TRAZOS.porterias.length);
  });
});
