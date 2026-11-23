import { Check, PackageCheck } from 'lucide-react';
import { datosDelOtroCentro, fraseDeSituacion } from '../pedidos/detalle.js';
import { cifrasDelPedido, lugarDelContacto, panelDelVendedor, TEXTOS_VISTA } from '../pedidos/vistas.js';
import AccionesPedidoVendedor from './AccionesPedidoVendedor.jsx';
import ContactoPedido from './ContactoPedido.jsx';
import SeccionMotivo from './SeccionMotivo.jsx';

// Vista del vendedor de /pedidos/:id («PedidoRecibido» de Lucía): el panel de arriba a la izquierda, del color del estado.
// - Pendiente con acciones: «¿Aceptas este pedido?», la frase de CA5, las tres cifras de US-34 y «Rechazar» / «Aceptar»
//   (AccionesPedidoVendedor, con el aviso amarillo de US-34 y sus diálogos).
// - Aceptado: la frase y los botones de email y teléfono del comprador (US-108 CA7).
// - Recibido, rechazado o cancelado: la frase y, si lo hay, el motivo (US-79). El resto: solo la frase.
// Los botones van dentro del panel, antes que el resto de la pantalla: el tabulador los alcanza en el orden en que se ven.
export default function PanelPedidoVendedor({ pedido, acciones }) {
  const panel = panelDelVendedor(pedido);
  const frase = fraseDeSituacion(pedido);

  if (panel === 'decidir') {
    const cifras = cifrasDelPedido(pedido);
    return (
      <section className="pedido-panel pedido-panel--decidir" aria-labelledby="titulo-panel">
        <div>
          <h2 id="titulo-panel" className="pedido-panel-titulo">{TEXTOS_VISTA.aceptas}</h2>
          <p className="pedido-panel-frase">{frase}</p>
        </div>
        {cifras && (
          <ul className="pedido-cifras" aria-label={TEXTOS_VISTA.unidades}>
            {cifras.map(({ clave, valor, texto, falta }) => (
              <li key={clave} className={falta ? 'pedido-cifra pedido-cifra--falta' : 'pedido-cifra'}>
                {/* «—» (no te llegan) no se lee: el texto de debajo ya lo dice. */}
                <span className="pedido-cifra-valor" aria-hidden={valor === '—' || undefined}>{valor}</span>
                <span className="pedido-cifra-texto">{texto}</span>
              </li>
            ))}
          </ul>
        )}
        <AccionesPedidoVendedor pedido={pedido} {...acciones} />
      </section>
    );
  }

  const otro = datosDelOtroCentro(pedido);
  const Icono = { aceptado: Check, recibido: PackageCheck }[panel];
  return (
    <section className="pedido-panel" aria-labelledby="titulo-panel">
      <h2 id="titulo-panel" className="pedido-panel-titulo">
        {Icono && <Icono size={26} strokeWidth={3} aria-hidden="true" />}
        {frase}
      </h2>
      {lugarDelContacto(pedido) === 'panel' && (
        <>
          <p className="pedido-panel-texto">{TEXTOS_VISTA.contactar(otro.nombre)}</p>
          <ContactoPedido contacto={otro.contacto} />
        </>
      )}
      <SeccionMotivo pedido={pedido} />
    </section>
  );
}
