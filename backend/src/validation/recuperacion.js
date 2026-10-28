import { ApiError } from '../errors.js';
import { errorDePassword } from './registro.js';
import { validarReenvio } from './reenvio.js';

// US-04 (CA6, CA19): el email para pedir el enlace sigue la misma regla que el
// registro y el reenvío de confirmación; se devuelve recortado y en minúsculas (CA25).
export function validarRecuperacion(body) {
  return validarReenvio(body ?? {});
}

// US-04 (CA7, CA20): token del enlace y contraseña nueva, con los mensajes de
// US-01. Devuelve los dos errores a la vez. La contraseña no se recorta.
export function validarRestablecimiento(body) {
  const tokenHash = body?.token_hash;
  const password = body?.password;
  const details = {};

  if (typeof tokenHash !== 'string' || tokenHash.trim() === '') {
    details.token_hash = 'Falta el token del enlace.';
  }
  const errorPassword = errorDePassword(password);
  if (errorPassword) details.password = errorPassword;

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', details);
  }
  return { tokenHash: tokenHash.trim(), password };
}
