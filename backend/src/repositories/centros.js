import { ApiError } from '../errors.js';

const UNIQUE_VIOLATION = '23505';

// US-07: columnas que devuelven GET y PATCH /api/centros/mio (CA17).
const PERFIL = `id, nombre, email, localidad, direccion, codigo_postal, telefono,
  descripcion, email_contacto, web, creado_en`;
const EDITABLES = ['nombre', 'descripcion', 'telefono', 'email_contacto', 'web'];

export function emailAlreadyRegistered() {
  return new ApiError(409, 'EMAIL_YA_REGISTRADO', 'Ya existe una cuenta con este email.');
}

export function databaseUnavailable() {
  return new ApiError(503, 'BASE_DATOS_NO_DISPONIBLE', 'No se ha podido guardar la información. Inténtalo más tarde.');
}

export function createCentrosRepository(database) {
  return {
    // US-01: crea el centro y su cuenta en la misma transacción. Si la cuenta
    // no se puede crear, el centro no se guarda; el índice único del email
    // impide dos altas simultáneas con el mismo email.
    async registrar(centro, crearCuenta) {
      try {
        return await database.transaction(async (client) => {
          const { rows } = await client.query(
            `INSERT INTO public.centros (
               nombre, email, localidad, direccion, codigo_postal, telefono,
               politica_privacidad_aceptada, politica_privacidad_aceptada_en
             ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, now())
             RETURNING id`,
            [centro.nombre, centro.email, centro.localidad, centro.direccion, centro.codigo_postal, centro.telefono],
          );
          const usuario = await crearCuenta();
          await client.query('UPDATE public.centros SET usuario_id = $1 WHERE id = $2', [usuario.id, rows[0].id]);
          return usuario;
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error?.code === UNIQUE_VIOLATION) throw emailAlreadyRegistered();
        console.error(`No se pudo registrar el centro: ${error?.code ?? 'error desconocido'}`);
        throw databaseUnavailable();
      }
    },

    // US-02: copia en centros la fecha de confirmación de la cuenta.
    async marcarEmailConfirmado(usuarioId, confirmadoEn) {
      await database.query(
        `UPDATE public.centros SET email_confirmado_en = $2
         WHERE usuario_id = $1 AND email_confirmado_en IS NULL`,
        [usuarioId, confirmadoEn],
      );
    },

    // US-07: centro al que pertenece el usuario, o null si no tiene ninguno.
    // En este sprint es el de centros.usuario_id; US-84 lo amplía a miembros.
    async centroDelUsuario(usuarioId) {
      try {
        const { rows } = await database.query(
          `SELECT ${PERFIL} FROM public.centros WHERE usuario_id = $1`,
          [usuarioId],
        );
        return rows[0] ?? null;
      } catch (error) {
        console.error(`No se pudo leer el centro: ${error?.code ?? 'error desconocido'}`);
        throw databaseUnavailable();
      }
    },

    // US-07: guarda los campos recibidos (ya validados) y siempre actualiza
    // actualizado_en (CA21). Los que no llegan no cambian.
    async actualizarPerfil(usuarioId, cambios) {
      const campos = EDITABLES.filter((campo) => campo in cambios);
      const asignaciones = campos.map((campo, indice) => `${campo} = $${indice + 2}`);
      try {
        const { rows } = await database.query(
          `UPDATE public.centros SET ${[...asignaciones, 'actualizado_en = now()'].join(', ')}
           WHERE usuario_id = $1
           RETURNING ${PERFIL}`,
          [usuarioId, ...campos.map((campo) => cambios[campo])],
        );
        return rows[0] ?? null;
      } catch (error) {
        console.error(`No se pudo actualizar el perfil del centro: ${error?.code ?? 'error desconocido'}`);
        throw databaseUnavailable();
      }
    },
  };
}
