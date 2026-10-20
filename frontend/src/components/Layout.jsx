import { Link, NavLink, Outlet } from 'react-router';

export default function Layout() {
  return (
    <div className="page">
      <header className="cabecera">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Sportsplace</span>
        </Link>
        <nav className="menu" aria-label="Principal">
          <NavLink to="/registro">Registro</NavLink>
          <NavLink to="/entrar">Entrar</NavLink>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>Sportsplace · Sprint 0</footer>
    </div>
  );
}
