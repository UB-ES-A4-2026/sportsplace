import { z } from 'zod';
import { crearEsquemaDireccionEnvio } from '../../../shared/direccion-envio.js';

export { PROVINCIAS } from '../../../shared/provincias.js';

export const esquemaDireccionEnvio = crearEsquemaDireccionEnvio(z);
