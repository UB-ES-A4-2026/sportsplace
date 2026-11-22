import { useState } from 'react';
import { ErrorApi } from '../api/cliente.js';
import { marcarPedidoPagado, recibirPedido } from '../api/cierrePedido.js';
import { accionesDeCierre, resultadoDelFallo } from '../pedidos/cierre.js';
import DialogoConfirmacion from './DialogoConfirmacion.jsx';

const PETICION = { marcar_pagado: marcarPedidoPagado, recibir: recibirPedido };

// T42-2: botones de cierre de /pedidos/:id, según `pedido.acciones` (US-108 CA9).
// - US-80: «Marcar como cobrado» (vendedor) → «¿Has cobrado este pedido?» → «Guardando…» → «Pedido marcado como cobrado.».
// - US-42: «He recibido el material» (comprador) → «¿Confirmas que has recibido el material?» → «Pedido marcado como
//   recibido.». Va al final de la sección «Entrega»: la pantalla puede pintar cada botón donde toque con `solo`.
// Props, como AccionesPedidoVendedor (US-33):
// - `onActualizado(pedido)`: el pedido que devuelve la API (etiqueta «Pagado», estado «Recibido», historial).
// - `onAviso({ tipo: 'exito', texto })`.
// - `onFallo(resultado)`: { mensaje, recargar } (409: `message` de la API y recargar), { noEncontrado } o { mensaje }.
// - `solo`: 'marcar_pagado' o 'recibir' para pintar solo uno de los dos botones.
// Uso en /pedidos/:id: <AccionesCierrePedido pedido={pedido} onActualizado={setPedido} onAviso={setAviso} onFallo={mostrarFallo} />
export default function AccionesCierrePedido({ pedido, solo, onActualizado, onAviso, onFallo }) {
  const [confirmando, setConfirmando] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const opciones = accionesDeCierre(pedido).filter((opcion) => !solo || opcion.accion === solo);

  if (opciones.length === 0) return null;

  async function ejecutar(opcion) {
    if (enviando) return;
    setEnviando(true);
    let actualizado;
    try {
      actualizado = await PETICION[opcion.accion](pedido.id);
    } catch (fallo) {
      if (!(fallo instanceof ErrorApi)) throw fallo;
      setEnviando(false);
      setConfirmando(null);
      onFallo?.(resultadoDelFallo(fallo));
      return;
    }
    setEnviando(false);
    setConfirmando(null);
    onActualizado?.(actualizado);
    onAviso?.({ tipo: 'exito', texto: opcion.aviso });
  }

  const textos = confirmando ? confirmando.dialogo(pedido) : {};

  return (
    <>
      <div className="pedido-acciones-cierre">
        {opciones.map((opcion) => (
          <button key={opcion.accion} type="button" disabled={enviando} onClick={() => setConfirmando(opcion)}>
            {opcion.texto}
          </button>
        ))}
      </div>
      <DialogoConfirmacion
        abierto={confirmando !== null}
        titulo={textos.titulo}
        texto={textos.texto}
        textoConfirmar={textos.textoConfirmar}
        textoEnviando={textos.textoEnviando}
        enviando={enviando}
        onConfirmar={() => ejecutar(confirmando)}
        onCancelar={() => setConfirmando(null)}
      />
    </>
  );
}
