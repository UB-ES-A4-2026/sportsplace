import { useAuth } from '../auth/useAuth.js';

// Zona privada. TODO US-67: botón para cerrar sesión (POST /api/auth/logout).
export default function PanelPage() {
  const { usuario } = useAuth();

  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Zona privada</h1>
      <p className="intro-text">
        Has iniciado sesión como <strong>{usuario?.email}</strong>.
      </p>
    </section>
  );
}
