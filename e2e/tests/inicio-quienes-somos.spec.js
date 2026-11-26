import { test, expect } from '../fixtures.js';

// Inicio (#386): la sección «Quiénes somos» enseña al equipo en tres filas (1-3-3), con foto o iniciales.
const FILAS = [
  ['Claude'],
  ['Alex Yang Ji', 'Lucía Nuez Hernández', 'Anass Baki Achkoukar'],
  ['Carlos Moya Paniza', 'Asier Sánchez', 'Marta Herranz Lozano'],
];

test('Inicio enseña «Quiénes somos» con los siete nombres en tres filas y las fotos cargadas', async ({ page }) => {
  await page.goto('/');
  const seccion = page.getByRole('region', { name: 'Quiénes somos' });
  await seccion.scrollIntoViewIfNeeded();
  await expect(seccion).toBeVisible();

  const filas = seccion.getByRole('list');
  await expect(filas).toHaveCount(3);
  for (const [i, nombres] of FILAS.entries()) {
    await expect(filas.nth(i).locator('.equipo-nombre')).toHaveText(nombres);
  }

  for (const nombre of ['Alex Yang Ji', 'Lucía Nuez Hernández', 'Anass Baki Achkoukar', 'Asier Sánchez']) {
    const foto = seccion.getByRole('img', { name: `Foto de ${nombre}` });
    await expect(foto).toBeVisible();
    await expect.poll(() => foto.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(seccion.getByText('CM', { exact: true })).toBeVisible();
  await expect(seccion.getByText('MH', { exact: true })).toBeVisible();
});
