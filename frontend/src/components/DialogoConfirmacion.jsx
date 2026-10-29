import { useEffect, useId, useRef } from 'react';

// Diálogo modal de confirmación reutilizable (US-70; también para «¿Marcar como entregado?» de US-17
// y «¿Salir sin publicar?» de US-12). Usa <dialog> nativo: atrapa el foco y Esc lo cierra.
// «Cancelar», Esc y el clic fuera llaman a `onCancelar` sin hacer nada más; mientras `enviando`, se ignoran.
// Uso:
//   <DialogoConfirmacion abierto={abierto} titulo="¿Retirar este anuncio?" texto="..."
//     textoConfirmar="Retirar" textoEnviando="Retirando…" peligro enviando={enviando}
//     onConfirmar={retirar} onCancelar={() => setAbierto(false)} />
export default function DialogoConfirmacion({
  abierto,
  titulo,
  texto,
  textoConfirmar,
  textoEnviando,
  textoCancelar = 'Cancelar',
  peligro = false,
  enviando = false,
  onConfirmar,
  onCancelar,
}) {
  const dialogo = useRef(null);
  const id = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (abierto && !elemento.open) elemento.showModal();
    if (!abierto && elemento.open) elemento.close();
  }, [abierto]);

  function cancelar() {
    if (!enviando) onCancelar();
  }

  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-texto`}
      onCancel={(evento) => { evento.preventDefault(); cancelar(); }}
      // El clic en el fondo llega al propio <dialog>; el contenido va en un div que lo ocupa entero.
      onClick={(evento) => { if (evento.target === dialogo.current) cancelar(); }}
    >
      <div className="dialogo-contenido">
        <h2 id={`${id}-titulo`}>{titulo}</h2>
        <p id={`${id}-texto`}>{texto}</p>
        <div className="dialogo-botones">
          <button type="button" className="boton-secundario" onClick={cancelar} disabled={enviando} autoFocus>
            {textoCancelar}
          </button>
          <button type="button" className={peligro ? 'boton-peligro' : undefined} onClick={onConfirmar} disabled={enviando}>
            {enviando ? textoEnviando : textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  );
}
