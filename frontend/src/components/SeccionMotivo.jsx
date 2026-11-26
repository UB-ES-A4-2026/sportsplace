import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { textoDelMotivo } from '../pedidos/acciones.js';

// US-108 punto 7 y US-79 CA4, CA5 y CA11: «Motivo» de /pedidos/:id cuando el pedido está rechazado o cancelado. Va
// dentro del panel de la situación (PanelPedidoVendedor y SeguimientoPedido), con un h3 bajo la frase. El texto se
// pinta como texto plano (React escapa el HTML).
// - Rechazo automático por falta de unidades (US-34 CA5): motivo «Se han agotado las unidades del anuncio» y la
//   frase de que se ha rechazado automáticamente.
// - El comprador de un pedido rechazado ve además «Buscar material parecido» → /catalogo (US-79 CA5).
export default function SeccionMotivo({ pedido }) {
  if (!['rechazado', 'cancelado'].includes(pedido?.estado) || !pedido.motivo_codigo) return null;
  const automatico = pedido.cerrado_por === 'sistema';

  return (
    <div className="pedido-motivo-bloque">
      <div className="pedido-motivo-textos">
        <h3 className="pedido-motivo-titulo">Motivo</h3>
        <p className="pedido-motivo-codigo">{textoDelMotivo(pedido.motivo_codigo) ?? pedido.motivo_codigo}</p>
        {pedido.motivo_texto && <p className="pedido-motivo-texto">{pedido.motivo_texto}</p>}
        {automatico && (
          <p className="pedido-motivo-texto">El pedido se ha rechazado automáticamente porque ya no quedan unidades suficientes.</p>
        )}
      </div>
      {pedido.estado === 'rechazado' && pedido.mi_papel === 'comprador' && (
        <Link to="/catalogo" className="s2-boton s2-boton-verde pedido-buscar">
          <Search size={20} strokeWidth={2.6} aria-hidden="true" />
          Buscar material parecido
        </Link>
      )}
    </div>
  );
}
