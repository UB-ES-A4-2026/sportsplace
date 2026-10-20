import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ErrorApi } from '../api/cliente.js';
import ReenviarConfirmacion from '../components/ReenviarConfirmacion.jsx';

// US-02: el email de confirmación enlaza a /confirmar-email?token_hash=...&type=email.
// Esta página envía esos valores a POST /api/auth/confirmar. Al confirmar, la cuenta queda activa.
export default function ConfirmarEmailPage() {
  const [parametros] = useSearchParams();
  const tokenHash = parametros.get('token_hash');
  const tipo = parametros.get('type') ?? 'email';

  const [estado, setEstado] = useState(
    tokenHash ? { fase: 'comprobando' } : { fase: 'error', code: 'ENLACE_INVALIDO' },
  );
  // El enlace solo sirve una vez: en desarrollo, StrictMode ejecuta los efectos dos veces,
  // y sin esta marca la segunda petición fallaría con ENLACE_INVALIDO.
  const enviado = useRef(false);

  useEffect(() => {
    if (!tokenHash || enviado.current) return;
    enviado.current = true;

    api('/auth/confirmar', { method: 'POST', body: { token_hash: tokenHash, type: tipo } })
      .then(() => setEstado({ fase: 'confirmado' }))
      .catch((error) => {
        const esErrorApi = error instanceof ErrorApi;
        setEstado({
          fase: 'error',
          code: esErrorApi ? error.code : 'ERROR_INTERNO',
          mensaje: esErrorApi ? error.message : 'Ha ocurrido un error inesperado.',
        });
      });
  }, [tokenHash, tipo]);

  return (
    <section className="pagina" aria-labelledby="titulo">
      {estado.fase === 'comprobando' && (
        <>
          <h1 id="titulo">Confirmando tu email</h1>
          <p className="status checking" role="status">
            <span className="dot" aria-hidden="true" />Un momento, estamos activando tu cuenta…
          </p>
        </>
      )}

      {estado.fase === 'confirmado' && (
        <>
          <h1 id="titulo">¡Email confirmado!</h1>
          <p className="intro-text" role="status">
            Tu cuenta ya está activa. Ya puedes entrar con tu email y tu contraseña.
          </p>
          <p className="intro-text"><Link to="/entrar">Entrar</Link></p>
        </>
      )}

      {estado.fase === 'error' && estado.code === 'ENLACE_INVALIDO' && (
        <>
          <h1 id="titulo">Enlace no válido</h1>
          <p className="status error" role="alert">
            <span className="dot" aria-hidden="true" />El enlace de confirmación no es válido, ya se ha usado o ha caducado.
          </p>
          <p className="intro-text">
            Si ya lo habías abierto antes, tu cuenta puede estar activa: prueba a <Link to="/entrar">entrar</Link>.
            Si todavía no te has registrado, <Link to="/registro">crea tu cuenta</Link>.
          </p>
          <ReenviarConfirmacion />
        </>
      )}

      {estado.fase === 'error' && estado.code !== 'ENLACE_INVALIDO' && (
        <>
          <h1 id="titulo">No hemos podido confirmar tu email</h1>
          <p className="status error" role="alert">
            <span className="dot" aria-hidden="true" />{estado.mensaje}
          </p>
          <p className="intro-text">
            El enlace puede seguir siendo válido. Inténtalo de nuevo en unos minutos.
          </p>
          <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
        </>
      )}
    </section>
  );
}
