// T13-5 · Archivos de prueba para los E2E de US-13, generados en memoria.
//
// Decidido en la #138: las imágenes grandes no se versionan. Aquí se construye cada
// archivo con una cabecera binaria válida y se rellena hasta el tamaño exacto, para
// pasarlo con `setInputFiles({ name, mimeType, buffer })` sin tocar el disco.
//
// Se distinguen dos cosas que los casos necesitan separar:
//   - el contenido real, que sale de la extensión del nombre (lo que ve la validación
//     por cabecera binaria de T13-2);
//   - el tipo declarado, que es lo que el navegador anuncia en el multipart.
// En E2E-6 los dos no coinciden a propósito: un .txt que se declara como image/jpeg.

// 5.242.880 bytes: el máximo que la especificación acepta por foto.
export const LIMITE_FOTO = 5 * 1024 * 1024;
// 5.242.881 bytes: un solo byte por encima, el primer tamaño que debe rechazarse.
export const UN_BYTE_DE_MAS = LIMITE_FOTO + 1;
// 6 MB: el archivo claramente pasado de tamaño que usa E2E-3.
export const SEIS_MB = 6 * 1024 * 1024;
// Tope de fotos por anuncio (CA de US-13); E2E-4 lo desborda a propósito.
export const MAXIMO_FOTOS = 8;

const TIPOS_POR_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
};

// Firmas de los formatos cuyo tamaño no va dentro de la cabecera.
const FIRMAS = {
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
};

// RIFF (4) + tamaño (4) + WEBP (4). El tamaño se escribe en tiempo de construcción.
const CABECERA_WEBP = 12;

export function tipoDe(nombre) {
  const punto = nombre.lastIndexOf('.');
  const extension = punto === -1 ? '' : nombre.slice(punto).toLowerCase();
  const tipo = TIPOS_POR_EXTENSION[extension];
  if (!tipo) throw new Error(`Extensión sin tipo conocido: ${nombre}`);
  return tipo;
}

// Relleno determinista: el mismo nombre y tamaño dan siempre los mismos bytes, para
// que un fallo se pueda reproducir tal cual.
function rellenar(buffer, desde) {
  for (let i = desde; i < buffer.length; i += 1) buffer[i] = i % 251;
}

function contenido(tipoReal, bytes) {
  if (tipoReal === 'text/plain') {
    const texto = Buffer.from('Esto no es una imagen.\n', 'utf8');
    if (bytes <= texto.length) return texto.subarray(0, bytes);
    const buffer = Buffer.alloc(bytes, 0x20);
    texto.copy(buffer);
    return buffer;
  }

  if (tipoReal === 'image/webp') {
    if (bytes < CABECERA_WEBP) {
      throw new Error(`Un WebP necesita al menos ${CABECERA_WEBP} bytes; pedidos ${bytes}.`);
    }
    const buffer = Buffer.alloc(bytes);
    buffer.write('RIFF', 0, 'latin1');
    buffer.writeUInt32LE(bytes - 8, 4); // tamaño del resto del contenedor
    buffer.write('WEBP', 8, 'latin1');
    rellenar(buffer, CABECERA_WEBP);
    return buffer;
  }

  const firma = FIRMAS[tipoReal];
  if (!firma) throw new Error(`No sé construir un archivo de tipo ${tipoReal}.`);
  if (bytes < firma.length) {
    throw new Error(`Un ${tipoReal} necesita al menos ${firma.length} bytes; pedidos ${bytes}.`);
  }
  const buffer = Buffer.alloc(bytes);
  Buffer.from(firma).copy(buffer);
  rellenar(buffer, firma.length);
  return buffer;
}

/**
 * Archivo listo para `setInputFiles`.
 * @param nombre     nombre con extensión; decide el contenido real.
 * @param bytes      tamaño exacto del resultado.
 * @param declarado  tipo que anuncia el navegador; por defecto, el que toca al nombre.
 */
export function archivo(nombre, bytes, declarado = tipoDe(nombre)) {
  return { name: nombre, mimeType: declarado, buffer: contenido(tipoDe(nombre), bytes) };
}

// Varias fotos válidas y pequeñas, para los casos que solo necesitan llenar la rejilla.
export function relleno(cuantas, { bytes = 50 * 1024, desde = 1 } = {}) {
  return Array.from({ length: cuantas }, (_, i) => archivo(`foto-${desde + i}.jpg`, bytes));
}
