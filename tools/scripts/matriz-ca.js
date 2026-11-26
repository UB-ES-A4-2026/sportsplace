import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  construirMatriz, cruzarTests, informeMarkdown, leerEspecificacion,
} from '../lib/matriz-ca.js';

// #390: uso `node scripts/matriz-ca.js [raíz del repo]`. Escribe la matriz en la
// salida y, en GitHub Actions, también en el resumen del job. Nunca falla el CI.
const raiz = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const CARPETAS_DE_TESTS = [
  { carpeta: 'backend/test', patron: /\.test\.js$/, e2e: false },
  { carpeta: 'frontend/src', patron: /\.test\.jsx?$/, e2e: false },
  { carpeta: 'e2e/unit', patron: /\.test\.js$/, e2e: false },
  { carpeta: 'e2e/tests', patron: /\.spec\.js$/, e2e: true },
];

async function archivosDe(carpeta, patron) {
  const entradas = await readdir(path.join(raiz, carpeta), { recursive: true, withFileTypes: true }).catch(() => []);
  return entradas
    .filter((e) => e.isFile() && patron.test(e.name) && !e.parentPath.includes('node_modules'))
    .map((e) => path.relative(raiz, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

async function main() {
  const especificacion = path.join(raiz, 'docs/especificacion');
  const documentos = (await readdir(especificacion)).filter((nombre) => /^E\d.*\.md$/.test(nombre)).sort();
  const historias = [];
  for (const nombre of documentos) {
    historias.push(...leerEspecificacion(await readFile(path.join(especificacion, nombre), 'utf8')));
  }
  const archivos = [];
  for (const { carpeta, patron, e2e } of CARPETAS_DE_TESTS) {
    for (const ruta of await archivosDe(carpeta, patron)) {
      archivos.push({ ruta, contenido: await readFile(path.join(raiz, ruta), 'utf8'), e2e });
    }
  }
  const informe = informeMarkdown(construirMatriz(historias, cruzarTests(archivos)));
  console.log(informe);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, informe);
}

main().catch((error) => {
  console.error(`No se ha podido generar la matriz CA → test: ${error.message}`);
});
