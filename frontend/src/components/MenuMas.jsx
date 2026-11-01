import { Children, useEffect, useId, useRef, useState } from 'react';

// Menú «Más ▾» de cada fila de «Mis anuncios» (US-18 CA6): agrupa las acciones que no son la principal.
// Las acciones son los botones de cada historia (US-16, US-17, US-70…), que se pasan como hijos.
// Las opciones siguen montadas aunque el menú esté cerrado: así un diálogo de confirmación abierto desde una
// opción («¿Marcar como entregado?») no desaparece. Se cierra al pulsar fuera o con Esc. Sin opciones, no se muestra.
export default function MenuMas({ children }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const boton = useRef(null);
  const idOpciones = useId();

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

  if (Children.toArray(children).length === 0) return null;

  return (
    <div className="menu-mas" ref={contenedor}>
      <button ref={boton} type="button" className="boton-secundario" aria-expanded={abierto}
        aria-controls={idOpciones} onClick={() => setAbierto((valor) => !valor)}>
        Más ▾
      </button>
      <div id={idOpciones} className="menu-mas-opciones" hidden={!abierto}>
        {children}
      </div>
    </div>
  );
}
