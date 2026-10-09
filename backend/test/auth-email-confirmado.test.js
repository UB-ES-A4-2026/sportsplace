import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { errorHandler } from '../src/errors.js';
import { requireAuth, requireEmailConfirmado } from '../src/middleware/auth.js';
import { postJson, usuarioConfirmado } from './helpers.js';

// US-02: hasta confirmar el email no puedo publicar anuncios ni hacer pedidos.
// Todavía no existen esas rutas (sprints siguientes), así que se prueba el
// middleware sobre rutas de ejemplo con la misma protección que tendrán.
const usuarios = {
  'token-confirmado': usuarioConfirmado,
  'token-sin-confirmar': { id: 'u2', email: 'nuevo@example.com', email_confirmado: false },
};
const fakeAuth = { getUser: async (token) => usuarios[token] ?? null };

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.set('auth', fakeAuth);
  app.post('/anuncios', requireAuth, requireEmailConfirmado, (request, response) => response.status(201).json({}));
  app.post('/pedidos', requireAuth, requireEmailConfirmado, (request, response) => response.status(201).json({}));
  app.use(errorHandler);
  server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

for (const ruta of ['/anuncios', '/pedidos']) {
  test(`US-02: sin confirmar el email no puedo usar ${ruta}`, async () => {
    const response = await postJson(`${baseUrl}${ruta}`, {}, { Authorization: 'Bearer token-sin-confirmar' });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'EMAIL_NO_CONFIRMADO');
  });

  test(`US-02: con el email confirmado puedo usar ${ruta}`, async () => {
    const response = await postJson(`${baseUrl}${ruta}`, {}, { Authorization: 'Bearer token-confirmado' });

    assert.equal(response.status, 201);
  });

  test(`US-02: sin sesión ${ruta} pide entrar antes que confirmar`, async () => {
    const response = await postJson(`${baseUrl}${ruta}`, {});

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'NO_AUTENTICADO');
  });
}
