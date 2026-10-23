import { erroresDelServidor } from '../validacion/anuncio.js';

// Textos exactos de US-12 (CA4, CA9, CA11, CA14).
export const AVISO_PUBLICADO = 'Anuncio publicado.';
export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';
export const DIALOGO_SALIR = {
  titulo: '¿Salir sin publicar?',
  texto: 'Se perderán los datos que has escrito.',
  confirmar: 'Salir',
  cancelar: 'Seguir editando',
};

// Traduce el fallo de POST /api/anuncios a lo que muestra el formulario. Los datos siempre se conservan.
// - 400 DATOS_INVALIDOS: cada mensaje de `details` debajo de su campo (CA12).
// - 403 EMAIL_NO_CONFIRMADO: el mensaje de la API, el mismo aviso de US-02 (CA3).
// - Red caída, 500, 503 y cualquier otro: aviso rojo genérico (CA11).
export function resultadoDelEnvio(fallo) {
  if (fallo?.status === 400 && fallo.code === 'DATOS_INVALIDOS') {
    const errores = erroresDelServidor(fallo.details);
    if (Object.keys(errores).length > 0) return { errores };
    return { mensaje: fallo.message };
  }
  if (fallo?.status === 403 && fallo.code === 'EMAIL_NO_CONFIRMADO') return { mensaje: fallo.message };
  return { mensaje: MENSAJE_ERROR_GENERICO };
}
