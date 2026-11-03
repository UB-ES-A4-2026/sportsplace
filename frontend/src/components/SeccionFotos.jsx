import { useRef, useState } from 'react';
import { ACEPTAR_FOTOS, AYUDA_FOTOS, MAX_FOTOS } from '../anuncios/fotos.js';

// Sección «Fotos» del formulario de anuncio (E03, US-13 T13-3).
// Es "tonta": el estado vive en FormularioAnuncio (ver anuncios/fotos.js).
//
// - `estado`: { fotos: [{ id, archivo, vista }], principalId }. Al editar (US-15), las actuales llevan `nombre` y no `archivo`.
// - `mensajes`: avisos de los archivos rechazados («logo.gif: Solo se admiten…»), CA2 y CA3.
// - `error`: «Añade al menos una foto.» u otro error de la sección (CA4).
// - `subiendo`: se está enviando con más de 10 MB en total → «Subiendo fotos…» (CA11).
export default function SeccionFotos({ estado, mensajes, error, subiendo, deshabilitado, onAnadir, onQuitar, onPrincipal }) {
  const selector = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const llena = estado.fotos.length >= MAX_FOTOS;

  function alElegir(evento) {
    onAnadir([...evento.target.files]);
    // Se vacía para que elegir el mismo archivo otra vez vuelva a disparar `change` (CA23).
    evento.target.value = '';
  }

  function alSoltar(evento) {
    evento.preventDefault();
    setArrastrando(false);
    if (deshabilitado) return;
    onAnadir([...evento.dataTransfer.files]);
  }

  function alArrastrar(evento) {
    evento.preventDefault();
    if (!deshabilitado) setArrastrando(true);
  }

  const describe = ['fotos-ayuda', error && 'fotos-error'].filter(Boolean).join(' ');

  return (
    <fieldset className="seccion-fotos" aria-describedby={describe}>
      <legend>Fotos<span aria-hidden="true"> *</span></legend>
      <p id="fotos-ayuda" className="ayuda">{AYUDA_FOTOS}</p>

      <p className="fotos-contador">{estado.fotos.length}/{MAX_FOTOS} fotos</p>

      {/* Rejilla de miniaturas y, al final, la casilla «+ Añadir fotos» (oculta con 8 fotos). También acepta soltar archivos. */}
      <div
        className={arrastrando ? 'fotos-zona fotos-zona-activa' : 'fotos-zona'}
        onDragOver={alArrastrar}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
      >
        <input
          ref={selector}
          type="file"
          className="solo-lectores"
          accept={ACEPTAR_FOTOS}
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={alElegir}
        />
        <ol className="fotos-lista">
          {estado.fotos.map((foto, posicion) => {
            const principal = foto.id === estado.principalId;
            return (
              <li key={foto.id} className={principal ? 'foto foto-principal' : 'foto'}>
                {foto.vista && <img src={foto.vista} alt={foto.archivo?.name ?? foto.nombre} />}
                {principal && <span className="foto-etiqueta">Principal</span>}
                <button
                  type="button"
                  className="foto-estrella"
                  title={principal ? 'Foto principal' : 'Marcar como principal'}
                  aria-pressed={principal}
                  aria-label={principal ? `Foto ${posicion + 1} (principal)` : `Marcar foto ${posicion + 1} como principal`}
                  disabled={deshabilitado}
                  onClick={() => onPrincipal(foto.id)}
                >
                  {principal ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  className="foto-quitar"
                  title="Quitar foto"
                  aria-label={`Quitar foto ${posicion + 1}`}
                  disabled={deshabilitado}
                  onClick={() => onQuitar(foto.id)}
                >
                  ✕
                </button>
              </li>
            );
          })}
          {!llena && (
            <li className="foto-anadir">
              <button
                type="button"
                id="fotos"
                name="fotos"
                className="boton-secundario"
                disabled={deshabilitado}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={describe}
                onClick={() => selector.current?.click()}
              >
                + Añadir fotos
              </button>
            </li>
          )}
        </ol>
        {estado.fotos.length === 0 && <span className="fotos-arrastrar">o arrástralas aquí</span>}
      </div>

      {mensajes.length > 0 && (
        <ul className="fotos-mensajes" role="alert">
          {mensajes.map((mensaje) => <li key={mensaje} className="campo-error">{mensaje}</li>)}
        </ul>
      )}
      {error && <p id="fotos-error" className="campo-error">{error}</p>}
      {subiendo && <p className="fotos-subiendo" role="status">Subiendo fotos…</p>}
    </fieldset>
  );
}
