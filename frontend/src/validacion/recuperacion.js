// Validación de los formularios de recuperación de contraseña (US-04).
// Mismas reglas y mensajes que US-01 (CA6, CA7); la coincidencia de las dos contraseñas solo se comprueba en la web (CA8).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;

// /recuperar-contrasena. Devuelve un objeto campo → mensaje. Vacío si todo es correcto.
export function validarRecuperacion(valores) {
  const errores = {};

  const email = (valores.email ?? '').trim();
  if (email === '') {
    errores.email = 'El email es obligatorio.';
  } else if (email.length > EMAIL_MAX || !EMAIL.test(email)) {
    errores.email = 'El email no es válido.';
  }

  return errores;
}

// /restablecer-contrasena. La contraseña no se recorta (CA7).
export function validarRestablecimiento(valores) {
  const errores = {};

  const password = valores.password ?? '';
  if (password === '') {
    errores.password = 'La contraseña es obligatoria.';
  } else if (password.length < PASSWORD_MIN) {
    errores.password = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  } else if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    errores.password = 'La contraseña es demasiado larga.';
  }

  if (password !== '' && (valores.password_repetida ?? '') !== password) {
    errores.password_repetida = 'Las contraseñas no coinciden.';
  }

  return errores;
}
