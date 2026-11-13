import { ApiError, errorInterno } from '../errors.js';
import { anuncioNoEncontrado } from './anuncios.js';
import { databaseUnavailable } from './centros.js';

// E05 · US-28 (T28-2): conversaciones entre el centro interesado y el centro
// que ofrece un anuncio, y sus mensajes. Las tablas son las de T28-1
// (20261111090000_crear_conversaciones_mensajes.sql); solo accede la API.

export const MENSAJES_POR_PAGINA = 50;
export const LIMITE_MENSAJES_POR_MINUTO = 30;

// «Recursos de otro centro»: una conversación ajena responde igual que una
// inexistente (CA31).
export function conversacionNoEncontrada() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Conversación no encontrada.');
}

export function anuncioPropio() {
  return new ApiError(409, 'ANUNCIO_PROPIO', 'No puedes escribirte sobre tu propio anuncio.');
}

export function anuncioNoDisponible() {
  return new ApiError(409, 'ANUNCIO_NO_DISPONIBLE', 'Este anuncio ya no está disponible.');
}

export function conversacionYaExiste(conversacionId) {
  return new ApiError(409, 'CONVERSACION_YA_EXISTE', 'Ya tienes una conversación sobre este anuncio.', {
    conversacion_id: conversacionId,
  });
}

export function demasiadosMensajes() {
  return new ApiError(429, 'DEMASIADOS_INTENTOS', 'Has enviado demasiados mensajes seguidos. Espera un minuto.');
}

function cursorNoValido(clave) {
  return new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los campos marcados.', {
    [clave]: 'El mensaje no es de esta conversación.',
  });
}

// CA33: solo se abren conversaciones sobre anuncios activos o reservados.
const ESTADOS_PARA_ABRIR = new Set(['activo', 'reservado']);

const fecha = (valor) => (valor === null || valor === undefined ? null : new Date(valor).toISOString());

// Fila → objeto `mensaje` (CA24).
export function aMensaje(fila, centroId) {
  return {
    id: fila.id,
    texto: fila.texto,
    es_mio: fila.centro_autor_id === centroId,
    tipo: fila.tipo,
    creado_en: fecha(fila.creado_en),
  };
}

// Fila → objeto `conversacion` (CA23). El centro eliminado y `puede_escribir =
// false` llegan con US-11 (CA35): hasta entonces ningún centro está eliminado.
export function aConversacion(fila, centroId, urlFoto) {
  return {
    id: fila.id,
    anuncio: {
      id: fila.anuncio_id,
      titulo: fila.titulo,
      foto_principal_url: fila.foto_ruta ? urlFoto(fila.foto_ruta) : null,
      modalidad: fila.modalidad,
      precio_unitario_centimos: fila.precio_unitario_centimos,
      estado: fila.estado,
    },
    otro_centro: { id: fila.otro_centro_id, nombre: fila.otro_centro_nombre, eliminado: false },
    soy: fila.centro_comprador_id === centroId ? 'comprador' : 'vendedor',
    puede_escribir: true,
    creada_en: fecha(fila.creada_en),
  };
}

const COLUMNAS_MENSAJE = 'id, centro_autor_id, tipo, texto, creado_en';

