// Textos exactos de US-07 y traducción de los fallos de PATCH /api/centros/mio.
import { CAMPOS_PERFIL } from '../validacion/perfil.js';

export const TEXTOS_PERFIL = {
  sinDescripcion: 'Todavía no has escrito una descripción.',
  sinDato: '—',
  actualizado: 'Perfil actualizado.',
  cargando: 'Cargando…',
  errorCarga: 'No se ha podido cargar. ',
  reintentar: 'Reintentar',
};

export const DIALOGO_DESCARTAR = {
  titulo: '¿Descartar cambios?',
  texto: 'Los cambios que has hecho no se guardarán.',
  confirmar: 'Descartar',
  cancelar: 'Cancelar',
};

export const MENSAJE_ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';

// Los datos del formulario siempre se conservan.
// - 400 DATOS_INVALIDOS: cada mensaje de `details` debajo de su campo (CA11).
// - 403 EMAIL_NO_CONFIRMADO: el mensaje de la API, el aviso de US-02 (CA23).
// - Red caída, 500, 503 y cualquier otro: aviso rojo genérico (CA16).
export function resultadoDelGuardado(fallo) {
  if (fallo?.status === 400 && fallo.code === 'DATOS_INVALIDOS' && fallo.details) {
    const errores = Object.fromEntries(
      Object.entries(fallo.details).filter(([campo]) => CAMPOS_PERFIL.includes(campo)),
    );
    if (Object.keys(errores).length > 0) return { errores };
  }
  if (fallo?.status === 403 && fallo.code === 'EMAIL_NO_CONFIRMADO') return { mensaje: fallo.message };
  return { mensaje: MENSAJE_ERROR_GENERICO };
}
