import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { busquedaDeUrl, conBusqueda, leerBusqueda, mismaBusqueda, sinBusqueda } from './busqueda.js';

// T21-5: búsqueda de /catalogo leída de la URL (`q`). La pantalla (T21-4) lo usa una vez, pasa `q`, `buscar` y
// `quitar` a <CuadroBusqueda> y envía `q` a GET /api/catalogo. Mientras `corregidos` no sea null, la URL se está
// corrigiendo y no hay que pedir datos (igual que useFiltrosCatalogo de T21-6).
export default function useBusquedaCatalogo() {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { q, corregidos } = useMemo(() => leerBusqueda(parametros), [parametros]);

  // E04 «Base común»: cada búsqueda se guarda con `push` para que «Atrás» recupere la anterior.
  const ir = useCallback(
    (nuevos, opciones) => navigate({ pathname, search: busquedaDeUrl(nuevos) }, opciones),
    [navigate, pathname],
  );

  // E04 «Web»: un `q` escrito a mano que no se acepta se quita con `replace`, sin mostrar error.
  useEffect(() => {
    if (corregidos) ir(corregidos, { replace: true });
  }, [corregidos, ir]);

  // CA2-CA6 y CA13. Devuelve el mensaje de error (no se busca) o null.
  const buscar = useCallback((texto) => {
    const { error, parametros: nuevos } = conBusqueda(parametros, texto);
    if (error) return error;
    if (!mismaBusqueda(parametros, nuevos)) ir(nuevos);
    return null;
  }, [parametros, ir]);

  // CA14: la «×» quita la búsqueda y conserva los filtros.
  const quitar = useCallback(() => {
    const nuevos = sinBusqueda(parametros);
    if (!mismaBusqueda(parametros, nuevos)) ir(nuevos);
  }, [parametros, ir]);

  return { q, corregidos, buscar, quitar };
}
