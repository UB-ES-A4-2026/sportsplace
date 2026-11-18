import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { busquedaDeUrl, leerFiltros } from './filtros.js';

// T21-6: filtros de /catalogo leídos de la URL. La pantalla lo usa una sola vez y pasa el resultado
// a <BarraFiltros>; mientras `corregidos` no sea null, la URL se está corrigiendo y no hay que pedir datos.
export default function useFiltrosCatalogo() {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { filtros, corregidos } = useMemo(() => leerFiltros(parametros), [parametros]);

  // E04 «Base común»: cada cambio se guarda con `push` para que «Atrás» recupere la búsqueda anterior.
  const cambiar = useCallback(
    (nuevos, opciones) => navigate({ pathname, search: busquedaDeUrl(nuevos) }, opciones),
    [navigate, pathname],
  );

  // E04 «Web» y US-22 CA14: un valor escrito a mano que no se acepta se quita con `replace`, sin error.
  useEffect(() => {
    if (corregidos) cambiar(corregidos, { replace: true });
  }, [corregidos, cambiar]);

  return { parametros, filtros, corregidos, cambiar };
}
