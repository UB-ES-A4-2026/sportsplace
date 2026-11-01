import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ErrorApi } from '../api/cliente.js';
import { retirarAnuncio } from '../api/anuncios.js';
import { AVISO_RETIRADO, puedeRetirar, resultadoDelFallo } from '../anuncios/acciones.js';
import DialogoConfirmacion from './DialogoConfirmacion.jsx';

// US-70: botón «Retirar anuncio» con su diálogo de confirmación.
// - En la ficha (sin `onRetirado`): al retirar navega a /mis-anuncios con replace y deja el aviso
//   en `location.state.aviso` = { tipo: 'exito', texto: 'Anuncio retirado.' } para que lo muestre esa pantalla (CA4).
// - En la fila de «Mis anuncios»: `onRetirado(id)` quita la fila sin recargar y muestra el mismo aviso (CA4).
// - `onFallo(resultado)` recibe { mensaje, recargar } o { noEncontrado } (ver resultadoDelFallo) para el aviso
//   rojo, la recarga o la pantalla «Anuncio no encontrado». El diálogo se cierra sin cambios (CA6).
// - `className` permite pintarlo como opción del menú «Más ▾» de la fila (US-18).
// Uso en la ficha: <BotonRetirarAnuncio anuncio={anuncio} onFallo={mostrarFallo} />
export default function BotonRetirarAnuncio({ anuncio, onRetirado, onFallo, className = 'boton-texto-peligro' }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!puedeRetirar(anuncio.estado)) return null;

  async function retirar() {
    if (enviando) return;
    setEnviando(true);
    try {
      await retirarAnuncio(anuncio.id);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      setEnviando(false);
      setAbierto(false);
      onFallo?.(resultadoDelFallo(fallo));
      return;
    }
    setEnviando(false);
    setAbierto(false);
    if (onRetirado) onRetirado(anuncio.id);
    else navigate('/mis-anuncios', { replace: true, state: { aviso: { tipo: 'exito', texto: AVISO_RETIRADO } } });
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setAbierto(true)}>
        Retirar anuncio
      </button>
      <DialogoConfirmacion
        abierto={abierto}
        titulo="¿Retirar este anuncio?"
        texto="Dejará de estar disponible y no podrás recuperarlo."
        textoConfirmar="Retirar"
        textoEnviando="Retirando…"
        peligro
        enviando={enviando}
        onConfirmar={retirar}
        onCancelar={() => setAbierto(false)}
      />
    </>
  );
}
