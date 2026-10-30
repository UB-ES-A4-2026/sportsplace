import { dispatchRenderSmoke } from '../lib/dispatch-render-smoke.js';

dispatchRenderSmoke({
  repository: process.env.GITHUB_REPOSITORY,
  commit: process.env.GITHUB_SHA,
  runnerRef: process.env.SMOKE_RUNNER_REF,
  token: process.env.GH_TOKEN,
}).then(() => {
  console.log(`Smoke solicitado para ${process.env.GITHUB_SHA}; ejecución en ${process.env.SMOKE_RUNNER_REF}.`);
}).catch((error) => {
  console.error(`No se pudo solicitar el smoke: ${error.message}`);
  process.exitCode = 1;
});
