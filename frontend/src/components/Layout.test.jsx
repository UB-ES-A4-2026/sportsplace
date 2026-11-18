// Diseño S2 (#304): botón «Menú» de la cabecera en móvil. Testing Library sobre jsdom, con la sesión, el contador de
// pedidos y el centro simulados (useAuth, useContadorPedidos y useCentro).
import '../../pruebas/dom.js';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';

const estado = { usuario: { id: 'u-1', email: 'centro@ejemplo.test' }, pendientes: 0 };

mock.module(new URL('../auth/useAuth.js', import.meta.url).href, {
  namedExports: { useAuth: () => ({ usuario: estado.usuario, cargando: false, cerrarSesion: async () => {} }) },
});
mock.module(new URL('../pedidos/useContadorPedidos.js', import.meta.url).href, {
  defaultExport: () => estado.pendientes,
});
mock.module(new URL('../centro/useCentro.js', import.meta.url).href, {
  namedExports: { useCentro: () => ({ centro: { id: 'c-1', nombre: 'Club Natació Exemple' } }) },
});

const { cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { MemoryRouter, Route, Routes } = await import('react-router');
const { default: Layout } = await import('./Layout.jsx');

function pintar(ruta = '/catalogo') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="catalogo" element={<p>Pantalla del catálogo</p>} />
          <Route path="mis-anuncios" element={<p>Pantalla de mis anuncios</p>} />
          <Route path="/" element={<p>Portada</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const botonMenu = () => screen.getByRole('button', { name: 'Menú' });
const menu = () => screen.getByRole('navigation', { name: 'Principal' });
const punto = (contenedor) => contenedor.querySelector('.cabecera-boton-menu-aviso');

beforeEach(() => {
  estado.usuario = { id: 'u-1', email: 'centro@ejemplo.test' };
  estado.pendientes = 0;
});
afterEach(cleanup);

describe('Layout · «Menú» de la cabecera en móvil', () => {
  test('con sesión empieza cerrado y al pulsarlo se abre (aria-expanded y clase «abierto»)', () => {
    pintar();
    assert.equal(botonMenu().getAttribute('aria-expanded'), 'false');
    assert.equal(menu().classList.contains('abierto'), false);

    fireEvent.click(botonMenu());

    assert.equal(botonMenu().getAttribute('aria-expanded'), 'true');
    assert.equal(menu().classList.contains('abierto'), true);
  });

  test('vuelve a cerrarse al pulsarlo otra vez', () => {
    pintar();
    fireEvent.click(botonMenu());
    fireEvent.click(botonMenu());

    assert.equal(botonMenu().getAttribute('aria-expanded'), 'false');
    assert.equal(menu().classList.contains('abierto'), false);
  });

  test('Esc lo cierra y el foco vuelve a «Menú»', () => {
    pintar();
    fireEvent.click(botonMenu());
    screen.getByRole('link', { name: 'Mis anuncios' }).focus();

    fireEvent.keyDown(document, { key: 'Escape' });

    assert.equal(botonMenu().getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, botonMenu());
  });

  test('se cierra al navegar a otra ruta', () => {
    pintar();
    fireEvent.click(botonMenu());

    fireEvent.click(screen.getByRole('link', { name: 'Mis anuncios' }));

    assert.ok(screen.getByText('Pantalla de mis anuncios'));
    assert.equal(botonMenu().getAttribute('aria-expanded'), 'false');
    assert.equal(menu().classList.contains('abierto'), false);
  });

  test('el punto rojo sale con pedidos pendientes y el menú cerrado', () => {
    estado.pendientes = 3;
    const { container } = pintar();
    assert.ok(punto(container));

    fireEvent.click(botonMenu());
    assert.equal(punto(container), null);
  });

  test('sin pedidos pendientes no hay punto rojo', () => {
    const { container } = pintar();
    assert.equal(punto(container), null);
  });

  test('sin sesión no hay «Menú» y se ven «Registro» y «Entrar»', () => {
    estado.usuario = null;
    pintar('/');

    assert.equal(screen.queryByRole('button', { name: 'Menú' }), null);
    assert.ok(screen.getByRole('link', { name: 'Registro' }));
    assert.ok(screen.getByRole('link', { name: 'Entrar' }));
  });
});
