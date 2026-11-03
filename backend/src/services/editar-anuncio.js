import { randomUUID } from 'node:crypto';
import { fotosNoPertenecen } from '../validation/fotos.js';
import { subirFotos } from './publicar-anuncio.js';

// US-15 CA8, CA12-CA16: edita un anuncio con sus fotos ya validadas.
// 1. Comprueba que el anuncio se puede editar y que `fotos_conservar` son
//    fotos suyas (CA13), antes de subir nada.
// 2. Calcula la lista final: primero las conservadas en su orden, después las
//    nuevas; `orden` 1..n y la principal marcada (CA8, CA12).
// 3. Sube las nuevas a `<centro_id>/<anuncio_id>/<foto_id>.<ext>`.
// 4. Guarda datos y fotos en una transacción. Si falla, borra las nuevas
//    subidas y el anuncio queda como estaba. Si se confirma, borra de Storage
//    las fotos quitadas (CA16).
export async function editarAnuncio({ anuncios, storage, usuarioId, id, datos, conservar, nuevas, principal }) {
  const { centroId, fotoIds } = await anuncios.paraEditar(usuarioId, id);
  const actuales = new Set(fotoIds);
  if (!conservar.every((fotoId) => actuales.has(fotoId))) throw fotosNoPertenecen();

  const preparadas = nuevas.map((foto, posicion) => {
    const fotoId = randomUUID();
    return {
      ...foto,
      id: fotoId,
      ruta: `${centroId}/${id}/${fotoId}.${foto.extension}`,
      es_principal: principal.nueva === posicion + 1,
    };
  });
  const fotos = [
    ...conservar.map((fotoId) => ({ id: fotoId, es_principal: principal.existente === fotoId })),
    ...preparadas,
  ].map((foto, posicion) => ({ ...foto, orden: posicion + 1 }));

  await subirFotos(storage, preparadas);

  let resultado;
  try {
    resultado = await anuncios.editar(usuarioId, id, { datos, fotos });
  } catch (error) {
    await storage.borrar(preparadas.map((foto) => foto.ruta));
    throw error;
  }
  await storage.borrar(resultado.rutasQuitadas);
  return resultado.anuncio;
}
