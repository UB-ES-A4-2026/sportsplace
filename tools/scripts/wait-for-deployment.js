import { waitForDeployment } from '../lib/wait-for-deployment.js';

waitForDeployment({ url: process.argv[2], commit: process.argv[3] }).catch((error) => {
  console.error(`Espera del despliegue fallida: ${error.message}`);
  process.exitCode = 1;
});
