// T04-4 · E2E de US-04 (recuperar la contraseña). Casos: docs/especificacion/E01-E02 (US-04).
// Usa la plantilla de T12-7 (`entrar`) y el buzón local de Supabase (Mailpit, http://127.0.0.1:54324).
//
// Las cuentas de la semilla no se tocan: cambiarles la contraseña rompería los demás specs.
// Cada caso registra su propia cuenta con un email único (POST /api/auth/registro) y la confirma
// con el enlace del buzón (POST /api/auth/confirmar).
//
// Plantillas: test-env:up solo copia config.toml y las migraciones, y config.toml no tiene
// [auth.email.template.*]. En local los emails usan la plantilla por defecto de Supabase, que enlaza
// a /auth/v1/verify?token=<token_hash>&type=... en lugar de a la web. Por eso los casos sacan el
// parámetro `token` (es el token_hash) y abren /restablecer-contrasena?token_hash=<token>&type=recovery,
// el mismo destino que tendría la plantilla supabase/templates/recuperar-contrasena.html.
// CA10 (asunto y botón de esa plantilla) queda en fixme hasta que el entorno la aplique (ver #89).
//
// CA11 (caducidad a los 3600 s) y CA24 (token_hash fuera de los logs) se comprueban a mano.
import { test, expect, entrar } from '../fixtures.js';

const BUZON = 'http://127.0.0.1:54324/api/v1';
const ANTIGUA = 'Antigua2025';
const NUEVA = 'Natacio2026!';

const CONFIRMACION = 'Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña. Caduca en 1 hora.';
const CAMBIADA = 'Contraseña cambiada. Ya puedes entrar con la nueva.';
const DEMASIADOS = 'Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.';
const ERROR_GENERICO = 'No se ha podido completar la acción. Inténtalo de nuevo.';
const ENLACE_INVALIDO_API = 'El enlace para cambiar la contraseña no es válido o ha caducado.';
const ENLACE_INVALIDO_WEB = 'El enlace para cambiar la contraseña no es válido, ya se ha usado o ha caducado.';
const MINIMO = 'La contraseña debe tener al menos 8 caracteres.';
const LARGA = 'La contraseña es demasiado larga.';
const NO_COINCIDEN = 'Las contraseñas no coinciden.';

// Un enlace con un token inventado: sirve para las pruebas de la web que interceptan la API.
const ENLACE_FALSO = '/restablecer-contrasena?token_hash=token-de-prueba&type=recovery';

// ---------------------------------------------------------------- buzón y cuentas

let secuencia = 0;
function emailUnico(prefijo = 'us04') {
  secuencia += 1;
  return `${prefijo}-${Date.now()}-${secuencia}@ejemplo.com`;
}

// Emails recibidos por esa dirección, del más reciente al más antiguo.
async function emailsDe(request, email) {
  const res = await request.get(`${BUZON}/search`, { params: { query: `to:"${email}"` } });
  expect(res.ok()).toBe(true);
  return (await res.json()).messages;
}

// Espera a que la dirección tenga `cuantos` emails y devuelve el enlace del último:
// { asunto, texto, url, tipo, token }. `token` es el token_hash, venga como `token_hash`
// (plantillas del proyecto) o como `token` (plantilla por defecto de Supabase).
async function esperarEmail(request, email, cuantos) {
  let emails = [];
  await expect.poll(async () => (emails = await emailsDe(request, email)).length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(cuantos);
  const res = await request.get(`${BUZON}/message/${emails[0].ID}`);
  expect(res.ok()).toBe(true);
  const { Subject, HTML } = await res.json();
  const [, href, texto] = HTML.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/);
  const url = new URL(href.replaceAll('&amp;', '&'));
  return {
    asunto: Subject,
    texto: texto.trim(),
    url,
    tipo: url.searchParams.get('type'),
    token: url.searchParams.get('token_hash') ?? url.searchParams.get('token'),
  };
}

// Registra una cuenta nueva con la contraseña ANTIGUA. Si `confirmada`, la confirma con el enlace del buzón.
async function crearCuenta(request, { confirmada = true, email = emailUnico() } = {}) {
  const res = await request.post('/api/auth/registro', {
    data: {
      nombre: 'Centro de prueba US-04',
      email,
      password: ANTIGUA,
      localidad: 'Barcelona',
      acepta_politica_privacidad: true,
    },
  });
  expect(res.status()).toBe(201);
  if (confirmada) {
    const { token, tipo } = await esperarEmail(request, email, 1);
    expect(tipo).toBe('signup');
    const confirmacion = await request.post('/api/auth/confirmar', { data: { token_hash: token, type: 'email' } });
    expect(confirmacion.status()).toBe(200);
  }
  return email;
}

