import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS, marcarEnterosConDecimales, validarAnuncio } from './anuncios.js';

// US-13: fotos del anuncio («Tabla de campos» de E03, CA12-CA15).
export const MAX_FOTOS = 8;

export const MENSAJES_FOTOS = {
  faltan: 'Añade al menos una foto.',
  demasiadas: 'Puedes añadir 8 fotos como máximo.',
  tipo: 'Solo se admiten fotos JPG, PNG o WebP.',
  tamano: 'Cada foto debe pesar 5 MB como máximo.',
};

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

// CA13: el tipo se decide por la cabecera binaria del archivo, nunca por la
// extensión ni por el Content-Type que declara el cliente.
export function tipoDeFoto(contenido) {
  if (contenido.length >= 3 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff) {
    return { tipo_mime: 'image/jpeg', extension: 'jpg' };
  }
  if (contenido.length >= 4 && contenido.subarray(0, 4).equals(FIRMA_PNG)) {
    return { tipo_mime: 'image/png', extension: 'png' };
  }
  if (contenido.length >= 12
      && contenido.toString('latin1', 0, 4) === 'RIFF'
      && contenido.toString('latin1', 8, 12) === 'WEBP') {
    return { tipo_mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

// `total` es el número de fotos que tendrá el anuncio: al publicar, las
// recibidas; al editar (US-15 CA12), las conservadas más las nuevas.
function errorDeFotos(fotos, total = fotos.length) {
  if (total === 0) return MENSAJES_FOTOS.faltan;
  if (total > MAX_FOTOS) return MENSAJES_FOTOS.demasiadas;
  if (fotos.some((foto) => !tipoDeFoto(foto.contenido))) return MENSAJES_FOTOS.tipo;
  if (fotos.some((foto) => foto.demasiadoGrande)) return MENSAJES_FOTOS.tamano;
  return null;
}

const MENSAJE_FOTO_PRINCIPAL = 'La foto principal no es válida.';
const MENSAJE_FOTOS_CONSERVAR = 'Alguna foto no pertenece a este anuncio.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Foto recibida y validada → foto lista para subir, con su tipo detectado.
const aFotoNueva = (foto) => ({
  contenido: foto.contenido,
  bytes: foto.contenido.length,
  ...tipoDeFoto(foto.contenido),
});

// CA12/CA14: índice 1..n en texto; si falta, la principal es la 1.
function indicePrincipal(valor, totalFotos) {
  if (valor === undefined) return 1;
  if (!/^[1-9]\d*$/.test(valor.trim())) return null;
  const indice = Number(valor.trim());
  // Sin fotos no hay rango que comprobar: el error ya está en `fotos`.
  if (totalFotos > 0 && indice > totalFotos) return null;
  return indice;
}

// CA15: `datos` es el texto JSON con los campos de US-12 (y US-14).
function leerDatos(texto) {
  if (typeof texto !== 'string') return { error: true };
  try {
    return { cuerpo: JSON.parse(texto, marcarEnterosConDecimales) };
  } catch {
    return { error: true };
  }
}

// Valida a la vez los datos del anuncio y sus fotos y devuelve los errores
// juntos en `details` (CA14). Si todo es correcto, devuelve los campos del
// anuncio y las fotos en su orden, con su tipo detectado y la principal marcada.
export function validarPublicacion({ datos, fotos, fotoPrincipal }) {
  const details = {};
  let anuncio;

  const { cuerpo, error } = leerDatos(datos);
  if (error) {
    details.datos = 'Faltan los datos del anuncio.';
  } else {
    try {
      anuncio = validarAnuncio(cuerpo);
    } catch (errorDeCampos) {
      if (!(errorDeCampos instanceof ApiError)) throw errorDeCampos;
      Object.assign(details, errorDeCampos.details);
    }
  }

  const mensajeFotos = errorDeFotos(fotos);
  if (mensajeFotos) details.fotos = mensajeFotos;

  const principal = indicePrincipal(fotoPrincipal, fotos.length);
  if (principal === null) details.foto_principal = MENSAJE_FOTO_PRINCIPAL;

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }

  return {
    anuncio,
    fotos: fotos.map((foto, posicion) => ({
      ...aFotoNueva(foto),
      orden: posicion + 1,
      es_principal: posicion + 1 === principal,
    })),
  };
}

// US-15 CA11: `fotos_conservar` es el array ordenado de ids de fotos actuales
// que se quedan. Un valor que no es un array de UUID distintos no puede
// referirse a fotos de este anuncio. Devuelve null si no es válido.
function idsConservados(valor) {
  if (!Array.isArray(valor)) return null;
  if (!valor.every((id) => typeof id === 'string' && UUID.test(id))) return null;
  const ids = valor.map((id) => id.toLowerCase());
  return new Set(ids).size === ids.length ? ids : null;
}

// US-15 CA11/CA13: `existente:<id>` (de `fotos_conservar`) o `nueva:<índice 1..n>`.
// Tiene que apuntar a una foto final; si falta, no apunta a ninguna.
function principalDeEdicion(valor, conservar, totalNuevas) {
  const [, tipo, referencia] = /^(existente|nueva):(.+)$/.exec(valor?.trim() ?? '') ?? [];
  if (tipo === 'existente') {
    const id = referencia.toLowerCase();
    return conservar?.includes(id) ? { existente: id } : null;
  }
  if (tipo === 'nueva' && /^[1-9]\d*$/.test(referencia)) {
    const indice = Number(referencia);
    return indice <= totalNuevas ? { nueva: indice } : null;
  }
  return null;
}

// US-15 CA5, CA11-CA13: valida el `PATCH` con las mismas reglas que al
// publicar y junta todos los errores en `details`. La pertenencia de
// `fotos_conservar` al anuncio se comprueba después, contra la base de datos.
// Devuelve los campos del anuncio, los ids conservados en orden, las fotos
// nuevas en orden y la principal ({ existente: id } o { nueva: índice }).
export function validarEdicion({ datos, fotos, fotoPrincipal }) {
  const details = {};
  let anuncio;
  let conservar;

  const { cuerpo, error } = leerDatos(datos);
  if (error) {
    details.datos = 'Faltan los datos del anuncio.';
  } else {
    try {
      anuncio = validarAnuncio(cuerpo);
    } catch (errorDeCampos) {
      if (!(errorDeCampos instanceof ApiError)) throw errorDeCampos;
      Object.assign(details, errorDeCampos.details);
    }
    conservar = idsConservados(cuerpo?.fotos_conservar);
    if (!conservar) details.fotos_conservar = MENSAJE_FOTOS_CONSERVAR;
  }

  // Sin `fotos_conservar` válido no se sabe el total: solo se miran las nuevas.
  const mensajeFotos = conservar
    ? errorDeFotos(fotos, conservar.length + fotos.length)
    : errorDeFotos(fotos, Math.max(fotos.length, 1));
  if (mensajeFotos) details.fotos = mensajeFotos;

  // Una principal `existente:` solo se puede comprobar si `fotos_conservar` es válido.
  const principal = principalDeEdicion(fotoPrincipal, conservar, fotos.length);
  if (!principal && (conservar || !fotoPrincipal?.trim().startsWith('existente:'))) {
    details.foto_principal = MENSAJE_FOTO_PRINCIPAL;
  }

  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }

  return { anuncio, conservar, nuevas: fotos.map(aFotoNueva), principal };
}

export function fotosNoPertenecen() {
  return new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, {
    fotos_conservar: MENSAJE_FOTOS_CONSERVAR,
  });
}
