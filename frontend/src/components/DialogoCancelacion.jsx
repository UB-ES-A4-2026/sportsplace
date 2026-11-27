import { dialogoCancelar, motivosDeCancelacion, validarCancelacion } from '../pedidos/cancelar.js';
import DialogoMotivo from './DialogoMotivo.jsx';

// US-39: diálogo «Cancelar el pedido» sobre el diálogo común de motivo (DialogoMotivo). El desplegable muestra
// solo los motivos de mi papel (CA2) y el texto avisa de que las unidades vuelven si el pedido está aceptado.
// - `onCancelarPedido({ motivoCodigo, motivoTexto })` hace la petición; los errores del servidor, por `errores`.
// - `onVolver` cierra sin cambios. Mientras `enviando`, «Cancelando…» y no se puede cerrar (CA3).
export default function DialogoCancelacion({ abierto, pedido, enviando = false, errores, onCancelarPedido, onVolver }) {
  const textos = dialogoCancelar(pedido);
  return (
    <DialogoMotivo
      abierto={abierto}
      className="dialogo-cancelacion"
      titulo={textos.titulo}
      texto={textos.texto}
      motivos={motivosDeCancelacion(pedido.mi_papel)}
      validar={(valores) => validarCancelacion(valores, pedido.mi_papel)}
      textoConfirmar={textos.textoConfirmar}
      textoEnviando={textos.textoEnviando}
      textoVolver={textos.textoVolver}
      enviando={enviando}
      errores={errores}
      onEnviar={onCancelarPedido}
      onCancelar={onVolver}
    />
  );
}
