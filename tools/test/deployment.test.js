import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForDeployment } from '../lib/wait-for-deployment.js';
import { dispatchRenderSmoke } from '../lib/dispatch-render-smoke.js';

const commit = 'a'.repeat(40);
const previousCommit = 'b'.repeat(40);
const url = 'https://sportsplace-pruebas.onrender.com';
const health = (value) => Response.json({ status: 'ok', service: 'sportsplace-api', commit: value });

function polling(responses, options = {}) {
  let elapsed = 0;
  let calls = 0;
  return {
    run: () => waitForDeployment({
      url, commit, timeoutMs: 50, intervalMs: 10, report: () => {},
      now: () => elapsed,
      sleep: async (duration) => { elapsed += duration; },
      fetchImpl: async (target, request) => {
        assert.equal(target.href, `${url}/api/health`);
        assert.equal(request.redirect, 'manual');
        assert.equal(request.headers['Cache-Control'], 'no-cache');
        const response = responses[Math.min(calls++, responses.length - 1)];
        if (response instanceof Error) throw response;
        return response.clone();
      },
      ...options,
    }),
    calls: () => calls,
  };
}

test('no acepta un servicio sano con el commit anterior antes de publicar el esperado', async () => {
  const probe = polling([health(previousCommit), health(commit)]);
  assert.equal(await probe.run(), commit);
  assert.equal(probe.calls(), 2);
});

test('el arranque en frío admite errores de red, 502, HTML y health sin versión', async () => {
  const probe = polling([
    new Error('cold start'), new Response('', { status: 502 }),
    new Response('<html>starting</html>'), Response.json({ status: 'ok', service: 'sportsplace-api' }),
    health(commit),
  ]);
  assert.equal(await probe.run(), commit);
  assert.equal(probe.calls(), 5);
});

test('commit incorrecto, posterior, ausente o sin status/service correctos agotan el plazo', async () => {
  for (const response of [health(previousCommit), health('c'.repeat(40)),
    Response.json({ status: 'ok', service: 'sportsplace-api' }),
    Response.json({ status: 'ok', service: 'another-api', commit }),
    Response.json({ status: 'error', service: 'sportsplace-api', commit }),
    health(`${commit}\n`), new Response('', { status: 302 }),
  ]) {
    const probe = polling([response]);
    await assert.rejects(probe.run(), /no sirvió.*dentro del plazo/);
    assert.equal(probe.calls(), 5);
  }
});

test('rechaza SHA abreviado y URLs con credenciales o parámetros antes de acceder a la red', async () => {
  for (const options of [{ commit: 'abcdef0' }, { commit: `${commit}\n` },
    { url: 'https://user:secret@example.test' }, { url: `${url}/?token=secret` },
    { url: `${url}/api/health` }, { timeoutMs: 0 }, { intervalMs: -1 },
  ]) {
    const probe = polling([health(commit)], options);
    await assert.rejects(probe.run());
    assert.equal(probe.calls(), 0);
  }
});

test('las peticiones colgadas tienen un límite y el error final no expone su contenido', async () => {
  let elapsed = 0;
  await assert.rejects(waitForDeployment({
    url, commit, timeoutMs: 5, requestTimeoutMs: 2, intervalMs: 1,
    now: () => elapsed, report: () => {},
    sleep: async (duration) => { elapsed += duration; },
    fetchImpl: async (_url, { signal }) => {
      // Un listener real prueba que AbortSignal limita la conexión, sin esperar el timeout de producción.
      await new Promise((resolve, reject) => {
        const keepAlive = setTimeout(resolve, 100);
        signal.addEventListener('abort', () => {
          clearTimeout(keepAlive);
          reject(new Error('detalle remoto que no debe mostrarse'));
        }, { once: true });
      });
    },
  }), (error) => /dentro del plazo/.test(error.message) && !error.message.includes('detalle remoto'));
});

test('el dispatcher manda el SHA de dev a una ref diferente y sin credenciales en el body', async () => {
  for (const dispatchStatus of [200, 204]) {
    const calls = [];
    await dispatchRenderSmoke({
      repository: 'UB-ES-A4-2026/sportsplace', commit,
      runnerRef: 'chore/T12-6-smoke-render-automatico', token: 'temporary-test-token',
      fetchImpl: async (endpoint, options) => {
        calls.push({ endpoint, options });
        return calls.length === 1 ? Response.json({ object: { sha: previousCommit } })
          : new Response(null, { status: dispatchStatus });
      },
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].options.body), {
      ref: 'chore/T12-6-smoke-render-automatico', inputs: { expected_sha: commit },
    });
    assert.ok(!calls[1].options.body.includes('temporary-test-token'));
  }
});

test('impide un smoke sobre el propio SHA que Render espera y falla si GitHub lo rechaza', async () => {
  for (const [refSha, dispatchStatus] of [[commit, 204], [previousCommit, 403]]) {
    let calls = 0;
    await assert.rejects(dispatchRenderSmoke({
      repository: 'UB-ES-A4-2026/sportsplace', commit,
      runnerRef: 'chore/T12-6-smoke-render-automatico', token: 'temporary-test-token',
      fetchImpl: async () => {
        calls++;
        return calls === 1 ? Response.json({ object: { sha: refSha } })
          : new Response(null, { status: dispatchStatus });
      },
    }));
    assert.equal(calls, refSha === commit ? 1 : 2);
  }
});
