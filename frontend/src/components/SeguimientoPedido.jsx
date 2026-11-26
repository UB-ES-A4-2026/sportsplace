import { Check, Clock, X } from 'lucide-react';
import { datosDelOtroCentro, fraseDeSituacion } from '../pedidos/detalle.js';
import { contactoEnElPanel, pasosDelSeguimiento, puedeRecibir, TEXTOS_VISTA } from '../pedidos/vistas.js';
import AccionesCierrePedido from './AccionesCierrePedido.jsx';
import ContactoPedido from './ContactoPedido.jsx';
import SeccionMotivo from './SeccionMotivo.jsx';

const ICONOS = { hecho: Check, espera: Clock, mal: X };

// Vista del comprador de /pedidos/:id: el panel de arriba a la izquierda es el seguimiento en 3 pasos (Pedido enviado →
// Respuesta del vendedor → Material recibido), con círculos y una barra verde, y debajo la frase de CA5 con lo que toca
// según el estado, como en el panel del vendedor: el email y el teléfono del vendedor a la derecha de la frase (US-108
// CA7) y «He recibido el material» (US-42), o el motivo y «Buscar material parecido» (US-79).
// Los pasos son un <ol> con aria-current="step" en el actual; el estado de cada paso («hecho», «en espera»…) solo lo
// oye el lector de pantalla, dentro del mismo texto del paso (así ningún texto de la pantalla sale dos veces).
export default function SeguimientoPedido({ pedido, acciones }) {
  const otro = datosDelOtroCentro(pedido);
  const conContacto = contactoEnElPanel(pedido);

  return (
    <section className="pedido-panel pedido-seguimiento" aria-labelledby="titulo-seguimiento">
      <h2 id="titulo-seguimiento" className="s2-solo-lectores">{TEXTOS_VISTA.seguimiento}</h2>
      <ol className="pedido-pasos">
        {pasosDelSeguimiento(pedido).map((paso) => {
          const Icono = ICONOS[paso.tipo];
          const clases = ['pedido-paso', `pedido-paso--${paso.tipo}`, paso.tramo && `pedido-tramo--${paso.tramo}`];
          return (
            <li key={paso.numero} className={clases.filter(Boolean).join(' ')} aria-current={paso.actual ? 'step' : undefined}>
              <span className="pedido-paso-circulo" aria-hidden="true">
                {Icono ? <Icono size={24} strokeWidth={3.2} /> : paso.numero}
              </span>
              <span className="pedido-paso-texto">
                {paso.texto}
                <span className="s2-solo-lectores"> ({paso.lector})</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className={`pedido-situacion${conContacto ? ' pedido-situacion--contacto' : ''}`}>
        <p className="pedido-situacion-frase">{fraseDeSituacion(pedido)}</p>
        {conContacto && <ContactoPedido contacto={otro.contacto} />}
        {puedeRecibir(pedido) && (
          <div className="pedido-recibir">
            <p>{TEXTOS_VISTA.recibirPregunta}</p>
            <AccionesCierrePedido pedido={pedido} solo="recibir" {...acciones} />
          </div>
        )}
        <SeccionMotivo pedido={pedido} />
      </div>
    </section>
  );
}
