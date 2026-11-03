import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, ErrorApi } from '../api/cliente.js';
import { CONFIRMACION_ENVIO, resultadoDelFallo } from '../auth/recuperacion.js';
import Aviso from '../components/Aviso.jsx';
import Campo from '../components/Campo.jsx';
import { validarRecuperacion } from '../validacion/recuperacion.js';

// US-04: pedir el enlace para cambiar la contraseña (POST /api/auth/recuperar-contrasena).
// Pública: también se abre con la sesión iniciada (CA2).
export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const formulario = useRef(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Tras un envío con error en el campo, el foco vuelve a él.
  useEffect(() => {
    if (intentosFallidos > 0) {
      formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }, [intentosFallidos]);

  function cambiar(evento) {
    setEmail(evento.target.value);
    setError('');
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;

    setAviso(null);
    const errores = validarRecuperacion({ email });
    if (errores.email) {
      setError(errores.email);
      setIntentosFallidos((n) => n + 1);
      return;
    }

    setEnviando(true);
    try {
      await api('/auth/recuperar-contrasena', { method: 'POST', body: { email: email.trim() } });
      // CA9: la API responde 204 exista o no la cuenta; se muestra siempre la misma confirmación.
      setEnviado(true);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      const resultado = resultadoDelFallo(fallo, ['email']);
      if (resultado.errores) {
        setError(resultado.errores.email);
        setIntentosFallidos((n) => n + 1);
      } else {
        setAviso({ tipo: 'error', texto: resultado.mensaje });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina" aria-labelledby="titulo">
        <h1 id="titulo">Recuperar contraseña</h1>

        {enviado ? (
          <>
            <p className="intro-text" role="status">{CONFIRMACION_ENVIO}</p>
            <p className="intro-text"><Link to="/entrar">Volver a entrar</Link></p>
          </>
        ) : (
          <>
            <p className="intro-text">
              Escribe el email de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
            </p>

            <form ref={formulario} className="formulario" onSubmit={enviar} noValidate>
              <Campo id="email" etiqueta="Email" obligatorio type="email" autoComplete="email"
                value={email} onChange={cambiar} error={error} />

              <button type="submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar enlace'}
              </button>

              <p className="formulario-pie"><Link to="/entrar">Volver a entrar</Link></p>
            </form>
          </>
        )}
      </section>
    </>
  );
}