export function createConversacionesRepository(database, { urlFoto = () => null } = {}) {
  // Traduce los fallos de PostgreSQL: los ApiError pasan tal cual; una
  // restricción violada con datos ya validados es un 500, y el resto, un 503.
  async function ejecutar(descripcion, operacion) {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error(`No se pudo ${descripcion}: ${error?.code ?? 'error desconocido'}`);
      if (typeof error?.code === 'string' && error.code.startsWith('23')) throw errorInterno();
      throw databaseUnavailable();
    }
  }

  // Centro de la sesión. Una cuenta sin centro no debería existir (US-01 crea
  // los dos juntos).
  async function centroDe(cliente, usuarioId) {
    const { rows } = await cliente.query('SELECT id FROM public.centros WHERE usuario_id = $1', [usuarioId]);
    if (rows.length === 0) throw new Error('La cuenta de la sesión no tiene centro.');
    return rows[0].id;
  }

  // Conversación en la que participa el centro, con su anuncio (aunque esté
  // retirado, CA34) y el otro centro; null si no existe o es ajena (CA31).
  async function conversacionDe(cliente, id, centroId) {
    const { rows } = await cliente.query(
      `SELECT c.id, c.creada_en, c.centro_comprador_id, c.centro_vendedor_id,
              a.id AS anuncio_id, a.titulo, a.modalidad, a.precio_unitario_centimos, a.estado,
              (SELECT f.ruta FROM public.anuncio_fotos f
               WHERE f.anuncio_id = a.id AND f.es_principal LIMIT 1) AS foto_ruta,
              o.id AS otro_centro_id, o.nombre AS otro_centro_nombre
       FROM public.conversaciones c
       JOIN public.anuncios a ON a.id = c.anuncio_id
       JOIN public.centros o ON o.id = CASE WHEN c.centro_comprador_id = $2
                                            THEN c.centro_vendedor_id ELSE c.centro_comprador_id END
       WHERE c.id = $1 AND $2 IN (c.centro_comprador_id, c.centro_vendedor_id)`,
      [id, centroId],
    );
    return rows[0] ?? null;
  }

  // CA26: como mucho 30 mensajes por minuto por centro, sumando todas sus
  // conversaciones. El bloqueo por centro serializa sus envíos simultáneos
  // hasta el final de la transacción, para que no se cuelen por encima del límite.
  async function comprobarLimite(cliente, centroId) {
    await cliente.query("SELECT pg_advisory_xact_lock(hashtextextended('mensajes:' || $1::text, 0))", [centroId]);
    const { rows: [{ recientes }] } = await cliente.query(
      `SELECT count(*)::integer AS recientes FROM public.mensajes
       WHERE centro_autor_id = $1 AND creado_en > clock_timestamp() - interval '1 minute'`,
      [centroId],
    );
    if (recientes >= LIMITE_MENSAJES_POR_MINUTO) throw demasiadosMensajes();
  }

  async function insertarMensaje(cliente, { conversacionId, centroId, usuarioId, texto }) {
    const { rows } = await cliente.query(
      `INSERT INTO public.mensajes (conversacion_id, centro_autor_id, autor_usuario_id, tipo, texto, creado_en)
       VALUES ($1, $2, $3, 'texto', $4, clock_timestamp())
       RETURNING ${COLUMNAS_MENSAJE}`,
      [conversacionId, centroId, usuarioId, texto],
    );
    return aMensaje(rows[0], centroId);
  }

  return {
    // CA19: conversación del centro de la sesión (como interesado) sobre el
    // anuncio, o null. Anuncio inexistente o retirado: 404.
    async deAnuncio(usuarioId, anuncioId) {
      return ejecutar('consultar la conversación del anuncio', async () => {
        const centroId = await centroDe(database, usuarioId);
        const { rows } = await database.query(
          `SELECT c.id
           FROM public.anuncios a
           LEFT JOIN public.conversaciones c ON c.anuncio_id = a.id AND c.centro_comprador_id = $2
           WHERE a.id = $1 AND a.estado <> 'retirado'`,
          [anuncioId, centroId],
        );
        if (rows.length === 0) throw anuncioNoEncontrado();
        return rows[0].id === null ? null : { id: rows[0].id };
      });
    },

    // CA20, CA21, CA32, CA33 y CA36: crea la conversación y su primer mensaje
    // en una transacción. El vendedor se copia del anuncio. Con dos envíos a la
    // vez del mismo centro, el segundo espera al bloqueo del límite y ya ve la
    // conversación creada (409); ON CONFLICT cubre además cualquier otra carrera.
    async crear(usuarioId, { anuncioId, texto }) {
      return ejecutar('crear la conversación', () => database.transaction(async (cliente) => {
        const centroId = await centroDe(cliente, usuarioId);
        const { rows: [anuncio] } = await cliente.query(
          `SELECT id, centro_id, estado FROM public.anuncios
           WHERE id = $1 AND estado <> 'retirado'
           FOR SHARE`,
          [anuncioId],
        );
        if (!anuncio) throw anuncioNoEncontrado();
        if (anuncio.centro_id === centroId) throw anuncioPropio();
        if (!ESTADOS_PARA_ABRIR.has(anuncio.estado)) throw anuncioNoDisponible();

        await comprobarLimite(cliente, centroId);
        const existente = 'SELECT id FROM public.conversaciones WHERE anuncio_id = $1 AND centro_comprador_id = $2';
        const { rows: [previa] } = await cliente.query(existente, [anuncioId, centroId]);
        if (previa) throw conversacionYaExiste(previa.id);

        const { rows: [nueva] } = await cliente.query(
          `INSERT INTO public.conversaciones (anuncio_id, centro_comprador_id, centro_vendedor_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (anuncio_id, centro_comprador_id) DO NOTHING
           RETURNING id`,
          [anuncioId, centroId, anuncio.centro_id],
        );
        if (!nueva) {
          const { rows: [ganadora] } = await cliente.query(existente, [anuncioId, centroId]);
          throw conversacionYaExiste(ganadora.id);
        }

        const mensaje = await insertarMensaje(cliente, { conversacionId: nueva.id, centroId, usuarioId, texto });
        const fila = await conversacionDe(cliente, nueva.id, centroId);
        return { conversacion: aConversacion(fila, centroId, urlFoto), mensaje };
      }));
    },

    // CA22, CA31: la conversación y una página de mensajes en orden ascendente.
    // Sin cursor, los 50 más recientes; con `antes`, los 50 anteriores a ese
    // mensaje; con `despues`, todos los posteriores (el sondeo de CA14).
    async obtener(usuarioId, id, { antes, despues } = {}) {
      return ejecutar('leer la conversación', async () => {
        const centroId = await centroDe(database, usuarioId);
        const fila = await conversacionDe(database, id, centroId);
        if (!fila) throw conversacionNoEncontrada();

        const cursorId = antes ?? despues;
        if (cursorId) {
          const { rowCount } = await database.query(
            'SELECT 1 FROM public.mensajes WHERE id = $1 AND conversacion_id = $2',
            [cursorId, id],
          );
          if (rowCount === 0) throw cursorNoValido(antes ? 'antes' : 'despues');
        }

        const cursor = '(SELECT creado_en, id FROM public.mensajes WHERE id = $2)';
        let filas;
        let hayAnteriores;
        if (despues) {
          ({ rows: filas } = await database.query(
            `SELECT ${COLUMNAS_MENSAJE} FROM public.mensajes
             WHERE conversacion_id = $1 AND (creado_en, id) > ${cursor}
             ORDER BY creado_en, id`,
            [id, despues],
          ));
          // El propio cursor es anterior a los devueltos.
          hayAnteriores = true;
        } else {
          const { rows } = await database.query(
            `SELECT ${COLUMNAS_MENSAJE} FROM public.mensajes
             WHERE conversacion_id = $1 ${antes ? `AND (creado_en, id) < ${cursor}` : ''}
             ORDER BY creado_en DESC, id DESC
             LIMIT ${MENSAJES_POR_PAGINA + 1}`,
            antes ? [id, antes] : [id],
          );
          hayAnteriores = rows.length > MENSAJES_POR_PAGINA;
          filas = rows.slice(0, MENSAJES_POR_PAGINA).reverse();
        }

        return {
          conversacion: aConversacion(fila, centroId, urlFoto),
          mensajes: filas.map((mensaje) => aMensaje(mensaje, centroId)),
          hay_anteriores: hayAnteriores,
        };
      });
    },

    // CA25, CA26, CA31, CA33 y CA34: escriben los dos centros de la
    // conversación, sea cual sea el estado del anuncio (también retirado).
    async enviar(usuarioId, id, { texto }) {
      return ejecutar('enviar el mensaje', () => database.transaction(async (cliente) => {
        const centroId = await centroDe(cliente, usuarioId);
        const fila = await conversacionDe(cliente, id, centroId);
        if (!fila) throw conversacionNoEncontrada();
        await comprobarLimite(cliente, centroId);
        return insertarMensaje(cliente, { conversacionId: id, centroId, usuarioId, texto });
      }));
    },
  };
}
