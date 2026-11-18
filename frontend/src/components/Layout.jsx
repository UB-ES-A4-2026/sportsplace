import { LayoutGrid, Menu, Package, Plus, ShoppingBag, Volleyball, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';
import { ENLACE_CABECERA, TEXTOS as TEXTOS_PEDIDOS, textoContador } from '../pedidos/bandeja.js';
import useContadorPedidos from '../pedidos/useContadorPedidos.js';
import MenuCentro from './MenuCentro.jsx';
import '../diseno/cabecera.css';
import '../pedidos/pedidos.css';

export default function Layout() {
  const { usuario, cargando } = useAuth();
  const { pathname } = useLocation();
  // US-109 CA9: el contador se refresca al cargar cualquier pantalla privada (cada cambio de ruta).
  const contador = textoContador(useContadorPedidos(Boolean(usuario), pathname));
  // Diseño S2 (#304): en móvil los enlaces se recogen tras «Menú». Se cierra al navegar y con Esc.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ruta, setRuta] = useState(pathname);
  const botonMenu = useRef(null);

  if (ruta !== pathname) {
    setRuta(pathname);
    setMenuAbierto(false);
  }

  useEffect(() => {
    if (!menuAbierto) return undefined;
    function alPulsarTecla(evento) {
      if (evento.key !== 'Escape') return;
      setMenuAbierto(false);
      botonMenu.current?.focus();
    }
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [menuAbierto]);

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-contenido">
          {/* US-96 CA1: con sesión, el logo lleva al catálogo. Mientras se comprueba la sesión guardada (al recargar o
              entrar por una URL) ya apunta a /catalogo; si la sesión no vale, la ruta privada lleva a /entrar. */}
          <Link to={usuario || cargando ? '/catalogo' : '/'} className="brand">
            <span className="brand-mark" aria-hidden="true"><Volleyball size={22} strokeWidth={2.2} /></span>
            <span>Sportsplace</span>
          </Link>
          {usuario && (
            <button ref={botonMenu} type="button" className="cabecera-boton-menu" aria-label="Menú"
              aria-expanded={menuAbierto} aria-controls="menu-principal" onClick={() => setMenuAbierto((valor) => !valor)}>
              {menuAbierto ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              {contador && !menuAbierto && <span className="cabecera-boton-menu-aviso" aria-hidden="true" />}
            </button>
          )}
          <nav id="menu-principal" className={claseDelMenu(Boolean(usuario), menuAbierto)} aria-label="Principal">
            {usuario ? (
              <>
                <div className="menu-enlaces">
                  {/* US-96 CA1: «Catálogo», marcado como activo (aria-current) en /catalogo. */}
                  <NavLink to="/catalogo"><LayoutGrid size={18} aria-hidden="true" />Catálogo</NavLink>
                  {/* US-18 CA1: «Mis anuncios», subrayado en cualquier ruta que empiece por /mis-anuncios. */}
                  <NavLink to="/mis-anuncios"><Package size={18} aria-hidden="true" />Mis anuncios</NavLink>
                  {/* US-109 CA1 y CA9: «Pedidos» → /pedidos?pestana=recibidos, con el número de recibidos pendientes. */}
                  <NavLink to={ENLACE_CABECERA}>
                    <ShoppingBag size={18} aria-hidden="true" />
                    {TEXTOS_PEDIDOS.enlaceCabecera}
                    {contador && (
                      <span className="contador-pedidos">
                        {contador}<span className="sr-only"> pendientes</span>
                      </span>
                    )}
                  </NavLink>
                </div>
                <div className="menu-acciones">
                  {/* US-12 CA1: botón primario «Publicar anuncio», a la derecha y antes del menú del centro. */}
                  <Link to="/anuncios/nuevo" className="boton-cabecera"><Plus size={18} aria-hidden="true" />Publicar anuncio</Link>
                  {/* US-07 CA1: menú del centro (nombre ▾) con «Mi perfil» y «Cerrar sesión». */}
                  <MenuCentro />
                </div>
              </>
            ) : (
              <div className="menu-enlaces">
                <NavLink to="/registro">Registro</NavLink>
                <NavLink to="/entrar">Entrar</NavLink>
              </div>
            )}
          </nav>
        </div>
      </header>

      <div className="page">
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}

function claseDelMenu(privado, abierto) {
  return ['menu', privado && 'privado', abierto && 'abierto'].filter(Boolean).join(' ');
}
