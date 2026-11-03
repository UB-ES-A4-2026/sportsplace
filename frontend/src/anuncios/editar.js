// «Editar anuncio» (US-15 T15-2): textos exactos, cuándo se puede editar y cuerpo de PATCH /api/anuncios/:id.
import { VALORES_VACIOS } from '../validacion/anuncio.js';

export const AVISO_GUARDADO = 'Cambios guardados.';
export const MENSAJE_NO_EDITABLE = 'Este anuncio ya no se puede editar.';
export const DIALOGO_DESCARTAR = {
  titulo: '¿Descartar los cambios?',
  texto: 'Los cambios que no has guardado se perderán.',
  confirmar: 'Descartar',
  cancelar: 'Seguir editando',
};

// CA1: «Editar» en activo, pausado y reservado; no en entregado. (En borrador el botón es «Completar y publicar», US-90.)
const ESTADOS_EDITABLES = ['activo', 'pausado', 'reservado'];

export function puedeEditar(estado) {
  return ESTADOS_EDITABLES.includes(estado);
}

// Valores del formulario a partir del anuncio de la API: los mismos campos que al publicar, como texto.
// Modalidad y precio (US-14) también: el precio se escribe como en el campo, «8,50» (sin separador de miles).
export function valoresDelAnuncio(anuncio) {
  const valores = Object.fromEntries(Object.keys(VALORES_VACIOS).map((campo) => [campo, String(anuncio[campo] ?? '')]));
  valores.precio = textoDelPrecio(anuncio.precio_unitario_centimos);
  return valores;
}

// 850 → «8,50»; sin precio (donación), vacío.
export function textoDelPrecio(centimos) {
  if (!Number.isInteger(centimos)) return '';
  return `${Math.trunc(centimos / 100)},${String(centimos % 100).padStart(2, '0')}`;
}

// CA2 y CA8: las fotos actuales en la rejilla, en su orden y con su principal. Se distinguen de las nuevas por
// `existente`; la miniatura es su URL pública.
export function fotosDelAnuncio(anuncio) {
  const actuales = [...(anuncio.fotos ?? [])].sort((a, b) => a.orden - b.orden);
  const principal = actuales.find((foto) => foto.es_principal) ?? actuales[0];
  return {
    fotos: actuales.map((foto) => ({ id: foto.id, existente: true, vista: foto.url, nombre: `Foto ${foto.orden}` })),
    principalId: principal?.id ?? null,
  };
}

// CA11 y CA12: `datos` con el anuncio completo (campos de US-12 y US-14) y `fotos_conservar` (ids de las actuales
// que se quedan, en el orden de la rejilla); una parte `fotos` por cada nueva, en orden; y `foto_principal` como
// `existente:<id>` o `nueva:<n>` (n = posición entre las nuevas, desde 1). Las nuevas siempre van detrás de las
// conservadas en la rejilla, así que el orden final del servidor coincide con el que se ve.
export function cuerpoDeLaEdicion(cuerpo, estadoFotos) {
  const conservadas = estadoFotos.fotos.filter((foto) => foto.existente);
  const nuevas = estadoFotos.fotos.filter((foto) => !foto.existente);
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify({ ...cuerpo, fotos_conservar: conservadas.map((foto) => foto.id) }));
  for (const foto of nuevas) formulario.append('fotos', foto.archivo, foto.archivo.name);
  const principal = estadoFotos.fotos.find((foto) => foto.id === estadoFotos.principalId);
  if (principal?.existente) formulario.append('foto_principal', `existente:${principal.id}`);
  else if (principal) formulario.append('foto_principal', `nueva:${nuevas.indexOf(principal) + 1}`);
  return formulario;
}
