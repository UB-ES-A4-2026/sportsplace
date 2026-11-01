import { test, expect, entrar } from '../fixtures.js';

// Plantilla ejecutable para QA: navegador -> Vite -> API -> Supabase Auth real.
// La conexión TLS a la base y los centros se comprueban en global-setup.js.
for (const cuenta of ['centroA', 'centroB']) {
  test(`la cuenta ${cuenta} puede iniciar sesión y acceder a la zona privada`, async ({ page, cuentas }) => {
    await entrar(page, cuentas[cuenta], cuentas.password);
    await expect(page.getByRole('heading', { name: 'Zona privada' })).toBeVisible();
    await expect(page.getByText(cuentas[cuenta], { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Zona privada' })).toBeVisible();
  });
}

test('la cuenta sin confirmar conserva la protección de Supabase Auth', async ({ request, cuentas }) => {
  const response = await request.post('/api/auth/login', {
    data: { email: cuentas.sinConfirmar, password: cuentas.password },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe('EMAIL_NO_CONFIRMADO');
});

test('una ruta privada sin sesión vuelve a Entrar', async ({ page }) => {
  await page.goto('/panel');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeVisible();
});
