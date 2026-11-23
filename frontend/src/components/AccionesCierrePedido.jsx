import { useState } from 'react';
import { Check, PackageCheck } from 'lucide-react';
import { ErrorApi } from '../api/cliente.js';
import { marcarPedidoPagado, recibirPedido } from '../api/cierrePedido.js';
import { accionesDeCierre, resultadoDelFallo } from '../pedidos/cierre.js';
import DialogoConfirmacion from './DialogoConfirmacion.jsx';

const PETICION = { marcar_pagado: marcarPedidoPagado, recibir: recibirPedido };
// Aspecto de cada botón (diseño con vida): «Marcar como cobrado» verde oscuro y «He recibido el material» azul.
const ASPECTO = {
  marcar_pagado: { clase: 'pedido-boton-cobrar', Icono: Check },
  recibir: { clase: 'pedido-boton-recibir', Icono: PackageCheck },
};

// T42-2: botones de cierre de /pedidos/:id, según `pedido.acciones` (US-108 CA9).
// - US-80: «Marcar como cobrado» (vendedor) → «¿Has cobrado este pedido?» → «Guardando…» → «Pedido marcado como cobrado.».
// - US-42: «He recibido el material» (comprador) → «¿Confirmas que has recibido el material?» → «Pedido marcado como
//   recibido.». La pantalla pinta cada botón donde toca con `solo`: el de US-80 en su tarjeta de cobro y el de US-42
//   en el seguimiento del comprador, bajo el contacto del vendedor.
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
        {opciones.map((opcion) => {
          const { clase, Icono } = ASPECTO[opcion.accion];
          return (
            <button key={opcion.accion} type="button" className={`s2-boton ${clase}`} disabled={enviando}
              onClick={() => setConfirmando(opcion)}>
              <Icono size={22} strokeWidth={2.8} aria-hidden="true" />
              {opcion.texto}
            </button>
          );
        })}
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
