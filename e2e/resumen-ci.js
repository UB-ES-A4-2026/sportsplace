import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

// #389: con `retries: 1` el job queda en verde aunque un caso falle a la primera, y el informe HTML solo se ve
// descargando el artefacto. Este reporter escribe en el resumen del job ($GITHUB_STEP_SUMMARY) los casos que
// solo pasaron al reintentar (inestables) y los omitidos con su motivo. Solo informa: nunca cambia el resultado.

const celda = (texto) => String(texto ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

const primeraLinea = (texto) => stripVTControlCharacters(String(texto ?? '')).split('\n').find((linea) => linea.trim()) ?? '';

/** Motivo de la omisión: la descripción de `test.skip(cond, motivo)` o `test.fixme(...)`. */
export function motivoOmision(anotaciones) {
  const omision = anotaciones.find((anotacion) => anotacion.type === 'skip' || anotacion.type === 'fixme');
  if (!omision) return 'Sin motivo indicado';
  const motivo = omision.description?.trim() || 'Sin motivo indicado';
  return omision.type === 'fixme' ? `fixme: ${motivo}` : motivo;
}

/** Pasa los casos de Playwright a objetos simples con lo que necesita el resumen. */
export function casoDesdePlaywright(test, raiz) {
  const resultados = test.results ?? [];
  const anotaciones = [...(test.annotations ?? []), ...resultados.flatMap((resultado) => resultado.annotations ?? [])];
  const fallo = resultados.find((resultado) => resultado.status !== 'passed' && resultado.status !== 'skipped');
  return {
    titulo: test.titlePath().slice(3).join(' › '),
    lugar: `${path.relative(raiz, test.location.file).split(path.sep).join('/')}:${test.location.line}`,
    resultado: test.outcome(),
    intentos: resultados.length,
    error: primeraLinea(fallo?.error?.message ?? fallo?.status),
    motivo: motivoOmision(anotaciones),
  };
}

/** Markdown del resumen a partir de los casos simplificados (ver `casoDesdePlaywright`). */
export function resumenMarkdown(casos) {
  const cuenta = (resultado) => casos.filter((caso) => caso.resultado === resultado).length;
  const inestables = casos.filter((caso) => caso.resultado === 'flaky');
  const omitidos = casos.filter((caso) => caso.resultado === 'skipped');
  const lineas = [
    '### E2E · Inestables y omitidos (#389)',
    '',
    `${casos.length} casos: ${cuenta('expected')} en verde a la primera, ${inestables.length} inestables, `
      + `${omitidos.length} omitidos y ${cuenta('unexpected')} con fallo.`,
    '',
  ];

  lineas.push(`#### Inestables: solo pasaron al reintentar (${inestables.length})`, '');
  if (inestables.length) {
    lineas.push('| Caso | Lugar | Intentos | Fallo del primer intento |', '|---|---|---|---|');
    for (const caso of inestables) {
      lineas.push(`| ${celda(caso.titulo)} | \`${celda(caso.lugar)}\` | ${caso.intentos} | ${celda(caso.error)} |`);
    }
  } else {
    lineas.push('Ninguno.');
  }
  lineas.push('');

  lineas.push(`#### Omitidos (${omitidos.length})`, '');
  if (omitidos.length) {
    const porMotivo = Map.groupBy(omitidos, (caso) => caso.motivo);
    lineas.push('| Motivo | Casos |', '|---|---|');
    for (const [motivo, grupo] of [...porMotivo].sort((a, b) => b[1].length - a[1].length)) {
      lineas.push(`| ${celda(motivo)} | ${grupo.length} |`);
    }
    lineas.push('', '| Caso | Lugar | Motivo |', '|---|---|---|');
    for (const caso of omitidos) {
      lineas.push(`| ${celda(caso.titulo)} | \`${celda(caso.lugar)}\` | ${celda(caso.motivo)} |`);
    }
  } else {
    lineas.push('Ninguno.');
  }
  return `${lineas.join('\n')}\n`;
}

export default class ResumenCi {
  onBegin(config, suite) {
    this.raiz = config.rootDir;
    this.suite = suite;
  }

  onEnd() {
    const destino = process.env.GITHUB_STEP_SUMMARY;
    if (!destino || !this.suite) return;
    const casos = this.suite.allTests().map((test) => casoDesdePlaywright(test, this.raiz));
    appendFileSync(destino, resumenMarkdown(casos));
  }

  printsToStdio() {
    return false;
  }
}
