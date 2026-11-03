// Textos exactos de US-04 (CA5, CA16, CA17, CA18) y traducción de los fallos de la API.
export const CONFIRMACION_ENVIO =
  'Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña. Caduca en 1 hora.';
export const AVISO_CONTRASENA_CAMBIADA = 'Contraseña cambiada. Ya puedes entrar con la nueva.';
export const MENSAJE_DEMASIADOS_INTENTOS = 'Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.';
export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

// Solo sirve un enlace con token_hash y type=recovery (CA4). Si no, la página no llama a la API.
export function esEnlaceDeRecuperacion(tokenHash, tipo) {
  return Boolean(tokenHash) && tipo === 'recovery';
}

// Traduce el fallo de POST /api/auth/recuperar-contrasena o /restablecer-contrasena a lo que muestra el formulario.
// Los valores de los campos siempre se conservan.
// - 400 DATOS_INVALIDOS: cada mensaje debajo de su campo; sin token, la variante «Enlace no válido».
// - 400 ENLACE_INVALIDO: la variante «Enlace no válido».
// - 429: aviso rojo de CA17. Red caída, 500, 503 y cualquier otro: aviso rojo genérico (CA18).
export function resultadoDelFallo(fallo, campos) {
  if (fallo?.status === 400 && fallo.code === 'ENLACE_INVALIDO') return { enlaceInvalido: true };
  if (fallo?.status === 400 && fallo.code === 'DATOS_INVALIDOS' && fallo.details) {
    if (fallo.details.token_hash) return { enlaceInvalido: true };
    const errores = Object.fromEntries(Object.entries(fallo.details).filter(([campo]) => campos.includes(campo)));
    if (Object.keys(errores).length > 0) return { errores };
  }
  if (fallo?.status === 429) return { mensaje: MENSAJE_DEMASIADOS_INTENTOS };
  return { mensaje: MENSAJE_ERROR_GENERICO };
}
