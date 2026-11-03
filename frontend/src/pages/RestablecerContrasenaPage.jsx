import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ErrorApi } from '../api/cliente.js';
import { AVISO_CONTRASENA_CAMBIADA, esEnlaceDeRecuperacion, resultadoDelFallo } from '../auth/recuperacion.js';
import { useAuth } from '../auth/useAuth.js';
import Aviso from '../components/Aviso.jsx';
import Campo from '../components/Campo.jsx';
import { validarRestablecimiento } from '../validacion/recuperacion.js';

const VALORES_INICIALES = { password: '', password_repetida: '' };

// US-04: el email de recuperación enlaza a /restablecer-contrasena?token_hash=...&type=recovery.
// Esta página envía el token y la contraseña nueva a POST /api/auth/restablecer-contrasena.
// Pública: también se abre con la sesión iniciada (CA2).
export default function RestablecerContrasenaPage() {
  const [parametros] = useSearchParams();
  const tokenHash = parametros.get('token_hash');
  const { olvidarSesion } = useAuth();
  const navigate = useNavigate();

  // CA4: sin token_hash o con un type distinto de recovery, la variante de error sin llamar a la API.
  const [enlaceInvalido, setEnlaceInvalido] = useState(() => !esEnlaceDeRecuperacion(tokenHash, parametros.get('type')));
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const formulario = useRef(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  // Tras un envío con errores en los campos, el foco va al primero.
  useEffect(() => {
    if (intentosFallidos > 0) {
      formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }, [intentosFallidos]);

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

    setAviso(null);
    // CA8 y E2E-4: si la validación falla, no se llama a la API.
    const erroresLocales = validarRestablecimiento(valores);
    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      setIntentosFallidos((n) => n + 1);
      return;
    }

    setErrores({});
    setEnviando(true);
    try {
      await api('/auth/restablecer-contrasena', {
        method: 'POST',
        body: { token_hash: tokenHash, password: valores.password },
      });
      // CA5: el servidor ha cerrado todas las sesiones; se borran los tokens de este navegador y se vuelve a /entrar.
      olvidarSesion();
      navigate('/entrar', { replace: true, state: { aviso: { tipo: 'exito', texto: AVISO_CONTRASENA_CAMBIADA } } });
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      const resultado = resultadoDelFallo(fallo, ['password']);
      if (resultado.enlaceInvalido) {
        setEnlaceInvalido(true);
      } else if (resultado.errores) {
        setErrores(resultado.errores);
        setIntentosFallidos((n) => n + 1);
      } else {
        setAviso({ tipo: 'error', texto: resultado.mensaje });
      }
      setEnviando(false);
    }
  }

  if (enlaceInvalido) {
    return (
      <section className="pagina" aria-labelledby="titulo">
        <h1 id="titulo">Enlace no válido</h1>
        <p className="status error" role="alert">
          <span className="dot" aria-hidden="true" />El enlace para cambiar la contraseña no es válido, ya se ha usado o ha caducado.
        </p>
        <button type="button" onClick={() => navigate('/recuperar-contrasena')}>Pedir otro enlace</button>
      </section>
    );
  }

  return (
    <>
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <section className="pagina" aria-labelledby="titulo">
        <h1 id="titulo">Nueva contraseña</h1>

        <form ref={formulario} className="formulario" onSubmit={enviar} noValidate>
          <Campo id="password" etiqueta="Contraseña nueva (mínimo 8 caracteres)" obligatorio type="password"
            autoComplete="new-password" value={valores.password} onChange={cambiar} error={errores.password} />
          <Campo id="password_repetida" etiqueta="Repite la contraseña" obligatorio type="password"
            autoComplete="new-password" value={valores.password_repetida} onChange={cambiar}
            error={errores.password_repetida} />

          <button type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar contraseña'}
          </button>

        </form>
      </section>
    </>
  );
}
