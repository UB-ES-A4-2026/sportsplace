import { Router } from 'express';
import { ApiError, methodNotAllowed } from '../errors.js';
import { getAnuncios, getCentros, requireAuth, requireEmailConfirmado } from '../middleware/auth.js';
import { esUuid } from '../repositories/anuncios.js';
import { validarPaginacion } from '../validation/anuncios.js';
import { validarPerfil } from '../validation/perfil.js';
import { validarUbicacion } from '../validation/ubicacion.js';

function centroNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'No hay ningún centro asociado a tu cuenta.');
}

// US-10 (CA13): un centro que no existe, un id que no es un UUID o un centro
// eliminado (US-11) responden igual.
function perfilNoEncontrado() {
  return new ApiError(404, 'NO_ENCONTRADO', 'Centro no encontrado.');
}

async function perfilPublico(request) {
  if (!esUuid(request.params.id)) throw perfilNoEncontrado();
  const centro = await getCentros(request).perfilPublico(request.params.id, request.usuario.id);
  if (!centro) throw perfilNoEncontrado();
  return centro;
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

  // US-68: dirección, código postal y localidad del centro propio. Provincia y
  // coordenadas las pone el servidor a partir del código postal (CA7, CA8).
  router.put('/mio/ubicacion', requireAuth, requireEmailConfirmado, async (request, response) => {
    const ubicacion = validarUbicacion(request.body ?? {});
    const centro = await getCentros(request).actualizarUbicacion(request.usuario.id, ubicacion);
    if (!centro) throw centroNoEncontrado();
    response.json({ centro });
  });

  router.all('/mio/ubicacion', methodNotAllowed(['PUT']));

  // US-10 (CA11, CA14): perfil de otro centro (o del propio, con es_mio).
  // Va después de /mio para que «mio» no se tome como un id.
  router.get('/:id', requireAuth, requireEmailConfirmado, async (request, response) => {
    response.json({ centro: await perfilPublico(request) });
  });

  // US-10 (CA6, CA12, CA15): sus anuncios activos y reservados, 20 por página.
  // Solo se lee `pagina`; el tamaño de página es fijo.
  router.get('/:id/anuncios', requireAuth, requireEmailConfirmado, async (request, response) => {
    const { pagina, porPagina } = validarPaginacion({ pagina: request.query.pagina });
    const centro = await perfilPublico(request);
    response.json(await getAnuncios(request).listarDeCentro(centro.id, { pagina, porPagina }));
  });

  // US-07 (CA22): no hay ruta para editar otro centro por id, así que otros
  // métodos sobre /:id siguen respondiendo 404 y no 405.
  router.all('/:id/anuncios', methodNotAllowed(['GET']));

  return router;
}
