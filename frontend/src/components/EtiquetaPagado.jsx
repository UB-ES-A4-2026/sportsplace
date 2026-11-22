import { estaPagado } from '../pedidos/cierre.js';

// US-80 CA2, CA3 y CA9: etiqueta verde oscuro «Pagado» junto a la etiqueta de estado, en /pedidos/:id y en cada
// fila de /pedidos, para los dos centros. Sin `pagado_en`, no se pinta nada.
export default function EtiquetaPagado({ pedido }) {
  if (!estaPagado(pedido)) return null;
  return <span className="etiqueta etiqueta-pagado">Pagado</span>;
}
