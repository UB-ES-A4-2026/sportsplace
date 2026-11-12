import { ApiError, errorInterno } from '../errors.js';
import { aPedido } from '../services/serializar-pedido.js';
import { validarMetodoPago } from '../validation/pedidos.js';
import { anuncioNoEncontrado } from './anuncios.js';
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

const SELECT_DETALLE = `SELECT to_jsonb(p) AS fila,
       jsonb_build_object('id', a.id, 'estado', a.estado,
         'unidades_disponibles', a.unidades_disponibles) AS anuncio,
       (SELECT f.ruta FROM public.anuncio_fotos f
         WHERE f.anuncio_id = a.id ORDER BY f.es_principal DESC, f.orden LIMIT 1) AS ruta_foto,
       ${CENTRO('cc')} AS comprador,
       ${CENTRO('cv')} || jsonb_build_object('direccion', cv.direccion, 'codigo_postal', cv.codigo_postal) AS vendedor,
       yo.id AS centro_id
FROM public.pedidos p
JOIN public.anuncios a ON a.id = p.anuncio_id
JOIN public.centros cc ON cc.id = p.comprador_centro_id
JOIN public.centros cv ON cv.id = p.vendedor_centro_id
JOIN public.centros yo ON yo.usuario_id = $1 AND yo.id IN (cc.id, cv.id)
WHERE p.id = $2`;

function pedidoPendiente(id) {
  return new ApiError(409, 'PEDIDO_YA_PENDIENTE', 'Ya tienes un pedido pendiente en este anuncio.', { pedido_id: id });
}

function comprobarAnuncio(anuncio, unidades) {
  if (!anuncio || anuncio.estado === 'retirado') throw anuncioNoEncontrado();
  if (anuncio.comprador_id === anuncio.centro_id) {
    throw new ApiError(403, 'PEDIDO_PROPIO', 'No puedes pedir tu propio anuncio.');
  }
  if (anuncio.estado !== 'activo') {
    throw new ApiError(409, 'ANUNCIO_NO_DISPONIBLE', 'Este anuncio ya no está disponible.');
  }
  if (unidades > anuncio.unidades_disponibles) {
    const disponibles = anuncio.unidades_disponibles;
    throw new ApiError(409, 'UNIDADES_INSUFICIENTES', `Solo quedan ${disponibles} unidades disponibles.`, {
      unidades_disponibles: disponibles,
    });
  }
}

async function insertarPedido(client, anuncio, datos, metodoPago) {
  const precio = anuncio.precio_unitario_centimos;
  const parametros = [anuncio.id, anuncio.comprador_id, anuncio.centro_id, anuncio.titulo,
    datos.unidades, anuncio.modalidad, precio, datos.mensaje, metodoPago, datos.metodo_entrega, datos.direccion_envio];

  // El índice resuelve envíos concurrentes del mismo comprador. Si el pedido
  // deja de estar pendiente entre el conflicto y la lectura, se puede crear otro.
  for (;;) {
    const { rows: [creado] } = await client.query(
      `INSERT INTO public.pedidos (
         anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio, unidades,
         modalidad, precio_unitario_centimos, total_centimos, mensaje, metodo_pago, metodo_entrega, direccion_envio
       ) VALUES ($1, $2, $3, $4, $5::integer, $6, $7::integer,
                 ($5::integer)::bigint * COALESCE($7::integer, 0), $8, $9, $10, $11)
       ON CONFLICT (anuncio_id, comprador_centro_id) WHERE estado = 'pendiente' DO NOTHING
       RETURNING id`,
      parametros,
    );
    if (creado) return creado.id;

    const { rows: [pendiente] } = await client.query(
      `SELECT id FROM public.pedidos
       WHERE anuncio_id = $1 AND comprador_centro_id = $2 AND estado = 'pendiente'`,
      [anuncio.id, anuncio.comprador_id],
    );
    if (pendiente) throw pedidoPendiente(pendiente.id);
  }
}

export function createPedidosRepository(database, { urlFoto = () => null } = {}) {
  async function consultar(sql, values) {
    try {
      return await database.query(sql, values);
    } catch (error) {
      console.error(`Error de PostgreSQL en pedidos: ${error?.code ?? 'error desconocido'}`);
      throw databaseUnavailable();
    }
  }

  function aDetalle(rows) {
    if (rows.length === 0) throw pedidoNoEncontrado();
    const { fila, anuncio, ruta_foto: rutaFoto, comprador, vendedor, centro_id: centroId } = rows[0];
    const fotoPrincipal = rutaFoto ? urlFoto(rutaFoto) : null;
    return aPedido({ fila, anuncio: { ...anuncio, foto_principal_url: fotoPrincipal }, comprador, vendedor }, centroId);
  }

  return {
    async crear(usuarioId, datos) {
      try {
        return await database.transaction(async (client) => {
          // Mismo orden de bloqueo que aceptarPedido: anuncio antes que pedidos.
          // El stock y el precio que se validan son los vigentes bajo ese bloqueo.
          const { rows: [anuncio] } = await client.query(
            `SELECT a.id, a.centro_id, a.titulo, a.estado, a.unidades_disponibles,
                    a.modalidad, a.precio_unitario_centimos, yo.id AS comprador_id
             FROM public.anuncios a
             JOIN public.centros yo ON yo.usuario_id = $1
             WHERE a.id = $2 FOR UPDATE OF a`,
            [usuarioId, datos.anuncio_id],
          );
          comprobarAnuncio(anuncio, datos.unidades);
          const metodoPago = validarMetodoPago(datos, anuncio.modalidad);
          const id = await insertarPedido(client, anuncio, datos, metodoPago);
          const { rows } = await client.query(SELECT_DETALLE, [usuarioId, id]);
          return aDetalle(rows);
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error(`No se pudo crear el pedido: ${error?.code ?? 'error desconocido'}`);
        if (typeof error?.code === 'string' && error.code.startsWith('23')) throw errorInterno();
        throw databaseUnavailable();
      }
    },

    // US-108 (CA10-CA14): el pedido visto por el centro de la sesión, que tiene
    // que ser su comprador o su vendedor.
    async obtener(usuarioId, id) {
      if (!esIdDePedido(id)) throw pedidoNoEncontrado();
      const { rows } = await consultar(SELECT_DETALLE, [usuarioId, id]);
      return aDetalle(rows);
    },
  };
}
