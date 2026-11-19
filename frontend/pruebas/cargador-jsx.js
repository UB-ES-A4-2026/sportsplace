// Cargador de módulos para los tests de componentes: compila los .jsx con Oxc (el mismo compilador que usa Vite) y
// convierte los `import '….css'` en módulos vacíos, porque Node no sabe cargar CSS. El resto pasa sin cambios.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  if (!url.endsWith('.jsx')) return nextLoad(url, context);

  const ruta = fileURLToPath(url);
  const { code } = await transformWithOxc(await readFile(ruta, 'utf8'), ruta, {
    lang: 'jsx',
    sourceType: 'module',
    jsx: { runtime: 'automatic' },
  });
  return { format: 'module', source: code, shortCircuit: true };
}
