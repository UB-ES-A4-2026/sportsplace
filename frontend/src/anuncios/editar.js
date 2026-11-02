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
export function valoresDelAnuncio(anuncio) {
  return Object.fromEntries(Object.keys(VALORES_VACIOS).map((campo) => [campo, String(anuncio[campo] ?? '')]));
}

// CA11: `datos` con el anuncio completo y `fotos_conservar`; `foto_principal` como `existente:<id>`.
// [Depende de US-13] El formulario todavía no tiene la sección «Fotos»: se conservan las actuales, en su orden y
// con su principal. [Depende de US-14] Modalidad y precio tampoco están en el formulario: se envían los actuales.
export function cuerpoDeLaEdicion(cuerpo, anuncio) {
  const fotos = [...(anuncio.fotos ?? [])].sort((a, b) => a.orden - b.orden);
  const principal = fotos.find((foto) => foto.es_principal) ?? fotos[0];
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify({
    ...cuerpo,
    modalidad: anuncio.modalidad ?? 'donacion',
    precio_unitario_centimos: anuncio.precio_unitario_centimos ?? null,
    fotos_conservar: fotos.map((foto) => foto.id),
  }));
  if (principal) formulario.append('foto_principal', `existente:${principal.id}`);
  return formulario;
}
