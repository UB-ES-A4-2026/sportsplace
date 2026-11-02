import { ApiError } from '../errors.js';
import { EMAIL } from './registro.js';

// US-07: campos del perfil que el centro puede editar.
const EDITABLES = ['nombre', 'descripcion', 'telefono', 'email_contacto', 'web'];
const TELEFONO = /^\+?[\d ]+$/;
const WEB = /^https?:\/\//i;

// Los límites se cuentan por puntos de código: un emoji es 1 carácter (CA25),
// igual que en char_length y VARCHAR de PostgreSQL.
function longitud(valor) {
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
    if (longitud(valor) > 1000) return 'Como máximo 1000 caracteres.';
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

// US-07 (CA6-CA10, CA18, CA19): valida el cuerpo de PATCH /api/centros/mio y
// devuelve solo los campos enviados, recortados. Un opcional vacío o null es null.
export function validarPerfil(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.');
  }

  const details = {};
  const cambios = {};

  for (const [campo, original] of Object.entries(body)) {
    if (!EDITABLES.includes(campo)) {
      details[campo] = 'Este campo no se puede modificar.';
      continue;
    }
    if (original !== null && typeof original !== 'string') {
      details[campo] = 'Debe ser un texto.';
      continue;
    }
    const valor = original === null ? '' : original.trim();
    if (valor === '' && campo !== 'nombre') {
      cambios[campo] = null;
      continue;
    }
    const error = REGLAS[campo](valor);
    if (error) details[campo] = error;
    else cambios[campo] = campo === 'email_contacto' ? valor.toLowerCase() : valor;
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', details);
  }
  return cambios;
}
