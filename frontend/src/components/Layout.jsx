import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { ENLACE_CABECERA, TEXTOS as TEXTOS_PEDIDOS, textoContador } from '../pedidos/bandeja.js';
import useContadorPedidos from '../pedidos/useContadorPedidos.js';
import MenuCentro from './MenuCentro.jsx';
import '../pedidos/pedidos.css';

export default function Layout() {
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  // US-109 CA9: el contador se refresca al cargar cualquier pantalla privada (cada cambio de ruta).
  const contador = textoContador(useContadorPedidos(Boolean(usuario), pathname));

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
              {/* US-18 CA1: «Mis anuncios», subrayado en cualquier ruta que empiece por /mis-anuncios. */}
              <NavLink to="/mis-anuncios">Mis anuncios</NavLink>
              {/* US-109 CA1 y CA9: «Pedidos» → /pedidos?pestana=recibidos, con el número de recibidos pendientes. */}
              <NavLink to={ENLACE_CABECERA}>
                {TEXTOS_PEDIDOS.enlaceCabecera}
                {contador && (
                  <span className="contador-pedidos">
                    {contador}<span className="sr-only"> pendientes</span>
                  </span>
                )}
              </NavLink>
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
