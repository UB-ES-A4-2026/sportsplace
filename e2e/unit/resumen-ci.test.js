import assert from 'node:assert/strict';
import { test } from 'node:test';
import { casoDesdePlaywright, motivoOmision, resumenMarkdown } from '../resumen-ci.js';

const caso = (resultado, extra = {}) => ({
  titulo: 'US-21 CA1 · busca', lugar: 'tests/us-21.spec.js:10', resultado, intentos: 1, error: '', motivo: 'Sin motivo indicado', ...extra,
});

test('el motivo de la omisión sale de test.skip o test.fixme', () => {
  assert.equal(motivoOmision([{ type: 'skip', description: 'Falta T32-1.' }]), 'Falta T32-1.');
  assert.equal(motivoOmision([{ type: 'fixme', description: 'Pendiente de #380' }]), 'fixme: Pendiente de #380');
  assert.equal(motivoOmision([{ type: 'issue', description: '#1' }, { type: 'skip' }]), 'Sin motivo indicado');
  assert.equal(motivoOmision([]), 'Sin motivo indicado');
});

test('lista los inestables con su fallo del primer intento y cuenta cada resultado', () => {
  const markdown = resumenMarkdown([
    caso('expected'),
    caso('flaky', { titulo: 'US-42 CA3 · cierra', intentos: 2, error: 'Timeout 10000ms | esperando' }),
    caso('unexpected'),
  ]);
  assert.match(markdown, /3 casos: 1 en verde a la primera, 1 inestables, 0 omitidos y 1 con fallo\./);
  assert.match(markdown, /#### Inestables: solo pasaron al reintentar \(1\)/);
  assert.match(markdown, /\| US-42 CA3 · cierra \| `tests\/us-21\.spec\.js:10` \| 2 \| Timeout 10000ms \\\| esperando \|/);
  assert.match(markdown, /#### Omitidos \(0\)\n\nNinguno\./);
});

test('agrupa los omitidos por motivo, de más a menos, y los lista uno a uno', () => {
  const markdown = resumenMarkdown([
    caso('skipped', { motivo: 'Sin token' }),
    caso('skipped', { motivo: 'Falta US-11' }),
    caso('skipped', { motivo: 'Falta US-11', titulo: 'US-28 CA35 · centro eliminado' }),
  ]);
  assert.match(markdown, /Inestables: solo pasaron al reintentar \(0\)\n\nNinguno\./);
  assert.match(markdown, /\| Motivo \| Casos \|\n\|---\|---\|\n\| Falta US-11 \| 2 \|\n\| Sin token \| 1 \|/);
  assert.match(markdown, /\| US-28 CA35 · centro eliminado \| `tests\/us-21\.spec\.js:10` \| Falta US-11 \|/);
});

test('convierte un caso de Playwright: título sin proyecto ni fichero, lugar relativo y error sin colores', () => {
  const resultados = [
    { status: 'failed', error: { message: '\u001b[31mError: expect(locator).toBeVisible()\u001b[39m\n\nLocator: x' }, annotations: [] },
    { status: 'passed', annotations: [] },
  ];
  const testPlaywright = {
    titlePath: () => ['', 'chromium', 'us-42.spec.js', 'US-42', 'CA3 · cierra'],
    location: { file: '/repo/e2e/tests/us-42.spec.js', line: 7 },
    outcome: () => 'flaky',
    annotations: [],
    results: resultados,
  };
  assert.deepEqual(casoDesdePlaywright(testPlaywright, '/repo/e2e'), {
    titulo: 'US-42 › CA3 · cierra', lugar: 'tests/us-42.spec.js:7', resultado: 'flaky', intentos: 2,
    error: 'Error: expect(locator).toBeVisible()', motivo: 'Sin motivo indicado',
  });
});

test('toma el motivo de las anotaciones del intento cuando test.skip se llama dentro del caso', () => {
  const testPlaywright = {
    titlePath: () => ['', 'chromium', 'a.spec.js', 'caso'],
    location: { file: '/repo/e2e/tests/a.spec.js', line: 1 },
    outcome: () => 'skipped',
    annotations: [],
    results: [{ status: 'skipped', annotations: [{ type: 'skip', description: 'La tabla pedidos (T32-1) aún no está en esta rama.' }] }],
  };
  const convertido = casoDesdePlaywright(testPlaywright, '/repo/e2e');
  assert.equal(convertido.motivo, 'La tabla pedidos (T32-1) aún no está en esta rama.');
  assert.equal(convertido.error, '');
});
