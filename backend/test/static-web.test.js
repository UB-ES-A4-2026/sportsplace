import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp, createAppServer } from '../src/app.js';

const directory = mkdtempSync(join(tmpdir(), 'sportsplace-static-web-'));
const webRoot = join(directory, 'build');
const html = '<!doctype html><html><body>Sportsplace build</body></html>';
let server;
let baseUrl;

before(async () => {
  for (const path of ['', 'assets', 'api', 'health', '.hidden']) {
    mkdirSync(join(webRoot, path), { recursive: true });
  }
  writeFileSync(join(webRoot, 'index.html'), html);
  writeFileSync(join(webRoot, 'assets', 'app.js'), 'console.log("build");');
  writeFileSync(join(webRoot, 'api', 'unknown'), 'This file must not shadow the API.');
  writeFileSync(join(webRoot, 'health', 'unknown'), 'This file must not shadow probes.');
  writeFileSync(join(webRoot, '.env'), 'PRIVATE_FIXTURE');
  writeFileSync(join(webRoot, '.hidden', 'file.txt'), 'PRIVATE_FIXTURE');
  writeFileSync(join(directory, 'outside.txt'), 'PRIVATE_FIXTURE');
  server = createAppServer({ webRoot });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  rmSync(directory, { recursive: true, force: true });
});

test('deployment serves built assets and direct SPA navigations, including HEAD', async () => {
  for (const path of ['/', '/entrar', '/anuncios/nuevo', '/anuncios/123?desde=panel']) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.equal(await response.text(), html);
  }
  const asset = await fetch(`${baseUrl}/assets/app.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), 'console.log("build");');
  const head = await fetch(`${baseUrl}/anuncios/nuevo`, { method: 'HEAD', headers: { Accept: 'text/html' } });
  assert.equal(head.status, 200);
  assert.match(head.headers.get('content-type'), /^text\/html/);
  assert.equal(await head.text(), '');
});

test('static hosting preserves API and probe responses instead of falling back to HTML', async () => {
  for (const path of ['/api/health', '/health']) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok', service: 'sportsplace-api' });
  }
  for (const path of ['/api', '/api/unknown', '/API/unknown', '/health/unknown']) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).error.code, 'NO_ENCONTRADO');
  }
  const method = await fetch(`${baseUrl}/api/health`, { method: 'POST' });
  assert.equal(method.status, 405);
  assert.equal((await method.json()).error.code, 'METODO_NO_PERMITIDO');
});

test('missing assets, non-HTML requests and unsupported methods do not receive the SPA', async () => {
  for (const path of ['/assets/missing.js', '/assets/missing', '/missing.css']) {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'text/html' } });
    assert.equal(response.status, 404, path);
    assert.equal((await response.json()).error.code, 'NO_ENCONTRADO');
  }
  for (const options of [
    { headers: { Accept: 'application/json' } },
    { method: 'POST', headers: { Accept: 'text/html' } },
  ]) {
    const response = await fetch(`${baseUrl}/anuncios/nuevo`, options);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'NO_ENCONTRADO');
  }
});

// node:http conserva los segmentos que fetch normaliza antes de enviar la URL.
function requestRawPath(path) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(baseUrl, { path, headers: { Accept: 'text/html' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('dotfiles and encoded or literal traversal cannot expose files or return the SPA', async () => {
  for (const path of [
    '/.env', '/%2eenv', '/.hidden/file.txt', '/../outside.txt',
    '/assets/%2e%2e/%2e%2e/outside.txt', '/..%5coutside.txt', '/%00', '/%E0%A4%A',
  ]) {
    const response = await requestRawPath(path);
    assert.equal(response.status, 404, path);
    assert.equal(JSON.parse(response.body).error.code, 'NO_ENCONTRADO');
    assert.doesNotMatch(response.body, /PRIVATE_FIXTURE|Sportsplace build/);
  }
});

test('static hosting is optional and invalid build configuration fails before listening', async () => {
  const withoutWeb = createAppServer();
  withoutWeb.listen(0, '127.0.0.1');
  await once(withoutWeb, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${withoutWeb.address().port}/entrar`, {
      headers: { Accept: 'text/html' },
    });
    assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => withoutWeb.close(resolve));
  }
  for (const root of ['', join(directory, 'missing'), join(webRoot, 'index.html'), join(webRoot, 'assets')]) {
    assert.throws(() => createApp({ webRoot: root }), /STATIC_WEB_DIR/);
  }
});
