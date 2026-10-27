import { ApiError } from '../errors.js';
import { transicionNoPermitida } from '../services/transiciones-anuncio.js';
import { databaseUnavailable } from './centros.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// «Propiedad»: un anuncio que no existe, es de otro centro o está retirado
// responde exactamente igual (404), para no revelar si existe.
export function anuncioNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Anuncio no encontrado.');
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

    // E03 «Estados del anuncio y transiciones» (US-16; después US-17 y US-70).
    // Cambia el estado en un único UPDATE que solo actúa si el estado actual está
    // en `desde`: con dos peticiones a la vez, la segunda ya no lo encuentra y
    // recibe 409 (US-16 CA10). Renueva actualizado_en y no toca ningún otro dato
    // ni publicado_en (US-16 CA5). entregado_en y retirado_en solo tienen valor
    // en su estado, como exigen los CHECK de la tabla.
    async transicionar(usuarioId, id, { desde, hacia }) {
      if (typeof id !== 'string' || !UUID.test(id)) throw anuncioNoEncontrado();
      const centro = 'SELECT c.id FROM public.centros c WHERE c.usuario_id = $1';
      const { rows } = await consultar(
        `UPDATE public.anuncios
         SET estado = $3::text,
             actualizado_en = now(),
             entregado_en = CASE WHEN $3::text = 'entregado' THEN now() END,
             retirado_en = CASE WHEN $3::text = 'retirado' THEN now() END
         WHERE id = $2 AND centro_id = (${centro}) AND estado = ANY($4::text[])
         RETURNING ${COLUMNAS}`,
        [usuarioId, id, hacia, [...desde]],
      );
      if (rows.length > 0) return aAnuncio(rows[0]);

      // No ha cambiado nada: o no es un anuncio visible del centro (404, como en
      // «Propiedad») o su estado no permite la acción (409 con el estado actual).
      const { rows: [actual] } = await consultar(
        `SELECT estado FROM public.anuncios
         WHERE id = $2 AND centro_id = (${centro}) AND estado <> 'retirado'`,
        [usuarioId, id],
      );
      if (!actual) throw anuncioNoEncontrado();
      throw transicionNoPermitida(actual.estado);
    },
  };
}
