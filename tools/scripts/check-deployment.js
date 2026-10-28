import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';

async function main() {
  let base;
  try {
    base = new URL(process.argv[2]);
  } catch {
    throw new Error('Uso: npm --prefix tools run deploy:check -- https://URL-DEL-ENTORNO');
  }
  assert.ok(['http:', 'https:'].includes(base.protocol), 'La URL debe usar HTTP o HTTPS.');
  assert.ok(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/',
    'Indica solo el origen del entorno, sin credenciales, ruta ni parámetros.');

  const get = (path, accept) => fetch(new URL(path, base), {
    headers: { Accept: accept },
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await get('/api/health', 'application/json');
      if (response.ok) {
        const body = await response.json();
        ready = body.status === 'ok' && body.service === 'sportsplace-api';
      }
    } catch { /* El contenedor o el alojamiento pueden estar arrancando. */ }
    if (ready) break;
    await wait(2_000);
  }
  assert.ok(ready, 'La API no respondió correctamente dentro del tiempo de arranque.');

  const root = await get('/', 'text/html');
  assert.equal(root.status, 200, 'La web debe responder 200.');
  assert.match(root.headers.get('content-type') || '', /text\/html/, 'La web debe servir HTML.');
  const html = await root.text();
  const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"/i)?.[1];
  assert.ok(script, 'Falta el JavaScript compilado de la web.');
  const assetUrl = new URL(script, base);
  assert.equal(assetUrl.origin, base.origin, 'Los assets de la web deben estar en el mismo origen.');
  const asset = await get(assetUrl.pathname, '*/*');
  assert.equal(asset.status, 200, 'El JavaScript compilado debe estar accesible.');
  assert.match(asset.headers.get('content-type') || '', /(?:java|ecma)script/);
  await asset.arrayBuffer();

  for (const path of ['/entrar', '/anuncios/nuevo', '/anuncios/00000000-0000-4000-8000-000000000001']) {
    const response = await get(path, 'text/html');
    assert.equal(response.status, 200, `Debe poder abrirse directamente ${path}.`);
    assert.equal(await response.text(), html, `Falta el fallback SPA en ${path}.`);
  }

  const missingApi = await get('/api/t12-6-ruta-inexistente', 'application/json');
  assert.equal(missingApi.status, 404);
  assert.match(missingApi.headers.get('content-type') || '', /application\/json/);
  assert.equal((await missingApi.json()).error.code, 'NO_ENCONTRADO');
  const missingAsset = await get('/assets/t12-6-inexistente.js', '*/*');
  assert.equal(missingAsset.status, 404);
  assert.notEqual(await missingAsset.text(), html, 'Un asset ausente no debe devolver la SPA.');

  console.log('Despliegue HTTP verificado: web compilada, rutas SPA, API y assets en el mismo origen.');
  console.log('Esta comprobación no acredita conexión PostgreSQL, Auth ni criterios funcionales de QA.');
}

main().catch((error) => {
  console.error(`Comprobación de despliegue fallida: ${error.message}`);
  process.exitCode = 1;
});
