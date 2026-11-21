import { ArrowRight, CircleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { useAuth } from '../auth/useAuth.js';
import Aviso from '../components/Aviso.jsx';
import Campo from '../components/Campo.jsx';
import { IconoDeporte } from '../diseno/IconoDeporte.jsx';
import '../auth/entrar.css';
import { validarLogin } from '../validacion/login.js';

const VALORES_INICIALES = { email: '', password: '' };

// US-03: entrar con email y contraseña (POST /api/auth/login).
// Diseño con vida (#361): pantalla partida; a la izquierda, la foto y el lema (decorativos); a la derecha, el formulario
// estrecho y centrado, con las etiquetas flotando dentro de los campos (siguen siendo <label>).
export default function EntrarPage() {
  const { usuario, iniciarSesion } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // US-04 CA5: «Contraseña cambiada. Ya puedes entrar con la nueva.» llega en `state.aviso` desde /restablecer-contrasena.
  const [aviso, setAviso] = useState(() => location.state?.aviso ?? null);
  const cerrarAviso = useCallback(() => setAviso(null), []);
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

  // El aviso se muestra una vez: se quita del historial para que no vuelva a salir al recargar.
  useEffect(() => {
    if (location.state?.aviso) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina pagina-entrar" aria-labelledby="titulo">
        <div className="entrar-visual" aria-hidden="true">
          <p className="entrar-lema">Más oportunidades para el material deportivo.</p>
        </div>

        <div className="entrar-panel">
          <div className="entrar-contenido">
            <span className="entrar-marca" aria-hidden="true">
              <IconoDeporte nombre="baloncesto" tamano={30} color="#fff" grosor={2.2} />
            </span>
            <h1 id="titulo">Entrar</h1>
            <p className="entrar-intro">Accede a la cuenta de tu centro con tu email y tu contraseña.</p>

            <form ref={formulario} className="formulario entrar-formulario" onSubmit={enviar} noValidate>
              {errorGeneral && (
                <p className="alerta entrar-alerta" role="alert"><CircleAlert size={18} aria-hidden="true" />{errorGeneral}</p>
              )}

              {/* placeholder=" " permite que la etiqueta flote con :placeholder-shown; el texto lo da la <label>. */}
              <Campo id="email" etiqueta="Email" obligatorio type="email" autoComplete="email" placeholder=" "
                value={valores.email} onChange={cambiar} error={errores.email} />
              <Campo id="password" etiqueta="Contraseña" obligatorio type="password" placeholder=" "
                autoComplete="current-password" value={valores.password} onChange={cambiar} error={errores.password} />
              <p className="formulario-enlace"><Link to="/recuperar-contrasena">¿Has olvidado la contraseña?</Link></p>

              <button type="submit" className="entrar-boton" disabled={enviando}>
                {enviando ? 'Entrando…' : <>Entrar<ArrowRight size={19} strokeWidth={2.4} aria-hidden="true" /></>}
              </button>
            </form>

            <p className="formulario-pie entrar-pie">
              ¿Todavía no tienes cuenta? <Link to="/registro">Registra tu centro</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
