import { ApiError } from '../errors.js';

const CAMPOS = ['direccion', 'codigo_postal', 'localidad'];
const CINCO_CIFRAS = /^\d{5}$/;

// Los límites se cuentan por puntos de código, igual que VARCHAR en PostgreSQL.
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

// US-68 (CA3-CA6, CA11, CA12): valida el cuerpo de PUT /api/centros/mio/ubicacion
// y devuelve los tres campos recortados. La dirección vacía se guarda como null
// (CA19). Que el código postal exista en codigos_postales lo comprueba el
// repositorio (CA5).
export function validarUbicacion(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {};

  const details = {};
  const ubicacion = {};

  for (const campo of CAMPOS) {
    const original = body[campo] ?? '';
    if (typeof original !== 'string') {
      details[campo] = 'Debe ser un texto.';
      continue;
    }
    const valor = original.trim();
    const error = REGLAS[campo](valor);
    if (error) details[campo] = error;
    else ubicacion[campo] = campo === 'direccion' && valor === '' ? null : valor;
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', details);
  }
  return ubicacion;
}
