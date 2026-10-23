import { ApiError, errorInterno } from '../errors.js';
import { fotosNoPertenecen } from '../validation/fotos.js';
import { databaseUnavailable } from './centros.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esIdDeAnuncio = (id) => typeof id === 'string' && UUID.test(id);

// «Propiedad»: un anuncio que no existe, es de otro centro o está retirado
// responde exactamente igual (404), para no revelar si existe.
export function anuncioNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Anuncio no encontrado.');
}

// US-15 (CA15, CA20): un anuncio entregado ya no se puede modificar.
export function anuncioNoEditable() {
  return new ApiError(409, 'ANUNCIO_NO_EDITABLE', 'Este anuncio ya no se puede editar.');
}

const fecha = (valor) => (valor === null || valor === undefined ? null : new Date(valor).toISOString());

// Fila de la tabla → objeto `anuncio` de la API («Base común»). `fotos` ya
// viene en el formato de la API y ordenado por `orden` (US-13).
// CA30: hasta que US-14 esté en dev, la rama no tiene modalidad ni precio:
// el anuncio se devuelve como donación, sin precio.
export function aAnuncio(fila, fotos = []) {
  return {
    id: fila.id,
    centro_id: fila.centro_id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    categoria: fila.categoria,
    deporte: fila.deporte,
    unidades_disponibles: fila.unidades_disponibles,
    estado_material: fila.estado_material,
    modalidad: 'donacion',
    precio_unitario_centimos: null,
    estado: fila.estado,
    fotos,
    publicado_en: fecha(fila.publicado_en),
    creado_en: fecha(fila.creado_en),
    actualizado_en: fecha(fila.actualizado_en),
  };
}

// Fila de `anuncio_fotos` → foto del objeto `anuncio` (US-13 CA17).
export function aFoto(fila, urlFoto) {
  return { id: fila.id, url: urlFoto(fila.ruta), orden: fila.orden, es_principal: fila.es_principal };
}

const COLUMNAS = `id, centro_id, titulo, descripcion, categoria, deporte,
  unidades_disponibles, estado_material, estado, publicado_en, creado_en, actualizado_en`;

// Clase 23 de PostgreSQL: una restricción (CHECK, UNIQUE, FK) ha rechazado los
// datos. Con los datos ya validados es un fallo del servidor (500), no una caída (503).
const esViolacionDeRestriccion = (error) => typeof error?.code === 'string' && error.code.startsWith('23');

