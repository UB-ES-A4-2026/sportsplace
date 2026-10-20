import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import BotonCerrarSesion from './BotonCerrarSesion.jsx';

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
              <NavLink to="/panel">Mi centro</NavLink>
              <BotonCerrarSesion className="enlace" />
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
