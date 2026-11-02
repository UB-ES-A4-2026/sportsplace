import assert from 'node:assert/strict';
import test from 'node:test';
import { createCentrosRepository } from '../src/repositories/centros.js';

// US-04 CA15 (#152): cuentaConfirmada consulta auth.users con un doble de la base de datos.
function fakeDatabase(respuesta) {
  const log = [];
  return {
    log,
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      if (respuesta instanceof Error) throw respuesta;
      return { rows: respuesta };
    },
  };
}

test('US-04 CA15: consulta auth.users por el email normalizado', async () => {
  const database = fakeDatabase([{ confirmada: true }]);
  assert.equal(await createCentrosRepository(database).cuentaConfirmada('piscina@clubnatacio.cat'), true);
  assert.deepEqual(database.log, [{
    sql: 'SELECT email_confirmed_at IS NOT NULL AS confirmada FROM auth.users WHERE lower(email) = $1 LIMIT 1',
    values: ['piscina@clubnatacio.cat'],
  }]);
});

test('US-04 CA15: una cuenta sin confirmar o un email sin cuenta no cuentan como confirmados', async () => {
  assert.equal(await createCentrosRepository(fakeDatabase([{ confirmada: false }])).cuentaConfirmada('a@b.com'), false);
  assert.equal(await createCentrosRepository(fakeDatabase([])).cuentaConfirmada('a@b.com'), false);
});

test('US-04: si PostgreSQL falla, 503 BASE_DATOS_NO_DISPONIBLE sin detalles', async () => {
  const caida = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
  await assert.rejects(createCentrosRepository(fakeDatabase(caida)).cuentaConfirmada('a@b.com'), {
    status: 503, code: 'BASE_DATOS_NO_DISPONIBLE',
  });
});
