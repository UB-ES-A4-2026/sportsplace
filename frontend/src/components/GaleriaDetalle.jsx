import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
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
import { CirculoDeporte } from '../diseno/IconoDeporte.jsx';
import { coloresDeporte, iconoCategoria } from '../diseno/iconosDeporte.js';

// Galería de la vista de otro centro (US-24 CA6 y CA7): la principal primero, flechas en bucle, miniaturas debajo (la
// activa con borde) y ← → del teclado. Con 1 foto no hay flechas ni miniaturas; sin fotos, «Sin foto» con el círculo
// del deporte sobre su color (diseño con vida, #361, mockup «Anuncio» de Lucía: foto 16:11, flechas de 52 px, contador
// «1 / 3» y miniaturas de 72 × 54).
export default function GaleriaDetalle({ titulo, fotos, deporte, categoria }) {
  const lista = fotosDelDetalle(fotos);
  const total = lista.length;
  const [indice, setIndice] = useState(0);
  const actual = Math.min(indice, Math.max(total - 1, 0));
  const tinte = deporte ? { background: coloresDeporte(deporte).tinte } : undefined;

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

  if (total === 0) {
    // Los balones y «Otros» llevan el icono de su deporte; el resto de categorías, el suyo (como en la tarjeta).
    const icono = !categoria || ['balones', 'otros'].includes(categoria) ? deporte : iconoCategoria(categoria);
    return (
      <div className="detalle-galeria">
        <div className="detalle-sin-foto" style={tinte}>
          {deporte
            ? <CirculoDeporte deporte={deporte} icono={icono} tamano={170} />
            : <span className="detalle-sin-foto-circulo" aria-hidden="true"><ImageOff size={64} /></span>}
          <span>{TEXTOS.sinFoto}</span>
        </div>
      </div>
    );
  }

  const foto = lista[actual];
  const navegable = hayNavegacion(total);

  return (
    <div className="detalle-galeria">
      <div className="detalle-galeria-marco" style={tinte}>
        <img className="detalle-galeria-grande" src={foto.url} alt={textoAlternativoDeFoto(actual + 1, total, titulo)} />
        {navegable && (
          <>
            <button
              type="button"
              className="detalle-galeria-flecha detalle-galeria-flecha-anterior"
              aria-label="Foto anterior"
              onClick={() => setIndice(fotoAnterior(actual, total))}
            >
              <ChevronLeft size={26} strokeWidth={3} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="detalle-galeria-flecha detalle-galeria-flecha-siguiente"
              aria-label="Foto siguiente"
              onClick={() => setIndice(fotoSiguiente(actual, total))}
            >
              <ChevronRight size={26} strokeWidth={3} aria-hidden="true" />
            </button>
            {/* Decorativo: el texto alternativo de la foto ya dice «Foto n de N». */}
            <span className="detalle-galeria-contador" aria-hidden="true">{actual + 1} / {total}</span>
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
                style={tinte}
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
