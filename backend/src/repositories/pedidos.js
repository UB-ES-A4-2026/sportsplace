import { ApiError, errorInterno } from '../errors.js';
import { aPedido } from '../services/serializar-pedido.js';
import { comprobarTransicion, transicionNoPermitida } from '../services/transiciones-pedido.js';
import { validarMetodoPago } from '../validation/pedidos.js';
import { createAceptarPedido } from './aceptar-pedido.js';
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

// US-109 CA3: cada pestaña filtra por la columna del papel del centro, y el otro
// centro es el del papel contrario.
const PAPELES = {
  recibidos: { propio: 'vendedor_centro_id', otro: 'comprador_centro_id' },
  realizados: { propio: 'comprador_centro_id', otro: 'vendedor_centro_id' },
};
export const POR_PAGINA_PEDIDOS = 20;

function aResumen(fila, urlFoto) {
  return {
    id: fila.id,
    anuncio: { id: fila.anuncio_id, titulo: fila.titulo_anuncio, foto_principal_url: fila.ruta_foto ? urlFoto(fila.ruta_foto) : null },
    otro_centro: { id: fila.otro_id, nombre: fila.otro_nombre },
    unidades: fila.unidades,
    modalidad: fila.modalidad,
    total_centimos: Number(fila.total_centimos),
    estado: fila.estado,
    pagado_en: fila.pagado_en ? new Date(fila.pagado_en).toISOString() : null,
    creado_en: new Date(fila.creado_en).toISOString(),
  };
}

export function createPedidosRepository(database, { urlFoto = () => null } = {}) {
  const aceptarPedido = createAceptarPedido(database);

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

    async aceptar(usuarioId, id) {
      if (!esIdDePedido(id)) throw pedidoNoEncontrado();
      const { rows: [centro] } = await consultar(
        'SELECT id FROM public.centros WHERE usuario_id = $1',
        [usuarioId],
      );
      if (!centro) throw pedidoNoEncontrado();
      return aceptarPedido({
        pedidoId: id,
        centroId: centro.id,
        comprobar: (pedido) => comprobarTransicion(pedido, centro.id, 'aceptar'),
        obtenerResultado: async (client) => aDetalle((await client.query(SELECT_DETALLE, [usuarioId, id])).rows),
      });
    },

    async rechazar(usuarioId, id, { motivo_codigo: motivoCodigo, motivo_texto: motivoTexto }) {
      if (!esIdDePedido(id)) throw pedidoNoEncontrado();
      try {
        return await database.transaction(async (client) => {
          // Rechazar un pendiente solo bloquea el pedido y conserva el stock.
          const { rows: [fila] } = await client.query(
            `SELECT p.estado, p.comprador_centro_id, p.vendedor_centro_id, yo.id AS centro_id
             FROM public.pedidos p
             JOIN public.centros yo ON yo.usuario_id = $1
               AND yo.id IN (p.comprador_centro_id, p.vendedor_centro_id)
             WHERE p.id = $2 FOR UPDATE OF p`,
            [usuarioId, id],
          );
          if (!fila) throw pedidoNoEncontrado();
          comprobarTransicion({
            estado: fila.estado,
            comprador: { id: fila.comprador_centro_id },
            vendedor: { id: fila.vendedor_centro_id },
          }, fila.centro_id, 'rechazar');

          const { rowCount } = await client.query(
            `UPDATE public.pedidos
             SET estado = 'rechazado', motivo_codigo = $2, motivo_texto = $3,
                 cerrado_por = 'vendedor', respondido_en = now(), actualizado_en = now()
             WHERE id = $1 AND estado = 'pendiente'`,
            [id, motivoCodigo, motivoTexto],
          );
          if (rowCount === 0) throw transicionNoPermitida(fila.estado);
          return aDetalle((await client.query(SELECT_DETALLE, [usuarioId, id])).rows);
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error(`No se pudo rechazar el pedido: ${error?.code ?? 'error desconocido'}`);
        if (typeof error?.code === 'string' && error.code.startsWith('23')) throw errorInterno();
        throw databaseUnavailable();
      }
    },

    // US-109 (CA3, CA4, CA10, CA11, CA13): pedidos del centro de la sesión con el
    // papel de la pestaña; primero los pendientes y, en cada grupo, del más nuevo
    // al más antiguo. Una página mayor que la última devuelve la lista vacía.
    // `pagado_en` llega con US-80: se lee de to_jsonb para no depender de la columna.
    async listar(usuarioId, { rol, pagina }) {
      const { propio, otro } = PAPELES[rol];
      const centro = 'SELECT c.id FROM public.centros c WHERE c.usuario_id = $1';
      const { rows: [{ total }] } = await consultar(
        `SELECT count(*)::integer AS total FROM public.pedidos p WHERE p.${propio} = (${centro})`,
        [usuarioId],
      );
      const { rows } = await consultar(
        `SELECT p.id, p.anuncio_id, p.titulo_anuncio, p.unidades, p.modalidad, p.total_centimos,
                p.estado, p.creado_en, to_jsonb(p) ->> 'pagado_en' AS pagado_en,
                o.id AS otro_id, o.nombre AS otro_nombre,
                (SELECT f.ruta FROM public.anuncio_fotos f
                  WHERE f.anuncio_id = p.anuncio_id ORDER BY f.es_principal DESC, f.orden LIMIT 1) AS ruta_foto
         FROM public.pedidos p
         JOIN public.centros o ON o.id = p.${otro}
         WHERE p.${propio} = (${centro})
         ORDER BY (p.estado = 'pendiente') DESC, p.creado_en DESC, p.id DESC
         LIMIT $2 OFFSET $3`,
        [usuarioId, POR_PAGINA_PEDIDOS, (pagina - 1) * POR_PAGINA_PEDIDOS],
      );
      return { pedidos: rows.map((fila) => aResumen(fila, urlFoto)), pagina, total, por_pagina: POR_PAGINA_PEDIDOS };
    },

    // US-109 CA9 y CA12: pedidos recibidos en `pendiente` del centro de la sesión.
    async contador(usuarioId) {
      const { rows: [{ n }] } = await consultar(
        `SELECT count(*)::integer AS n FROM public.pedidos p
         WHERE p.vendedor_centro_id = (SELECT c.id FROM public.centros c WHERE c.usuario_id = $1)
           AND p.estado = 'pendiente'`,
        [usuarioId],
      );
      return { recibidos_pendientes: n };
    },
  };
}