// Pide un enlace por la API y devuelve su token_hash. `cuantos` = emails que tendrá la dirección
// después de este (el de registro cuenta como el primero).
async function pedirEnlace(request, email, cuantos = 2) {
  const res = await request.post('/api/auth/recuperar-contrasena', { data: { email } });
  expect(res.status()).toBe(204);
  const { token, tipo } = await esperarEmail(request, email, cuantos);
  expect(tipo).toBe('recovery');
  return token;
}

const enlace = (token) => `/restablecer-contrasena?token_hash=${encodeURIComponent(token)}&type=recovery`;

const restablecer = (request, token_hash, password) => request.post('/api/auth/restablecer-contrasena', {
  data: { token_hash, password },
});

const login = (request, email, password) => request.post('/api/auth/login', { data: { email, password } });

// ---------------------------------------------------------------- web

function formularios(page) {
  return {
    email: page.getByLabel('Email'),
    enviar: page.getByRole('button', { name: /^Enviar enlace$|^Enviando…$/ }),
    password: page.getByLabel('Contraseña nueva'),
    repetida: page.getByLabel('Repite la contraseña'),
    guardar: page.getByRole('button', { name: /^Guardar contraseña$|^Guardando…$/ }),
  };
}

async function guardarContrasena(page, password, repetida = password) {
  const f = formularios(page);
  await f.password.fill(password);
  await f.repetida.fill(repetida);
  await f.guardar.click();
}

// Cuenta las peticiones POST a una ruta de la API que hace el navegador.
function contarPeticiones(page, ruta) {
  const contador = { n: 0 };
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === ruta) contador.n += 1;
  });
  return contador;
}

const RECUPERAR = '/api/auth/recuperar-contrasena';
const RESTABLECER = '/api/auth/restablecer-contrasena';

// ---------------------------------------------------------------- flujos e2e

