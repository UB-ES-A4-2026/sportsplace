import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createAppServer } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('the canonical health endpoint returns the API status', async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok', service: 'sportsplace-api' });
});

test('the health probe alias has the same response', async () => {
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'sportsplace-api' });
});

test('unknown routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NO_ENCONTRADO', message: 'Recurso no encontrado.' },
  });
});

test('unsupported methods return 405 and advertise GET', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { method: 'POST' });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(await response.json(), {
    error: { code: 'METODO_NO_PERMITIDO', message: 'Método no permitido.' },
  });
});

test('invalid JSON bodies return the common error format', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email":',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'JSON_INVALIDO', message: 'El cuerpo de la petición no es un JSON válido.' },
  });
});
