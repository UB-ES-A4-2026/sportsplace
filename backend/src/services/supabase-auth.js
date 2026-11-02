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

function invalidCredentials() {
  return new ApiError(401, 'CREDENCIALES_INCORRECTAS', 'Email o contraseña incorrectos.');
}

function notAuthenticated() {
  return new ApiError(401, 'NO_AUTENTICADO', 'Tu sesión no es válida. Vuelve a entrar.');
}

function tooManyAttempts() {
  return new ApiError(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
}

// US-04 (CA20): enlace de recuperación usado, caducado, sustituido por otro o inventado.
export function invalidRecoveryLink() {
  return new ApiError(400, 'ENLACE_INVALIDO', 'El enlace para cambiar la contraseña no es válido o ha caducado.');
}

export function emailNotConfirmed() {
  return new ApiError(403, 'EMAIL_NO_CONFIRMADO', 'Confirma tu email con el enlace que te hemos enviado antes de continuar.');
}

export function createSupabaseAuth({
  environment = process.env,
  clientFactory = createClient,
} = {}) {
  const url = environment.SUPABASE_URL?.trim();
  const key = environment.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;

  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const client = clientFactory(url, key, options);

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

    // US-02: activa la cuenta con el token_hash del enlace de confirmación.
    async verifyEmail(tokenHash) {
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      if (error) {
        if (error.status === 429) throw tooManyAttempts();
        if (error.status >= 500 || !error.status) throw authUnavailable();
        throw new ApiError(400, 'ENLACE_INVALIDO', 'El enlace de confirmación no es válido o ha caducado.');
      }
      return {
        usuario: toUsuario(data.user),
        confirmadoEn: data.user.email_confirmed_at,
        sesion: data.session ? toSesion(data.session) : null,
      };
    },

    // US-66: reenvía el email de confirmación con un enlace nuevo. Utiliza la
    // misma plantilla «Confirm signup» que el registro, así que el enlace abre
    // /confirmar-email igual que el primero.
    async resendConfirmation(email) {
      const { error } = await client.auth.resend({ type: 'signup', email: normalizeEmail(email) });
      if (!error) return;
      if (error.status === 429) throw tooManyAttempts();
      if (error.status >= 500 || !error.status) throw authUnavailable();
      // Otros errores (email sin cuenta o ya confirmado) se responden igual que
      // un envío correcto, para no revelar qué emails tienen cuenta.
    },

    // US-04 (CA19, CA23, CA25): pide el email «Reset password» (plantilla de
    // T04-1, que enlaza a /restablecer-contrasena). Supabase no revela si el
    // email tiene cuenta, y cualquier otro error se responde igual que un envío
    // correcto, así que la respuesta es la misma exista o no la cuenta.
    async requestPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(email));
      if (!error) return;
      if (error.status === 429) throw tooManyAttempts();
      if (error.status >= 500 || !error.status) throw authUnavailable();
    },

    // US-04 (CA12-CA14, CA20, CA26): cambia la contraseña con el token_hash del
    // enlace y cierra todas las sesiones de la cuenta. Usa un cliente propio de
    // esta petición: verifyOtp guarda la sesión de recuperación en el cliente y
    // updateUser la usa, así que no se puede compartir con otras peticiones.
    // El token_hash no se escribe nunca en los logs (CA24).
    async resetPassword(tokenHash, password) {
      const recuperacion = clientFactory(url, key, options);

      const { data, error } = await recuperacion.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (error) {
        if (error.status === 429) throw tooManyAttempts();
        if (error.status >= 500 || !error.status) throw authUnavailable();
        throw invalidRecoveryLink();
      }
      if (!data?.session) throw invalidRecoveryLink();

      const { error: errorCambio } = await recuperacion.auth.updateUser({ password });
      // CA26: elegir la misma contraseña que antes se acepta.
      if (errorCambio && errorCambio.code !== 'same_password') {
        if (errorCambio.code === 'weak_password') {
          throw new ApiError(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', {
            password: 'La contraseña es demasiado débil.',
          });
        }
        if (errorCambio.status === 429) throw tooManyAttempts();
        throw authUnavailable();
      }

      // CA14: cierra todas las sesiones abiertas de la cuenta (también la de
      // recuperación); sus refresh_token dejan de servir.
      const { error: errorCierre } = await recuperacion.auth.admin.signOut(data.session.access_token, 'global');
      if (errorCierre && (errorCierre.status >= 500 || !errorCierre.status)) throw authUnavailable();
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) {
        // Supabase comprueba la contraseña antes que la confirmación, así que
        // este caso no revela si un email está registrado.
        if (error.code === 'email_not_confirmed') throw emailNotConfirmed();
        if (error.status === 429) throw tooManyAttempts();
        // US-03: el mismo error tanto si falla el email como la contraseña.
        if (error.code === 'invalid_credentials' || error.status === 400) throw invalidCredentials();
        throw authUnavailable();
      }
      return { usuario: toUsuario(data.user), sesion: toSesion(data.session) };
    },

    async refresh(refreshToken) {
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
      if (error) {
        if (error.status === 429) throw tooManyAttempts();
        if (error.status >= 500 || !error.status) throw authUnavailable();
        throw notAuthenticated();
      }
      if (!data.session) throw notAuthenticated();
      return { usuario: toUsuario(data.user), sesion: toSesion(data.session) };
    },

    // US-67: cierra solo la sesión actual; su refresh_token deja de funcionar.
    async signOut(accessToken) {
      const { error } = await client.auth.admin.signOut(accessToken, 'local');
      // Si la sesión ya no existe (401, 403 o 404), el resultado es el mismo: cerrada.
      if (error && (error.status >= 500 || !error.status)) throw authUnavailable();
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
