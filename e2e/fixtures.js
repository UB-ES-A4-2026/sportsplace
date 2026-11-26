import { test as base, expect } from '@playwright/test';
import { CLAVE_SESION, crearAlmacen } from './sesion-guardada.js';

export const test = base.extend({
  cuentas: [{
      centroA: process.env.E2E_CENTRO_A_EMAIL,
      centroB: process.env.E2E_CENTRO_B_EMAIL,
      sinConfirmar: process.env.E2E_SIN_CONFIRMAR_EMAIL,
      password: process.env.E2E_PASSWORD,
  }, { option: true }],
});

export { expect };

const almacen = crearAlmacen();

// Entra con la cuenta y deja la página en /panel. Las pruebas del propio login (US-03 y las que vuelven a la
// ruta pedida tras /entrar) rellenan el formulario a mano y no pasan por aquí.
export async function entrar(page, email, password) {
  if (await restaurarSesion(page, email)) return;
  await entrarPorPantalla(page, email, password);
  almacen.guardar(email, await page.evaluate((clave) => JSON.parse(localStorage.getItem(clave) ?? 'null'), CLAVE_SESION));
}

async function entrarPorPantalla(page, email, password) {
  await page.goto('/entrar');
  await page.getByLabel('Email', { exact: false }).fill(email);
  await page.getByLabel('Contraseña', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

// #392: pone la sesión guardada en localStorage y abre /panel. La web la comprueba con GET /api/auth/me; si ya no
// vale (un caso cerró la sesión, por ejemplo), se olvida y se entra por la pantalla.
async function restaurarSesion(page, email) {
  const sesion = almacen.leer(email);
  if (!sesion) return false;
  // localStorage es del origen de la web: /api/health es del mismo origen (proxy) y no carga la aplicación.
  await page.goto('/api/health');
  await page.evaluate(([clave, valor]) => localStorage.setItem(clave, valor), [CLAVE_SESION, JSON.stringify(sesion)]);
  const comprobacion = page.waitForResponse((respuesta) => new URL(respuesta.url()).pathname === '/api/auth/me');
  await page.goto('/panel');
  const respuesta = await comprobacion.catch(() => null);
  if (respuesta?.ok()) {
    await expect(page).toHaveURL(/\/panel$/);
    return true;
  }
  almacen.olvidar(email);
  await page.evaluate((clave) => localStorage.removeItem(clave), CLAVE_SESION);
  return false;
}
