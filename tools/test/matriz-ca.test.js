import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  construirMatriz, cruzarTests, historiaDelArchivo, informeMarkdown, leerEspecificacion,
  leerTitulos, numerosDeCa, referenciasDeTitulo,
} from '../lib/matriz-ca.js';

const especificacion = `# E06 Pedidos y pago

## Base común de la épica
- CA1. No es de ninguna historia.

## (3) US-32 · Pedir unidades de un anuncio
- CA1. Primero.
- CA2. Segundo.
  - CA2. Repetido en una sublista: no cuenta dos veces.
- **CA3.** En negrita.

### Flujos E2E
- E2E-1 (camino feliz). No es un CA.

## (2) US-108 · Ver el detalle de un pedido
- CA1. Único.

## (1) US-200 · Sin tests todavía
- CA1. Del backlog.
`;

test('#390: lee historias y CA de la especificación, sin la base común ni los E2E', () => {
  assert.deepEqual(leerEspecificacion(especificacion), [
    { id: 'US-32', titulo: 'Pedir unidades de un anuncio', ca: [1, 2, 3] },
    { id: 'US-108', titulo: 'Ver el detalle de un pedido', ca: [1] },
    { id: 'US-200', titulo: 'Sin tests todavía', ca: [1] },
  ]);
});

test('#390: entiende listas, barras y rangos de CA', () => {
  assert.deepEqual(numerosDeCa('CA1, CA2 y CA4'), [1, 2, 4]);
  assert.deepEqual(numerosDeCa('CA17/CA21'), [17, 21]);
  assert.deepEqual(numerosDeCa('CA7 a CA9 · límites'), [7, 8, 9]);
  assert.deepEqual(numerosDeCa('CA1-CA3 y CA5–6'), [1, 2, 3, 5, 6]);
  assert.deepEqual(numerosDeCa('CA7 a la vista'), [7]);
  assert.deepEqual(numerosDeCa('E2E-3 sin criterios'), []);
});

test('#390: cada CA va con la última historia citada antes en el título', () => {
  assert.deepEqual(referenciasDeTitulo('US-32 CA1 y US-108 CA1: el detalle').referencias, [
    { historia: 'US-32', ca: 1 }, { historia: 'US-108', ca: 1 },
  ]);
  assert.deepEqual(referenciasDeTitulo('US-04: sin CA').referencias, []);
  assert.deepEqual(referenciasDeTitulo('CA2: sin historia'), { referencias: [], sinHistoria: true });
  assert.deepEqual(referenciasDeTitulo('CA2 · en su spec', 'US-32').referencias, [{ historia: 'US-32', ca: 2 }]);
});

test('#390: solo los specs E2E dan historia por su nombre', () => {
  assert.equal(historiaDelArchivo('e2e/tests/us-108-detalle-pedido.spec.js'), 'US-108');
  assert.equal(historiaDelArchivo('e2e/tests/us-04-recuperar.spec.js'), 'US-04');
  assert.equal(historiaDelArchivo('frontend/src/pedidos/api.test.js'), null);
});

test('#390: lee los títulos de test, it y describe con cualquier comilla', () => {
  const contenido = [
    "test('US-32 CA1: simple', () => {});",
    'it("US-32 CA2: dobles con \\"escape\\"", () => {});',
    'test.describe(`US-32 · CA3`, () => {});',
    "test.skip('US-32 CA4: omitido', () => {});",
    "contest('no es un test');",
  ].join('\n');
  assert.deepEqual(leerTitulos(contenido), [
    'US-32 CA1: simple', 'US-32 CA2: dobles con \\"escape\\"', 'US-32 · CA3', 'US-32 CA4: omitido',
  ]);
});

test('#390: la matriz cuenta CA con test y con E2E y lista los que faltan', () => {
  const cruce = cruzarTests([
    { ruta: 'backend/test/pedidos.test.js', contenido: "test('US-32 CA1: crea', () => {});\ntest('CA9: ¿de quién?', () => {});", e2e: false },
    { ruta: 'e2e/tests/us-32-pedir.spec.js', contenido: "test('US-32 · CA1 y CA3 · pantalla', () => {});\ntest('CA7 · no existe', () => {});", e2e: true },
  ]);
  const matriz = construirMatriz(leerEspecificacion(especificacion), cruce);
  assert.deepEqual(matriz.filas, [{
    id: 'US-32', titulo: 'Pedir unidades de un anuncio', total: 3, conTest: 2, conE2e: 2, sinTest: [2],
  }]);
  assert.deepEqual(matriz.inexistentes, ['US-32 CA7']);
  assert.deepEqual(matriz.sinHistoria, [{ ruta: 'backend/test/pedidos.test.js', titulo: 'CA9: ¿de quién?' }]);

  const informe = informeMarkdown(matriz);
  assert.match(informe, /\*\*2 de 3 CA \(66,7 %\) tienen algún test que los nombra; 2 \(66,7 %\) tienen E2E\.\*\*/);
  assert.match(informe, /\| US-32 · Pedir unidades de un anuncio \| 3 \| 2 \(66,7 %\) \| 2 \| CA2 \|/);
  assert.match(informe, /no está en la especificación:\*\* US-32 CA7/);
  assert.match(informe, /1 títulos citan un CA sin decir de qué historia/);
  assert.doesNotMatch(informe, /US-108|US-200/);
});

test('#390: sin ninguna historia con tests el informe no divide por cero', () => {
  const informe = informeMarkdown(construirMatriz([], { nombrados: new Map(), sinHistoria: [] }));
  assert.match(informe, /0 de 0 CA \(—\)/);
  assert.doesNotMatch(informe, /<details>/);
});
