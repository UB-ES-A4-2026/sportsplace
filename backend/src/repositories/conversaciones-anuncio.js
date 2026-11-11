import { ApiError } from '../errors.js';
import { anuncioNoEncontrado, esIdDeAnuncio } from './anuncios.js';
import { databaseUnavailable } from './centros.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function conversacionNoEncontrada() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Conversación no encontrada.');
}

function ultimoMensaje(fila, centroId) {
  if (fila.mensaje_id === null) return null;
  const texto = [...(fila.texto ?? '')];
  const textoResumen = fila.tipo === 'oferta'
    ? 'Oferta'
    : `${texto.slice(0, 80).join('')}${texto.length > 80 ? '…' : ''}`;
  return {
    texto_resumen: textoResumen,
    es_mio: fila.centro_autor_id === centroId,
    creado_en: new Date(fila.mensaje_creado_en).toISOString(),
  };
}

export function createConversacionesAnuncioRepository(database) {
  async function consultar(sql, valores) {
    try {
      return await database.query(sql, valores);
    } catch (error) {
      console.error(`Error de PostgreSQL en conversaciones de anuncios: ${error?.code ?? 'error desconocido'}`);
      throw databaseUnavailable();
    }
  }

  return {
    async listar(usuarioId, anuncioId) {
      if (!esIdDeAnuncio(anuncioId)) throw anuncioNoEncontrado();
      // La conversación sigue disponible aunque se haya retirado el anuncio.
      const { rows: [anuncio] } = await consultar(
        `SELECT a.id, c.id AS centro_id
         FROM public.anuncios a
         JOIN public.centros c ON c.id = a.centro_id
         WHERE a.id = $2 AND c.usuario_id = $1`,
        [usuarioId, anuncioId],
      );
      if (!anuncio) throw anuncioNoEncontrado();

      const { rows } = await consultar(
        `SELECT conv.id, comprador.id AS otro_centro_id, comprador.nombre AS otro_centro_nombre,
                ultimo.id AS mensaje_id, ultimo.texto, ultimo.tipo,
                ultimo.centro_autor_id, ultimo.creado_en AS mensaje_creado_en,
                EXISTS (
                  SELECT 1 FROM public.mensajes pendiente
                  WHERE pendiente.conversacion_id = conv.id
                    AND pendiente.centro_autor_id = conv.centro_comprador_id
                    AND (conv.leida_hasta_vendedor IS NULL
                         OR pendiente.creado_en > conv.leida_hasta_vendedor)
                ) AS sin_leer
         FROM public.conversaciones conv
         JOIN public.centros comprador ON comprador.id = conv.centro_comprador_id
         LEFT JOIN LATERAL (
           SELECT id, texto, tipo, centro_autor_id, creado_en
           FROM public.mensajes
           WHERE conversacion_id = conv.id
           ORDER BY creado_en DESC, id DESC LIMIT 1
         ) ultimo ON TRUE
         WHERE conv.anuncio_id = $1 AND conv.centro_vendedor_id = $2
         ORDER BY conv.ultimo_mensaje_en DESC NULLS LAST, conv.id DESC
         LIMIT 200`,
        [anuncioId, anuncio.centro_id],
      );
      return {
        conversaciones: rows.map((fila) => ({
          id: fila.id,
          otro_centro: { id: fila.otro_centro_id, nombre: fila.otro_centro_nombre, eliminado: false },
          ultimo_mensaje: ultimoMensaje(fila, anuncio.centro_id),
          sin_leer: fila.sin_leer,
        })),
      };
    },

    async marcarLeida(usuarioId, conversacionId) {
      if (typeof conversacionId !== 'string' || !UUID.test(conversacionId)) throw conversacionNoEncontrada();
      const { rows } = await consultar(
        `UPDATE public.conversaciones conv
         SET leida_hasta_comprador = CASE WHEN yo.id = conv.centro_comprador_id
               THEN GREATEST(conv.leida_hasta_comprador, now()) ELSE conv.leida_hasta_comprador END,
             leida_hasta_vendedor = CASE WHEN yo.id = conv.centro_vendedor_id
               THEN GREATEST(conv.leida_hasta_vendedor, now()) ELSE conv.leida_hasta_vendedor END
         FROM public.centros yo
         WHERE conv.id = $2 AND yo.usuario_id = $1
           AND yo.id IN (conv.centro_comprador_id, conv.centro_vendedor_id)
         RETURNING conv.id`,
        [usuarioId, conversacionId],
      );
      if (rows.length === 0) throw conversacionNoEncontrada();
    },
  };
}
