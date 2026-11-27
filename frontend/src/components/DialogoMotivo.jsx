import { useEffect, useId, useRef, useState } from 'react';
import { etiquetaExplicacion, EXPLICACION_MAX, longitud } from '../pedidos/acciones.js';

const VACIO = { motivoCodigo: '', motivoTexto: '' };

// Diálogo de cierre de un pedido con motivo (obligatorio) y explicación (obligatoria solo con «Otro motivo»):
// lo usan el rechazo (US-79, DialogoRechazo) y la cancelación (US-39, DialogoCancelacion). Valida al pulsar el
// botón principal y no envía nada si hay errores.
// - `motivos`: [{ codigo, texto }] del desplegable; `validar(valores)` devuelve { campo: mensaje }.
// - `onEnviar({ motivoCodigo, motivoTexto })` hace la petición; los errores del servidor llegan por `errores`.
// - Mientras `enviando`, `textoEnviando` y no se puede cerrar. Quien lo usa le cambia la `key` al abrirlo, para
//   que empiece vacío cada vez.
export default function DialogoMotivo({
  abierto, titulo, texto, motivos, validar, textoConfirmar, textoEnviando, textoVolver, className = '',
  enviando = false, errores: erroresServidor, onEnviar, onCancelar,
}) {
  const dialogo = useRef(null);
  const id = useId();
  const [valores, setValores] = useState(VACIO);
  const [erroresLocales, setErroresLocales] = useState({});
  const errores = { ...erroresLocales, ...erroresServidor };

  useEffect(() => {
    const elemento = dialogo.current;
    if (abierto && !elemento.open) elemento.showModal?.();
    if (!abierto && elemento.open) elemento.close?.();
  }, [abierto]);

  function cancelar() {
    if (!enviando) onCancelar();
  }

  function cambiar(campo, valor) {
    const siguientes = { ...valores, [campo]: valor };
    setValores(siguientes);
    // Tras un primer intento, el error se actualiza al escribir (como el resto de formularios).
    if (Object.keys(erroresLocales).length > 0) setErroresLocales(validar(siguientes));
  }

  function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;
    const encontrados = validar(valores);
    setErroresLocales(encontrados);
    if (Object.keys(encontrados).length > 0) {
      dialogo.current?.querySelector(encontrados.motivo_codigo ? `#${id}-motivo` : `#${id}-explicacion`)?.focus();
      return;
    }
    onEnviar(valores);
  }

  const caracteres = longitud(valores.motivoTexto);

  return (
    <dialog
      ref={dialogo}
      className={`dialogo dialogo-rechazo ${className}`.trim()}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-texto`}
      onCancel={(evento) => { evento.preventDefault(); cancelar(); }}
      onClick={(evento) => { if (evento.target === dialogo.current) cancelar(); }}
    >
      <form className="dialogo-contenido" onSubmit={enviar} noValidate>
        <h2 id={`${id}-titulo`}>{titulo}</h2>
        <p id={`${id}-texto`}>{texto}</p>

        <div className="campo">
          {/* El «*» va por CSS para que el nombre accesible del desplegable sea exactamente «Motivo». */}
          <label htmlFor={`${id}-motivo`} className="etiqueta-obligatoria">Motivo</label>
          <select id={`${id}-motivo`} value={valores.motivoCodigo} disabled={enviando}
            aria-invalid={errores.motivo_codigo ? 'true' : undefined}
            aria-describedby={errores.motivo_codigo ? `${id}-motivo-error` : undefined}
            onChange={(evento) => cambiar('motivoCodigo', evento.target.value)}>
            <option value="">Elige un motivo</option>
            {motivos.map(({ codigo, texto: nombre }) => <option key={codigo} value={codigo}>{nombre}</option>)}
          </select>
          {errores.motivo_codigo && <p id={`${id}-motivo-error`} className="campo-error">{errores.motivo_codigo}</p>}
        </div>

        <div className="campo">
          <label htmlFor={`${id}-explicacion`}>{etiquetaExplicacion(valores.motivoCodigo)}</label>
          <textarea id={`${id}-explicacion`} rows={4} value={valores.motivoTexto} disabled={enviando}
            aria-invalid={errores.motivo_texto ? 'true' : undefined}
            aria-describedby={`${id}-contador${errores.motivo_texto ? ` ${id}-explicacion-error` : ''}`}
            onChange={(evento) => cambiar('motivoTexto', evento.target.value)} />
          <div className="campo-pie">
            {errores.motivo_texto
              ? <p id={`${id}-explicacion-error`} className="campo-error">{errores.motivo_texto}</p>
              : <span />}
            <span id={`${id}-contador`} className={caracteres > EXPLICACION_MAX ? 'contador contador-excedido' : 'contador'}>
              {caracteres}/{EXPLICACION_MAX}
            </span>
          </div>
        </div>

        <div className="dialogo-botones">
          <button type="button" className="boton-secundario" onClick={cancelar} disabled={enviando}>{textoVolver}</button>
          <button type="submit" className="boton-peligro" disabled={enviando}>
            {enviando ? textoEnviando : textoConfirmar}
          </button>
        </div>
      </form>
    </dialog>
  );
}
