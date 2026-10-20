import { Navigate, Outlet, useLocation } from 'react-router';
import { leerSesion } from '../api/sesion.js';

// Protege las rutas privadas: sin sesión guardada, lleva a /entrar.
// TODO US-03: comprobar la sesión con GET /api/auth/me y renovar el token con /api/auth/refresh.
export default function RutaPrivada() {
  const location = useLocation();

  if (!leerSesion()?.access_token) {
    return <Navigate to="/entrar" replace state={{ desde: location.pathname }} />;
  }

  return <Outlet />;
}
