import { once } from 'node:events';
import { createAppServer } from '../src/app.js';

// Arranca la API en un puerto libre con un servicio de autenticación de prueba.
export async function startApi(options) {
  const server = createAppServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

export function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

export const usuarioConfirmado = { id: 'u1', email: 'centro@example.com', email_confirmado: true };
export const sesion = { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 1760000000 };

// US-13: fotos de prueba reconocibles por su cabecera binaria (CA13).
// El PNG es una imagen real de 1×1 px (CA24).
export const fotoPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
export const fotoJpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]);
export const fotoWebp = Buffer.concat([
  Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(28, 2),
]);

// Cuerpo multipart de POST /api/anuncios (US-13 CA12). `datos` se envía tal cual
// si es texto y como JSON si no; cada foto es { contenido, tipo, nombre }.
export function formularioAnuncio({ datos, fotos = [], fotoPrincipal } = {}) {
  const formulario = new FormData();
  if (datos !== undefined) formulario.append('datos', typeof datos === 'string' ? datos : JSON.stringify(datos));
  fotos.forEach(({ contenido, tipo = 'image/jpeg', nombre = 'foto.jpg' }) => {
    formulario.append('fotos', new Blob([contenido], { type: tipo }), nombre);
  });
  if (fotoPrincipal !== undefined) formulario.append('foto_principal', String(fotoPrincipal));
  return formulario;
}
