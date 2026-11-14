import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { conversacionDelAnuncio } from '../api/mensajes.js';
import { destinoDeEscribir, resultadoDelFallo, TEXTOS } from '../mensajes/conversacion.js';
import Aviso from './Aviso.jsx';

// US-28 CA1-CA3: «Escribir al centro» en el detalle de un anuncio de otro centro. Pregunta si ya hay conversación
// sobre el anuncio (GET /api/anuncios/:id/conversacion) y lleva a ella o a /mensajes/nueva?anuncio=:id.
export default function BotonEscribirAlCentro({ anuncioId }) {
  const navigate = useNavigate();
  const [comprobando, setComprobando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const cerrarAviso = useCallback(() => setAviso(null), []);

  async function escribir() {
    setComprobando(true);
    try {
      const conversacion = await conversacionDelAnuncio(anuncioId);
      navigate(destinoDeEscribir(conversacion, anuncioId));
    } catch (fallo) {
      setAviso({ tipo: 'error', texto: resultadoDelFallo(fallo).aviso });
      setComprobando(false);
    }
  }

  return (
    <div className="detalle-boton">
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />
      <button type="button" className="boton-secundario" disabled={comprobando} onClick={escribir}>
        {TEXTOS.escribir}
      </button>
    </div>
  );
}
