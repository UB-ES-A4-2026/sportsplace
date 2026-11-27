import { MOTIVOS_RECHAZO, validarRechazo } from '../pedidos/acciones.js';
import DialogoMotivo from './DialogoMotivo.jsx';

// US-79: diálogo «Rechazar el pedido» con el motivo (obligatorio) y la explicación (obligatoria solo con
// «Otro motivo»), sobre el diálogo común de motivo (DialogoMotivo). Valida al pulsar «Rechazar pedido» y no envía
// nada si hay errores (E2E-2).
// - `onRechazar({ motivoCodigo, motivoTexto })` hace la petición; los errores del servidor llegan por `errores`.
// - Mientras `enviando`, «Rechazando…» y no se puede cerrar. Quien lo usa le cambia la `key` al abrirlo, para
//   que empiece vacío cada vez.
export default function DialogoRechazo({ abierto, comprador, enviando = false, errores, onRechazar, onCancelar }) {
  return (
    <DialogoMotivo
      abierto={abierto}
      titulo="Rechazar el pedido"
      texto={`${comprador} verá el motivo.`}
      motivos={MOTIVOS_RECHAZO}
      validar={validarRechazo}
      textoConfirmar="Rechazar pedido"
      textoEnviando="Rechazando…"
      textoVolver="Cancelar"
      enviando={enviando}
      errores={errores}
      onEnviar={onRechazar}
      onCancelar={onCancelar}
    />
  );
}
