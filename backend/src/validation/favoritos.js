import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';
import { validarPagina } from './catalogo.js';

// US-25 CA15: GET /api/favoritos?pagina=N, con la misma regla de página que
// el catálogo (US-96 CA17). Los demás parámetros se ignoran.
export function validarConsultaFavoritos(query = {}) {
  const pagina = validarPagina(query.pagina);
  if (pagina.error) {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, { pagina: pagina.error });
  }
  return { pagina: pagina.valor };
}