test.describe('US-04 · Recuperar la contraseña', () => {
  test('E2E-1 · camino feliz', async ({ page, request }) => {
    const email = await crearCuenta(request);

    // CA1: enlace en /entrar.
    await page.goto('/entrar');
    await page.getByRole('link', { name: '¿Has olvidado la contraseña?' }).click();
    await expect(page).toHaveURL('/recuperar-contrasena');
    // La URL cambia antes de que se pinte la página nueva: sin esperar al título, `fill` podría
    // escribir en el campo «Email» de /entrar.
    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();

    const f = formularios(page);
    await f.email.fill(email);
    await f.enviar.click();
    await expect(page.getByText(CONFIRMACION)).toBeVisible(); // CA16

    // Enlace del email: ver la cabecera (plantilla por defecto en local).
    const { token, tipo } = await esperarEmail(request, email, 2);
    expect(tipo).toBe('recovery');
    await page.goto(enlace(token));
    await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible();
    await guardarContrasena(page, NUEVA);

    // CA5: vuelve a /entrar con el aviso verde.
    await expect(page).toHaveURL('/entrar');
    await expect(page.getByRole('status').filter({ hasText: CAMBIADA })).toBeVisible();

    await entrar(page, email, NUEVA);

    // Sin sesión, la contraseña anterior ya no sirve.
    await page.evaluate(() => globalThis.localStorage.clear());
    await page.goto('/entrar');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(ANTIGUA);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible();
  });

  test('E2E-2 · email no registrado', async ({ page, request }) => {
    const nadie = 'nadie@ejemplo.com';
    await page.goto('/recuperar-contrasena');
    const f = formularios(page);
    await f.email.fill(nadie);
    await f.enviar.click();
    await expect(page.getByText(CONFIRMACION)).toBeVisible();

    // No hay un evento que esperar si no se envía nada: se da margen al servidor de correo.
    await page.waitForTimeout(2_000);
    expect(await emailsDe(request, nadie)).toHaveLength(0);
  });

  test('E2E-3 · enlace reutilizado', async ({ page, request }) => {
    const email = await crearCuenta(request);
    await page.goto('/recuperar-contrasena');
    await formularios(page).email.fill(email);
    await formularios(page).enviar.click();
    await expect(page.getByText(CONFIRMACION)).toBeVisible();
    const { token } = await esperarEmail(request, email, 2);

    await page.goto(enlace(token));
    await guardarContrasena(page, NUEVA);
    await expect(page).toHaveURL('/entrar');

    // CA12 en la web: el mismo enlace ya no sirve.
    await page.goto(enlace(token));
    await guardarContrasena(page, 'Otra2026!!');
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
    await expect(page.getByText(ENLACE_INVALIDO_WEB)).toBeVisible();
    await page.getByRole('button', { name: 'Pedir otro enlace' }).click();
    await expect(page).toHaveURL('/recuperar-contrasena');
  });

  test('E2E-4 · validación sin llamar a la API', async ({ page, request }) => {
    const email = await crearCuenta(request);
    const token = await pedirEnlace(request, email);
    const envios = contarPeticiones(page, RESTABLECER);
    await page.goto(enlace(token));

    await guardarContrasena(page, 'abc');
    await expect(page.getByText(MINIMO)).toBeVisible();

    await guardarContrasena(page, NUEVA, 'Natacio2026?'); // CA8
    await expect(page.getByText(NO_COINCIDEN)).toBeVisible();
    await expect(page).toHaveURL(enlace(token));
    expect(envios.n).toBe(0);
  });

  test('E2E-5 · el cambio cierra las sesiones de otros navegadores', async ({ browser, request }, testInfo) => {
    const { baseURL, locale, timezoneId } = testInfo.project.use;
    const opciones = { baseURL, locale, timezoneId };
    const email = await crearCuenta(request);

    // Navegador A: sesión abierta y reloj controlado para provocar la renovación del token.
    const contextoA = await browser.newContext(opciones);
    const a = await contextoA.newPage();
    await a.clock.install();
    await entrar(a, email, ANTIGUA);
    const { refresh_token: refreshA } = await a.evaluate(() => JSON.parse(globalThis.localStorage.getItem('sportsplace.sesion')));

    // Navegador B: cambia la contraseña con el enlace.
    const token = await pedirEnlace(request, email);
    const contextoB = await browser.newContext(opciones);
    const b = await contextoB.newPage();
    await b.goto(enlace(token));
    await guardarContrasena(b, NUEVA);
    await expect(b).toHaveURL('/entrar');

    // La web renueva el token 60 s antes de que caduque (1 h): se adelanta el reloj de A.
    const renovacion = a.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/refresh');
    await a.clock.fastForward('59:30');
    expect((await renovacion).status()).toBe(401);
    await expect(a).toHaveURL('/entrar');

    // CA14: el refresh_token de A ya no sirve.
    const res = await request.post('/api/auth/refresh', { data: { refresh_token: refreshA } });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe('NO_AUTENTICADO');

    await contextoA.close();
    await contextoB.close();
  });

  // ---------------------------------------------------------------- resto de criterios de la web

  test('CA2 · páginas públicas, con y sin sesión', async ({ page, cuentas }) => {
    for (const conSesion of [false, true]) {
      if (conSesion) await entrar(page, cuentas.centroA, cuentas.password);
      await page.goto('/recuperar-contrasena');
      await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
      await expect(page).toHaveURL('/recuperar-contrasena');
      await page.goto(ENLACE_FALSO);
      await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible();
      await expect(page).toHaveURL(ENLACE_FALSO);
    }
  });

  test('CA3 · «Volver a entrar» lleva a /entrar', async ({ page }) => {
    await page.goto('/recuperar-contrasena');
    await page.getByRole('link', { name: 'Volver a entrar' }).click();
    await expect(page).toHaveURL('/entrar');
  });

  test('CA4 · enlace sin token_hash o de otro tipo: «Enlace no válido» sin llamar a la API', async ({ page }) => {
    const envios = contarPeticiones(page, RESTABLECER);
    for (const ruta of ['/restablecer-contrasena', '/restablecer-contrasena?token_hash=abc&type=signup']) {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
      await expect(page.getByText(ENLACE_INVALIDO_WEB)).toBeVisible();
    }
    expect(envios.n).toBe(0);
  });

  test('CA5 · tras guardar se borran los tokens guardados', async ({ page, cuentas }) => {
    await entrar(page, cuentas.centroA, cuentas.password);
    // Se intercepta la API: la cuenta de la semilla no debe cambiar de contraseña.
    await page.route(`**${RESTABLECER}`, (route) => route.fulfill({ status: 204 }));
    // Al cargar, la web comprueba la sesión guardada con GET /api/auth/me. Se espera a que termine:
    // si llega después de guardar, vuelve a poner al usuario que la página acaba de olvidar.
    const comprobada = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/auth/me');
    await page.goto(ENLACE_FALSO);
    await comprobada;
    await guardarContrasena(page, NUEVA);
    await expect(page).toHaveURL('/entrar');
    await expect(page.getByRole('status').filter({ hasText: CAMBIADA })).toBeVisible();
    expect(await page.evaluate(() => globalThis.localStorage.getItem('sportsplace.sesion'))).toBeNull();
  });

  test.describe('CA6 · email', () => {
    // Email válido de n caracteres: 64 + «@» + (n - 69) + «.com».
    const largo = (n) => `${'a'.repeat(64)}@${'b'.repeat(n - 69)}.com`;
    for (const [nombre, valor, error] of [
      ['vacío', '', 'El email es obligatorio.'],
      ['centro@ejemplo', 'centro@ejemplo', 'El email no es válido.'],
      ['254 caracteres', largo(254), null],
      ['255 caracteres', largo(255), 'El email no es válido.'],
    ]) {
      test(nombre, async ({ page }) => {
        const envios = contarPeticiones(page, RECUPERAR);
        await page.goto('/recuperar-contrasena');
        await formularios(page).email.fill(valor);
        await formularios(page).enviar.click();
        if (error) {
          await expect(page.getByText(error)).toBeVisible();
          expect(envios.n).toBe(0);
        } else {
          await expect(page.getByText(CONFIRMACION)).toBeVisible();
          expect(envios.n).toBe(1);
        }
      });
    }
  });

  test.describe('CA7 · contraseña nueva', () => {
    // 'ñ' ocupa 2 bytes en UTF-8: 36 'ñ' son 72 bytes (y 36 caracteres).
    for (const [nombre, valor, error] of [
      ['8 caracteres', 'abcdefg1', null],
      ['7 caracteres', 'abcdefg', MINIMO],
      ['72 bytes', 'ñ'.repeat(36), null],
      ['73 bytes', `${'ñ'.repeat(36)}a`, LARGA],
      ['vacía', '', 'La contraseña es obligatoria.'],
      ['sin recortar espacios', '  abcd  ', null],
    ]) {
      test(nombre, async ({ page }) => {
        const cuerpos = [];
        await page.route(`**${RESTABLECER}`, (route) => {
          cuerpos.push(route.request().postDataJSON());
          return route.fulfill({ status: 204 });
        });
        await page.goto(ENLACE_FALSO);
        await guardarContrasena(page, valor);
        if (error) {
          await expect(page.getByText(error)).toBeVisible();
          expect(cuerpos).toHaveLength(0);
        } else {
          await expect(page).toHaveURL('/entrar');
          expect(cuerpos).toEqual([{ token_hash: 'token-de-prueba', password: valor }]);
        }
      });
    }
  });

  test('CA9 · «Enviando…» y deshabilitado mientras responde la API', async ({ page }) => {
    await page.route(`**${RECUPERAR}`, async (route) => {
      await new Promise((r) => setTimeout(r, 1_500));
      return route.continue();
    });
    await page.goto('/recuperar-contrasena');
    await formularios(page).email.fill(emailUnico('sin-cuenta'));
    await formularios(page).enviar.click();
    const enviando = page.getByRole('button', { name: 'Enviando…' });
    await expect(enviando).toBeVisible();
    await expect(enviando).toBeDisabled();
    await expect(page.getByText(CONFIRMACION)).toBeVisible();
  });

  // CA17 y CA18 en los dos formularios. Los errores de servidor se simulan con page.route.
  const FORMULARIOS = {
    recuperar: {
      ruta: '/recuperar-contrasena',
      api: RECUPERAR,
      rellenar: (page) => formularios(page).email.fill('centro@ejemplo.com'),
      enviar: (page) => formularios(page).enviar.click(),
      conserva: async (page) => expect(formularios(page).email).toHaveValue('centro@ejemplo.com'),
    },
    restablecer: {
      ruta: ENLACE_FALSO,
      api: RESTABLECER,
      rellenar: async (page) => {
        await formularios(page).password.fill(NUEVA);
        await formularios(page).repetida.fill(NUEVA);
      },
      enviar: (page) => formularios(page).guardar.click(),
      conserva: async (page) => {
        await expect(formularios(page).password).toHaveValue(NUEVA);
        await expect(formularios(page).repetida).toHaveValue(NUEVA);
      },
    },
  };

  for (const [nombre, formulario] of Object.entries(FORMULARIOS)) {
    for (const [caso, responder, mensaje] of [
      ['CA17 · 429', (route) => route.fulfill({ status: 429, json: { error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos.' } } }), DEMASIADOS],
      ['CA18 · 503', (route) => route.fulfill({ status: 503, json: { error: { code: 'AUTH_NO_DISPONIBLE', message: 'No disponible.' } } }), ERROR_GENERICO],
      ['CA18 · red caída', (route) => route.abort('failed'), ERROR_GENERICO],
    ]) {
      test(`${caso} en ${nombre}: aviso rojo y campos conservados`, async ({ page }) => {
        await page.route(`**${formulario.api}`, responder);
        await page.goto(formulario.ruta);
        await formulario.rellenar(page);
        await formulario.enviar(page);
        await expect(page.getByRole('alert').filter({ hasText: mensaje })).toBeVisible();
        await formulario.conserva(page);
      });
    }
  }

  // ---------------------------------------------------------------- API

  test('CA12 · el enlace solo sirve una vez', async ({ request }) => {
    const email = await crearCuenta(request);
    const token = await pedirEnlace(request, email);
    expect((await restablecer(request, token, NUEVA)).status()).toBe(204);

    const otra = await restablecer(request, token, 'Otra2026!!');
    expect(otra.status()).toBe(400);
    expect((await otra.json()).error).toMatchObject({ code: 'ENLACE_INVALIDO', message: ENLACE_INVALIDO_API });
  });

  test('CA13 · con dos enlaces solo funciona el último', async ({ request }) => {
    const email = await crearCuenta(request);
    const primero = await pedirEnlace(request, email, 2);
    // config.toml: max_frequency = "1s" entre dos emails de recuperación a la misma cuenta.
    await new Promise((r) => setTimeout(r, 1_500));
    const segundo = await pedirEnlace(request, email, 3);
    expect(segundo).not.toBe(primero);

    const conPrimero = await restablecer(request, primero, NUEVA);
    expect(conPrimero.status()).toBe(400);
    expect((await conPrimero.json()).error.code).toBe('ENLACE_INVALIDO');
    expect((await restablecer(request, segundo, NUEVA)).status()).toBe(204);
  });

  test('CA14 · la contraseña anterior y las sesiones abiertas dejan de servir', async ({ request }) => {
    const email = await crearCuenta(request);
    const abierta = await login(request, email, ANTIGUA);
    expect(abierta.status()).toBe(200);
    const { refresh_token } = (await abierta.json()).sesion;

    const token = await pedirEnlace(request, email);
    expect((await restablecer(request, token, NUEVA)).status()).toBe(204);

    const anterior = await login(request, email, ANTIGUA);
    expect(anterior.status()).toBe(401);
    expect((await anterior.json()).error.code).toBe('CREDENCIALES_INCORRECTAS');

    const renovar = await request.post('/api/auth/refresh', { data: { refresh_token } });
    expect(renovar.status()).toBe(401);
    expect((await renovar.json()).error.code).toBe('NO_AUTENTICADO');

    expect((await login(request, email, NUEVA)).status()).toBe(200);
  });

  // Fallo de la aplicación: al verificar el enlace de recuperación, Supabase Auth confirma el email
  // de la cuenta, y el login posterior responde 200 en lugar de 403. Se activa cuando se corrija
  // Fallo abierto en #152.
  test.fixme('CA15 · cambiar la contraseña no confirma el email', async ({ request }) => {
    const email = await crearCuenta(request, { confirmada: false });
    const token = await pedirEnlace(request, email);
    expect((await restablecer(request, token, NUEVA)).status()).toBe(204);

    const res = await login(request, email, NUEVA);
    expect(res.status()).toBe(403);
    expect((await res.json()).error.code).toBe('EMAIL_NO_CONFIRMADO');
  });

  test('CA19 · POST /api/auth/recuperar-contrasena', async ({ request }) => {
    const ok = await request.post(RECUPERAR, { data: { email: emailUnico('sin-cuenta') } });
    expect(ok.status()).toBe(204);
    expect(await ok.text()).toBe('');

    for (const [cuerpo, mensaje] of [
      [{}, 'El email es obligatorio.'],
      [{ email: 'centro@ejemplo' }, 'El email no es válido.'],
    ]) {
      const res = await request.post(RECUPERAR, { data: cuerpo });
      expect(res.status()).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('DATOS_INVALIDOS');
      expect(error.details.email).toBe(mensaje);
    }

    const roto = await request.post(RECUPERAR, {
      headers: { 'Content-Type': 'application/json' },
      data: '{"email": ',
    });
    expect(roto.status()).toBe(400);
    expect((await roto.json()).error.code).toBe('JSON_INVALIDO');
  });

  test('CA20 · POST /api/auth/restablecer-contrasena: errores', async ({ request }) => {
    const vacio = await request.post(RESTABLECER, { data: {} });
    expect(vacio.status()).toBe(400);
    expect((await vacio.json()).error).toMatchObject({
      code: 'DATOS_INVALIDOS',
      details: { token_hash: 'Falta el token del enlace.', password: 'La contraseña es obligatoria.' },
    });

    for (const [password, mensaje] of [['abcdefg', MINIMO], [`${'ñ'.repeat(36)}a`, LARGA]]) {
      const res = await restablecer(request, 'token-de-prueba', password);
      expect(res.status()).toBe(400);
      expect((await res.json()).error.details.password).toBe(mensaje);
    }

    const inventado = await restablecer(request, 'token-de-prueba', NUEVA);
    expect(inventado.status()).toBe(400);
    expect((await inventado.json()).error).toMatchObject({ code: 'ENLACE_INVALIDO', message: ENLACE_INVALIDO_API });
  });

  test('CA21 y CA26 · no-store, sin sesión y misma contraseña aceptada', async ({ request }) => {
    const email = await crearCuenta(request);
    const pedir = await request.post(RECUPERAR, { data: { email } });
    expect(pedir.status()).toBe(204);
    expect(pedir.headers()['cache-control']).toBe('no-store');
    expect(await pedir.text()).toBe('');

    const { token } = await esperarEmail(request, email, 2);
    const cambio = await restablecer(request, token, ANTIGUA); // CA26: la misma que tenía
    expect(cambio.status()).toBe(204);
    expect(cambio.headers()['cache-control']).toBe('no-store');
    expect(await cambio.text()).toBe('');

    expect((await login(request, email, ANTIGUA)).status()).toBe(200);
  });

  test('CA23 · misma respuesta con email registrado, no registrado y sin confirmar', async ({ request }) => {
    const emails = [
      await crearCuenta(request),
      emailUnico('sin-cuenta'),
      await crearCuenta(request, { confirmada: false }),
    ];
    const respuestas = [];
    for (const email of emails) {
      const res = await request.post(RECUPERAR, { data: { email } });
      const cabeceras = { ...res.headers() };
      delete cabeceras.date;
      respuestas.push({ status: res.status(), cuerpo: await res.text(), cabeceras });
    }
    expect(respuestas[0].status).toBe(204);
    expect(respuestas[1]).toEqual(respuestas[0]);
    expect(respuestas[2]).toEqual(respuestas[0]);
  });

  test('CA25 · el email se normaliza', async ({ request }) => {
    const email = await crearCuenta(request, { email: emailUnico('piscina').replace('@ejemplo.com', '@clubnatacio.cat') });
    const escrito = `  ${email.replace('piscina', 'Piscina').replace('clubnatacio.cat', 'ClubNatacio.CAT')} `;
    const res = await request.post(RECUPERAR, { data: { email: escrito } });
    expect(res.status()).toBe(204);
    const { tipo } = await esperarEmail(request, email, 2);
    expect(tipo).toBe('recovery');
  });

  // ---------------------------------------------------------------- plantilla (CA10)

  // test-env:up no aplica supabase/templates/recuperar-contrasena.html: config.toml no tiene
  // [auth.email.template.recovery] y solo se copian config.toml y las migraciones. En local llega la
  // plantilla por defecto («Reset your password»). Se activa cuando el entorno la aplique (ver #89).
  test.fixme('CA10 · asunto, botón y enlace de la plantilla', async ({ request }) => {
    const email = await crearCuenta(request);
    await request.post(RECUPERAR, { data: { email } });
    const { asunto, texto, url, tipo, token } = await esperarEmail(request, email, 2);
    expect(asunto).toBe('Cambia tu contraseña de Sportsplace');
    expect(texto).toBe('Cambiar contraseña');
    expect(`${url.origin}${url.pathname}`).toBe('http://127.0.0.1:4173/restablecer-contrasena');
    expect(tipo).toBe('recovery');
    expect(url.searchParams.get('token_hash')).toBe(token);
  });
});
