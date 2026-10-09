import { ApiError } from '../errors.js';
import { authUnavailable, emailNotConfirmed } from '../services/supabase-auth.js';

export function bearerToken(request) {
  const header = request.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? match[1] : null;
}

export function getAuth(request) {
  const auth = request.app.get('auth');
  if (!auth) throw authUnavailable();
  return auth;
}

// Exige una sesión válida y deja el usuario en request.usuario.
export async function requireAuth(request, response, next) {
  const token = bearerToken(request);
  if (!token) {
    throw new ApiError(401, 'NO_AUTENTICADO', 'Necesitas entrar en tu cuenta.');
  }
  const usuario = await getAuth(request).getUser(token);
  if (!usuario) {
    throw new ApiError(401, 'NO_AUTENTICADO', 'Tu sesión no es válida. Vuelve a entrar.');
  }
  request.accessToken = token;
  request.usuario = usuario;
  next();
}

// US-02: hasta confirmar el email no se puede publicar anuncios ni hacer pedidos.
// Se usa siempre después de requireAuth en esas rutas.
export function requireEmailConfirmado(request, response, next) {
  if (!request.usuario?.email_confirmado) throw emailNotConfirmed();
  next();
}
