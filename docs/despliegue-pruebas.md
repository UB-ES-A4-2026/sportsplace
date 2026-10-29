# T12-6 · Entorno de pruebas desplegado

Responsable: Carlos. [Tarea #86](https://github.com/UB-ES-A4-2026/sportsplace/issues/86),
historia US-12. **Estado: Auto-Deploy de #145 y smoke remoto manual comprobados y
aceptados el 29/10/2026.** La imagen está integrada mediante #127 y esta guía mediante
#145. La conexión PostgreSQL con TLS está acreditada por los logs del servidor.
La [ampliación pedida por Alex](https://github.com/UB-ES-A4-2026/sportsplace/issues/86#issuecomment-6500493326)
añade el smoke automático de cada push a `dev`: queda por integrar esta ampliación
y registrar su primera ejecución automática real en verde. Alex cerrará #86 al
aceptar esa evidencia; el plazo de la ampliación es el 30/10/2026 antes de las 14:00
(Europe/Madrid). El flujo funcional de Auth se valida en las historias y en QA.
La [decisión de #86](https://github.com/UB-ES-A4-2026/sportsplace/issues/86#issuecomment-6476683628)
establece un único Web Service para web y API, despliegue desde `dev` después del
CI y aceptación del arranque en frío.

## Servicio publicado y evidencia HTTP

| Dato | Valor |
|---|---|
| URL HTTPS | [https://sportsplace-pruebas.onrender.com](https://sportsplace-pruebas.onrender.com) |
| Servicio | `sportsplace-pruebas` |
| Alojamiento | Render Free, Frankfurt (EU Central). |
| Workspace / proyecto | `My Workspace` / `My project`. |
| Rama | `dev` |
| Auto-Deploy guardado | `After CI Checks Pass` |
| Commit del primer despliegue | [`e1adad1`](https://github.com/UB-ES-A4-2026/sportsplace/commit/e1adad1238d3a051e52ccd247fca5e816de0abcb) |
| CI del commit | [Los cinco jobs correctos](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/40760662549). |
| Primer despliegue | 29/10/2026, 00:02, Europe/Madrid; estado `Live`. |
| Panel de Render | [Servicio y despliegues](https://dashboard.render.com/web/srv-dbh7tt3bc2fs73fr1i20/deploys). Requiere acceso al workspace. |

Comprobación ejecutada contra la URL real, con Node.js 24 y código de salida `0`:

```text
npm --prefix tools run deploy:check -- https://sportsplace-pruebas.onrender.com

Despliegue HTTP verificado: web compilada, rutas SPA, API y assets en el mismo origen.
Esta comprobación no acredita conexión PostgreSQL, Auth ni criterios funcionales de QA.
```

Después de aquel **First Deploy**, #145 entró en `dev` con el merge commit
[`59a5e7f`](https://github.com/UB-ES-A4-2026/sportsplace/commit/59a5e7ff2abcaa807b86b910af81865b20bc2416).
El [CI del push](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/40848921018)
terminó en verde el 29/10 a las 10:24:05 (Europe/Madrid). Render registró
**Auto-Deploy**, estado **Live**, para ese mismo commit:
[despliegue de #145](https://dashboard.render.com/web/srv-dbh7tt3bc2fs73fr1i20/deploys/dep-dbhh1e19q7ns73cv140g).
Sus logs muestran PostgreSQL correcto a las 10:25:13 y el servicio disponible a las
10:25:18. El smoke remoto volvió a terminar con salida `0`.
[Evidencia completa aceptada en #86](https://github.com/UB-ES-A4-2026/sportsplace/issues/86#issuecomment-6499811504).
Esto acredita el Auto-Deploy real; la ejecución de ese smoke todavía fue manual.

En los [logs del servicio](https://dashboard.render.com/web/srv-dbh7tt3bc2fs73fr1i20/logs),
el proceso publicado registró el 29/10/2026 a las 00:02:58 (Europe/Madrid):

```text
Conexión PostgreSQL: correcta.
```

Ese mensaje se emite después de `database.check()` al arrancar: acredita una
consulta `SELECT 1` desde Render con la verificación TLS y el CA configurados.
No acredita el esquema completo ni sustituye una prueba funcional de Auth.

## Qué se despliega

El [Dockerfile de la raíz](../Dockerfile) compila la web con Vite en una etapa y
prepara Node.js 24 con las dependencias de producción de la API en otra. La imagen
final sirve la web compilada y `/api/...` desde el mismo origen. No utiliza el
servidor de desarrollo de Vite ni necesita cambiar las llamadas del frontend.

El proceso escucha en `HOST=0.0.0.0` y el `PORT` que proporcione el alojamiento
(3000 por defecto en la imagen), se ejecuta como el usuario `node` y responde a
SIGTERM. `STATIC_WEB_DIR=/app/web` activa la web estática; sin esa variable, el
backend conserva su comportamiento habitual en desarrollo. Las rutas API y las
sondas tienen prioridad sobre la web. Las navegaciones GET/HEAD reciben la SPA;
los assets inexistentes, peticiones de otros métodos y archivos ocultos no reciben
ese HTML. La carpeta y su `index.html` deben existir antes de arrancar.

[.dockerignore](../.dockerignore) excluye secretos, certificados, dependencias del
host y resultados locales. El build no necesita credenciales ni acceso a Supabase.
Los Dockerfiles de cada carpeta y [compose.yaml](../compose.yaml) siguen destinados
al desarrollo.

## Reproducir desde un clon limpio

Requisitos: Docker y, para la comprobación HTTP, Node.js 24. Desde la raíz:

```bash
docker build --tag sportsplace-pruebas .
docker run --detach --name sportsplace-pruebas --publish 127.0.0.1:4301:3000 sportsplace-pruebas
npm --prefix tools run deploy:check -- http://127.0.0.1:4301
docker inspect --format '{{.State.Health.Status}}' sportsplace-pruebas
docker stop sportsplace-pruebas
docker rm sportsplace-pruebas
```

La comprobación no instala dependencias ni necesita secretos. Comprueba el HTML
compilado y su JavaScript, acceso directo a `/entrar` y rutas de anuncios, health
JSON, 404 de API y 404 de assets. Espera hasta dos minutos al arranque, para admitir
un alojamiento con arranque en frío. **No acredita Auth, PostgreSQL ni los CA de QA.**
Sin variables privadas la API informa que esos servicios siguen sin configurar.

## Crear el servicio en Render

1. Conectar el repositorio `UB-ES-A4-2026/sportsplace` mediante **Git Provider →
   GitHub**. La conexión nativa permite los despliegues automáticos; la opción de
   introducir una URL pública del repositorio solo permite despliegues manuales.
2. Crear **New → Web Service** con esta configuración:

| Campo | Valor |
|---|---|
| Branch | `dev` |
| Language / Runtime | `Docker` |
| Root Directory | Vacío: se necesita la raíz con `frontend/` y `backend/`. |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` si aparece el campo. |
| Docker Command | Vacío: se utiliza el `CMD` de la imagen. |
| Instance Type | `Free` |
| Health Check Path | `/api/health` |
| Auto-Deploy | `After CI Checks Pass` |

3. Añadir las variables y, si procede, el CA como se explica abajo. Comprobar el
   CI del commit de `dev` elegido antes de crear el servicio: **Create Web Service**
   inicia la primera construcción y el primer despliegue.
4. Cuando el servicio esté disponible, anotar su nombre, cuenta/proyecto, commit
   publicado y URL **HTTPS real** que proporciona Render. Mantener web y API en
   ese mismo origen; no crear un servicio estático adicional.

El plan Free suspende el servicio tras 15 minutos sin tráfico y una petición nueva
puede necesitar aproximadamente un minuto para arrancarlo. Es una limitación
aceptada para este entorno; `deploy:check` espera hasta dos minutos a la API.
Los datos y las imágenes persistentes permanecen en Supabase, no en el sistema de
archivos efímero del contenedor.

## Configuración del servicio remoto

Configurar las variables en **Render → servicio → Environment**; su referencia está
en [.env.example](../.env.example). No copiarlas al build de la web ni al repositorio.

| Variable | Uso |
|---|---|
| `PORT` | Conservar el puerto que proporcione Render; la imagen usa 3000 si no se sustituye. |
| `HOST` | La imagen ya establece `0.0.0.0`, para aceptar conexiones del proxy. |
| `STATIC_WEB_DIR` | La imagen ya establece `/app/web`, donde queda la web compilada. |
| `RENDER_GIT_COMMIT` | Render lo proporciona automáticamente. `/api/health` expone el SHA válido como `commit`; no configurarlo manualmente. |
| `SUPABASE_URL` | URL del proyecto de Auth del entorno. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable de ese mismo proyecto; la usa el backend. |
| `DATABASE_URL` | Conexión privada PostgreSQL, preferentemente Session pooler según el README. |
| `DATABASE_SSL_CA_FILE` | Ruta al CA montado como archivo del servicio, si la conexión lo necesita. |

La verificación TLS de PostgreSQL permanece activada. El certificado se proporciona
mediante **Environment → Secret Files** de Render. Por ejemplo, un archivo llamado
`supabase-ca.crt` se monta en `/etc/secrets/supabase-ca.crt`; configurar
`DATABASE_SSL_CA_FILE` con esa ruta y ajustar el nombre al archivo real. La ruta
local `/app/.certs/...` no existe en esta imagen: los certificados están excluidos
del build. No configurar `NODE_TLS_REJECT_UNAUTHORIZED=0` ni desactivar la
verificación en la URI. El servicio no necesita permisos para migrar.

Al conocer la URL pública, revisar **Supabase Auth → URL Configuration** y las
plantillas de correo para que los enlaces abran ese entorno. Si se comparte el
proyecto con desarrollo, coordinar el cambio de Site URL con el equipo porque
afecta también a sus correos. No se ha cambiado esa configuración en esta tarea.

## Despliegue automático y comprobación remota

En **Render → servicio → Settings → Auto-Deploy**, guardar **After CI Checks Pass**
para `dev`. Render espera a que terminen las comprobaciones del nuevo commit y no
despliega si alguna falla o si no detecta ninguna. Para GitHub, considera aprobadas
las conclusiones `success`, `neutral` y `skipped`; revisar también que los jobs
requeridos se hayan ejecutado correctamente en GitHub.

Se utiliza la integración nativa de GitHub con Render. Las variables privadas se
guardan en Render, sin duplicarlas en GitHub para esta integración. Si otra
automatización futura necesitase credenciales, se guardarían como secrets, nunca
en el YAML. No desplegar automáticamente `main`, una historia ni una rama de tarea.

El job **Imagen de despliegue (T12-6)** de [CI](../.github/workflows/ci.yml) construye
y comprueba esta imagen en cada PR y push a main/dev. Es una validación del paquete:
no publica un servicio ni equivale a un despliegue remoto. Los otros jobs de CI y
E2E conservan su función.

### Smoke automático de cada push a dev

[`.github/workflows/smoke-render.yml`](../.github/workflows/smoke-render.yml) tiene
dos ejecuciones para evitar una dependencia circular con **After CI Checks Pass**:

1. Cada push a `dev` ejecuta **Programar smoke de dev**. Usa el `GITHUB_TOKEN`
   temporal del job, con `actions: write`, para lanzar `workflow_dispatch` del
   mismo workflow sobre la rama conservada `chore/T12-6-smoke-render-automatico`,
   pasando el SHA completo del push como `expected_sha`. Después termina.
2. **Esperar commit y comprobar Render** se ejecuta sobre el SHA de esa rama
   auxiliar, con `contents: read`. Descarga el commit objetivo de `dev`, espera
   hasta **30 minutos desde el inicio de la espera** (incluye el tiempo de CI,
   construcción y arranque en frío) y exige `status: ok`, `service: sportsplace-api`
   y `commit` exactamente igual al SHA esperado en `/api/health`. Consulta cada
   10 segundos, con 10 segundos de máximo por petición y sin seguir redirecciones.
3. Solo entonces ejecuta `npm --prefix tools run deploy:check --
   https://sportsplace-pruebas.onrender.com` y vuelve a comprobar el SHA al terminar.
   Si la espera, el smoke o la comprobación final fallan, la ejecución queda roja.
   El resumen de Actions guarda la URL, el SHA esperado y el resultado. El job
   completo tiene un límite de 35 minutos.

El run que espera al servicio **no pertenece al SHA que Render está esperando
autorizar**. Poner esa espera dentro del CI del commit desplegable impediría que
Render lo publicara mientras el smoke espera su publicación. El dispatcher falla
si la rama auxiliar falta o apunta al propio SHA de `dev`, antes de crear ese ciclo.
No necesita claves de Render, credenciales de Supabase ni dependencias npm.

**Conservar `chore/T12-6-smoke-render-automatico`** después de fusionar la PR. Se usa
como ref del runner y ya está incluida en la regla del equipo de conservar ramas.
Render sigue desplegando únicamente `dev`. Si se cambia la ref del runner, actualizar
`SMOKE_RUNNER_REF` y mantenerla en un SHA distinto del commit desplegable. La
automatización queda operativa cuando este workflow está integrado en la rama por
defecto `dev`; antes de esa integración no hay una ejecución automática real que
se pueda acreditar. La primera evidencia se obtiene del propio merge de esta PR.

Si hay pushes muy seguidos y Render omite una versión intermedia, el smoke de esa
versión agotará el plazo y fallará: una versión posterior no se registra como éxito
del commit anterior. Si falla el CI, Render no despliega y la espera tampoco podrá
dar un resultado correcto. Un reintento manual desde **Actions → Smoke Render
(T12-6) → Run workflow** debe elegir la rama auxiliar e indicar el SHA completo de
`dev` que se quiere comprobar; no sustituye la evidencia del disparador automático.

### Reproducir la comprobación remota

Desde un clon actualizado, con Node.js 24, puede ejecutarse el smoke HTTP:

```bash
npm --prefix tools run deploy:check -- https://sportsplace-pruebas.onrender.com
```

No necesita `npm ci` ni credenciales: utiliza módulos incluidos en Node. Conservar
la salida real y el código de salida del proceso; el resultado correcto incluye:

```text
Despliegue HTTP verificado: web compilada, rutas SPA, API y assets en el mismo origen.
Esta comprobación no acredita conexión PostgreSQL, Auth ni criterios funcionales de QA.
```

Para reproducir también la espera por versión, sustituir el marcador por el SHA
completo de `dev` que se espera publicado:

```bash
npm --prefix tools run deploy:wait -- https://sportsplace-pruebas.onrender.com SHA_COMPLETO_DE_DEV
```

Después de obtener y comprobar la URL, actualizar el README y esta guía mediante
una PR hacia `dev`, según la indicación específica de Alex en #86. Solicitar una
aprobación ajena y fusionar con **Create a merge commit**, sin borrar la rama.
Usar la integración de esta ampliación para registrar el commit de `dev`, CI,
Auto-Deploy de Render y **enlace al run automático del smoke en verde** en #86.
El primer despliegue al crear el servicio, una comprobación HTTP local o un smoke
ejecutado a mano no acreditan esta ampliación. Hasta registrar esa ejecución se
utiliza `Refs #86`; Alex mantiene y cierra el seguimiento de la issue.

Las migraciones al Supabase compartido siguen el procedimiento de
[T12-8](base-pruebas.md#migraciones-nuevas-al-supabase-compartido), con revisión de
Anass/Alex y ejecución coordinada. El arranque del contenedor no aplica SQL.

La preparación de la imagen ya está integrada mediante la
[PR #127](https://github.com/UB-ES-A4-2026/sportsplace/pull/127). Seguimiento de #86:

- [x] Servicio Render Free creado y URL HTTPS real documentada en `dev`.
- [x] Variables y CA configurados en Render, sin publicar sus valores.
- [x] Comprobación HTTP contra la URL real correcta, con código de salida `0`.
- [x] Conexión PostgreSQL real desde el servicio con TLS verificado, acreditada en los logs.
- [x] Auto-Deploy de #145 con commit, CI, fecha y versión publicada, aceptado por Alex.
- [x] Documentación de #145 integrada mediante merge commit.
- [x] Workflow de smoke por SHA preparado en esta ampliación, con espera limitada.
- [ ] PR de esta ampliación hacia `dev`, aprobación ajena y fusión mediante merge commit.
- [ ] Enlace a una ejecución automática real en verde después del merge en `dev`.

Hasta entonces se utiliza `Refs #86` y no se declara la tarea terminada.

Referencias de configuración: [Docker en Render](https://render.com/docs/docker),
[despliegues y CI](https://render.com/docs/deploys),
[variables y Secret Files](https://render.com/docs/configure-environment-variables)
y [limitaciones de Free](https://render.com/docs/free).
El dispatch usa las [excepciones de `GITHUB_TOKEN` para lanzar workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
y la [API de workflows de GitHub](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).
