import { useState } from 'react';
import { ErrorApi } from '../api/cliente.js';
import { pausarAnuncio, reactivarAnuncio } from '../api/anuncios.js';
import { accionDePausa, resultadoDelFallo } from '../anuncios/acciones.js';

const LLAMADAS = { pausar: pausarAnuncio, reactivar: reactivarAnuncio };

// US-16: botón secundario «Pausar» (solo activo) o «Reactivar» (solo pausado); en el resto de estados no se pinta (CA1).
// Sin diálogo de confirmación (CA3). Mientras se envía se deshabilita y muestra «Pausando…» / «Reactivando…» (CA2).
// - `onActualizado(anuncio)` recibe el anuncio que devuelve la API para actualizar en sitio la etiqueta,
//   la franja y los botones, sin recargar la página (CA3). En la fila de «Mis anuncios» la fila no se mueve (US-18 CA7).
// - `onAviso({ tipo: 'exito', texto })` con «Anuncio pausado.» o «Anuncio reactivado.» (CA4, verde).
// - `onFallo(resultado)` recibe { mensaje, recargar } o { noEncontrado } (ver resultadoDelFallo): con un 409,
//   aviso rojo y recargar el anuncio para mostrar su estado real (CA4).
// - `className` permite pintarlo como opción del menú «Más ▾» de la fila (US-18 E2E-4).
// Uso en la ficha: <BotonPausarReactivar anuncio={anuncio} onActualizado={setAnuncio} onAviso={mostrarAviso} onFallo={mostrarFallo} />
export default function BotonPausarReactivar({ anuncio, onActualizado, onAviso, onFallo, className = 'boton-secundario' }) {
  const [enviando, setEnviando] = useState(false);
  const pausa = accionDePausa(anuncio.estado);

  if (!pausa) return null;

  async function cambiar() {
    if (enviando) return;
    setEnviando(true);
    let actualizado;
    try {
      actualizado = await LLAMADAS[pausa.accion](anuncio.id);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      setEnviando(false);
      onFallo?.(resultadoDelFallo(fallo));
      return;
    }
    setEnviando(false);
    onActualizado?.(actualizado);
    onAviso?.({ tipo: 'exito', texto: pausa.aviso });
  }

  return (
    <button type="button" className={className} disabled={enviando} onClick={cambiar}>
      {enviando ? pausa.textoEnviando : pausa.texto}
    </button>
  );
}
