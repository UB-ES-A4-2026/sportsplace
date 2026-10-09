import { ApiError } from '../errors.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Supabase Auth guarda la contraseña con bcrypt, que solo usa los primeros 72 bytes.
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;

// Los límites coinciden con la tabla centros (migración de TR-03).
const TEXTOS = {
  nombre: { max: 160, obligatorio: 'El nombre del centro es obligatorio.' },
  localidad: { max: 120, obligatorio: 'La localidad es obligatoria.' },
  direccion: { max: 255 },
  codigo_postal: { max: 20 },
  telefono: { max: 30 },
};

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : valor;
}

// US-01: valida el alta y devuelve los datos limpios del centro.
export function validarRegistro(body = {}) {
  const details = {};
  const centro = {};

  for (const [campo, regla] of Object.entries(TEXTOS)) {
    const valor = texto(body[campo]);
    if (valor === undefined || valor === null || valor === '') {
      if (regla.obligatorio) details[campo] = regla.obligatorio;
      centro[campo] = null;
    } else if (typeof valor !== 'string') {
      details[campo] = 'Debe ser un texto.';
    } else if (valor.length > regla.max) {
      details[campo] = `Como máximo ${regla.max} caracteres.`;
    } else {
      centro[campo] = valor;
    }
  }

  const email = texto(body.email);
  if (typeof email !== 'string' || email === '') {
    details.email = 'El email es obligatorio.';
  } else if (email.length > 254 || !EMAIL.test(email)) {
    details.email = 'El email no es válido.';
  } else {
    centro.email = email.toLowerCase();
  }

  const { password } = body;
  if (typeof password !== 'string' || password === '') {
    details.password = 'La contraseña es obligatoria.';
  } else if (password.length < PASSWORD_MIN) {
    details.password = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  } else if (Buffer.byteLength(password) > PASSWORD_MAX_BYTES) {
    details.password = 'La contraseña es demasiado larga.';
  }

  if (body.acepta_politica_privacidad !== true) {
    details.acepta_politica_privacidad = 'Debes aceptar la política de privacidad.';
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', details);
  }
  return { centro, password };
}
