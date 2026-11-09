import { ApiError, errorInterno } from '../errors.js';
import { databaseUnavailable } from './centros.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// E06 «Reglas comunes de la API»: inexistente o de otros centros, igual (404).
export function pedidoNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Pedido no encontrado.');
}

// US-33 CA8: no se acepta sobre un anuncio retirado o entregado (pausado sí).
export function anuncioNoDisponible() {
  return new ApiError(409, 'ANUNCIO_NO_DISPONIBLE', 'Este anuncio ya no está disponible.');
}

// US-34 CA2.
export function unidadesInsuficientes(disponibles) {
  return new ApiError(
    409,
    'UNIDADES_INSUFICIENTES',
    `Solo quedan ${disponibles} unidades disponibles.`,
    { unidades_disponibles: disponibles },
  );
}

const ANUNCIO_NO_ACEPTABLE = new Set(['retirado', 'entregado']);

// US-33 + US-34 (T33-3): acepta un pedido y reserva sus unidades en una sola
// transacción. Orden de bloqueo fijo, primero el anuncio y luego el pedido,
// para que dos aceptaciones del mismo anuncio se esperen en vez de bloquearse
// entre sí (deadlock): la segunda vuelve a leer el pedido ya actualizado y, si
// la primera lo ha rechazado por falta de unidades, responde 409 (US-34 CA8).
//
// `comprobar(pedido)` lanza el 403/409 de la transición; la ruta (T33-2) le
// pasa `comprobarTransicion(pedido, centroId, 'aceptar')` de
// services/transiciones-pedido.js (US-32), la misma tabla que calcula `acciones`.
// Devuelve el id del pedido aceptado, el anuncio tras la reserva y los pedidos
// rechazados por el sistema; la ruta responde con el detalle del pedido.
export function createAceptarPedido(database) {
  return async function aceptarPedido({ pedidoId, centroId, comprobar }) {
    if (typeof pedidoId !== 'string' || !UUID.test(pedidoId)) throw pedidoNoEncontrado();
    try {
      return await database.transaction(async (client) => {
        const { rows: encontrados } = await client.query(
          `SELECT anuncio_id FROM public.pedidos
           WHERE id = $1 AND $2::uuid IN (comprador_centro_id, vendedor_centro_id)`,
          [pedidoId, centroId],
        );
        if (encontrados.length === 0) throw pedidoNoEncontrado();
        const anuncioId = encontrados[0].anuncio_id;

        // US-34 CA2: se bloquea el anuncio antes de comprobar las unidades.
        const { rows: anuncios } = await client.query(
          `SELECT estado, unidades_disponibles FROM public.anuncios
           WHERE id = $1 FOR UPDATE`,
          [anuncioId],
        );
        const anuncio = anuncios[0];

        // Con el anuncio ya bloqueado, el pedido se lee de nuevo: si otra
        // aceptación lo ha cambiado mientras esperábamos, aquí se ve.
        const { rows: pedidos } = await client.query(
          `SELECT id, estado, unidades, comprador_centro_id, vendedor_centro_id
           FROM public.pedidos WHERE id = $1 FOR UPDATE`,
          [pedidoId],
        );
        const fila = pedidos[0];
        comprobar({
          id: fila.id,
          estado: fila.estado,
          unidades: fila.unidades,
          comprador: { id: fila.comprador_centro_id },
          vendedor: { id: fila.vendedor_centro_id },
          anuncio: { id: anuncioId, estado: anuncio.estado, unidades_disponibles: anuncio.unidades_disponibles },
        });
        if (ANUNCIO_NO_ACEPTABLE.has(anuncio.estado)) throw anuncioNoDisponible();
        if (fila.unidades > anuncio.unidades_disponibles) {
          throw unidadesInsuficientes(anuncio.unidades_disponibles);
        }

        // US-34 CA1 y CA3: resta las unidades; si quedan 0 y estaba activo,
        // pasa a reservado (pausado sigue pausado).
        const { rows: reservados } = await client.query(
          `UPDATE public.anuncios
           SET unidades_disponibles = unidades_disponibles - $2,
               estado = CASE WHEN estado = 'activo' AND unidades_disponibles - $2 = 0
                             THEN 'reservado' ELSE estado END,
               actualizado_en = now()
           WHERE id = $1
           RETURNING id, estado, unidades_disponibles`,
          [anuncioId, fila.unidades],
        );

        // US-33 CA6. El pedido ya está bloqueado y pendiente; el WHERE con el
        // estado de origen es, además, la protección común de E06.
        await client.query(
          `UPDATE public.pedidos
           SET estado = 'aceptado', respondido_en = now(), actualizado_en = now()
           WHERE id = $1 AND estado = 'pendiente'`,
          [pedidoId],
        );

        // US-34 CA4: los pendientes que ya no caben se rechazan por el sistema.
        const { rows: rechazados } = await client.query(
          `UPDATE public.pedidos
           SET estado = 'rechazado', motivo_codigo = 'anuncio_sin_stock',
               cerrado_por = 'sistema', respondido_en = now(), actualizado_en = now()
           WHERE anuncio_id = $1 AND estado = 'pendiente' AND unidades > $2
           RETURNING id`,
          [anuncioId, reservados[0].unidades_disponibles],
        );

        return {
          pedidoId,
          anuncio: reservados[0],
          rechazados: rechazados.map((pedido) => pedido.id),
        };
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`No se pudo aceptar el pedido: ${error?.code ?? 'error desconocido'}`);
      // Clase 23: una restricción ha rechazado los datos (fallo del servidor, 500).
      if (typeof error?.code === 'string' && error.code.startsWith('23')) throw errorInterno();
      throw databaseUnavailable();
    }
  };
}
