import { ApiError } from '../errors.js';
import { EMAIL } from './registro.js';

// US-66: valida el email para pedir un enlace de confirmación nuevo.
// Usa la misma regla de formato que el registro (US-01).
export function validarReenvio(body = {}) {
  const email = typeof body.email === 'string' ? body.email.trim() : body.email;

  let error;
  if (typeof email !== 'string' || email === '') {
    error = 'El email es obligatorio.';
  } else if (email.length > 254 || !EMAIL.test(email)) {
    error = 'El email no es válido.';
  }

  if (error) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', { email: error });
  }
  return { email: email.toLowerCase() };
}
