import { Mail, Phone } from 'lucide-react';
import { TEXTOS_VISTA } from '../pedidos/vistas.js';

// US-108 CA7: email y teléfono del otro centro (solo en aceptado y recibido), como enlaces `mailto:` y `tel:`: dos
// botones grandes (azul el email y verde el teléfono) a la derecha de la frase del panel, como en los mockups de Lucía.
// El email y el teléfono se escriben tal cual los manda la API; «Email:» y «Teléfono:» solo los oye el lector.
// Uso: <ContactoPedido contacto={datosDelOtroCentro(pedido).contacto} />
export default function ContactoPedido({ contacto }) {
  return (
    <div className="pedido-contacto">
      {contacto.email && (
        <a href={contacto.enlaceEmail} className="s2-boton pedido-contacto-boton pedido-contacto-email">
          <Mail size={20} strokeWidth={2.4} aria-hidden="true" />
          <span className="s2-solo-lectores">{TEXTOS_VISTA.email} </span>{contacto.email}
        </a>
      )}
      {contacto.telefono && (
        <a href={contacto.enlaceTelefono} className="s2-boton pedido-contacto-boton pedido-contacto-telefono">
          <Phone size={20} strokeWidth={2.4} aria-hidden="true" />
          <span className="s2-solo-lectores">{TEXTOS_VISTA.telefono} </span>{contacto.telefono}
        </a>
      )}
    </div>
  );
}
