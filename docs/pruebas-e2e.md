# T12-7 · E2E en CI y plantilla para QA

El job **E2E (Playwright)** arranca la web y la API reales y utiliza el Supabase
local aislado de T12-8 (#88). Antes de abrir el navegador comprueba PostgreSQL
con el cliente del backend y TLS verificado, las migraciones y los tres centros
de la semilla. No carga el `.env` del proyecto compartido.

## Desde un clon limpio

Requisitos: Node.js 24, npm y Docker con contenedores Linux en funcionamiento.
Desde la raíz, en PowerShell, Linux o macOS:

```bash
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix tools ci
npm --prefix e2e ci
cd e2e
npx playwright install --with-deps chromium
cd ..
npm --prefix tools run test-env:up
npm --prefix e2e test
```

`test-env:up` pertenece a T12-8: la PR de T12-7 depende de su integración.
Genera `.e2e/runtime.env` y el certificado local, ambos fuera de Git. La primera
ejecución descarga las imágenes de Supabase. No hace falta una cuenta de Supabase
ni añadir secretos cloud a GitHub. Los puertos 4173 (web) y 4300 (API) deben estar
libres; Playwright se niega a reutilizar servidores ajenos.

```bash
npm --prefix e2e run lint
npm --prefix e2e run test:unit
npm --prefix e2e run test:headed
npm --prefix e2e run report
npm --prefix tools run test-env:down
```

El último comando detiene solo el proyecto de pruebas. Para preparar otra ejecución
se repite `test-env:up`. Los procedimientos de semilla y migración de T12-8 se
documentan con su implementación; nunca se ejecutan contra el Supabase compartido.

## Plantilla para Asier

[infraestructura.spec.js](../e2e/tests/infraestructura.spec.js) es una plantilla
ejecutable: entra desde el formulario con cada centro confirmado, recarga una ruta
privada, comprueba el rechazo del usuario sin confirmar y la redirección sin sesión.
Esto acredita la infraestructura, no los CA de publicación de anuncios.

Crear un archivo por historia dentro de `e2e/tests/`, importar `test`, `expect` y
`entrar` desde `../fixtures.js`, y titular cada caso con su historia y E2E/CA.
Las cuentas están disponibles en la fixture `cuentas`:

```js
import { test, expect, entrar } from '../fixtures.js';

test('US-12 · E2E-1 · publicar con datos correctos', async ({ page, cuentas }) => {
  await entrar(page, cuentas.centroA, cuentas.password);
  await page.getByRole('link', { name: 'Publicar anuncio', exact: true }).click();
  await expect(page).toHaveURL(/\/anuncios\/nuevo$/);
  // Completar los pasos y resultados exactos de la especificación de US-12.
});
```

No copiar este caso incompleto como prueba terminada. QA incorpora el flujo completo
cuando frontend y API estén disponibles en la historia. La plantilla usa login real,
contextos de navegador nuevos por test y un solo worker; no guarda sesiones en Git.
Los tests que modifican anuncios deben crear sus propios registros o restaurar su
fixture para que un reintento no dependa del estado dejado por el intento anterior.

Para simular un error sin parar la API de todo el job, interceptar solo la petición
del caso con `page.route('**/api/anuncios', route => route.fulfill({ status: 503,
contentType: 'application/json', body: JSON.stringify({ error: { code:
'BASE_DATOS_NO_DISPONIBLE', message: 'No se ha podido completar la acción. Inténtalo de nuevo.' } }) }))`.
Para una caída de red, `route.abort()`. Es el mecanismo propuesto en #110; la respuesta
simulada se declara como tal y no acredita disponibilidad real de PostgreSQL.

## CI y revisión

[ci.yml](../.github/workflows/ci.yml) ejecuta el job en **todas las PR**, incluidas
las dirigidas a `story/*` y `dev`, y en los push a `main`/`dev`. No tiene filtros de
rutas ni `continue-on-error`. El frontend ejecuta `npm test --if-present` para recoger
los tests que se incorporen con sus historias, conservando lint y build.

El informe HTML, capturas y trazas de fallos se guardan como `playwright-report`
durante 7 días. Solo contienen el entorno sintético; no adjuntar `.e2e/`, `.env`,
credenciales cloud ni volcados de variables. Los servicios se detienen al finalizar,
también si una prueba falla.

Carlos debe configurar **E2E (Playwright)** como check obligatorio para `story/*`
y `dev`, conservando los checks y revisiones existentes. Se activa cuando el workflow
esté disponible en las ramas afectadas: una rama que todavía no lo contiene no puede
producir ese check. La evidencia de una PR real y la configuración de protección se
registran en la PR de T12-7; no se deducen de una ejecución local.
