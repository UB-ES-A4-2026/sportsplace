import { Link } from 'react-router';
import { textoDelMotivo } from '../pedidos/acciones.js';

// US-108 punto 7 y US-79 CA4, CA5 y CA11: sección «Motivo» de /pedidos/:id cuando el pedido está rechazado
// o cancelado. El texto se pinta como texto plano (React escapa el HTML).
// - Rechazo automático por falta de unidades (US-34 CA5): motivo «Se han agotado las unidades del anuncio» y la
//   frase de que se ha rechazado automáticamente.
// - El comprador de un pedido rechazado ve además «Buscar material parecido» → /catalogo (US-79 CA5).
export default function SeccionMotivo({ pedido }) {
  if (!['rechazado', 'cancelado'].includes(pedido?.estado) || !pedido.motivo_codigo) return null;
  const automatico = pedido.cerrado_por === 'sistema';

  return (
    <section className="pedido-motivo" aria-labelledby="titulo-motivo">
      <h2 id="titulo-motivo">Motivo</h2>
      <p className="pedido-motivo-codigo">{textoDelMotivo(pedido.motivo_codigo) ?? pedido.motivo_codigo}</p>
      {pedido.motivo_texto && <p className="pedido-motivo-texto">{pedido.motivo_texto}</p>}
      {automatico && (
        <p>El pedido se ha rechazado automáticamente porque ya no quedan unidades suficientes.</p>
      )}
      {pedido.estado === 'rechazado' && pedido.mi_papel === 'comprador' && (
        <Link to="/catalogo" className="boton-enlace boton-enlace-secundario">Buscar material parecido</Link>
      )}
    </section>
  );
}
