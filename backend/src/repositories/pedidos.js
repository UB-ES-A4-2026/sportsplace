import { ApiError } from '../errors.js';
import { aPedido } from '../services/serializar-pedido.js';
import { databaseUnavailable } from './centros.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const esIdDePedido = (id) => typeof id === 'string' && UUID.test(id);

// US-108 CA11 y CA14: un id que no es uuid, un pedido que no existe o uno en el
// que el centro no es ni comprador ni vendedor responden igual, sin revelar nada.
export function pedidoNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Pedido no encontrado.');
}

// La fila se lee con to_jsonb(p): las columnas que añaden US-33, US-79, US-80…
// en sus propias migraciones aparecen solas, y mientras no existan salen null.
const CENTRO = (alias) => `jsonb_build_object(
  'id', ${alias}.id, 'nombre', ${alias}.nombre, 'localidad', ${alias}.localidad,
  'email', COALESCE(${alias}.email_contacto, ${alias}.email), 'telefono', ${alias}.telefono)`;

export function createPedidosRepository(database, { urlFoto = () => null } = {}) {
  async function consultar(sql, values) {
    try {
      return await database.query(sql, values);
    } catch (error) {
      console.error(`Error de PostgreSQL en pedidos: ${error?.code ?? 'error desconocido'}`);
      throw databaseUnavailable();
    }
  }

  return {
    // US-108 (CA10-CA14): el pedido visto por el centro de la sesión, que tiene
    // que ser su comprador o su vendedor.
    async obtener(usuarioId, id) {
      if (!esIdDePedido(id)) throw pedidoNoEncontrado();
      const { rows } = await consultar(
        `SELECT to_jsonb(p) AS fila,
                jsonb_build_object('id', a.id, 'estado', a.estado,
                  'unidades_disponibles', a.unidades_disponibles) AS anuncio,
                (SELECT f.ruta FROM public.anuncio_fotos f
                  WHERE f.anuncio_id = a.id ORDER BY f.es_principal DESC, f.orden LIMIT 1) AS ruta_foto,
                ${CENTRO('cc')} AS comprador,
                ${CENTRO('cv')} AS vendedor,
                yo.id AS centro_id
         FROM public.pedidos p
         JOIN public.anuncios a ON a.id = p.anuncio_id
         JOIN public.centros cc ON cc.id = p.comprador_centro_id
         JOIN public.centros cv ON cv.id = p.vendedor_centro_id
         JOIN public.centros yo ON yo.usuario_id = $1 AND yo.id IN (cc.id, cv.id)
         WHERE p.id = $2`,
        [usuarioId, id],
      );
      if (rows.length === 0) throw pedidoNoEncontrado();
      const { fila, anuncio, ruta_foto: rutaFoto, comprador, vendedor, centro_id: centroId } = rows[0];
      const fotoPrincipal = rutaFoto ? urlFoto(rutaFoto) : null;
      return aPedido({ fila, anuncio: { ...anuncio, foto_principal_url: fotoPrincipal }, comprador, vendedor }, centroId);
    },
  };
}
