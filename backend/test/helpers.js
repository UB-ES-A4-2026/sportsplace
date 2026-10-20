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
