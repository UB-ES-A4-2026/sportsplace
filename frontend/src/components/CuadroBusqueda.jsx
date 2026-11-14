import { useId, useRef, useState } from 'react';
import { MAX_CARACTERES, TEXTOS } from '../catalogo/busqueda.js';
import '../catalogo/busqueda.css';

// Zona de búsqueda de /catalogo (US-21, T21-5): cuadro «Buscar material…» con lupa, la «×» (solo si hay texto) y el
// botón «Buscar»; debajo, el error de longitud. Uso, con useBusquedaCatalogo():
//   <CuadroBusqueda q={q} alBuscar={buscar} alQuitar={quitar} />
// `alBuscar(texto)` devuelve el mensaje de error o null.
export default function CuadroBusqueda({ q, alBuscar, alQuitar }) {
  const id = useId();
  const idError = `${id}-error`;
  const cuadro = useRef(null);
  const [texto, setTexto] = useState(q ?? '');
  const [error, setError] = useState(null);
  const [qAnterior, setQAnterior] = useState(q);

  // CA15 (y «Atrás» del navegador): si cambia `q` en la URL, el cuadro lo refleja.
  if (q !== qAnterior) {
    setQAnterior(q);
    setTexto(q ?? '');
    setError(null);
  }

  // CA6: solo al pulsar Intro o «Buscar», no a cada tecla.
  function buscar(evento) {
    evento.preventDefault();
    setError(alBuscar(texto));
  }

  // CA14: vacía el cuadro y, si había búsqueda en la URL, la quita.
  function quitar() {
    setTexto('');
    setError(null);
    if (q) alQuitar();
    cuadro.current?.focus();
  }

  return (
    <form role="search" className="busqueda-catalogo" onSubmit={buscar} noValidate>
      <div className="busqueda-fila">
        <div className={`busqueda-cuadro${error ? ' busqueda-cuadro-error' : ''}`}>
          <svg className="busqueda-lupa" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={cuadro}
            id={id}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label={TEXTOS.etiqueta}
            placeholder={TEXTOS.ejemplo}
            maxLength={MAX_CARACTERES}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? idError : undefined}
          />
          {texto && (
            <button type="button" className="busqueda-quitar" aria-label={TEXTOS.quitar} onClick={quitar}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <button type="submit" className="busqueda-boton">{TEXTOS.buscar}</button>
      </div>
      {error && <p id={idError} className="busqueda-error" role="alert">{error}</p>}
    </form>
  );
}
