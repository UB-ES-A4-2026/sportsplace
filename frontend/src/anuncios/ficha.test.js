import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorApi } from '../api/cliente.js';
import { formatearFecha, formatearFechaHora, lineaDeFechas, resultadoDeLaCarga } from './ficha.js';

describe('Fechas en hora de Madrid', () => {
  test('dd/mm/aaaa y dd/mm/aaaa hh:mm (UTC+1 en noviembre)', () => {
    assert.equal(formatearFecha('2026-11-03T10:15:00.000Z'), '03/11/2026');
    assert.equal(formatearFechaHora('2026-11-03T10:15:00.000Z'), '03/11/2026 11:15');
  });

  test('cambia de día según Madrid, no según UTC (UTC+2 en verano)', () => {
    assert.equal(formatearFechaHora('2026-06-30T22:30:00.000Z'), '01/07/2026 00:30');
  });

  test('línea «Publicado el … · Última modificación …»', () => {
    assert.equal(
      lineaDeFechas({ publicado_en: '2026-11-03T10:15:00.000Z', actualizado_en: '2026-11-04T08:05:00.000Z' }),
      'Publicado el 03/11/2026 · Última modificación 04/11/2026 09:05',
    );
  });

  test('un borrador no tiene «Publicado el»', () => {
    assert.equal(lineaDeFechas({ publicado_en: null, actualizado_en: '2026-11-03T10:15:00.000Z' }),
      'Última modificación 03/11/2026 11:15');
  });
});

describe('resultadoDeLaCarga', () => {
  test('cualquier 404 → «Anuncio no encontrado»', () => {
    assert.deepEqual(resultadoDeLaCarga(new ErrorApi(404, { code: 'NO_ENCONTRADO', message: 'Anuncio no encontrado.' })),
      { noEncontrado: true });
  });

  test('red caída, 500 y 503 → «No se ha podido cargar.» con «Reintentar»', () => {
    for (const fallo of [new ErrorApi(0, { code: 'SIN_CONEXION' }), new ErrorApi(500), new ErrorApi(503)]) {
      assert.deepEqual(resultadoDeLaCarga(fallo), { error: true });
    }
  });
});
