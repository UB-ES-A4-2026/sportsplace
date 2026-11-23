import { Check, PackageCheck } from 'lucide-react';
import { botonesDelVendedor } from '../pedidos/acciones.js';
import { datosDelOtroCentro, fraseDeSituacion } from '../pedidos/detalle.js';
import { contactoEnElPanel, panelDelVendedor, TEXTOS_VISTA } from '../pedidos/vistas.js';
import AccionesPedidoVendedor from './AccionesPedidoVendedor.jsx';
import ContactoPedido from './ContactoPedido.jsx';
import SeccionMotivo from './SeccionMotivo.jsx';

// Vista del vendedor de /pedidos/:id (imagen de referencia de Lucía): el panel de arriba a la izquierda, del color del
// estado, con la frase de CA5 a la izquierda y lo que toca hacer a la derecha, en la misma fila.
// - Pendiente con acciones: «Rechazar» y «Aceptar» (AccionesPedidoVendedor, con sus diálogos). Si faltan unidades, el
//   aviso de US-34 va bajo la frase y «Aceptar» sale deshabilitado.
// - Aceptado y recibido: los botones de email y teléfono del comprador a la derecha (US-108 CA7).
// - Rechazado o cancelado: la frase y, si lo hay, el motivo debajo (US-79). El resto: solo la frase.
// Los botones van dentro del panel, antes que el resto de la pantalla: el tabulador los alcanza en el orden en que se ven.
export default function PanelPedidoVendedor({ pedido, acciones }) {
  const panel = panelDelVendedor(pedido);
  const frase = fraseDeSituacion(pedido);

  if (panel === 'decidir') {
    const faltan = Boolean(botonesDelVendedor(pedido).avisoSinStock);
    return (
      <section className={`pedido-panel pedido-panel--decidir${faltan ? ' pedido-panel--faltan' : ''}`} aria-labelledby="titulo-panel">
        <h2 id="titulo-panel" className="pedido-panel-titulo">{frase}</h2>
        <AccionesPedidoVendedor pedido={pedido} {...acciones} />
      </section>
    );
  }

  const otro = datosDelOtroCentro(pedido);
  const Icono = { aceptado: Check, recibido: PackageCheck }[panel];
  const conContacto = contactoEnElPanel(pedido);
  return (
    <section className={`pedido-panel${conContacto ? ' pedido-panel--contacto' : ''}`} aria-labelledby="titulo-panel">
      <div className="pedido-panel-textos">
        <h2 id="titulo-panel" className="pedido-panel-titulo">
          {Icono && <Icono size={22} strokeWidth={3} aria-hidden="true" />}
          {frase}
        </h2>
        {conContacto && panel === 'aceptado' && <p className="pedido-panel-texto">{TEXTOS_VISTA.contactar(otro.nombre)}</p>}
      </div>
      {conContacto && <ContactoPedido contacto={otro.contacto} />}
      <SeccionMotivo pedido={pedido} />
    </section>
  );
}
