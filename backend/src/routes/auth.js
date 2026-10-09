import { Router } from 'express';
import { ApiError, methodNotAllowed } from '../errors.js';
import { getAuth, requireAuth } from '../middleware/auth.js';

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

  router.all('/login', methodNotAllowed(['POST']));
  router.all('/refresh', methodNotAllowed(['POST']));
  router.all('/me', methodNotAllowed(['GET']));

  return router;
}
