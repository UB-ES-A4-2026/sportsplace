// Fotos del anuncio en el formulario (E03, US-13 T13-3): validación de archivos, foto principal y cuerpo multipart.
// Todo son funciones puras sobre `{ fotos, principalId }` para poder probarlas sin navegador:
//   - `fotos`: [{ id, archivo, vista }] en el orden en que se añadieron (CA8). `vista` es la URL de la miniatura.
//   - `principalId`: id de la foto principal, o null si no hay fotos.

export const MAX_FOTOS = 8;
export const MAX_BYTES_FOTO = 5 * 1024 * 1024; // 5.242.880 (CA5)
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const ACEPTAR_FOTOS = TIPOS_FOTO.join(','); // CA1
// CA11: por encima de 10 MB en total se avisa con «Subiendo fotos…».
export const BYTES_SUBIDA_LENTA = 10 * 1024 * 1024;

// Mensajes exactos de la «Tabla de campos» de E03.
export const MENSAJES_FOTOS = {
  tipo: 'Solo se admiten fotos JPG, PNG o WebP.',
  peso: 'Cada foto debe pesar 5 MB como máximo.',
  maximo: 'Puedes añadir 8 fotos como máximo.',
  faltan: 'Añade al menos una foto.',
};

export const AYUDA_FOTOS = 'Entre 1 y 8 fotos JPG, PNG o WebP de 5 MB como máximo. La principal es la que se verá primero.';

export const FOTOS_VACIAS = Object.freeze({ fotos: [], principalId: null });

let contador = 0;
function generarId() {
  contador += 1;
  return globalThis.crypto?.randomUUID?.() ?? `foto-${contador}`;
}

// CA2: tipo MIME y tamaño. El tipo se mira primero: un GIF de 6 MB se rechaza por ser GIF.
export function errorDeArchivo(archivo) {
  if (!TIPOS_FOTO.includes(archivo.type)) return MENSAJES_FOTOS.tipo;
  if (archivo.size > MAX_BYTES_FOTO) return MENSAJES_FOTOS.peso;
  return undefined;
}

// Añade los archivos elegidos (selector o arrastrar y soltar).
// - Los inválidos no se añaden y dan un mensaje «nombre: motivo» (CA2).
// - Si con los válidos se pasaría de 8, entran los primeros hasta llegar a 8 y sale «Puedes añadir 8 fotos como
//   máximo.» (CA3).
// - La primera foto que se añade queda como principal (CA6). Elegir dos veces el mismo archivo añade dos fotos (CA23).
// `nuevoId` y `crearVista` se pueden cambiar en los tests. Devuelve { estado, mensajes, nuevas }.
export function anadirFotos(estado, archivos, { nuevoId = generarId, crearVista = () => null } = {}) {
  const mensajes = [];
  const validos = [];
  for (const archivo of archivos) {
    const error = errorDeArchivo(archivo);
    if (error) mensajes.push(`${archivo.name}: ${error}`);
    else validos.push(archivo);
  }

  const hueco = Math.max(MAX_FOTOS - estado.fotos.length, 0);
  const admitidos = validos.slice(0, hueco);
  if (validos.length > admitidos.length) mensajes.push(MENSAJES_FOTOS.maximo);

  const nuevas = admitidos.map((archivo) => ({ id: nuevoId(), archivo, vista: crearVista(archivo) }));
  return {
    estado: { fotos: [...estado.fotos, ...nuevas], principalId: estado.principalId ?? nuevas[0]?.id ?? null },
    mensajes,
    nuevas,
  };
}

// CA6: la estrella de otra foto la convierte en principal; siempre hay exactamente una si hay fotos.
export function marcarPrincipal(estado, id) {
  if (!estado.fotos.some((foto) => foto.id === id)) return estado;
  return { ...estado, principalId: id };
}

// CA7: la ✕ quita la foto sin confirmar. Si era la principal, pasa a serlo la primera de las restantes.
// Devuelve { estado, quitada } (`quitada` es undefined si el id no existe).
export function quitarFoto(estado, id) {
  const quitada = estado.fotos.find((foto) => foto.id === id);
  if (!quitada) return { estado, quitada };
  const fotos = estado.fotos.filter((foto) => foto.id !== id);
  const principalId = estado.principalId === id ? (fotos[0]?.id ?? null) : estado.principalId;
  return { estado: { fotos, principalId }, quitada };
}

// CA4: con 0 fotos no se envía nada y sale «Añade al menos una foto.» bajo la sección.
export function validarFotos(estado) {
  return estado.fotos.length === 0 ? { fotos: MENSAJES_FOTOS.faltan } : {};
}

// CA12: `foto_principal` es el índice (1..n) de la principal en el orden de las fotos; la principal no se mueve
// al primer lugar (CA8).
export function indicePrincipal(estado) {
  const posicion = estado.fotos.findIndex((foto) => foto.id === estado.principalId);
  return posicion === -1 ? 1 : posicion + 1;
}

export function pesoTotal(estado) {
  return estado.fotos.reduce((suma, foto) => suma + foto.archivo.size, 0);
}

// CA11: ¿hay que mostrar «Subiendo fotos…» durante el envío?
export function subidaLenta(estado) {
  return pesoTotal(estado) > BYTES_SUBIDA_LENTA;
}

// CA12: POST /api/anuncios pasa a multipart/form-data con la parte `datos` (JSON de US-12/US-14), las partes
// `fotos` (1-8 archivos, en orden) y `foto_principal` (índice 1..n, como texto).
export function cuerpoMultipart(datos, estado) {
  const formulario = new FormData();
  formulario.append('datos', JSON.stringify(datos));
  for (const foto of estado.fotos) formulario.append('fotos', foto.archivo, foto.archivo.name);
  formulario.append('foto_principal', String(indicePrincipal(estado)));
  return formulario;
}
