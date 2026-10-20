import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../src/errors.js';
import { createCentrosRepository } from '../src/repositories/centros.js';

// Doble de la base de datos: registra las consultas y simula la transacción.
function fakeDatabase({ insertError } = {}) {
  const log = [];
  const client = {
    async query(sql, values) {
      log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
      if (sql.includes('INSERT') && insertError) throw insertError;
      return { rows: [{ id: 'centro-1' }] };
    },
  };
  return {
    log,
    async transaction(callback) {
      log.push('BEGIN');
      try {
        const result = await callback(client);
        log.push('COMMIT');
        return result;
      } catch (error) {
        log.push('ROLLBACK');
        throw error;
      }
    },
    query: client.query,
  };
}

const centro = {
  nombre: 'Club', email: 'centro@example.com', localidad: 'Barcelona',
  direccion: null, codigo_postal: '08001', telefono: null,
};

test('registrar guarda el centro, crea la cuenta y enlaza usuario_id en una transacción', async () => {
  const database = fakeDatabase();
  const usuario = await createCentrosRepository(database).registrar(centro, async () => ({ id: 'u1' }));

  assert.deepEqual(usuario, { id: 'u1' });
  assert.equal(database.log[0], 'BEGIN');
  assert.match(database.log[1].sql, /^INSERT INTO public\.centros .* TRUE, now\(\)\) RETURNING id$/);
  assert.deepEqual(database.log[1].values, ['Club', 'centro@example.com', 'Barcelona', null, '08001', null]);
  assert.deepEqual(database.log[2], {
    sql: 'UPDATE public.centros SET usuario_id = $1 WHERE id = $2',
    values: ['u1', 'centro-1'],
  });
  assert.equal(database.log[3], 'COMMIT');
});

test('un email repetido en centros devuelve 409 sin crear la cuenta', async () => {
  const database = fakeDatabase({ insertError: Object.assign(new Error('duplicate'), { code: '23505' }) });
  let cuentas = 0;

  await assert.rejects(
    createCentrosRepository(database).registrar(centro, async () => { cuentas += 1; }),
    { status: 409, code: 'EMAIL_YA_REGISTRADO' },
  );
  assert.equal(cuentas, 0);
  assert.equal(database.log.at(-1), 'ROLLBACK');
});

test('si la cuenta no se puede crear, el centro no se guarda', async () => {
  const database = fakeDatabase();
  const authError = new ApiError(429, 'DEMASIADOS_INTENTOS', 'Espera.');

  await assert.rejects(createCentrosRepository(database).registrar(centro, async () => { throw authError; }), authError);
  assert.equal(database.log.at(-1), 'ROLLBACK');
});

test('otros errores de PostgreSQL se ocultan como 503', async (t) => {
  t.mock.method(console, 'error', () => {});
  const database = fakeDatabase({ insertError: Object.assign(new Error('password=secreta'), { code: '08006' }) });

  await assert.rejects(
    createCentrosRepository(database).registrar(centro, async () => ({ id: 'u1' })),
    (error) => error.status === 503 && error.code === 'BASE_DATOS_NO_DISPONIBLE' && !error.message.includes('secreta'),
  );
});

test('marcarEmailConfirmado solo rellena la fecha la primera vez', async () => {
  const database = fakeDatabase();
  await createCentrosRepository(database).marcarEmailConfirmado('u1', '2026-10-09T10:00:00Z');

  assert.deepEqual(database.log, [{
    sql: 'UPDATE public.centros SET email_confirmado_en = $2 WHERE usuario_id = $1 AND email_confirmado_en IS NULL',
    values: ['u1', '2026-10-09T10:00:00Z'],
  }]);
});
