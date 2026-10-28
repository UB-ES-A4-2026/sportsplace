// T14-5 · E2E de US-14 (vender con precio o ceder gratis). Casos: docs/especificacion/E03 (US-14).
// Usa la plantilla de T12-7: login real con `entrar` y las cuentas de la semilla de T12-8.
//
// Esqueleto. Los cinco casos y las dos tablas de valores quedan en `fixme` hasta que la
// historia esté completa en `story/US-14-indicar-material-vende-precio-cede`:
//   - T14-1 (#128, abierta): migración de `modalidad` y `precio_unitario_centimos` con su
//     CHECK. Sin ella la columna no existe y no se puede publicar nada con precio.
//   - T14-2: validación de modalidad y precio en el módulo compartido (necesaria para E2E-5).
//   - T14-4 (#109, cerrada sin fusionar): precio y «Donación · Gratis» en la ficha y en la
//     fila de «Mis anuncios». Necesaria para comprobar E2E-1, E2E-2 y CA6.
// En la historia solo está T14-3 (#106: sección «Modalidad y precio» del formulario).
// Quitar el `fixme` de cada caso cuando su dependencia esté fusionada, no antes.
import { test, expect, entrar } from '../fixtures.js';

// CA3 · conversión a céntimos en la web (sin coma flotante).
const CONVERSION = [
  { escrito: '8,5', centimos: 850 },
  { escrito: '8,05', centimos: 805 },
  { escrito: '0,01', centimos: 1 },
  { escrito: '99999,99', centimos: 9999999 },
];

const RANGO = 'El precio debe estar entre 0,01 € y 99.999,99 €.';
const FORMATO = 'Escribe el precio con hasta 2 decimales, por ejemplo 12,50.';
const FALTA = 'Indica el precio por unidad.';

// CA4 · casos límite de la web. `null` = se acepta y publica.
const LIMITES = [
  { escrito: '0,01', error: null },
  { escrito: '0', error: RANGO },
  { escrito: '0,00', error: RANGO },
  { escrito: '99999,99', error: null },
  { escrito: '100000', error: RANGO },
  { escrito: '12,345', error: FORMATO },
  { escrito: '1.234,50', error: FORMATO },
  { escrito: '12 €', error: FORMATO },
  { escrito: '-5', error: FORMATO },
  { escrito: 'abc', error: FORMATO },
  { escrito: '', error: FALTA },
];

test.describe('US-14 · Modalidad y precio', () => {
  test.fixme('E2E-1 · venta', async ({ page, cuentas }) => {
    // Formulario válido + «Venta» + precio «8,50» → ficha «8,50 € / unidad».
    // BD: modalidad='venta', precio_unitario_centimos=850.
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-2 · donación', async ({ page, cuentas }) => {
    // «Donación» → no hay campo de precio → ficha «Donación · Gratis».
    // BD: modalidad='donacion', precio_unitario_centimos IS NULL.
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-3 · venta sin precio y límites', async ({ page, cuentas }) => {
    // Precio vacío → «Indica el precio por unidad.»; «0,00» → rango; «12,345» → formato;
    // «99999,99» se publica y la ficha muestra «99.999,99 € / unidad».
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-4 · cambio de modalidad', async ({ page, cuentas }) => {
    // «Venta» + «abc» → error de formato. Marcar «Donación» → el error desaparece
    // → «Publicar» → se publica como donación (CA5).
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-5 · API incoherente', async ({ request, cuentas }) => {
    // datos con modalidad 'donacion' y precio_unitario_centimos 500 → 400,
    // details.precio_unitario_centimos «Una donación no puede tener precio.».
    expect(cuentas.centroA).toBeTruthy();
    expect(request).toBeTruthy();
  });

  test.describe('CA3 · conversión a céntimos', () => {
    for (const { escrito, centimos } of CONVERSION) {
      test.fixme(`«${escrito}» → ${centimos}`, async ({ page, cuentas }) => {
        await entrar(page, cuentas.centroA, cuentas.password);
        expect(true).toBe(true);
      });
    }
  });

  test.describe('CA4 · casos límite del precio', () => {
    for (const { escrito, error } of LIMITES) {
      const nombre = escrito === '' ? 'vacío' : `«${escrito}»`;
      test.fixme(`${nombre} → ${error ?? 'se publica'}`, async ({ page, cuentas }) => {
        await entrar(page, cuentas.centroA, cuentas.password);
        expect(true).toBe(true);
      });
    }
  });
});
