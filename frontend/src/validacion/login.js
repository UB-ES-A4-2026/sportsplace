// Validación del formulario de entrada (US-03). Solo comprueba lo básico: el servidor decide si las credenciales son correctas.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve un objeto campo → mensaje. Vacío si todo es correcto.
export function validarLogin(valores) {
  const errores = {};

  const email = (valores.email ?? '').trim();
  if (email === '') {
    errores.email = 'El email es obligatorio.';
  } else if (!EMAIL.test(email)) {
    errores.email = 'El email no es válido.';
  }

  if ((valores.password ?? '') === '') {
    errores.password = 'La contraseña es obligatoria.';
  }

  return errores;
}
