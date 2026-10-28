// T13-5 · E2E de US-13 (añadir fotos a mi anuncio). Casos: docs/especificacion/E03 (US-13).
// Usa la plantilla de T12-7: login real con `entrar` y las cuentas de la semilla de T12-8.
//
// Esqueleto. Los seis casos quedan en `fixme` hasta que la historia tenga su parte
// de servidor y de interfaz en `story/US-13-anadir-fotos-anuncio`:
//   - T13-2 (#124, en borrador): multipart en `POST /api/anuncios`, validación por
//     cabecera binaria y subida a Storage. Sin ella no hay petición que comprobar.
//   - T13-3: sección «Fotos» del formulario (añadir, principal, quitar).
//   - T13-4: galería de la ficha.
// En la historia solo está T13-1 (#117: metadatos y bucket). Quitar el `fixme` de cada
// caso cuando su dependencia esté fusionada; no antes, para no dar por verde algo ausente.
//
// Pendiente de acordar antes de implementar: las imágenes de `tests/fixtures` que pide
// la tarea (incluidas una de 5.242.880 y otra de 5.242.881 bytes, los dos lados del
// límite de 5 MB) suman unos 12 MB. Decidir si se versionan o se generan al arrancar.
import { test, expect, entrar } from '../fixtures.js';

test.describe('US-13 · Añadir fotos a mi anuncio', () => {
  test.fixme('E2E-1 · publicar con dos fotos y cambiar la principal', async ({ page, cuentas }) => {
    // balones1.jpg (800 kB) y balones2.png (1,2 MB); estrella en la 2 → «Principal».
    // Ficha con balones2.png grande y dos miniaturas. BD: 2 filas en `anuncio_fotos`
    // (orden 1 y 2, `es_principal` solo en la 2). Storage: 2 objetos en `<centro_id>/<anuncio_id>/`.
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-2 · sin fotos', async ({ page, cuentas }) => {
    // Formulario correcto sin fotos → «Añade al menos una foto.». Sin petición; BD sin cambios.
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-3 · archivos inválidos', async ({ page, cuentas }) => {
    // logo.gif + grande.jpg (6 MB) + ok.webp (100 kB) → solo ok.webp en la rejilla, con
    // «logo.gif: Solo se admiten fotos JPG, PNG o WebP.» y
    // «grande.jpg: Cada foto debe pesar 5 MB como máximo.».
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-4 · límite de 8', async ({ page, cuentas }) => {
    // 7 fotos + 3 más → quedan 8, aparece «Puedes añadir 8 fotos como máximo.» y
    // desaparece «+ Añadir fotos». Quitar una con ✕ → 7 y vuelve «+ Añadir fotos».
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-5 · quitar la principal', async ({ page, cuentas }) => {
    // Con 3 fotos y la principal en la 1, ✕ en la 1 → la antigua 2 pasa a «Principal».
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-6 · API con archivo falso', async ({ request, cuentas }) => {
    // multipart con `datos` válidos y una parte `fotos` que es un .txt con
    // Content-Type: image/jpeg → 400 DATOS_INVALIDOS, `details.fotos`
    // «Solo se admiten fotos JPG, PNG o WebP.». BD y Storage sin cambios.
    expect(cuentas.centroA).toBeTruthy();
    expect(request).toBeTruthy();
  });
});
