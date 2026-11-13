import { useEffect, useState } from 'react';
import {
  TEXTOS,
  fotoAnterior,
  fotoConTecla,
  fotoSiguiente,
  fotosDelDetalle,
  hayNavegacion,
  textoAlternativoDeFoto,
} from '../anuncios/detalleOtroCentro.js';

// Galería de la vista de otro centro (US-24 CA6 y CA7): la principal primero, flechas «‹» «›» en bucle, miniaturas
// debajo (la activa con borde) y ← → del teclado. Con 1 foto no hay flechas ni miniaturas; sin fotos, «Sin foto».
export default function GaleriaDetalle({ titulo, fotos }) {
  const lista = fotosDelDetalle(fotos);
  const total = lista.length;
  const [indice, setIndice] = useState(0);
  const actual = Math.min(indice, Math.max(total - 1, 0));

  useEffect(() => {
    if (!hayNavegacion(total)) return undefined;
    function alPulsar(evento) {
      // No se roba la tecla a un campo de texto ni a un elemento que la use (p. ej. un select).
      const destino = evento.target;
      if (destino instanceof HTMLElement && destino.closest('input, textarea, select, [contenteditable="true"]')) return;
      const nuevo = fotoConTecla(evento.key, actual, total);
      if (nuevo === null) return;
      evento.preventDefault();
      setIndice(nuevo);
    }
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [actual, total]);

  if (total === 0) return <div className="detalle-sin-foto">{TEXTOS.sinFoto}</div>;

  const foto = lista[actual];
  const navegable = hayNavegacion(total);

  return (
    <div className="detalle-galeria">
      <div className="detalle-galeria-marco">
        <img className="detalle-galeria-grande" src={foto.url} alt={textoAlternativoDeFoto(actual + 1, total, titulo)} />
        {navegable && (
          <>
            <button
              type="button"
              className="detalle-galeria-flecha detalle-galeria-flecha-anterior"
              aria-label="Foto anterior"
              onClick={() => setIndice(fotoAnterior(actual, total))}
            >
              ‹
            </button>
            <button
              type="button"
              className="detalle-galeria-flecha detalle-galeria-flecha-siguiente"
              aria-label="Foto siguiente"
              onClick={() => setIndice(fotoSiguiente(actual, total))}
            >
              ›
            </button>
          </>
        )}
      </div>
      {navegable && (
        <ul className="detalle-galeria-miniaturas">
          {lista.map((miniatura, posicion) => (
            <li key={miniatura.url}>
              <button
                type="button"
                className={posicion === actual ? 'galeria-miniatura galeria-miniatura-activa' : 'galeria-miniatura'}
                aria-label={`Ver foto ${posicion + 1} de ${total}`}
                aria-pressed={posicion === actual}
                onClick={() => setIndice(posicion)}
              >
                <img src={miniatura.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
