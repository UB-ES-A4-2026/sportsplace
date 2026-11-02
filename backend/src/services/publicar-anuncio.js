import { randomUUID } from 'node:crypto';

// US-13 CA18-CA20: publica un anuncio con sus fotos ya validadas.
// 1. Busca el centro de la sesión y genera los UUID del anuncio y de cada foto.
// 2. Sube las fotos a `<centro_id>/<anuncio_id>/<foto_id>.<ext>`, sin el nombre original (CA21, CA22).
// 3. Guarda el anuncio y sus filas de `anuncio_fotos` en una transacción.
// Si falla la subida o la base de datos, borra las fotos ya subidas y propaga
// el error (503 o 500 según la causa): no queda ni el anuncio ni ninguna foto.
export async function publicarAnuncio({ anuncios, storage, usuarioId, datos, fotos }) {
  const centroId = await anuncios.centroDe(usuarioId);
  const id = randomUUID();
  const preparadas = fotos.map((foto) => {
    const fotoId = randomUUID();
    return { ...foto, id: fotoId, ruta: `${centroId}/${id}/${fotoId}.${foto.extension}` };
  });

  // Se espera a todas las subidas aunque una falle, para no borrar antes de
  // que acaben las demás. Se borran todas las rutas, no solo las que han
  // respondido bien: una subida que ha fallado por tiempo puede haber llegado
  // a guardarse (borrar una ruta que no existe no da error).
  const rutas = preparadas.map((foto) => foto.ruta);
  const resultados = await Promise.allSettled(
    preparadas.map((foto) => storage.subir(foto.ruta, foto.contenido, foto.tipo_mime)),
  );
  const fallo = resultados.find((resultado) => resultado.status === 'rejected');
  if (fallo) {
    await storage.borrar(rutas);
    throw fallo.reason;
  }

  try {
    return await anuncios.crear({ id, centroId, datos, fotos: preparadas });
  } catch (error) {
    await storage.borrar(rutas);
    throw error;
  }
}
