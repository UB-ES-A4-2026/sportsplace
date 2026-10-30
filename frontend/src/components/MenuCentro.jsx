import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useCentro } from '../centro/useCentro.js';
import BotonCerrarSesion from './BotonCerrarSesion.jsx';

// Menú del centro en la cabecera privada (US-07 CA1): «nombre del centro ▾» con «Mi perfil» y «Cerrar sesión» (US-67).
// «Equipo» (US-08) y «Ajustes» (US-11) se añaden en sus historias. Se cierra al pulsar fuera, con Esc o al navegar.
export default function MenuCentro() {
  const { centro } = useCentro();
  const location = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [ruta, setRuta] = useState(location.pathname);
  const contenedor = useRef(null);
  const boton = useRef(null);
  const idOpciones = useId();

  // Al cambiar de página, el menú se cierra.
  if (ruta !== location.pathname) {
    setRuta(location.pathname);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return undefined;

    function alPulsarFuera(evento) {
      if (!contenedor.current?.contains(evento.target)) setAbierto(false);
    }
    function alPulsarTecla(evento) {
      if (evento.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    }

    document.addEventListener('pointerdown', alPulsarFuera);
    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('pointerdown', alPulsarFuera);
      document.removeEventListener('keydown', alPulsarTecla);
    };
  }, [abierto]);

  return (
    <div className="menu-centro" ref={contenedor}>
      {/* Mientras carga el centro (o si falla), el botón muestra «Mi centro». */}
      <button ref={boton} type="button" className="enlace menu-centro-boton" aria-expanded={abierto}
        aria-controls={idOpciones} onClick={() => setAbierto((valor) => !valor)}>
        {centro?.nombre ?? 'Mi centro'} ▾
      </button>
      <div id={idOpciones} className="menu-centro-opciones" hidden={!abierto}>
        <Link to="/perfil">Mi perfil</Link>
        <BotonCerrarSesion />
      </div>
    </div>
  );
}
