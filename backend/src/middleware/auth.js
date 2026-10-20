import { databaseUnavailable } from '../repositories/centros.js';
import { authUnavailable } from '../services/supabase-auth.js';

export function getAuth(request) {
  const auth = request.app.get('auth');
  if (!auth) throw authUnavailable();
  return auth;
}

export function getCentros(request) {
  const centros = request.app.get('centros');
  if (!centros) throw databaseUnavailable();
  return centros;
}
