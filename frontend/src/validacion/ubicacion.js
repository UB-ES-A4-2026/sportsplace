// Validación del formulario «Ubicación del centro» (US-68, CA3-CA6).
// Mismas reglas y mensajes que el servidor (backend/src/validation/ubicacion.js), para avisar antes de enviar.
// Que el código postal exista en la tabla solo lo sabe el servidor (CA5, CODIGO_POSTAL_DESCONOCIDO).
export const CAMPOS_UBICACION = ['direccion', 'codigo_postal', 'localidad'];
const CINCO_CIFRAS = /^\d{5}$/;

// Los límites se cuentan por puntos de código, igual que en la API.
function longitud(valor) {
  return [...valor].length;
}

const REGLAS = {
  direccion(valor) {
    if (longitud(valor) > 255) return 'Como máximo 255 caracteres.';
  },
  codigo_postal(valor) {
    if (valor === '') return 'El código postal es obligatorio.';
    if (!CINCO_CIFRAS.test(valor)) return 'El código postal debe tener 5 cifras.';
    if (valor < '01000' || valor > '52999') return 'El código postal no es de España.';
  },
  localidad(valor) {
    if (valor === '') return 'La localidad es obligatoria.';
    if (longitud(valor) > 120) return 'Como máximo 120 caracteres.';
  },
};

// Se recortan los espacios antes de validar. Devuelve un objeto campo → mensaje; vacío si todo es correcto.
export function validarUbicacion(valores) {
  const errores = {};
  for (const campo of CAMPOS_UBICACION) {
    const error = REGLAS[campo]((valores[campo] ?? '').trim());
    if (error) errores[campo] = error;
  }
  return errores;
}

// CA1: el formulario empieza con los valores actuales; los null se muestran vacíos.
export function valoresDeUbicacion(centro) {
  return Object.fromEntries(CAMPOS_UBICACION.map((campo) => [campo, centro[campo] ?? '']));
}

// Cuerpo del PUT: siempre los tres campos, recortados (la API guarda la dirección vacía como null, CA19).
export function cuerpoDeUbicacion(valores) {
  return Object.fromEntries(CAMPOS_UBICACION.map((campo) => [campo, (valores[campo] ?? '').trim()]));
}
