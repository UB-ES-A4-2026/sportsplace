import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../errors.js';

// Supabase Auth guarda las contraseñas (hash y sal), envía el email de
// confirmación y emite los tokens. El servidor solo traduce sus respuestas
// al formato común de la API, sin exponer los errores originales.

export function toUsuario(user) {
  return {
    id: user.id,
    email: user.email,
    email_confirmado: Boolean(user.email_confirmed_at),
  };
}

export function toSesion(session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}

export function authUnavailable() {
  return new ApiError(503, 'AUTH_NO_DISPONIBLE', 'El servicio de autenticación no está disponible. Inténtalo más tarde.');
}

export function createSupabaseAuth({
  environment = process.env,
  clientFactory = createClient,
} = {}) {
  const url = environment.SUPABASE_URL?.trim();
  const key = environment.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;

  const client = clientFactory(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    client,

    async getUser(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) {
        if (error.status >= 500 || !error.status) throw authUnavailable();
        return null;
      }
      return data.user ? toUsuario(data.user) : null;
    },
  };
}
