import { ApiError } from '../errors.js';

// E03 «Base común»: valores fijos y reglas de la «Tabla de campos»
// (docs/especificacion/E03-publicacion-de-material.md). Lo comparten US-12,
// US-14 (modalidad y precio), US-15 (modificar), US-19 y US-90.

export const CATEGORIAS = [
  'balones', 'ropa_equipacion', 'calzado', 'protecciones',
  'material_entrenamiento', 'porterias_redes', 'maquinas_fitness', 'otros',
];

export const DEPORTES = [
  'futbol', 'baloncesto', 'balonmano', 'voleibol', 'tenis',
  'padel', 'natacion', 'atletismo', 'gimnasio_fitness', 'varios',
];

export const ESTADOS_MATERIAL = ['nuevo', 'como_nuevo', 'buen_estado', 'usado', 'para_reparar'];

// Claves numéricas que la API solo acepta como entero JSON: `3.0` o `1e3`
// llegan a JavaScript como 3 y 1000, así que se marcan al leer el JSON.
const CAMPOS_ENTEROS = new Set(['unidades_disponibles', 'precio_unitario_centimos']);

// `reviver` de express.json: un número de esas claves escrito con decimales
// o exponente se convierte en NaN, que la validación rechaza.
export function marcarEnterosConDecimales(clave, valor, contexto) {
  if (typeof valor === 'number' && CAMPOS_ENTEROS.has(clave) && /[.eE]/.test(contexto?.source ?? '')) {
    return Number.NaN;
  }
  return valor;
}

export const MENSAJE_DATOS_INVALIDOS = 'Revisa los campos marcados.';

// Las longitudes se cuentan en caracteres Unicode (un emoji o una «ñ» cuentan 1),
// igual que char_length en PostgreSQL.
const longitud = (texto) => [...texto].length;
const vacio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

function validarTexto(valor, { min, max, obligatorio, rango, unaLinea }) {
  if (vacio(valor)) return { error: obligatorio };
  if (typeof valor !== 'string') return { error: rango };
  const texto = valor.trim();
  if (unaLinea && /[\r\n]/.test(texto)) return { error: unaLinea };
  const n = longitud(texto);
  if (n < min || n > max) return { error: rango };
  return { valor: texto };
}

function validarOpcion(valor, opciones, { obligatorio, invalido }) {
  if (vacio(valor)) return { error: obligatorio };
  // Sensible a mayúsculas: «Balones» no es válido en la API.
  if (typeof valor !== 'string' || !opciones.includes(valor.trim())) return { error: invalido };
  return { valor: valor.trim() };
}

function validarUnidades(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return { error: 'Indica las unidades disponibles.' };
  }
  // Solo entero JSON: "3" (texto), 3.0 o 2.5 se rechazan.
  if (!Number.isInteger(valor) || valor < 1 || valor > 9999) {
    return { error: 'Las unidades deben ser un número entero entre 1 y 9999.' };
  }
  return { valor };
}

const REGLAS = {
  titulo: (valor) => validarTexto(valor, {
    min: 5,
    max: 80,
    obligatorio: 'El título es obligatorio.',
    rango: 'El título debe tener entre 5 y 80 caracteres.',
    unaLinea: 'El título no puede tener saltos de línea.',
  }),
  descripcion: (valor) => validarTexto(valor, {
    min: 20,
    max: 1000,
    obligatorio: 'La descripción es obligatoria.',
    rango: 'La descripción debe tener entre 20 y 1000 caracteres.',
  }),
  categoria: (valor) => validarOpcion(valor, CATEGORIAS, {
    obligatorio: 'Elige una categoría.',
    invalido: 'La categoría no es válida.',
  }),
  deporte: (valor) => validarOpcion(valor, DEPORTES, {
    obligatorio: 'Elige un deporte.',
    invalido: 'El deporte no es válido.',
  }),
  unidades_disponibles: validarUnidades,
  estado_material: (valor) => validarOpcion(valor, ESTADOS_MATERIAL, {
    obligatorio: 'Elige el estado del material.',
    invalido: 'El estado del material no es válido.',
  }),
};

// US-12: valida los datos de un anuncio y devuelve solo los campos conocidos,
// ya recortados. Comprueba todos los campos a la vez (CA17); cualquier otra
// clave del cuerpo (`estado`, `centro_id`, `id`...) se ignora (CA21).
// Un cuerpo que no es un objeto (p. ej. `[]`) cuenta como vacío (CA18).
export function validarAnuncio(cuerpo) {
  const datos = cuerpo !== null && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {};
  const anuncio = {};
  const details = {};

  for (const [campo, regla] of Object.entries(REGLAS)) {
    const { valor, error } = regla(datos[campo]);
    if (error) details[campo] = error;
    else anuncio[campo] = valor;
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }
  return anuncio;
}

// US-18 (CA11): `pagina` (por defecto 1) y `por_pagina` (1-50, por defecto 20)
// de la query. Solo se aceptan dígitos: «2.5», «-1», «abc» o un parámetro
// repetido se rechazan con su mensaje.
export const POR_PAGINA_DEFECTO = 20;

function enteroDeQuery(valor) {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : null;
}

export function validarPaginacion(query) {
  const details = {};
  let pagina = 1;
  let porPagina = POR_PAGINA_DEFECTO;

  if (query.pagina !== undefined) {
    pagina = enteroDeQuery(query.pagina);
    if (pagina === null || pagina < 1) details.pagina = 'Debe ser un número entero mayor que 0.';
  }
  if (query.por_pagina !== undefined) {
    porPagina = enteroDeQuery(query.por_pagina);
    if (porPagina === null || porPagina < 1 || porPagina > 50) {
      details.por_pagina = 'Debe ser un número entre 1 y 50.';
    }
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }
  return { pagina, porPagina };
}
