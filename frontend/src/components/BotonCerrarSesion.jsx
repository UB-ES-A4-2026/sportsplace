import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth.js';

// US-67: cierra la sesión y vuelve a la pantalla de entrada.
export default function BotonCerrarSesion({ className }) {
  const { cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [cerrando, setCerrando] = useState(false);

  async function cerrar() {
    if (cerrando) return;
    setCerrando(true);
    await cerrarSesion();
    navigate('/entrar', { replace: true });
  }

  return (
    <button type="button" className={className} onClick={cerrar} disabled={cerrando}>
      {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
    </button>
  );
}
