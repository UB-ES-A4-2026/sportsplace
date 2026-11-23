import { Mail, Phone } from 'lucide-react';
import { TEXTOS_VISTA } from '../pedidos/vistas.js';

// US-108 CA7: email y teléfono del otro centro (solo en aceptado y recibido), como enlaces `mailto:` y `tel:`.
// - Por defecto, dos botones grandes (azul el email y verde el teléfono), como en los mockups de Lucía.
// - `enLinea`: dos enlaces en una línea, para la tarjeta «Comprador» del vendedor con el pedido recibido.
// El email y el teléfono se escriben tal cual los manda la API; «Email:» y «Teléfono:» solo los oye el lector.
// Uso: <ContactoPedido contacto={datosDelOtroCentro(pedido).contacto} />
export default function ContactoPedido({ contacto, enLinea = false }) {
  const email = contacto.email && (
    <a href={contacto.enlaceEmail} className={enLinea ? undefined : 's2-boton pedido-contacto-boton pedido-contacto-email'}>
      {!enLinea && <Mail size={20} strokeWidth={2.4} aria-hidden="true" />}
      <span className="s2-solo-lectores">{TEXTOS_VISTA.email} </span>{contacto.email}
    </a>
  );
  const telefono = contacto.telefono && (
    <a href={contacto.enlaceTelefono} className={enLinea ? undefined : 's2-boton pedido-contacto-boton pedido-contacto-telefono'}>
      {!enLinea && <Phone size={20} strokeWidth={2.4} aria-hidden="true" />}
      <span className="s2-solo-lectores">{TEXTOS_VISTA.telefono} </span>{contacto.telefono}
    </a>
  );

  if (enLinea) {
    return (
      <p className="pedido-contacto-en-linea">
        {email}
        {email && telefono && <span aria-hidden="true"> · </span>}
        {telefono}
      </p>
    );
  }
  return <div className="pedido-contacto">{email}{telefono}</div>;
}
