import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import MenuCentro from './MenuCentro.jsx';

export default function Layout() {
  const { usuario, cargando } = useAuth();

  return (
    <div className="page">
      <header className="cabecera">
        {/* US-96 CA1: con sesión, el logo lleva al catálogo. Mientras se comprueba la sesión guardada (al recargar o
            entrar por una URL) ya apunta a /catalogo; si la sesión no vale, la ruta privada lleva a /entrar. */}
        <Link to={usuario || cargando ? '/catalogo' : '/'} className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Sportsplace</span>
        </Link>
        <nav className="menu" aria-label="Principal">
          {usuario ? (
            <>
              {/* US-96 CA1: «Catálogo», marcado como activo (aria-current) en /catalogo. */}
              <NavLink to="/catalogo">Catálogo</NavLink>
              {/* US-18 CA1: «Mis anuncios», subrayado en cualquier ruta que empiece por /mis-anuncios. */}
              <NavLink to="/mis-anuncios">Mis anuncios</NavLink>
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
