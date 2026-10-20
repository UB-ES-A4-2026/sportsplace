import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/useAuth.js';

// Protege las rutas privadas: sin sesión válida, lleva a /entrar y recuerda a dónde quería ir.
export default function RutaPrivada() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <p className="status checking pagina" role="status">
        <span className="dot" aria-hidden="true" />Comprobando tu sesión…
      </p>
    );
  }

  if (!usuario) {
    return <Navigate to="/entrar" replace state={{ desde: location.pathname }} />;
  }

  return <Outlet />;
}
