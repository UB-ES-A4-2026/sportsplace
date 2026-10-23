import { ApiError } from '../errors.js';
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

// Fila de la tabla → objeto `anuncio` de la API («Base común»).
// CA30: hasta que US-13 y US-14 estén en dev, la rama de US-12 no tiene fotos
// ni modalidad/precio: el anuncio se devuelve como donación, sin precio ni fotos.
export function aAnuncio(fila) {
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
    fotos: [],
    publicado_en: fecha(fila.publicado_en),
    creado_en: fecha(fila.creado_en),
    actualizado_en: fecha(fila.actualizado_en),
  };
}

const COLUMNAS = `id, centro_id, titulo, descripcion, categoria, deporte,
  unidades_disponibles, estado_material, estado, publicado_en, creado_en, actualizado_en`;

export function createAnunciosRepository(database) {
  async function consultar(sql, values) {
    try {
      return await database.query(sql, values);
    } catch (error) {
      console.error(`Error de PostgreSQL en anuncios: ${error?.code ?? 'error desconocido'}`);
      throw databaseUnavailable();
    }
  }

  return {
    // US-12: crea el anuncio del centro de la sesión, siempre `activo` (CA13, CA21, CA22).
    // El centro se busca por usuario_id en la misma consulta; publicado_en,
    // creado_en y actualizado_en toman la misma hora del servidor (now()).
    async crear(usuarioId, datos) {
      const { rows } = await consultar(
        `INSERT INTO public.anuncios (
           centro_id, titulo, descripcion, categoria, deporte,
           unidades_disponibles, estado_material, estado, publicado_en
         )
         SELECT c.id, $2, $3, $4, $5, $6, $7, 'activo', now()
         FROM public.centros c
         WHERE c.usuario_id = $1
         RETURNING ${COLUMNAS}`,
        [
          usuarioId, datos.titulo, datos.descripcion, datos.categoria, datos.deporte,
          datos.unidades_disponibles, datos.estado_material,
        ],
      );
      // Una cuenta sin centro no debería existir (US-01 crea los dos juntos).
      if (rows.length === 0) throw new Error('La cuenta de la sesión no tiene centro.');
      return aAnuncio(rows[0]);
    },

    // US-12 (CA20, CA24): solo los anuncios del centro de la sesión que no están retirados.
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
      return aAnuncio(rows[0]);
    },

    // US-15 (CA7, CA9, CA14, CA15, CA17, CA20): sustituye los datos del anuncio
    // del centro de la sesión sin tocar `estado` ni `publicado_en` y renueva
    // `actualizado_en` aunque no cambie nada. La condición de estado va en el
    // propio UPDATE, así que un anuncio que otra persona acaba de marcar como
    // entregado no se modifica. Si no se actualiza ninguna fila, se mira el
    // estado para distinguir 404 de 409: `entregado` y `retirado` son finales,
    // de modo que esa segunda lectura no puede dar un resultado desfasado.
    async editar(usuarioId, id, datos) {
      if (!esIdDeAnuncio(id)) throw anuncioNoEncontrado();
      const propio = `a.id = $2 AND a.centro_id = (
        SELECT c.id FROM public.centros c WHERE c.usuario_id = $1
      ) AND a.estado <> 'retirado'`;

      const { rows } = await consultar(
        `UPDATE public.anuncios a
         SET titulo = $3, descripcion = $4, categoria = $5, deporte = $6,
             unidades_disponibles = $7, estado_material = $8, actualizado_en = now()
         WHERE ${propio} AND a.estado <> 'entregado'
         RETURNING ${COLUMNAS}`,
        [
          usuarioId, id, datos.titulo, datos.descripcion, datos.categoria, datos.deporte,
          datos.unidades_disponibles, datos.estado_material,
        ],
      );
      if (rows.length > 0) return aAnuncio(rows[0]);

      const { rows: actual } = await consultar(
        `SELECT a.estado FROM public.anuncios a WHERE ${propio}`,
        [usuarioId, id],
      );
      if (actual.length === 0) throw anuncioNoEncontrado();
      throw anuncioNoEditable();
    },
  };
}
