import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { useAuth } from '../auth/useAuth.js';
import Campo from '../components/Campo.jsx';
import { validarLogin } from '../validacion/login.js';

const VALORES_INICIALES = { email: '', password: '' };

// US-03: entrar con email y contraseña (POST /api/auth/login).
export default function EntrarPage() {
  const { usuario, iniciarSesion } = useAuth();
  const location = useLocation();
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const formulario = useRef(null);

  // Tras un envío con errores en los campos, el foco va al primero.
  useEffect(() => {
    if (intentosFallidos > 0) {
      formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }, [intentosFallidos]);

  // Con la sesión iniciada se va a la página que se quería abrir, o a la zona privada.
  if (usuario) return <Navigate to={location.state?.desde ?? '/panel'} replace />;

  function cambiar(evento) {
    const { name, value } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: value }));
    setErrores((anteriores) => {
      if (!anteriores[name]) return anteriores;
      const resto = { ...anteriores };
      delete resto[name];
      return resto;
    });
  }

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;

    setErrorGeneral('');
    const erroresLocales = validarLogin(valores);
    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      setIntentosFallidos((n) => n + 1);
      return;
    }

    setErrores({});
    setEnviando(true);
    try {
      await iniciarSesion(valores.email.trim(), valores.password);
      // Al guardarse el usuario, esta página redirige sola.
    } catch (error) {
      if (!(error instanceof ErrorApi)) throw error;

      if (error.code === 'DATOS_INVALIDOS' && error.details) {
        const delServidor = Object.fromEntries(
          Object.entries(error.details).filter(([campo]) => campo in VALORES_INICIALES),
        );
        setErrores(delServidor);
        if (Object.keys(delServidor).length === 0) setErrorGeneral(error.message);
      } else {
        // CREDENCIALES_INCORRECTAS, EMAIL_NO_CONFIRMADO, DEMASIADOS_INTENTOS, SIN_CONEXION...
        setErrorGeneral(error.message);
      }
      setIntentosFallidos((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Entrar</h1>
      <p className="intro-text">Accede a la cuenta de tu centro con tu email y tu contraseña.</p>

      <form ref={formulario} className="formulario" onSubmit={enviar} noValidate>
        {errorGeneral && <p className="alerta" role="alert">{errorGeneral}</p>}

        <Campo id="email" etiqueta="Email" obligatorio type="email" autoComplete="email"
          value={valores.email} onChange={cambiar} error={errores.email} />
        <Campo id="password" etiqueta="Contraseña" obligatorio type="password"
          autoComplete="current-password" value={valores.password} onChange={cambiar} error={errores.password} />

        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="formulario-pie">
          ¿Todavía no tienes cuenta? <Link to="/registro">Registra tu centro</Link>
        </p>
      </form>
    </section>
  );
}
