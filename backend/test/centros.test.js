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
  assert.match(database.log[1].sql, /^INSERT INTO public\.centros .* TRUE, now\(\) FROM \(SELECT 1\) AS fila LEFT JOIN public\.codigos_postales cp ON cp\.codigo_postal = \$5 RETURNING id$/);
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

test('US-07: centroDelUsuario busca el centro por usuario_id', async () => {
  const database = fakeDatabase();
  const encontrado = await createCentrosRepository(database).centroDelUsuario('u1');

  assert.deepEqual(encontrado, { id: 'centro-1' });
  assert.match(database.log[0].sql, /^SELECT id, nombre, email, .* creado_en, .* FROM public\.centros WHERE usuario_id = \$1$/);
  assert.deepEqual(database.log[0].values, ['u1']);
});

test('US-07 CA18 y CA21: actualizarPerfil solo cambia los campos recibidos y actualizado_en', async () => {
  const database = fakeDatabase();
  await createCentrosRepository(database).actualizarPerfil('u1', { web: null, nombre: 'Club' });

  assert.match(
    database.log[0].sql,
    /^UPDATE public\.centros SET nombre = \$2, web = \$3, actualizado_en = now\(\) WHERE usuario_id = \$1 RETURNING id, /,
  );
  assert.deepEqual(database.log[0].values, ['u1', 'Club', null]);
});

test('US-07 CA21: un PATCH vacío también actualiza actualizado_en', async () => {
  const database = fakeDatabase();
  await createCentrosRepository(database).actualizarPerfil('u1', {});

  assert.match(database.log[0].sql, /^UPDATE public\.centros SET actualizado_en = now\(\) WHERE usuario_id = \$1 /);
  assert.deepEqual(database.log[0].values, ['u1']);
});

test('US-07: los errores de PostgreSQL al leer o editar el perfil se ocultan como 503', async (t) => {
  t.mock.method(console, 'error', () => {});
  const fallo = Object.assign(new Error('password=secreta'), { code: '08006' });
  const repositorio = createCentrosRepository({ query: async () => { throw fallo; } });

  for (const promesa of [repositorio.centroDelUsuario('u1'), repositorio.actualizarPerfil('u1', { nombre: 'Club' })]) {
    await assert.rejects(promesa, (error) => error.status === 503 && !error.message.includes('secreta'));
  }
});

test('US-68 CA13: centroDelUsuario devuelve provincia y coordenadas como números', async () => {
  const database = fakeDatabase();
  await createCentrosRepository(database).centroDelUsuario('u1');

  assert.match(database.log[0].sql, /provincia, latitud::float8 AS latitud, longitud::float8 AS longitud FROM/);
});

test('US-68 CA7: actualizarUbicacion copia provincia y coordenadas del código postal en una sola sentencia', async () => {
  const database = { log: [], async query(sql, values) {
    this.log.push({ sql: sql.replace(/\s+/g, ' ').trim(), values });
    return { rows: [{ codigo_conocido: true, id: 'centro-1', provincia: 'Barcelona' }] };
  } };
  const centro = await createCentrosRepository(database).actualizarUbicacion('u1', {
    direccion: null, codigo_postal: '08025', localidad: 'Barcelona',
  });

  assert.deepEqual(centro, { id: 'centro-1', provincia: 'Barcelona' });
  assert.equal(database.log.length, 1);
  assert.match(database.log[0].sql, /AS cp_longitud FROM public\.codigos_postales WHERE codigo_postal = \$3/);
  assert.match(database.log[0].sql, /provincia = cp_provincia, latitud = cp_latitud, longitud = cp_longitud, actualizado_en = now\(\) FROM cp WHERE usuario_id = \$1/);
  assert.deepEqual(database.log[0].values, ['u1', null, '08025', 'Barcelona']);
});

test('US-68 CA5: actualizarUbicacion con un código que no está en la tabla → 400 CODIGO_POSTAL_DESCONOCIDO', async () => {
  const repositorio = createCentrosRepository({
    query: async () => ({ rows: [{ codigo_conocido: false, id: null }] }),
  });

  await assert.rejects(
    repositorio.actualizarUbicacion('u1', { direccion: null, codigo_postal: '52998', localidad: 'Melilla' }),
    (error) => error instanceof ApiError && error.status === 400 && error.code === 'CODIGO_POSTAL_DESCONOCIDO'
      && error.details.codigo_postal === 'No conocemos este código postal. Revísalo.',
  );
});

test('US-68: actualizarUbicacion devuelve null si la cuenta no tiene centro y oculta los errores como 503', async (t) => {
  const sinCentro = createCentrosRepository({ query: async () => ({ rows: [{ codigo_conocido: true, id: null }] }) });
  assert.equal(await sinCentro.actualizarUbicacion('u3', { direccion: null, codigo_postal: '08025', localidad: 'B' }), null);

  t.mock.method(console, 'error', () => {});
  const fallo = Object.assign(new Error('password=secreta'), { code: '08006' });
  const caido = createCentrosRepository({ query: async () => { throw fallo; } });
  await assert.rejects(
    caido.actualizarUbicacion('u1', { direccion: null, codigo_postal: '08025', localidad: 'B' }),
    (error) => error.status === 503 && !error.message.includes('secreta'),
  );
});
