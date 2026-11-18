import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { conPagina, leerPagina } from './catalogo.js';
import { busquedaDeUrl } from './filtros.js';

// T21-4: página de /catalogo leída de la URL (`pagina`), con el mismo patrón que useBusquedaCatalogo (T21-5) y
// useFiltrosCatalogo (T21-6). Mientras `corregidos` no sea null, la URL se está corrigiendo y no se piden datos.
export default function usePaginaCatalogo() {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { pagina, corregidos } = useMemo(() => leerPagina(parametros), [parametros]);

  const ir = useCallback(
    (nuevos, opciones) => navigate({ pathname, search: busquedaDeUrl(nuevos) }, opciones),
    [navigate, pathname],
  );

  // CA10: `pagina=0`, `-1` o `abc` escritos a mano se quitan con `replace`, sin error.
  useEffect(() => {
    if (corregidos) ir(corregidos, { replace: true });
  }, [corregidos, ir]);

  // CA9: «Anterior» y «Siguiente» crean una entrada en el historial, para que «Atrás» vuelva a la página anterior.
  const irAPagina = useCallback((numero) => ir(conPagina(parametros, numero)), [parametros, ir]);

  // CA10: una página mayor que la última se sustituye por la última sin añadir una entrada al historial.
  const corregirPagina = useCallback(
    (numero) => ir(conPagina(parametros, numero), { replace: true }),
    [parametros, ir],
  );

  return { pagina, corregidos, irAPagina, corregirPagina };
}
