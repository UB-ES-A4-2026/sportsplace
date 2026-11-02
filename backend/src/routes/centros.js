import { Router } from 'express';
import { ApiError, methodNotAllowed } from '../errors.js';
import { getCentros, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { validarPerfil } from '../validation/perfil.js';

function centroNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'No hay ningún centro asociado a tu cuenta.');
}

export function centrosRouter() {
  const router = Router();

  // US-07: ver los datos del perfil de mi centro.
  router.get('/mio', requireAuth, async (request, response) => {
    const centro = await getCentros(request).centroDelUsuario(request.usuario.id);
    if (!centro) throw centroNoEncontrado();
    response.json({ centro });
  });

  // US-07: editar la descripción y los datos de contacto. Solo el centro propio
  // (CA22): no hay ninguna ruta para editar otro centro por id.
  router.patch('/mio', requireAuth, requireEmailConfirmado, async (request, response) => {
    const cambios = validarPerfil(request.body ?? {});
    const centro = await getCentros(request).actualizarPerfil(request.usuario.id, cambios);
    if (!centro) throw centroNoEncontrado();
    response.json({ centro });
  });

  router.all('/mio', methodNotAllowed(['GET', 'PATCH']));

  return router;
}
