// Validación del formulario «Editar perfil» (US-07, CA6-CA10).
// Mismas reglas y mensajes que el servidor (backend/src/validation/perfil.js), para avisar antes de enviar (CA11).
// Se recortan los espacios antes de validar; un opcional vacío se envía como null.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[\d ]+$/;
const WEB = /^https?:\/\//i;

export const CAMPOS_PERFIL = ['nombre', 'descripcion', 'telefono', 'email_contacto', 'web'];
export const DESCRIPCION_MAX = 1000;

// Los límites se cuentan por puntos de código: un emoji es 1 carácter (CA25).
export function longitud(valor) {
  return [...valor].length;
}

function webValida(valor) {
  try {
    const { hostname } = new URL(valor);
    return hostname.includes('.') && !hostname.startsWith('.') && !hostname.endsWith('.');
  } catch {
    return false;
  }
}

const REGLAS = {
  nombre(valor) {
    if (valor === '') return 'El nombre del centro es obligatorio.';
    if (longitud(valor) > 160) return 'Como máximo 160 caracteres.';
  },
  descripcion(valor) {
    if (longitud(valor) > DESCRIPCION_MAX) return `Como máximo ${DESCRIPCION_MAX} caracteres.`;
  },
  telefono(valor) {
    if (longitud(valor) > 30) return 'Como máximo 30 caracteres.';
    if (longitud(valor) < 9 || !TELEFONO.test(valor)) return 'El teléfono no es válido.';
  },
  email_contacto(valor) {
    if (longitud(valor) > 254 || !EMAIL.test(valor)) return 'El email no es válido.';
  },
  web(valor) {
    if (longitud(valor) > 255) return 'Como máximo 255 caracteres.';
    if (!WEB.test(valor)) return 'La web debe empezar por http:// o https://.';
    if (!webValida(valor)) return 'La web no es válida.';
  },
};

// Devuelve un objeto campo → mensaje. Vacío si todo es correcto.
export function validarPerfil(valores) {
  const errores = {};
  for (const campo of CAMPOS_PERFIL) {
    const valor = (valores[campo] ?? '').trim();
    if (valor === '' && campo !== 'nombre') continue;
    const error = REGLAS[campo](valor);
    if (error) errores[campo] = error;
  }
  return errores;
}

// Valores del formulario a partir del centro de la API (CA3): los null se muestran vacíos.
export function valoresDelCentro(centro) {
  return Object.fromEntries(CAMPOS_PERFIL.map((campo) => [campo, centro[campo] ?? '']));
}

// CA13: hay cambios si algún campo es distinto de lo que llegó de la API.
export function hayCambios(valores, centro) {
  const iniciales = valoresDelCentro(centro);
  return CAMPOS_PERFIL.some((campo) => valores[campo] !== iniciales[campo]);
}

// Cuerpo de PATCH /api/centros/mio: los cinco campos recortados; un opcional vacío es null (CA18, CA24).
export function cuerpoDelPerfil(valores) {
  return Object.fromEntries(CAMPOS_PERFIL.map((campo) => {
    const valor = (valores[campo] ?? '').trim();
    return [campo, valor === '' && campo !== 'nombre' ? null : valor];
  }));
}
