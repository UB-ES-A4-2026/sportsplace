import { z } from 'zod';
import { crearEsquemaDireccionEnvio } from '../../../shared/direccion-envio.js';
import { ApiError } from '../errors.js';
import { MENSAJE_DATOS_INVALIDOS } from './anuncios.js';

const esquemaDireccion = crearEsquemaDireccionEnvio(z);

export function validarEntregaPedido(cuerpo) {
  const { metodo_entrega: metodo, direccion_envio: direccion } = cuerpo ?? {};
  if (metodo === 'recogida') {
    return { metodo_entrega: metodo, direccion_envio: null };
  }
  if (metodo !== 'envio') {
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, {
      metodo_entrega: 'Elige cómo quieres recibir el material.',
    });
  }

  const resultado = esquemaDireccion.safeParse(direccion);
  if (!resultado.success) {
    const details = Object.fromEntries(
      resultado.error.issues.map(({ path, message }) => [`direccion_envio.${path.join('.')}`, message]),
    );
    throw new ApiError(400, 'DATOS_INVALIDOS', MENSAJE_DATOS_INVALIDOS, details);
  }
  return { metodo_entrega: metodo, direccion_envio: resultado.data };
}
