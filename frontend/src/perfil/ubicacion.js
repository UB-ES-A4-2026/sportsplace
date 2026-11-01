// Textos exactos de US-68 y qué mostrar en /perfil y si falla PUT /api/centros/mio/ubicacion.
import { CAMPOS_UBICACION } from '../validacion/ubicacion.js';
import { MENSAJE_ERROR_GENERICO } from './perfil.js';

export const TEXTOS_UBICACION = {
  banda: 'Indica tu código postal para que los demás centros sepan a qué distancia estás.',
  indicar: 'Indicar ubicación',
  editar: 'Editar ubicación',
  guardada: 'Ubicación guardada.',
  explicacion: 'Los demás centros solo verán tu localidad y tu provincia.',
};

// CA10: los centros del Sprint 0 no tienen código postal; hasta indicarlo, /perfil muestra la banda amarilla.
export function faltaCodigoPostal(centro) {
  return !centro.codigo_postal;
}

// «Zona: Barcelona (Barcelona)»: la localidad la escribe el usuario y la provincia sale del código postal (CA8).
export function textoZona({ localidad, provincia }) {
  return provincia ? `Zona: ${localidad} (${provincia})` : `Zona: ${localidad}`;
}

// «Dirección (solo la ves tú): Carrer de la Piscina 12, 08025 Barcelona». Sin dirección (CA19), «08025 Barcelona».
export function textoDireccion({ direccion, codigo_postal: codigoPostal, localidad }) {
  const lugar = `${codigoPostal} ${localidad}`;
  return `Dirección (solo la ves tú): ${direccion ? `${direccion}, ${lugar}` : lugar}`;
}

// Los datos del formulario siempre se conservan.
// - 400 DATOS_INVALIDOS o CODIGO_POSTAL_DESCONOCIDO: cada mensaje de `details` debajo de su campo (CA3-CA6, CA12).
// - 403 EMAIL_NO_CONFIRMADO: el mensaje de la API (aviso de US-02).
// - Red caída, 500, 503 y cualquier otro: aviso rojo genérico.
export function resultadoDeLaUbicacion(fallo) {
  if (fallo?.status === 400 && fallo.details) {
    const errores = Object.fromEntries(
      Object.entries(fallo.details).filter(([campo]) => CAMPOS_UBICACION.includes(campo)),
    );
    if (Object.keys(errores).length > 0) return { errores };
  }
  if (fallo?.status === 403 && fallo.code === 'EMAIL_NO_CONFIRMADO') return { mensaje: fallo.message };
  return { mensaje: MENSAJE_ERROR_GENERICO };
}
