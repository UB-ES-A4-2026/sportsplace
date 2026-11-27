import { useState } from 'react';
import { ErrorApi } from '../api/cliente.js';
import { cancelarPedido } from '../api/accionesPedido.js';
import { resultadoDelFallo } from '../pedidos/acciones.js';
import { AVISO_CANCELADO, cuerpoDeLaCancelacion, puedeCancelar } from '../pedidos/cancelar.js';
import DialogoCancelacion from './DialogoCancelacion.jsx';

// T39-2 (US-39): botón secundario rojo «Cancelar pedido» al final de la barra de acciones de /pedidos/:id.
// «Cancelar pedido» → diálogo con el motivo → «Cancelando…» → aviso verde «Pedido cancelado.» (CA3).
// Solo si `pedido.acciones` incluye `cancelar` (CA1, US-108 CA9). Props, como AccionesPedidoVendedor:
// - `onActualizado(pedido)`: el pedido que devuelve la API («Cancelado», sección «Motivo» e historial).
// - `onAviso({ tipo: 'exito', texto })`.
// - `onFallo(resultado)`: { mensaje, recargar } (409: el `message` de la API y recargar el pedido),
//   { noEncontrado } (404) o { mensaje } (resto). Con errores de campo (400) se quedan bajo su campo; con la red
//   caída, 500 o 503, el diálogo sigue abierto con lo escrito.
// - `cancelar`: la petición; solo se cambia en los tests.
export default function AccionesCancelacion({ pedido, onActualizado, onAviso, onFallo, cancelar = cancelarPedido }) {
  const [abierto, setAbierto] = useState(false);
  const [aperturas, setAperturas] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState({});

  if (!puedeCancelar(pedido)) return null;

  function abrir() {
    setAperturas((n) => n + 1);
    setErrores({});
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setErrores({});
  }

  async function enviar(valores) {
    if (enviando) return;
    setEnviando(true);
    let actualizado;
    try {
      actualizado = await cancelar(pedido.id, cuerpoDeLaCancelacion(valores));
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      setEnviando(false);
      const resultado = resultadoDelFallo(fallo);
      if (resultado.errores) {
        setErrores(resultado.errores);
        return;
      }
      if (!resultado.conservar) cerrar();
      onFallo?.({ mensaje: resultado.mensaje, recargar: resultado.recargar, noEncontrado: resultado.noEncontrado });
      return;
    }
    setEnviando(false);
    cerrar();
    onActualizado?.(actualizado);
    onAviso?.({ tipo: 'exito', texto: AVISO_CANCELADO });
  }

  return (
    <>
      <div className="pedido-acciones-cancelar">
        <button type="button" className="boton-secundario boton-borde-peligro" disabled={enviando} onClick={abrir}>
          Cancelar pedido
        </button>
      </div>
      <DialogoCancelacion
        key={aperturas}
        abierto={abierto}
        pedido={pedido}
        enviando={enviando}
        errores={errores}
        onCancelarPedido={enviar}
        onVolver={cerrar}
      />
    </>
  );
}
