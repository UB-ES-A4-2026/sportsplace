import { CATEGORIAS, DEPORTES, ESTADOS_MATERIAL } from '../anuncios/valores.js';
import { datosModalidadPrecio, validarModalidadPrecio } from './modalidadPrecio.js';

// Validación del formulario de anuncio (E03, «Tabla de campos»; US-12 CA5-CA8 y CA26-CA29).
// Los mensajes son exactamente los de la especificación: la API devuelve los mismos en `details`.
// La usan «Publicar anuncio» (US-12) y, más adelante, «Editar» (US-15), «Duplicar» (US-19) y los importados (US-90).

// Campos en el orden del formulario. El foco va al primero con error en este orden (CA7).
export const CAMPOS_ANUNCIO = [
  'titulo',
  'descripcion',
  'categoria',
  'deporte',
  'unidades_disponibles',
  'estado_material',
];

// Campos de la sección «Modalidad y precio» (US-14). Las claves son las de la API (`details` de un 400).
// En el formulario, el precio escrito vive en `valores.precio` y el error cuelga de `precio_unitario_centimos`.
export const CAMPOS_MODALIDAD_PRECIO = ['modalidad', 'precio_unitario_centimos'];

// Todos los campos que pueden tener error, en el orden del formulario: el foco va al primero (CA7)
// y de un 400 se muestran los de esta lista (CA12).
export const CAMPOS_CON_ERROR = [...CAMPOS_ANUNCIO, ...CAMPOS_MODALIDAD_PRECIO];

export const TITULO_MAX = 80;
export const DESCRIPCION_MAX = 1000;

export const VALORES_VACIOS = Object.freeze({
  titulo: '',
  descripcion: '',
  categoria: '',
  deporte: '',
  unidades_disponibles: '',
  estado_material: '',
  modalidad: '',
  precio: '',
});

const ENTERO = /^\d+$/;

// Longitud en caracteres Unicode, sin los espacios del principio y del final (un emoji o una «ñ» cuentan 1),
// igual que `char_length` en PostgreSQL. Es lo que muestran los contadores «n/80» y «n/1000» (CA6).
export function longitud(texto) {
  return [...(texto ?? '').trim()].length;
}

function validarTexto(valor, { min, max, falta, rango }) {
  const n = longitud(valor);
  if (n === 0) return falta;
  if (n < min || n > max) return rango;
  return undefined;
}

function validarOpcion(valor, opciones, { falta, invalido }) {
  if ((valor ?? '') === '') return falta;
  if (!opciones.some((opcion) => opcion.valor === valor)) return invalido;
  return undefined;
}

const VALIDADORES = {
  titulo(valor) {
    if (/[\r\n]/.test((valor ?? '').trim())) return 'El título no puede tener saltos de línea.';
    return validarTexto(valor, {
      min: 5,
      max: TITULO_MAX,
      falta: 'El título es obligatorio.',
      rango: 'El título debe tener entre 5 y 80 caracteres.',
    });
  },
  descripcion(valor) {
    return validarTexto(valor, {
      min: 20,
      max: DESCRIPCION_MAX,
      falta: 'La descripción es obligatoria.',
      rango: 'La descripción debe tener entre 20 y 1000 caracteres.',
    });
  },
  categoria(valor) {
    return validarOpcion(valor, CATEGORIAS, { falta: 'Elige una categoría.', invalido: 'La categoría no es válida.' });
  },
  deporte(valor) {
    return validarOpcion(valor, DEPORTES, { falta: 'Elige un deporte.', invalido: 'El deporte no es válido.' });
  },
  // `ilegible`: el campo numérico tiene texto que el navegador no entiende como número («abc», «2,5» en algunos
  // navegadores). En ese caso `value` llega vacío, pero hay algo escrito: es un error de formato, no un campo vacío.
  unidades_disponibles(valor, { ilegible = false } = {}) {
    const texto = String(valor ?? '').trim();
    if (texto === '' && !ilegible) return 'Indica las unidades disponibles.';
    const n = Number(texto);
    if (ilegible || !ENTERO.test(texto) || n < 1 || n > 9999) {
      return 'Las unidades deben ser un número entero entre 1 y 9999.';
    }
    return undefined;
  },
  estado_material(valor) {
    return validarOpcion(valor, ESTADOS_MATERIAL, {
      falta: 'Elige el estado del material.',
      invalido: 'El estado del material no es válido.',
    });
  },
};

// Valida un campo. Devuelve el mensaje de error o undefined si es válido.
export function validarCampo(campo, valor, opciones) {
  return VALIDADORES[campo](valor, opciones);
}

// Valida todos los campos a la vez (CA7). Devuelve un objeto campo → mensaje; vacío si todo es correcto.
// Incluye «Modalidad y precio» (US-14): el precio solo se valida con «Venta» marcada.
export function validarAnuncio(valores, { unidadesIlegibles = false } = {}) {
  const errores = {};
  for (const campo of CAMPOS_ANUNCIO) {
    const error = validarCampo(campo, valores[campo], { ilegible: unidadesIlegibles });
    if (error) errores[campo] = error;
  }
  return { ...errores, ...validarModalidadPrecio(valores) };
}

// Cuerpo de POST /api/anuncios (US-12 CA15): textos recortados y unidades como entero JSON.
// Con US-14 lleva `modalidad` y, solo en una venta, `precio_unitario_centimos` en céntimos enteros (CA5, CA8).
// Las fotos las añadirá US-13.
export function cuerpoDelAnuncio(valores) {
  return {
    titulo: valores.titulo.trim(),
    descripcion: valores.descripcion.trim(),
    categoria: valores.categoria,
    deporte: valores.deporte,
    unidades_disponibles: Number(String(valores.unidades_disponibles).trim()),
    estado_material: valores.estado_material,
    ...datosModalidadPrecio(valores),
  };
}

// ¿Se ha tocado el formulario? Decide si «Cancelar» abre el diálogo «¿Salir sin publicar?» (US-12 CA9).
// En «Publicar anuncio» los valores iniciales están vacíos, así que equivale a «algún campo tiene valor».
// Comparar con los iniciales deja el componente listo para un formulario que ya viene relleno (US-15, US-19).
export function haCambiado(valores, iniciales = VALORES_VACIOS, { unidadesIlegibles = false } = {}) {
  return unidadesIlegibles
    || [...CAMPOS_ANUNCIO, 'modalidad', 'precio']
      .some((campo) => String(valores[campo] ?? '') !== String(iniciales[campo] ?? ''));
}

// Se queda con los mensajes de `details` de un 400 DATOS_INVALIDOS que corresponden a campos del formulario (CA12).
export function erroresDelServidor(details) {
  if (!details || typeof details !== 'object') return {};
  return Object.fromEntries(
    CAMPOS_CON_ERROR.filter((campo) => typeof details[campo] === 'string').map((campo) => [campo, details[campo]]),
  );
}
