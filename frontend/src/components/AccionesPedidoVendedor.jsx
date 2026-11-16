import { useState } from 'react';
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
import DialogoConfirmacion from './DialogoConfirmacion.jsx';
import DialogoRechazo from './DialogoRechazo.jsx';

// T33-5: botones del vendedor en la barra de acciones de /pedidos/:id (US-108 punto 9).
// - US-33: «Aceptar» → diálogo «¿Aceptar el pedido?» → «Aceptando…» → aviso «Pedido aceptado.».
// - US-79: «Rechazar» → diálogo con el motivo → «Rechazando…» → aviso «Pedido rechazado.».
// - US-34: si faltan unidades, aviso amarillo y «Aceptar» deshabilitado.
// Sin `aceptar` ni `rechazar` en `pedido.acciones` no se pinta nada (US-108 CA9).
// Props, como los botones de acciones de los anuncios (BotonesReservaEntrega):
// - `onActualizado(pedido)`: el pedido que devuelve la API, para refrescar estado, contacto, motivo e historial.
// - `onAviso({ tipo: 'exito', texto })`.
// - `onFallo(resultado)`: { mensaje, recargar } (409: aviso rojo con el `message` y recargar el pedido, US-33 CA9),
//   { noEncontrado } (404) o { mensaje } (resto). El diálogo se cierra sin cambios, salvo los errores de campo
//   del rechazo, que se quedan en el diálogo.
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
      cerrar();
      onFallo?.(resultado);
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
      {botones.avisoSinStock && <p className="pedido-aviso-stock" role="status">{botones.avisoSinStock}</p>}
      <div className="pedido-acciones-vendedor">
        {botones.aceptar && (
          <button type="button" disabled={botones.aceptarDeshabilitado || enviando} onClick={() => setDialogo('aceptar')}>
            Aceptar
          </button>
        )}
        {botones.rechazar && (
          <button type="button" className="boton-secundario" disabled={enviando} onClick={() => { setAperturasRechazo((n) => n + 1); setDialogo('rechazar'); }}>
            Rechazar
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
