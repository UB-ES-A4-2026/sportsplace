import { PROVINCIA_POR_PREFIJO, PROVINCIAS } from './provincias.js';

const CODIGO_POSTAL = /^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$/;
const TELEFONO = /^[6-9][0-9]{8}$/;
const ERROR_CP = 'Introduce un código postal español de 5 cifras.';
const ERROR_TELEFONO = 'Introduce un teléfono español de 9 cifras.';
const ERROR_PROVINCIA = 'Elige una provincia.';

// Web y API instalan Zod en sus paquetes y comparten las mismas reglas.
export function crearEsquemaDireccionEnvio(z) {
  const texto = (min, max, error) => z.string({ error }).trim().refine((valor) => {
    const longitud = [...valor].length;
    return longitud >= min && longitud <= max && !valor.includes('\0');
  }, { error });
  const opcional = (max) => texto(0, max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((valor) => valor || null);

  const campos = z.object({
    destinatario: texto(2, 100, 'Indica la persona de contacto (entre 2 y 100 caracteres).'),
    calle_numero: texto(5, 150, 'Indica la calle y el número (entre 5 y 150 caracteres).'),
    piso_puerta: opcional(50),
    codigo_postal: z.string({ error: ERROR_CP }).trim().regex(CODIGO_POSTAL, { error: ERROR_CP }),
    localidad: texto(2, 120, 'Indica la localidad (entre 2 y 120 caracteres).'),
    provincia: z.string({ error: ERROR_PROVINCIA }).trim()
      .refine((valor) => PROVINCIAS.includes(valor), { error: ERROR_PROVINCIA }),
    telefono_contacto: z.string({ error: ERROR_TELEFONO })
      .transform((valor) => valor.replace(/\s/g, ''))
      .refine((valor) => TELEFONO.test(valor), { error: ERROR_TELEFONO }),
    indicaciones: opcional(300),
  }).refine(({ codigo_postal: cp, provincia }) => (
    !CODIGO_POSTAL.test(cp) || !PROVINCIAS.includes(provincia)
    || PROVINCIA_POR_PREFIJO[cp.slice(0, 2)] === provincia
  ), {
    path: ['codigo_postal'],
    error: 'El código postal no corresponde a la provincia elegida.',
  });

  return z.preprocess(
    (valor) => (valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}),
    campos,
  );
}
