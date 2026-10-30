import { useCallback, useEffect, useMemo, useState } from 'react';
import { obtenerMiCentro } from '../api/centros.js';
import { useAuth } from '../auth/useAuth.js';
import { CentroContexto } from './contexto.js';

// US-07: carga el centro de la sesión (GET /api/centros/mio) para el menú de la cabecera y /perfil.
// Al guardar el perfil, `actualizarCentro` cambia el nombre del menú sin recargar la página (CA14).
export default function CentroProvider({ children }) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? null;
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState(null);

  // Cada carga se identifica por usuario + intento: al cambiar de sesión no se muestra el centro anterior.
  const clave = usuarioId ? `${usuarioId}#${intento}` : null;

  useEffect(() => {
    if (!clave) return undefined;
    const control = new AbortController();
    obtenerMiCentro({ signal: control.signal })
      .then((centro) => setResultado({ clave, centro }))
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return;
        setResultado({ clave, error: true });
      });
    return () => control.abort();
  }, [clave]);

  const actual = clave && resultado?.clave === clave ? resultado : null;
  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  const actualizarCentro = useCallback((centro) => setResultado({ clave, centro }), [clave]);

  const valor = useMemo(() => ({
    centro: actual?.centro ?? null,
    cargando: Boolean(clave) && !actual,
    error: Boolean(actual?.error),
    recargar,
    actualizarCentro,
  }), [actual, clave, recargar, actualizarCentro]);

  return <CentroContexto.Provider value={valor}>{children}</CentroContexto.Provider>;
}
