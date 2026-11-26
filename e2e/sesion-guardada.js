// #392: sesión guardada de los centros de prueba. La primera vez cada cuenta entra por la pantalla; las siguientes
// se restaura su sesión (lo que la web guarda en localStorage, como un storageState) y se ahorra el formulario.

export const CLAVE_SESION = 'sportsplace.sesion'; // La misma clave que frontend/src/api/sesion.js.

// Margen (segundos) antes de que caduque el access_token. La web lo renueva 60 s antes, y una sesión renovada
// deja la copia guardada sin valor: con 5 min de margen, un caso (30 s como máximo) nunca llega a renovarla.
export const MARGEN_CADUCIDAD = 5 * 60;

export function sesionReutilizable(sesion, ahora = Math.floor(Date.now() / 1000)) {
  return Boolean(sesion?.access_token && sesion.refresh_token && Number.isFinite(sesion.expires_at))
    && sesion.expires_at - ahora > MARGEN_CADUCIDAD;
}

export function crearAlmacen() {
  const sesiones = new Map();
  return {
    leer(email) {
      const sesion = sesiones.get(email);
      return sesionReutilizable(sesion) ? sesion : null;
    },
    guardar(email, sesion) {
      if (sesionReutilizable(sesion)) sesiones.set(email, sesion);
      else sesiones.delete(email);
    },
    olvidar(email) {
      sesiones.delete(email);
    },
  };
}
