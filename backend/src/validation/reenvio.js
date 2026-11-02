import { ApiError } from '../errors.js';
import { errorDeEmail } from './registro.js';

// US-66: valida el email para pedir un enlace de confirmación nuevo.
// Usa la misma regla que el registro (US-01). US-04 la reutiliza para pedir
// el enlace de recuperación de la contraseña.
export function validarReenvio(body = {}) {
  const email = typeof body?.email === 'string' ? body.email.trim() : body?.email;

  const error = errorDeEmail(email);
  if (error) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', { email: error });
  }
  return { email: email.toLowerCase() };
}
