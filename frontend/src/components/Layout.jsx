import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import MenuCentro from './MenuCentro.jsx';

export default function Layout() {
  const { usuario } = useAuth();

  return (
    <div className="page">
      <header className="cabecera">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Sportsplace</span>
        </Link>
        <nav className="menu" aria-label="Principal">
          {usuario ? (
            <>
              {/* US-12 CA1: botón primario «Publicar anuncio», a la derecha y antes del menú del centro. */}
              <Link to="/anuncios/nuevo" className="boton-cabecera">Publicar anuncio</Link>
              {/* US-07 CA1: menú del centro (nombre ▾) con «Mi perfil» y «Cerrar sesión». */}
              <MenuCentro />
            </>
          ) : (
            <>
              <NavLink to="/registro">Registro</NavLink>
              <NavLink to="/entrar">Entrar</NavLink>
            </>
          )}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>Sportsplace · Sprint 0</footer>
    </div>
  );
}
