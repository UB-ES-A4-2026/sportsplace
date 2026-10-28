import { Router } from 'express';
import { ApiError, methodNotAllowed } from '../errors.js';
import { getAuth, getCentros, requireAuth } from '../middleware/auth.js';
import { validarRegistro } from '../validation/registro.js';
import { validarRecuperacion, validarRestablecimiento } from '../validation/recuperacion.js';
import { validarReenvio } from '../validation/reenvio.js';

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

  // US-02: confirmar el email con el enlace recibido; la cuenta queda activa.
  router.post('/confirmar', async (request, response) => {
    requiredStrings(request.body, { token_hash: 'Falta el token del enlace.' });
    if (!['email', 'signup'].includes(request.body.type ?? 'email')) {
      throw new ApiError(400, 'ENLACE_INVALIDO', 'El enlace de confirmación no es válido o ha caducado.');
    }
    const { usuario, confirmadoEn, sesion } = await getAuth(request).verifyEmail(request.body.token_hash);
    try {
      await getCentros(request).marcarEmailConfirmado(usuario.id, confirmadoEn);
    } catch (error) {
      // La cuenta ya está activa en Supabase Auth, que es la fuente de verdad;
      // el enlace no se puede reutilizar, así que no se devuelve un error.
      console.error(`No se pudo copiar la confirmación del email en centros: ${error?.code ?? 'error desconocido'}`);
    }
    response.json({ usuario, sesion });
  });

  // US-66: pedir un enlace de confirmación nuevo si el anterior ha caducado.
  // Responde siempre 204 para no revelar qué emails tienen cuenta.
  router.post('/reenviar-confirmacion', async (request, response) => {
    const { email } = validarReenvio(request.body);
    await getAuth(request).resendConfirmation(email);
    response.status(204).end();
  });

  // US-04: pedir un enlace para cambiar la contraseña. Responde siempre 204,
  // exista o no la cuenta (CA19, CA23).
  router.post('/recuperar-contrasena', async (request, response) => {
    const { email } = validarRecuperacion(request.body);
    await getAuth(request).requestPasswordReset(email);
    response.status(204).end();
  });

  // US-04: fijar la contraseña nueva con el token_hash del enlace (CA20). No
  // devuelve sesión (CA21): después se entra con la contraseña nueva (CA5).
  router.post('/restablecer-contrasena', async (request, response) => {
    const { tokenHash, password } = validarRestablecimiento(request.body);
    await getAuth(request).resetPassword(tokenHash, password);
    response.status(204).end();
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
  router.all('/confirmar', methodNotAllowed(['POST']));
  router.all('/reenviar-confirmacion', methodNotAllowed(['POST']));
  router.all('/recuperar-contrasena', methodNotAllowed(['POST']));
  router.all('/restablecer-contrasena', methodNotAllowed(['POST']));
  router.all('/login', methodNotAllowed(['POST']));
  router.all('/refresh', methodNotAllowed(['POST']));
  router.all('/me', methodNotAllowed(['GET']));
  router.all('/logout', methodNotAllowed(['POST']));

  return router;
}
