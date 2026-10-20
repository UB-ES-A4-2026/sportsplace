import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, ErrorApi } from '../api/cliente.js';
import Campo from '../components/Campo.jsx';
import { validarRegistro } from '../validacion/registro.js';

const VALORES_INICIALES = {
  nombre: '',
  email: '',
  password: '',
  localidad: '',
  direccion: '',
  codigo_postal: '',
  telefono: '',
  acepta_politica_privacidad: false,
};

const CAMPOS = Object.keys(VALORES_INICIALES);

// Solo se envían los campos opcionales que tienen contenido.
function construirCuerpo(valores) {
  const cuerpo = {
    nombre: valores.nombre.trim(),
    email: valores.email.trim(),
    password: valores.password,
    localidad: valores.localidad.trim(),
    acepta_politica_privacidad: valores.acepta_politica_privacidad,
  };
  for (const campo of ['direccion', 'codigo_postal', 'telefono']) {
    const valor = valores[campo].trim();
    if (valor !== '') cuerpo[campo] = valor;
  }
  return cuerpo;
}

export default function RegistroPage() {
  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [emailRegistrado, setEmailRegistrado] = useState(null);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const formulario = useRef(null);

  // Tras un envío con errores, el foco va al primer campo incorrecto.
  useEffect(() => {
    if (intentosFallidos > 0) {
      formulario.current?.querySelector('[aria-invalid="true"]')?.focus();
    }
  }, [intentosFallidos]);

  function cambiar(evento) {
    const { name, value, type, checked } = evento.target;
    setValores((anteriores) => ({ ...anteriores, [name]: type === 'checkbox' ? checked : value }));
    // Al corregir un campo, desaparece su error.
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
    const erroresLocales = validarRegistro(valores);
    if (Object.keys(erroresLocales).length > 0) {
      setErrores(erroresLocales);
      setIntentosFallidos((n) => n + 1);
      return;
    }

    setErrores({});
    setEnviando(true);
    try {
      const respuesta = await api('/auth/registro', { method: 'POST', body: construirCuerpo(valores) });
      setEmailRegistrado(respuesta?.usuario?.email ?? valores.email.trim().toLowerCase());
    } catch (error) {
      if (!(error instanceof ErrorApi)) throw error;

      if (error.code === 'EMAIL_YA_REGISTRADO') {
        setErrores({ email: 'Ya existe una cuenta con este email.' });
      } else if (error.code === 'DATOS_INVALIDOS' && error.details) {
        const delServidor = Object.fromEntries(
          Object.entries(error.details).filter(([campo]) => CAMPOS.includes(campo)),
        );
        setErrores(delServidor);
        if (Object.keys(delServidor).length === 0) setErrorGeneral(error.message);
      } else {
        // SIN_CONEXION, DEMASIADOS_INTENTOS, AUTH_NO_DISPONIBLE, ERROR_INTERNO...
        setErrorGeneral(error.message);
      }
      setIntentosFallidos((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  }

  if (emailRegistrado) {
    return (
      <section className="pagina" aria-labelledby="titulo">
        <h1 id="titulo">Revisa tu email</h1>
        <p className="intro-text" role="status">
          Hemos enviado un enlace de confirmación a <strong>{emailRegistrado}</strong>. Ábrelo para
          activar la cuenta de tu centro y poder entrar.
        </p>
        <p className="intro-text">
          ¿Ya lo has confirmado? <Link to="/entrar">Entrar</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Registra tu centro</h1>
      <p className="intro-text">
        Crea la cuenta de tu club o centro deportivo para ofrecer y pedir material. Los campos con * son
        obligatorios.
      </p>

      <form ref={formulario} className="formulario" onSubmit={enviar} noValidate>
        {errorGeneral && (
          <p className="alerta" role="alert">{errorGeneral}</p>
        )}

        <Campo id="nombre" etiqueta="Nombre del centro" obligatorio autoComplete="organization"
          value={valores.nombre} onChange={cambiar} error={errores.nombre} maxLength={160} />
        <Campo id="email" etiqueta="Email" obligatorio type="email" autoComplete="email"
          value={valores.email} onChange={cambiar} error={errores.email} />
        <Campo id="password" etiqueta="Contraseña (mínimo 8 caracteres)" obligatorio type="password"
          autoComplete="new-password" value={valores.password} onChange={cambiar} error={errores.password} />
        <Campo id="localidad" etiqueta="Localidad" obligatorio autoComplete="address-level2"
          value={valores.localidad} onChange={cambiar} error={errores.localidad} maxLength={120} />

        <div className="campos-en-fila">
          <Campo id="direccion" etiqueta="Dirección" autoComplete="street-address"
            value={valores.direccion} onChange={cambiar} error={errores.direccion} maxLength={255} />
          <Campo id="codigo_postal" etiqueta="Código postal" autoComplete="postal-code"
            value={valores.codigo_postal} onChange={cambiar} error={errores.codigo_postal} maxLength={20} />
        </div>
        <Campo id="telefono" etiqueta="Teléfono" type="tel" autoComplete="tel"
          value={valores.telefono} onChange={cambiar} error={errores.telefono} maxLength={30} />

        <div className="campo campo-casilla">
          <label htmlFor="acepta_politica_privacidad">
            <input
              id="acepta_politica_privacidad"
              name="acepta_politica_privacidad"
              type="checkbox"
              checked={valores.acepta_politica_privacidad}
              onChange={cambiar}
              aria-required="true"
              aria-invalid={errores.acepta_politica_privacidad ? 'true' : undefined}
              aria-describedby={errores.acepta_politica_privacidad ? 'acepta_politica_privacidad-error' : undefined}
            />
            <span>Acepto la política de privacidad <span aria-hidden="true">*</span></span>
          </label>
          {errores.acepta_politica_privacidad && (
            <p id="acepta_politica_privacidad-error" className="campo-error">
              {errores.acepta_politica_privacidad}
            </p>
          )}
        </div>

        <button type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar mi centro'}
        </button>

        <p className="formulario-pie">
          ¿Ya tienes cuenta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </section>
  );
}
