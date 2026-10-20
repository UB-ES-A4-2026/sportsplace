import { useState } from 'react';
import { api, ErrorApi } from '../api/cliente.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// US-66: pide un enlace de confirmación nuevo (POST /api/auth/reenviar-confirmacion).
// El servidor responde 204 aunque el email no tenga cuenta, para no revelar qué emails están registrados,
// así que el mensaje de éxito es siempre el mismo.
export default function ReenviarConfirmacion() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;

    const valor = email.trim();
    if (valor === '') return setError('El email es obligatorio.');
    if (!EMAIL.test(valor)) return setError('El email no es válido.');

    setError('');
    setEnviando(true);
    try {
      await api('/auth/reenviar-confirmacion', { method: 'POST', body: { email: valor } });
      setEnviado(true);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      // DATOS_INVALIDOS trae details.email; DEMASIADOS_INTENTOS, AUTH_NO_DISPONIBLE y SIN_CONEXION, su mensaje.
      setError(fallo.details?.email ?? fallo.message);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <p className="intro-text" role="status">
        Si hay una cuenta pendiente con ese email, te hemos enviado un enlace nuevo. Ábrelo para confirmarla
        (el enlace anterior ya no funciona). Mira también la carpeta de spam.
      </p>
    );
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor="reenvio-email">Pide un enlace nuevo con el email de tu cuenta</label>
        <input
          id="reenvio-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(evento) => { setEmail(evento.target.value); setError(''); }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'reenvio-email-error' : undefined}
        />
        {error && <p id="reenvio-email-error" className="campo-error" role="alert">{error}</p>}
      </div>
      <button type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Pedir enlace nuevo'}
      </button>
    </form>
  );
}
