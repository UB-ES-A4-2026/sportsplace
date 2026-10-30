// T13-5 · E2E de US-13 (añadir fotos a mi anuncio). Casos: docs/especificacion/E03 (US-13).
// Usa la plantilla de T12-7: login real con `entrar` y las cuentas de la semilla de T12-8.
//
// Esqueleto. Los seis casos quedan en `fixme` hasta que la historia tenga su parte
// de servidor y de interfaz en `story/US-13-anadir-fotos-anuncio`:
//   - T13-2 (#124, en borrador): multipart en `POST /api/anuncios`, validación por
//     cabecera binaria y subida a Storage. Sin ella no hay petición que comprobar.
//   - T13-3 (#57): sección «Fotos» del formulario (añadir, principal, quitar).
//   - T13-4: galería en la ficha.
// En la historia solo está T13-1 (#117: metadatos y bucket). Quitar el `fixme` de cada
// caso cuando su dependencia esté fusionada; no antes, para no dar por verde algo ausente.
//
// Archivos de prueba: decidido en la #138 que las grandes no se versionan. E2E-3, E2E-4
// y E2E-6 las generan en memoria con `fixtures/imagenes.js`. Solo quedan por versionar
// las dos pequeñas y reales de E2E-1 (`balones1.jpg` y `balones2.png`, < 200 kB), que se
// añadirán con ese caso.
import { test, expect, entrar } from '../fixtures.js';
import { archivo, relleno, LIMITE_FOTO, UN_BYTE_DE_MAS, SEIS_MB, MAXIMO_FOTOS } from './fixtures/imagenes.js';

// Selector provisional: se confirma contra el marcado real cuando T13-3 (#57) esté
// fusionada. La sección «Fotos» monta un input de archivo múltiple.
function entradaDeFotos(page) {
  return page.locator('input[type="file"]');
}

test.describe('US-13 · Añadir fotos a mi anuncio', () => {
  test.fixme('E2E-1 · publicar con dos fotos y cambiar la principal', async ({ page, cuentas }) => {
    // balones1.jpg (800 kB) y balones2.png (1,2 MB); estrella en la 2 → «Principal».
    // Ficha con balones2.png grande y dos miniaturas. BD: 2 filas en `anuncio_fotos`
    // (orden 1 y 2, `es_principal` solo en la 2). Storage: 2 objetos en `<centro_id>/<anuncio_id>/`.
    // Estas dos sí se versionan: tienen que verse en la ficha.
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-2 · sin fotos', async ({ page, cuentas }) => {
    // Formulario correcto sin fotos → «Añade al menos una foto.». Sin petición; BD sin cambios.
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-3 · archivos inválidos', async ({ page, cuentas }) => {
    await entrar(page, cuentas.centroA, cuentas.password);
    await page.goto('/anuncios/nuevo');

    // Un GIF (tipo no admitido), un JPG de 6 MB (pasado de tamaño) y un WebP válido de 100 kB.
    await entradaDeFotos(page).setInputFiles([
      archivo('logo.gif', 20 * 1024),
      archivo('grande.jpg', SEIS_MB),
      archivo('ok.webp', 100 * 1024),
    ]);

    await expect(page.getByText('logo.gif: Solo se admiten fotos JPG, PNG o WebP.')).toBeVisible();
    await expect(page.getByText('grande.jpg: Cada foto debe pesar 5 MB como máximo.')).toBeVisible();
    // Solo sobrevive el WebP.
    await expect(page.getByRole('img', { name: /ok\.webp/ })).toHaveCount(1);
  });

  test.fixme('E2E-3 bis · los dos lados exactos del límite de 5 MB', async ({ page, cuentas }) => {
    // El límite se comprueba con los dos tamaños que pide la tarea: 5.242.880 pasa y
    // 5.242.881 se rechaza. Generarlos en memoria evita versionar 10 MB.
    await entrar(page, cuentas.centroA, cuentas.password);
    await page.goto('/anuncios/nuevo');

    await entradaDeFotos(page).setInputFiles([
      archivo('justo.jpg', LIMITE_FOTO),
      archivo('pasado.jpg', UN_BYTE_DE_MAS),
    ]);

    await expect(page.getByText('pasado.jpg: Cada foto debe pesar 5 MB como máximo.')).toBeVisible();
    await expect(page.getByText('justo.jpg: Cada foto debe pesar 5 MB como máximo.')).toHaveCount(0);
  });

  test.fixme('E2E-4 · límite de 8', async ({ page, cuentas }) => {
    await entrar(page, cuentas.centroA, cuentas.password);
    await page.goto('/anuncios/nuevo');

    const entrada = entradaDeFotos(page);
    const anadir = page.getByRole('button', { name: '+ Añadir fotos' });

    await entrada.setInputFiles(relleno(7));
    await expect(anadir).toBeVisible();

    // Tres más: se quedan 8 y desaparece el botón de añadir.
    await entrada.setInputFiles(relleno(3, { desde: 8 }));
    await expect(page.getByText(`Puedes añadir ${MAXIMO_FOTOS} fotos como máximo.`)).toBeVisible();
    await expect(anadir).toHaveCount(0);

    // Quitar una devuelve el botón.
    await page.getByRole('button', { name: 'Quitar foto 1' }).click();
    await expect(anadir).toBeVisible();
  });

  test.fixme('E2E-5 · quitar la principal', async ({ page, cuentas }) => {
    // Con 3 fotos y la principal en la 1, ✕ en la 1 → la antigua 2 pasa a «Principal».
    await entrar(page, cuentas.centroA, cuentas.password);
    expect(true).toBe(true);
  });

  test.fixme('E2E-6 · API con archivo falso', async ({ request, cuentas }) => {
    // Un .txt que se declara como image/jpeg: la validación por cabecera binaria de
    // T13-2 tiene que rechazarlo aunque el tipo anunciado sea válido.
    const falso = archivo('trampa.txt', 2 * 1024, 'image/jpeg');

    const res = await request.post('/api/anuncios', {
      multipart: {
        datos: JSON.stringify({ titulo: 'Balones de fútbol talla 5' }),
        fotos: { name: falso.name, mimeType: falso.mimeType, buffer: falso.buffer },
      },
    });

    expect(res.status()).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.codigo).toBe('DATOS_INVALIDOS');
    expect(cuerpo.details.fotos).toBe('Solo se admiten fotos JPG, PNG o WebP.');
    expect(cuentas.centroA).toBeTruthy();
  });
});
