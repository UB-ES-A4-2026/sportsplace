import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';

export async function waitForDeployment({
  url,
  commit,
  timeoutMs = 30 * 60_000,
  intervalMs = 10_000,
  requestTimeoutMs = 10_000,
  fetchImpl = fetch,
  sleep = wait,
  now = Date.now,
  report = console.log,
}) {
  const base = new URL(url);
  assert.ok(['https:', 'http:'].includes(base.protocol)
    && !base.username && !base.password && !base.search && !base.hash && base.pathname === '/',
  'Indica solo el origen HTTP(S), sin credenciales, rutas ni parámetros.');
  assert.ok(typeof commit === 'string' && commit.length === 40 && /^[a-f0-9]{40}$/i.test(commit),
    'El commit esperado debe ser un SHA completo de 40 caracteres hexadecimales.');
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0, 'El plazo debe ser positivo.');
  assert.ok(Number.isInteger(intervalMs) && intervalMs >= 0, 'El intervalo no puede ser negativo.');
  assert.ok(Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0,
    'El plazo de cada petición debe ser positivo.');

  const expected = commit.toLowerCase();
  const deadline = now() + timeoutMs;
  let observed = 'sin respuesta';
  let previous;
  report(`Esperando ${expected} en ${base.origin} (máximo ${timeoutMs / 1000} s).`);

  while (now() < deadline) {
    try {
      const response = await fetchImpl(new URL('/api/health', base), {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.min(requestTimeoutMs, Math.max(1, deadline - now()))),
      });
      const data = response.ok ? await response.json() : null;
      const validCommit = typeof data?.commit === 'string' && data.commit.length === 40
        && /^[a-f0-9]{40}$/i.test(data.commit);
      observed = !response.ok ? `HTTP ${response.status}`
        : validCommit ? data.commit.toLowerCase() : 'health sin commit válido';
      if (response.ok && data?.status === 'ok' && data?.service === 'sportsplace-api'
        && validCommit && observed === expected) {
        report(`Render sirve el commit esperado: ${expected}.`);
        return expected;
      }
      if (observed === expected) observed = 'health sin status/service correctos';
    } catch {
      // Los arranques en frío, 502 y respuestas aún incompletas admiten reintento.
      observed = 'sin health JSON disponible';
    }
    if (observed !== previous) report(`Esperando despliegue; observado: ${observed}.`);
    previous = observed;
    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(intervalMs, remaining));
  }
  throw new Error(`Render no sirvió ${expected} dentro del plazo. Último estado: ${observed}.`);
}
