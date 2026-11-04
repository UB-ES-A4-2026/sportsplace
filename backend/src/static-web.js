import { accessSync, constants, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import express from 'express';

// Solo se activa en el despliegue: desarrollo sigue utilizando el proxy de Vite.
export function staticWeb(webRoot) {
  let root;
  let index;
  try {
    if (typeof webRoot !== 'string' || !webRoot.trim()) throw new Error();
    root = resolve(webRoot);
    index = resolve(root, 'index.html');
    if (!statSync(root).isDirectory() || !statSync(index).isFile()) throw new Error();
    accessSync(index, constants.R_OK);
  } catch {
    throw new Error('STATIC_WEB_DIR debe apuntar a una carpeta con index.html legible.');
  }

  const serveFiles = express.static(root, {
    dotfiles: 'ignore',
    index: false,
    redirect: false,
  });

  return (request, response, next) => {
    if (!['GET', 'HEAD'].includes(request.method)) return next();

    let path;
    try {
      path = decodeURIComponent(request.path);
    } catch {
      return next();
    }

    // Reservar la API incluso si el build contiene un archivo con el mismo nombre.
    // No permitir dotfiles, segmentos de ascenso ni separadores de Windows.
    if (/^\/(api|health)(\/|$)/i.test(path)
        || path.includes('\\') || path.includes('\0')
        || path.split('/').some((segment) => segment.startsWith('.'))) return next();

    serveFiles(request, response, (error) => {
      if (error) return next(error);
      // Las navegaciones SPA reciben index; los assets ausentes conservan su 404.
      if (extname(path) || /^\/assets(\/|$)/i.test(path) || !request.accepts('html')) return next();
      response.sendFile(index, (sendError) => {
        if (sendError) next(sendError);
      });
    });
  };
}
