import assert from 'node:assert/strict';
import { createDatabase } from '../backend/src/database.js';
import { loadTestEnvironment } from './environment.js';

// /health no demuestra conexión a PostgreSQL. Esta comprobación sí usa el
// mismo cliente y TLS verificado que el backend, y exige la semilla de QA.
export default async function globalSetup() {
  const environment = loadTestEnvironment();
  const database = createDatabase({ environment });
  try {
    assert.deepEqual(await database.check({ includeSchema: true }), { connected: true, centrosExists: true });
    const emails = [environment.E2E_CENTRO_A_EMAIL, environment.E2E_CENTRO_B_EMAIL, environment.E2E_SIN_CONFIRMAR_EMAIL];
    const { rows } = await database.query(
      `SELECT c.email, c.email_confirmado, (u.email_confirmed_at IS NOT NULL) AS auth_confirmado
       FROM public.centros c JOIN auth.users u ON u.id = c.usuario_id WHERE c.email = ANY($1::text[])`,
      [emails],
    );
    assert.equal(rows.length, 3, 'La base de pruebas debe tener los tres centros de la semilla de T12-8.');
    for (const [index, email] of emails.entries()) {
      const centro = rows.find((row) => row.email === email);
      assert.ok(centro, 'Falta un centro de prueba.');
      assert.equal(centro.email_confirmado, index < 2, 'Confirmación del centro incorrecta.');
      assert.equal(centro.auth_confirmado, index < 2, 'Confirmación de Auth incorrecta.');
    }
  } finally {
    await database.close();
  }
}
