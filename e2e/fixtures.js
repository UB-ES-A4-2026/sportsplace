import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  cuentas: [{
      centroA: process.env.E2E_CENTRO_A_EMAIL,
      centroB: process.env.E2E_CENTRO_B_EMAIL,
      sinConfirmar: process.env.E2E_SIN_CONFIRMAR_EMAIL,
      password: process.env.E2E_PASSWORD,
  }, { option: true }],
});

export { expect };

export async function entrar(page, email, password) {
  await page.goto('/entrar');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Contraseña', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
}
