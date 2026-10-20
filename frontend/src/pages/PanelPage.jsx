import { useAuth } from '../auth/useAuth.js';
import BotonCerrarSesion from '../components/BotonCerrarSesion.jsx';

// Zona privada. US-67: desde aquí se puede cerrar la sesión.
export default function PanelPage() {
  const { usuario } = useAuth();

  return (
    <section className="pagina" aria-labelledby="titulo">
      <h1 id="titulo">Zona privada</h1>
      <p className="intro-text">
        Has iniciado sesión como <strong>{usuario?.email}</strong>.
      </p>
      <BotonCerrarSesion />
    </section>
  );
}
