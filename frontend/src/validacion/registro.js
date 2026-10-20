// Validación del formulario de registro (US-01).
// Mismas reglas y mensajes que el servidor (backend/src/validation/registro.js), para avisar antes de enviar.
// El servidor vuelve a validar siempre: esta comprobación solo mejora la experiencia.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;

const TEXTOS = {
  nombre: { max: 160, obligatorio: 'El nombre del centro es obligatorio.' },
  localidad: { max: 120, obligatorio: 'La localidad es obligatoria.' },
  direccion: { max: 255 },
  codigo_postal: { max: 20 },
  telefono: { max: 30 },
};

// Devuelve un objeto campo → mensaje. Vacío si todo es correcto.
export function validarRegistro(valores) {
  const errores = {};

  for (const [campo, regla] of Object.entries(TEXTOS)) {
    const valor = (valores[campo] ?? '').trim();
    if (valor === '') {
      if (regla.obligatorio) errores[campo] = regla.obligatorio;
    } else if (valor.length > regla.max) {
      errores[campo] = `Como máximo ${regla.max} caracteres.`;
    }
  }

  const email = (valores.email ?? '').trim();
  if (email === '') {
    errores.email = 'El email es obligatorio.';
  } else if (email.length > 254 || !EMAIL.test(email)) {
    errores.email = 'El email no es válido.';
  }

  const password = valores.password ?? '';
  if (password === '') {
    errores.password = 'La contraseña es obligatoria.';
  } else if (password.length < PASSWORD_MIN) {
    errores.password = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  } else if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    errores.password = 'La contraseña es demasiado larga.';
  }

  if (valores.acepta_politica_privacidad !== true) {
    errores.acepta_politica_privacidad = 'Debes aceptar la política de privacidad.';
  }

  return errores;
}
