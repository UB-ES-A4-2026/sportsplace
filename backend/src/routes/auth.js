import { Router } from 'express';
import { ApiError, methodNotAllowed } from '../errors.js';
import { getAuth, getCentros, requireAuth } from '../middleware/auth.js';
import { validarRegistro } from '../validation/registro.js';

function requiredStrings(body, fields) {
  const details = {};
  for (const [field, message] of Object.entries(fields)) {
    if (typeof body?.[field] !== 'string' || body[field].trim() === '') {
      details[field] = message;
    }
  }
  if (Object.keys(details).length > 0) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', details);
  }
}

export function authRouter() {
  const router = Router();

  // US-01: registrar mi centro. La cuenta queda pendiente de confirmar el email.
  router.post('/registro', async (request, response) => {
    const { centro, password } = validarRegistro(request.body);
    const auth = getAuth(request);
    const usuario = await getCentros(request).registrar(centro, () => auth.signUp(centro.email, password));
    response.status(201).json({ usuario });
  });

  // US-03: entrar con email y contraseña.
  router.post('/login', async (request, response) => {
    requiredStrings(request.body, {
      email: 'El email es obligatorio.',
      password: 'La contraseña es obligatoria.',
    });
    const { email, password } = request.body;
    response.json(await getAuth(request).signIn(email, password));
  });

  // US-03: renovar la sesión antes de que caduque el access_token.
  router.post('/refresh', async (request, response) => {
    requiredStrings(request.body, { refresh_token: 'Falta el refresh_token.' });
    response.json(await getAuth(request).refresh(request.body.refresh_token));
  });

  router.get('/me', requireAuth, (request, response) => {
    response.json({ usuario: request.usuario });
  });

  // US-67: cerrar sesión.
  router.post('/logout', requireAuth, async (request, response) => {
    await getAuth(request).signOut(request.accessToken);
    response.status(204).end();
  });

  router.all('/registro', methodNotAllowed(['POST']));
  router.all('/login', methodNotAllowed(['POST']));
  router.all('/refresh', methodNotAllowed(['POST']));
  router.all('/me', methodNotAllowed(['GET']));
  router.all('/logout', methodNotAllowed(['POST']));

  return router;
}
