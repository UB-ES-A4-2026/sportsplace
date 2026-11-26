import { useState } from 'react';
import { Check, TriangleAlert, X } from 'lucide-react';
import { ErrorApi } from '../api/cliente.js';
import { aceptarPedido, rechazarPedido } from '../api/accionesPedido.js';
import {
  AVISO_ACEPTADO,
  AVISO_RECHAZADO,
  botonesDelVendedor,
  cuerpoDelRechazo,
  dialogoAceptar,
  resultadoDelFallo,
} from '../pedidos/acciones.js';
import { TEXTOS_VISTA } from '../pedidos/vistas.js';
import DialogoConfirmacion from './DialogoConfirmacion.jsx';
import DialogoRechazo from './DialogoRechazo.jsx';

// T33-5: botones del vendedor en /pedidos/:id (US-108 punto 9), dentro del panel «¿Aceptas este pedido?» de
// PanelPedidoVendedor: «Rechazar» (borde rojo) y «Aceptar» (verde), grandes y en ese orden, como en el mockup.
// - US-33: «Aceptar» → diálogo «¿Aceptar el pedido?» → «Aceptando…» → aviso «Pedido aceptado.».
// - US-79: «Rechazar» → diálogo con el motivo → «Rechazando…» → aviso «Pedido rechazado.».
// - US-34: si faltan unidades, aviso amarillo y «Aceptar» deshabilitado.
// Sin `aceptar` ni `rechazar` en `pedido.acciones` no se pinta nada (US-108 CA9).
// Props, como los botones de acciones de los anuncios (BotonesReservaEntrega):
// - `onActualizado(pedido)`: el pedido que devuelve la API, para refrescar estado, contacto, motivo e historial.
// - `onAviso({ tipo: 'exito', texto })`.
// - `onFallo(resultado)`: { mensaje, recargar } (409: aviso rojo con el `message` y recargar el pedido, US-33 CA9),
//   { noEncontrado } (404) o { mensaje } (resto). El diálogo se cierra sin cambios, salvo en el rechazo con
//   errores de campo (se quedan bajo su campo) o con la red caída, 500 o 503 (sigue abierto con lo escrito).
// Uso en /pedidos/:id: <AccionesPedidoVendedor pedido={pedido} onActualizado={setPedido} onAviso={setAviso} onFallo={mostrarFallo} />
export default function AccionesPedidoVendedor({ pedido, onActualizado, onAviso, onFallo }) {
  const [dialogo, setDialogo] = useState(null); // 'aceptar' | 'rechazar' | null
  const [enviando, setEnviando] = useState(false);
  const [erroresRechazo, setErroresRechazo] = useState({});
  const [aperturasRechazo, setAperturasRechazo] = useState(0);
  const botones = botonesDelVendedor(pedido);

  if (!botones.aceptar && !botones.rechazar) return null;

  function cerrar() {
    setDialogo(null);
    setErroresRechazo({});
  }

  async function ejecutar(peticion, aviso) {
    if (enviando) return;
    setEnviando(true);
    let actualizado;
    try {
      actualizado = await peticion();
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      setEnviando(false);
      const resultado = resultadoDelFallo(fallo);
      if (resultado.errores) {
        setErroresRechazo(resultado.errores);
        return;
      }
      // Red caída, 500 o 503 al rechazar: el diálogo sigue abierto con el motivo y la explicación escritos.
      if (!(resultado.conservar && dialogo === 'rechazar')) cerrar();
      onFallo?.({ mensaje: resultado.mensaje, recargar: resultado.recargar, noEncontrado: resultado.noEncontrado });
      return;
    }
    setEnviando(false);
    cerrar();
    onActualizado?.(actualizado);
    onAviso?.({ tipo: 'exito', texto: aviso });
  }

  const textosAceptar = dialogoAceptar(pedido);

  return (
    <>
      {botones.avisoSinStock && (
        <p className="pedido-aviso-stock" role="status">
          <TriangleAlert size={20} strokeWidth={2.6} aria-hidden="true" />
          {botones.avisoSinStock}
        </p>
      )}
      <div className="pedido-acciones-vendedor" role="group" aria-label={TEXTOS_VISTA.responder}>
        {botones.rechazar && (
          <button type="button" className="s2-boton s2-boton-peligro pedido-boton-responder" disabled={enviando}
            onClick={() => { setAperturasRechazo((n) => n + 1); setDialogo('rechazar'); }}>
            <X size={22} strokeWidth={3} aria-hidden="true" />
            Rechazar
          </button>
        )}
        {botones.aceptar && (
          <button type="button" className="s2-boton s2-boton-verde pedido-boton-responder"
            disabled={botones.aceptarDeshabilitado || enviando} onClick={() => setDialogo('aceptar')}>
            <Check size={22} strokeWidth={3} aria-hidden="true" />
            Aceptar
          </button>
        )}
      </div>

      <DialogoConfirmacion
        abierto={dialogo === 'aceptar'}
        titulo={textosAceptar.titulo}
        texto={textosAceptar.texto}
        textoConfirmar={textosAceptar.textoConfirmar}
        textoEnviando={textosAceptar.textoEnviando}
        enviando={enviando && dialogo === 'aceptar'}
        onConfirmar={() => ejecutar(() => aceptarPedido(pedido.id), AVISO_ACEPTADO)}
        onCancelar={cerrar}
      />
      <DialogoRechazo
        key={aperturasRechazo}
        abierto={dialogo === 'rechazar'}
        comprador={pedido.comprador.nombre}
        enviando={enviando && dialogo === 'rechazar'}
        errores={erroresRechazo}
        onRechazar={(valores) => ejecutar(() => rechazarPedido(pedido.id, cuerpoDelRechazo(valores)), AVISO_RECHAZADO)}
        onCancelar={cerrar}
      />
    </>
  );
}
