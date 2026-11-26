// #390: matriz CA → test. Cruza los CA de docs/especificacion/ con los
// títulos de los tests que los nombran («US-XX CAn», «US-XX · CA7 a CA9»...).
// Es solo un informe: nunca hace fallar el CI.

const HISTORIA = /US-(\d+)/g;
const TITULO = /\b(?:test|it|describe)(?:\.(?:only|skip|todo|serial|parallel))*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

const usId = (numero) => `US-${String(Number(numero)).padStart(2, '0')}`;

// Historias y CA de un documento de la especificación. Cada historia empieza en
// «## (n) US-XX · Título» y acaba en el siguiente encabezado de nivel 2.
export function leerEspecificacion(markdown) {
  const historias = new Map();
  let actual = null;
  for (const linea of markdown.split('\n')) {
    if (linea.startsWith('## ')) {
      const encabezado = /^## (?:\([^)]*\) )?US-(\d+) · (.+)$/.exec(linea.trim());
      actual = encabezado ? { id: usId(encabezado[1]), titulo: encabezado[2].trim(), ca: [] } : null;
      if (actual && !historias.has(actual.id)) historias.set(actual.id, actual);
      continue;
    }
    const ca = actual && /^\s*-\s+(?:\*\*)?CA(\d+)\b/.exec(linea);
    if (ca) {
      const historia = historias.get(actual.id);
      const numero = Number(ca[1]);
      if (!historia.ca.includes(numero)) historia.ca.push(numero);
    }
  }
  return [...historias.values()];
}

// Números de CA de un fragmento: «CA1, CA2 y CA4», «CA17/CA21», «CA7 a CA9»,
// «CA1-CA3» o «CA5-7».
export function numerosDeCa(texto) {
  const numeros = new Set();
  const patron = /CA(\d+)(?:\s*(?:a|-|–)\s*(?:CA)?(\d+))?/g;
  for (const [, desde, hasta] of texto.matchAll(patron)) {
    const inicio = Number(desde);
    const fin = hasta === undefined ? inicio : Number(hasta);
    if (fin < inicio || fin - inicio > 50) numeros.add(inicio);
    else for (let n = inicio; n <= fin; n += 1) numeros.add(n);
  }
  return [...numeros];
}

// Pares historia-CA que nombra un título. Cada CA va con la última historia
// citada antes que él; si el título no cita ninguna, con la del archivo.
export function referenciasDeTitulo(titulo, historiaPorDefecto = null) {
  const referencias = [];
  const marcas = [...titulo.matchAll(HISTORIA)];
  const tramos = [{ historia: historiaPorDefecto, texto: titulo.slice(0, marcas[0]?.index ?? titulo.length) }];
  marcas.forEach((marca, i) => {
    tramos.push({
      historia: usId(marca[1]),
      texto: titulo.slice(marca.index + marca[0].length, marcas[i + 1]?.index ?? titulo.length),
    });
  });
  let sinHistoria = false;
  for (const { historia, texto } of tramos) {
    const numeros = numerosDeCa(texto);
    if (!numeros.length) continue;
    if (!historia) sinHistoria = true;
    else for (const ca of numeros) referencias.push({ historia, ca });
  }
  return { referencias, sinHistoria };
}

// Historia por defecto de un archivo de test: solo la del nombre de los specs
// E2E (us-32-...). Fuera de ellos el título tiene que citar la historia
// (docs/estrategia-test.md: «US-XX CAn»); adivinarla por el resto del archivo
// asigna CA a la historia equivocada.
export function historiaDelArchivo(ruta) {
  const porNombre = /(?:^|\/)us-(\d+)-[^/]*$/i.exec(ruta);
  return porNombre ? usId(porNombre[1]) : null;
}

export function leerTitulos(contenido) {
  return [...contenido.matchAll(TITULO)].map((coincidencia) => coincidencia[2]);
}

