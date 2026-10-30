import assert from 'node:assert/strict';

// El run que espera a Render pertenece a una ref distinta del commit desplegable.
// Así no forma parte de los checks que Render espera para desplegar ese commit.
export async function dispatchRenderSmoke({
  repository,
  commit,
  runnerRef,
  token,
  fetchImpl = fetch,
}) {
  assert.match(repository || '', /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/);
  assert.ok(typeof commit === 'string' && commit.length === 40 && /^[a-f0-9]{40}$/i.test(commit),
    'Se necesita el SHA completo del push a dev.');
  assert.ok(runnerRef?.startsWith('chore/T12-6-'), 'La ref del runner debe ser una rama T12-6 conservada.');
  assert.ok(token, 'Falta el GITHUB_TOKEN temporal del job.');
  const root = `https://api.github.com/repos/${repository}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const branch = await fetchImpl(`${root}/git/ref/heads/${encodeURIComponent(runnerRef)}`, {
    headers, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  assert.equal(branch.status, 200, 'No se encuentra la rama conservada del smoke.');
  const ref = await branch.json();
  assert.ok(typeof ref.object?.sha === 'string' && ref.object.sha !== commit,
    'El smoke debe ejecutarse sobre un SHA distinto de dev para no bloquear el Auto-Deploy.');

  const response = await fetchImpl(`${root}/actions/workflows/smoke-render.yml/dispatches`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: runnerRef, inputs: { expected_sha: commit } }),
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  assert.ok([200, 204].includes(response.status), 'GitHub no ha aceptado el workflow del smoke.');
}
