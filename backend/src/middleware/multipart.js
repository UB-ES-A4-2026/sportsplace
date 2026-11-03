import busboy from 'busboy';
import { ApiError } from '../errors.js';

// US-13 CA12 y CA16: recepción de `POST /api/anuncios` en multipart/form-data.
export const LIMITE_PETICION_MULTIPART = 41_943_040; // 40 MB en total
export const LIMITE_BYTES_FOTO = 5_242_880; // 5 MB por foto
// La parte `datos` tiene el mismo límite que un cuerpo JSON del resto de rutas.
const LIMITE_DATOS = 100 * 1024;

export function peticionDemasiadoGrande() {
  return new ApiError(413, 'PETICION_DEMASIADO_GRANDE', 'La petición es demasiado grande.');
}

const sinPartes = () => ({ datos: undefined, fotos: [], fotoPrincipal: undefined });

// Lee las partes `datos`, `fotos` y `foto_principal` sin validarlas (eso lo hace
// validarPublicacion, que junta todos los errores). Cada foto se guarda en
// memoria hasta 5 MB; si pasa de ahí solo se anota que es demasiado grande.
// Un cuerpo que no es multipart, o multipart mal formado, cuenta como vacío.
// Las demás partes se ignoran.
export function leerPublicacion(request, { limite = LIMITE_PETICION_MULTIPART } = {}) {
  return new Promise((resolve, reject) => {
    if (!request.is('multipart/form-data')) {
      resolve(sinPartes());
      return;
    }

    // Se corta la conexión al responder 413 para no leer el resto del cuerpo.
    const rechazarPorTamano = () => {
      request.res?.set('Connection', 'close');
      reject(peticionDemasiadoGrande());
    };
    if (Number(request.get('Content-Length')) > limite) {
      rechazarPorTamano();
      return;
    }

    let parser;
    try {
      parser = busboy({
        headers: request.headers,
        // busboy marca el límite al llegar a fileSize, no al pasarlo: con un
        // byte más se distingue la foto de 5.242.880 bytes (válida) de la de 5.242.881.
        limits: { fileSize: LIMITE_BYTES_FOTO + 1, fieldSize: LIMITE_DATOS },
      });
    } catch {
      request.resume();
      request.once('end', () => resolve(sinPartes()));
      return;
    }

    const partes = sinPartes();
    let terminado = false;
    const terminar = (accion) => {
      if (terminado) return;
      terminado = true;
      accion();
    };

    // Sin Content-Length (envío por trozos) el total se cuenta mientras llega.
    let recibidos = 0;
    request.on('data', (trozo) => {
      recibidos += trozo.length;
      if (recibidos > limite) {
        request.unpipe(parser);
        request.pause();
        terminar(rechazarPorTamano);
      }
    });

    parser.on('field', (nombre, valor, info) => {
      if (nombre === 'datos') partes.datos = info.valueTruncated ? null : valor;
      if (nombre === 'foto_principal') partes.fotoPrincipal = valor;
    });

    parser.on('file', (nombre, stream) => {
      if (nombre !== 'fotos') {
        stream.resume();
        return;
      }
      const foto = { trozos: [], demasiadoGrande: false };
      partes.fotos.push(foto);
      stream.on('data', (trozo) => foto.trozos.push(trozo));
      stream.on('limit', () => { foto.demasiadoGrande = true; });
      stream.on('end', () => {
        foto.contenido = Buffer.concat(foto.trozos);
        if (foto.contenido.length > LIMITE_BYTES_FOTO) foto.demasiadoGrande = true;
        delete foto.trozos;
      });
    });

    parser.on('close', () => terminar(() => resolve(partes)));
    parser.on('error', () => {
      request.unpipe(parser);
      request.resume();
      terminar(() => resolve(sinPartes()));
    });

    request.pipe(parser);
  });
}
