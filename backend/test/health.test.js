import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createAppServer } from '../src/app.js';

const commit = '59a5e7ff2abcaa807b86b910af81865b20bc2416';
const basicStatus = { status: 'ok', service: 'sportsplace-api' };

async function start(t, options) {
  const server = createAppServer(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('health and its alias expose only the validated deployment SHA without caching', async (t) => {
  const base = await start(t, { renderGitCommit: commit });
  for (const path of ['/api/health', '/health']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ...basicStatus, commit });
  }
});

test('a hexadecimal SHA is normalized to lowercase', async (t) => {
  const base = await start(t, { renderGitCommit: commit.toUpperCase() });
  const response = await fetch(`${base}/api/health`);
  assert.deepEqual(await response.json(), { ...basicStatus, commit });
});

test('absent or invalid deployment metadata preserves the local health response', async (t) => {
  for (const renderGitCommit of [
    undefined, null, '', '59a5e7f', `${commit}0`, 'g'.repeat(40), ` ${commit}`, `${commit}\n`,
    'postgresql://example:do-not-expose@example.invalid/db', { token: 'do-not-expose' },
  ]) {
    const base = await start(t, { renderGitCommit });
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), basicStatus);
  }
});

test('HEAD health probes preserve GET metadata headers and return no body', async (t) => {
  const base = await start(t, { renderGitCommit: commit });
  for (const path of ['/api/health', '/health']) {
    const response = await fetch(`${base}${path}`, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('content-length'),
      String(Buffer.byteLength(JSON.stringify({ ...basicStatus, commit }))));
    assert.equal(await response.text(), '');
  }
});
