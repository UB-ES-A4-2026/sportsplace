import { useState } from 'react';
import { ErrorApi } from '../api/cliente.js';
import { cambiarReservaOEntrega } from '../api/anuncios.js';
import { accionesDeReservaYEntrega, resultadoDelFallo } from '../anuncios/acciones.js';
import DialogoConfirmacion from './DialogoConfirmacion.jsx';

// US-17: botones según el estado (CA1). Si el anuncio está pausado, en borrador o entregado no se pinta nada (CA6).
// «Marcar como reservado» y «Quitar reserva» son inmediatos; «Marcar como entregado» abre el diálogo
// «¿Marcar como entregado?» (CA3). Durante la petición el botón muestra «Reservando…», «Quitando reserva…» o
// «Marcando…» y los botones se deshabilitan (CA2).
// - `onActualizado(anuncio)` recibe el anuncio que devuelve la API para actualizar en sitio la etiqueta, la franja
//   y los botones. Tras entregar ya no queda ninguno (CA6).
// - `onAviso({ tipo: 'exito', texto })` con «Anuncio reservado.», «Reserva quitada.» o «Anuncio entregado.» (CA4).
// - `onFallo(resultado)` recibe { mensaje, recargar } o { noEncontrado } (ver resultadoDelFallo): con un 409,
//   aviso rojo y recargar el anuncio (CA4). El diálogo se cierra sin cambios.
// - `className` permite pintarlos como opciones del menú «Más ▾» de la fila (US-18).
// Uso en la ficha: <BotonesReservaEntrega anuncio={anuncio} onActualizado={setAnuncio} onAviso={mostrarAviso} onFallo={mostrarFallo} />
export default function BotonesReservaEntrega({ anuncio, onActualizado, onAviso, onFallo, className = 'boton-secundario' }) {
  const [enviando, setEnviando] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const acciones = accionesDeReservaYEntrega(anuncio.estado);

  if (acciones.length === 0) return null;

  async function ejecutar(opcion) {
    if (enviando) return;
    setEnviando(opcion.accion);
    let actualizado;
    try {
      actualizado = await cambiarReservaOEntrega(anuncio.id, opcion.accion);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      setEnviando(null);
      setConfirmando(null);
      onFallo?.(resultadoDelFallo(fallo));
      return;
    }
    setEnviando(null);
    setConfirmando(null);
    onActualizado?.(actualizado);
    onAviso?.({ tipo: 'exito', texto: opcion.aviso });
  }

  return (
    <>
      {acciones.map((opcion) => (
        <button
          key={opcion.accion}
          type="button"
          className={className}
          disabled={enviando !== null}
          onClick={() => (opcion.confirmacion ? setConfirmando(opcion) : ejecutar(opcion))}
        >
          {enviando === opcion.accion ? opcion.textoEnviando : opcion.texto}
        </button>
      ))}
      <DialogoConfirmacion
        abierto={confirmando !== null}
        titulo={confirmando?.confirmacion.titulo}
        texto={confirmando?.confirmacion.texto}
        textoConfirmar={confirmando?.confirmacion.textoConfirmar}
        textoEnviando={confirmando?.textoEnviando}
        enviando={confirmando !== null && enviando === confirmando.accion}
        onConfirmar={() => ejecutar(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />
    </>
  );
}
