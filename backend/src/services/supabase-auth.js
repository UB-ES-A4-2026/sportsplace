import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../errors.js';
import { emailAlreadyRegistered } from '../repositories/centros.js';

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

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function tooManyAttempts() {
  return new ApiError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
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

    // US-01: crea la cuenta. Con «Confirm email» activado, Supabase envía el
    // email de confirmación (US-02) y no devuelve sesión hasta confirmarlo.
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email: normalizeEmail(email), password });
      if (error) {
        if (['user_already_exists', 'email_exists'].includes(error.code)) throw emailAlreadyRegistered();
        if (error.code === 'weak_password') {
          throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', {
            password: 'La contraseña es demasiado débil.',
          });
        }
        if (error.code === 'email_address_invalid') {
          throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', {
            email: 'El email no es válido.',
          });
        }
        if (error.status === 429) throw tooManyAttempts();
        throw authUnavailable();
      }
      // Supabase no da error si el email ya tiene cuenta: devuelve un usuario sin identidades.
      if (!data.user || data.user.identities?.length === 0) throw emailAlreadyRegistered();
      return toUsuario(data.user);
    },

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
