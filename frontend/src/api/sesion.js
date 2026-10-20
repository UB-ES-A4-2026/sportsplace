// Sesión del usuario guardada en el navegador.
// US-03 guardará aquí la `sesion` que devuelve la API (access_token, refresh_token, expires_at).
const CLAVE = 'sportsplace.sesion';

export function leerSesion() {
  try {
    const texto = window.localStorage.getItem(CLAVE);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento disponible: la sesión solo dura mientras la página siga abierta.
  }
}

export function borrarSesion() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}
