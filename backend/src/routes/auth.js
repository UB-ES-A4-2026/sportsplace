import { Router } from 'express';
import { methodNotAllowed } from '../errors.js';
import { getAuth, getCentros } from '../middleware/auth.js';
import { validarRegistro } from '../validation/registro.js';

export function authRouter() {
  const router = Router();

  // US-01: registrar mi centro. La cuenta queda pendiente de confirmar el email.
  router.post('/registro', async (request, response) => {
    const { centro, password } = validarRegistro(request.body);
    const auth = getAuth(request);
    const usuario = await getCentros(request).registrar(centro, () => auth.signUp(centro.email, password));
    response.status(201).json({ usuario });
  });

  router.all('/registro', methodNotAllowed(['POST']));

  return router;
}