// archivos: [{ ruta, contenido, e2e }]. Devuelve, por historia y CA, si algún
// test lo nombra y si alguno es E2E, más los títulos con CA sin historia.
export function cruzarTests(archivos) {
  const nombrados = new Map();
  const sinHistoria = [];
  for (const { ruta, contenido, e2e } of archivos) {
    const porDefecto = historiaDelArchivo(ruta);
    for (const titulo of leerTitulos(contenido)) {
      const { referencias, sinHistoria: huerfano } = referenciasDeTitulo(titulo, porDefecto);
      if (huerfano) sinHistoria.push({ ruta, titulo });
      for (const { historia, ca } of referencias) {
        const clave = `${historia} CA${ca}`;
        const previo = nombrados.get(clave) ?? { test: false, e2e: false };
        nombrados.set(clave, { test: true, e2e: previo.e2e || e2e });
      }
    }
  }
  return { nombrados, sinHistoria };
}

// Solo entran las historias que algún test ya nombra (las que están hechas o
// en curso); el resto del backlog no cuenta como «sin test».
export function construirMatriz(historias, { nombrados, sinHistoria }) {
  const conTests = new Set([...nombrados.keys()].map((clave) => clave.split(' ')[0]));
  const filas = historias
    .filter((historia) => conTests.has(historia.id) && historia.ca.length)
    .map((historia) => {
      const estado = historia.ca.map((ca) => ({ ca, ...(nombrados.get(`${historia.id} CA${ca}`) ?? { test: false, e2e: false }) }));
      return {
        id: historia.id,
        titulo: historia.titulo,
        total: estado.length,
        conTest: estado.filter((e) => e.test).length,
        conE2e: estado.filter((e) => e.e2e).length,
        sinTest: estado.filter((e) => !e.test).map((e) => e.ca),
      };
    })
    .sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)));
  const definidos = new Set(historias.flatMap((h) => h.ca.map((ca) => `${h.id} CA${ca}`)));
  const inexistentes = [...nombrados.keys()]
    .filter((clave) => conTests.has(clave.split(' ')[0]) && !definidos.has(clave)
      && historias.some((h) => h.id === clave.split(' ')[0]))
    .sort();
  return { filas, sinHistoria, inexistentes };
}

const porcentaje = (parte, total) => (total ? `${((parte * 100) / total).toFixed(1).replace('.', ',')} %` : '—');

export function informeMarkdown({ filas, sinHistoria, inexistentes }) {
  const total = filas.reduce((suma, f) => suma + f.total, 0);
  const conTest = filas.reduce((suma, f) => suma + f.conTest, 0);
  const conE2e = filas.reduce((suma, f) => suma + f.conE2e, 0);
  const lineas = [
    '## Matriz CA → test (#390, solo informe)',
    '',
    `**${conTest} de ${total} CA (${porcentaje(conTest, total)}) tienen algún test que los nombra; `
      + `${conE2e} (${porcentaje(conE2e, total)}) tienen E2E.** Cuentan las ${filas.length} historias que ya tienen tests.`,
    '',
    '| Historia | CA | Con test | Con E2E | CA sin test |',
    '|---|---:|---:|---:|---|',
    ...filas.map((f) => `| ${f.id} · ${f.titulo} | ${f.total} | ${f.conTest} (${porcentaje(f.conTest, f.total)}) `
      + `| ${f.conE2e} | ${f.sinTest.length ? f.sinTest.map((ca) => `CA${ca}`).join(', ') : '—'} |`),
  ];
  if (inexistentes.length) {
    lineas.push('', `**Tests que nombran un CA que no está en la especificación:** ${inexistentes.join(', ')}`);
  }
  if (sinHistoria.length) {
    lineas.push('', `<details><summary>${sinHistoria.length} títulos citan un CA sin decir de qué historia</summary>`, '');
    for (const { ruta, titulo } of sinHistoria) lineas.push(`- \`${ruta}\`: ${titulo.replaceAll('|', '\\|')}`);
    lineas.push('', '</details>');
  }
  return `${lineas.join('\n')}\n`;
}
