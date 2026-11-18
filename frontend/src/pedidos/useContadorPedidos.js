import { useEffect, useState } from 'react';
import { contarPedidosPendientes } from '../api/pedidos.js';

// US-109 CA9: pedidos recibidos en `pendiente`. Se vuelve a pedir cada vez que cambia `clave` (la ruta, desde la
// cabecera: «se refresca al cargar cualquier pantalla privada»). Sin sesión no se pide. Si falla, se queda en 0:
// el contador es una ayuda y no debe romper la cabecera.
export default function useContadorPedidos(activo, clave) {
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (!activo) return undefined;
    const control = new AbortController();
    contarPedidosPendientes({ signal: control.signal })
      .then((n) => setPendientes(Number.isInteger(n) ? n : 0))
      .catch((fallo) => {
        if (fallo?.name !== 'AbortError') setPendientes(0);
      });
    return () => control.abort();
  }, [activo, clave]);

  return activo ? pendientes : 0;
}
