import { useId } from 'react';
import { Send } from 'lucide-react';
import { contador, esAtajoDeEnvio, MAXIMO_CARACTERES, puedeEnviar, TEXTOS } from '../mensajes/conversacion.js';

// US-28 CA7-CA13: área de texto con contador «n/2000» (rojo desde 1900) y «Enviar». Ctrl/Cmd+Enter envía; mientras
// se envía, el botón dice «Enviando…» y el texto se conserva. `onEnviar` recibe el texto tal cual.
export default function CuadroMensaje({ valor, onCambiar, onEnviar, enviando, filas, ayuda }) {
  const idContador = useId();
  const idAyuda = useId();
  const cuenta = contador(valor);
  const habilitado = puedeEnviar(valor) && !enviando;

  function enviar(evento) {
    evento.preventDefault();
    if (habilitado) onEnviar(valor);
  }

  return (
    <form className="cuadro-mensaje" onSubmit={enviar}>
      {ayuda && <p id={idAyuda} className="campo-ayuda">{ayuda}</p>}
      <textarea
        rows={filas}
        maxLength={MAXIMO_CARACTERES}
        placeholder={TEXTOS.placeholder}
        aria-label={TEXTOS.placeholder}
        aria-describedby={ayuda ? `${idAyuda} ${idContador}` : idContador}
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        onKeyDown={(evento) => { if (esAtajoDeEnvio(evento)) enviar(evento); }}
      />
      <div className="cuadro-mensaje-pie">
        <span id={idContador} className={cuenta.alerta ? 'cuadro-mensaje-contador alerta' : 'cuadro-mensaje-contador'}>
          {cuenta.texto}
        </span>
        <button type="submit" className="s2-boton" disabled={!habilitado}>
          <Send size={16} aria-hidden="true" />
          {enviando ? TEXTOS.enviando : TEXTOS.enviar}
        </button>
      </div>
    </form>
  );
}