// `urlFoto(ruta)` construye la URL pública de una foto del bucket (US-13 CA17).
export function createAnunciosRepository(database, { urlFoto = () => null } = {}) {
  async function consultar(sql, values) {
    try {
      return await database.query(sql, values);
    } catch (error) {
      console.error(`Error de PostgreSQL en anuncios: ${error?.code ?? 'error desconocido'}`);
      throw databaseUnavailable();
    }
  }

  // Fotos de varios anuncios en una consulta, en su orden: id → [foto].
  async function fotosDe(anuncioIds) {
    const porAnuncio = new Map(anuncioIds.map((id) => [id, []]));
    if (anuncioIds.length === 0) return porAnuncio;
    const { rows } = await consultar(
      `SELECT id, anuncio_id, ruta, orden, es_principal
       FROM public.anuncio_fotos
       WHERE anuncio_id = ANY($1::uuid[])
       ORDER BY anuncio_id, orden`,
      [anuncioIds],
    );
    for (const fila of rows) porAnuncio.get(fila.anuncio_id)?.push(aFoto(fila, urlFoto));
    return porAnuncio;
  }

  return {
    fotosDe,

    // US-13: centro de la sesión, necesario para la ruta de las fotos en Storage
    // antes de crear el anuncio. Una cuenta sin centro no debería existir
    // (US-01 crea los dos juntos).
    async centroDe(usuarioId) {
      const { rows } = await consultar('SELECT id FROM public.centros WHERE usuario_id = $1', [usuarioId]);
      if (rows.length === 0) throw new Error('La cuenta de la sesión no tiene centro.');
      return rows[0].id;
    },

    // US-12 y US-13: crea el anuncio `activo` del centro y sus fotos en una
    // única transacción (CA19, CA20): o se guardan todas las filas o ninguna.
    // `id` lo genera el servidor antes, porque forma parte de la ruta de las
    // fotos; publicado_en, creado_en y actualizado_en toman la misma hora (now()).
    async crear({ id, centroId, datos, fotos }) {
      try {
        return await database.transaction(async (client) => {
          const { rows } = await client.query(
            `INSERT INTO public.anuncios (
               id, centro_id, titulo, descripcion, categoria, deporte,
               unidades_disponibles, estado_material, estado, publicado_en
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo', now())
             RETURNING ${COLUMNAS}`,
            [
              id, centroId, datos.titulo, datos.descripcion, datos.categoria, datos.deporte,
              datos.unidades_disponibles, datos.estado_material,
            ],
          );
          const { rows: filasFotos } = await client.query(
            `INSERT INTO public.anuncio_fotos (id, anuncio_id, ruta, tipo_mime, bytes, orden, es_principal)
             SELECT f.id, $1, f.ruta, f.tipo_mime, f.bytes, f.orden, f.es_principal
             FROM unnest($2::uuid[], $3::text[], $4::text[], $5::integer[], $6::smallint[], $7::boolean[])
               AS f(id, ruta, tipo_mime, bytes, orden, es_principal)
             RETURNING id, ruta, orden, es_principal`,
            [
              id,
              fotos.map((foto) => foto.id),
              fotos.map((foto) => foto.ruta),
              fotos.map((foto) => foto.tipo_mime),
              fotos.map((foto) => foto.bytes),
              fotos.map((foto) => foto.orden),
              fotos.map((foto) => foto.es_principal),
            ],
          );
          filasFotos.sort((a, b) => a.orden - b.orden);
          return aAnuncio(rows[0], filasFotos.map((fila) => aFoto(fila, urlFoto)));
        });
      } catch (error) {
        console.error(`No se pudo crear el anuncio: ${error?.code ?? 'error desconocido'}`);
        if (esViolacionDeRestriccion(error)) throw errorInterno();
        throw databaseUnavailable();
      }
    },

    // US-12 (CA20, CA24): solo los anuncios del centro de la sesión que no están
    // retirados, con sus fotos en orden (US-13).
    async obtener(usuarioId, id) {
      if (typeof id !== 'string' || !UUID.test(id)) throw anuncioNoEncontrado();
      const { rows } = await consultar(
        `SELECT a.id, a.centro_id, a.titulo, a.descripcion, a.categoria, a.deporte,
                a.unidades_disponibles, a.estado_material, a.estado,
                a.publicado_en, a.creado_en, a.actualizado_en
         FROM public.anuncios a
         JOIN public.centros c ON c.id = a.centro_id
         WHERE a.id = $2 AND c.usuario_id = $1 AND a.estado <> 'retirado'`,
        [usuarioId, id],
      );
      if (rows.length === 0) throw anuncioNoEncontrado();
      const fotos = await fotosDe([rows[0].id]);
      return aAnuncio(rows[0], fotos.get(rows[0].id));
    },

    // US-15 (CA15, CA17, CA20): antes de subir las fotos nuevas, comprueba que
    // el anuncio es del centro de la sesión y se puede editar, y devuelve su
    // centro (para la ruta de las fotos) y los ids de sus fotos actuales.
    async paraEditar(usuarioId, id) {
      if (!esIdDeAnuncio(id)) throw anuncioNoEncontrado();
      const { rows } = await consultar(
        `SELECT a.centro_id, a.estado,
                COALESCE(array_agg(f.id) FILTER (WHERE f.id IS NOT NULL), '{}') AS foto_ids
         FROM public.anuncios a
         JOIN public.centros c ON c.id = a.centro_id
         LEFT JOIN public.anuncio_fotos f ON f.anuncio_id = a.id
         WHERE a.id = $2 AND c.usuario_id = $1 AND a.estado <> 'retirado'
         GROUP BY a.id`,
        [usuarioId, id],
      );
      if (rows.length === 0) throw anuncioNoEncontrado();
      if (rows[0].estado === 'entregado') throw anuncioNoEditable();
      return { centroId: rows[0].centro_id, fotoIds: rows[0].foto_ids };
    },

    // US-15 (CA7-CA9, CA12-CA17, CA20): sustituye los datos y las fotos del
    // anuncio en una transacción, sin tocar `estado` ni `publicado_en` y
    // renovando `actualizado_en` aunque no cambie nada. `fotos` es la lista
    // final en orden: las conservadas solo llevan `id`, `orden` y
    // `es_principal`; las nuevas, además, `ruta`, `tipo_mime` y `bytes`.
    // El anuncio se bloquea (FOR UPDATE) y se vuelve a comprobar dentro de la
    // transacción, por si otra persona lo ha entregado o ha cambiado sus fotos
    // desde paraEditar. Las fotos se borran y se vuelven a insertar con el mismo
    // id, ruta y creado_en: así el orden y la principal cambian sin chocar con
    // las restricciones UNIQUE. Devuelve el anuncio y las rutas de las fotos
    // quitadas, que se borran de Storage después de confirmar (CA16).
    async editar(usuarioId, id, { datos, fotos }) {
      if (!esIdDeAnuncio(id)) throw anuncioNoEncontrado();
      try {
        return await database.transaction(async (client) => {
          const { rows: actual } = await client.query(
            `SELECT a.estado
             FROM public.anuncios a
             JOIN public.centros c ON c.id = a.centro_id
             WHERE a.id = $2 AND c.usuario_id = $1 AND a.estado <> 'retirado'
             FOR UPDATE OF a`,
            [usuarioId, id],
          );
          if (actual.length === 0) throw anuncioNoEncontrado();
          if (actual[0].estado === 'entregado') throw anuncioNoEditable();

          const { rows } = await client.query(
            `UPDATE public.anuncios
             SET titulo = $2, descripcion = $3, categoria = $4, deporte = $5,
                 unidades_disponibles = $6, estado_material = $7, actualizado_en = now()
             WHERE id = $1
             RETURNING ${COLUMNAS}`,
            [
              id, datos.titulo, datos.descripcion, datos.categoria, datos.deporte,
              datos.unidades_disponibles, datos.estado_material,
            ],
          );

          const { rows: anteriores } = await client.query(
            `DELETE FROM public.anuncio_fotos WHERE anuncio_id = $1
             RETURNING id, ruta, tipo_mime, bytes, creado_en`,
            [id],
          );
          const porId = new Map(anteriores.map((fila) => [fila.id, fila]));
          const finales = fotos.map((foto) => {
            if (foto.ruta) return { ...foto, creado_en: null };
            const anterior = porId.get(foto.id);
            if (!anterior) throw fotosNoPertenecen();
            return { ...anterior, orden: foto.orden, es_principal: foto.es_principal };
          });
          const conservadas = new Set(finales.map((foto) => foto.id));

          const { rows: filasFotos } = await client.query(
            `INSERT INTO public.anuncio_fotos (id, anuncio_id, ruta, tipo_mime, bytes, orden, es_principal, creado_en)
             SELECT f.id, $1, f.ruta, f.tipo_mime, f.bytes, f.orden, f.es_principal, COALESCE(f.creado_en, now())
             FROM unnest($2::uuid[], $3::text[], $4::text[], $5::integer[], $6::smallint[], $7::boolean[], $8::timestamptz[])
               AS f(id, ruta, tipo_mime, bytes, orden, es_principal, creado_en)
             RETURNING id, ruta, orden, es_principal`,
            [
              id,
              finales.map((foto) => foto.id),
              finales.map((foto) => foto.ruta),
              finales.map((foto) => foto.tipo_mime),
              finales.map((foto) => foto.bytes),
              finales.map((foto) => foto.orden),
              finales.map((foto) => foto.es_principal),
              finales.map((foto) => foto.creado_en),
            ],
          );
          filasFotos.sort((a, b) => a.orden - b.orden);
          return {
            anuncio: aAnuncio(rows[0], filasFotos.map((fila) => aFoto(fila, urlFoto))),
            rutasQuitadas: anteriores.filter((fila) => !conservadas.has(fila.id)).map((fila) => fila.ruta),
          };
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error(`No se pudo editar el anuncio: ${error?.code ?? 'error desconocido'}`);
        if (esViolacionDeRestriccion(error)) throw errorInterno();
        throw databaseUnavailable();
      }
    },
  };
}
