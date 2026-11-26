import { Banknote } from 'lucide-react';
import { estaPagado } from '../pedidos/cierre.js';

// US-80 CA2, CA3 y CA9: etiqueta verde oscuro «Pagado» junto a la etiqueta de estado de /pedidos/:id, para los dos
// centros, con un billete decorativo. Sin `pagado_en`, no se pinta nada.
export default function EtiquetaPagado({ pedido }) {
  if (!estaPagado(pedido)) return null;
  return (
    <span className="etiqueta etiqueta-pagado">
      <Banknote size={16} strokeWidth={2.6} aria-hidden="true" />
      Pagado
    </span>
  );
}
