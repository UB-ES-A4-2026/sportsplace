# T12-6 · Entorno de pruebas desplegado

Responsable: Carlos. [Tarea #86](https://github.com/UB-ES-A4-2026/sportsplace/issues/86),
historia US-12. **Estado de #86: cerrada, con Auto-Deploy y smoke automático desde
`dev` aceptados.** La imagen se integró mediante #127, la guía mediante #145 y el
smoke automático mediante #147. La conexión PostgreSQL con TLS está acreditada por
los logs del servidor. El flujo funcional de Auth se valida en las historias y en QA.

El acuerdo del 4/11/2026 añade una rama desplegada para QA: **`story/...` → `dev` →
`staging` → `main`**. Se conserva un único Web Service para web y API, el arranque
en frío y **After CI Checks Pass**. La entrega del Sprint 1 en
[#212](https://github.com/UB-ES-A4-2026/sportsplace/pull/212) y la configuración de
[#213](https://github.com/UB-ES-A4-2026/sportsplace/pull/213) están integradas.
`staging` ya existe, está protegida y es la rama guardada en Render. La configuración
está activada; sigue pendiente acreditar la primera promoción real `dev` → `staging`
con Auto-Deploy, smoke del mismo SHA y QA funcional. La
[evidencia del 4/11](evidencias/staging-2026-11-04/README.md) separa esos resultados.

## Transición de dev a staging

Se elige `staging` porque existen 16 ramas `test/T...`: Git no permite crear la rama
literal `test` mientras existen esas referencias. Se conservan todas las ramas.
La rama de integración y por defecto sigue siendo `dev`.

Carlos coordina los siguientes pasos, conservando la evidencia de cada uno:

- [x] Fusionar la entrega #212 (`dev` → `main`) mediante merge commit, según el acuerdo del equipo.
- [x] Integrar #213 en `dev`: CI en pushes a `staging` y disparador del smoke exclusivamente en `staging`.
- [x] Crear `staging` desde `dev`, en `c8bb2e1ec3ab88056c829e633b3ddd92f7ea5314`, conservando las ramas `test/...`.
- [x] Copiar la protección de `dev` en la interfaz de GitHub: Carlos confirmó las opciones de revisión y los cuatro checks obligatorios se contrastaron mediante la API pública.
- [x] Guardar en Render **Branch: staging** y **Auto-Deploy: After CI Checks Pass**, y verificar ambos valores tras recargar Settings.
- [x] Comprobar el despliegue iniciado por el cambio de rama y verificar el SHA esperado con `deploy:wait` y `deploy:check` remoto correcto.
- [ ] Promover un cambio real mediante PR `dev` → `staging` y registrar sus cinco jobs del CI correctos, el **Auto-Deploy causado por ese push** y el smoke remoto del mismo SHA completo en verde.
- [ ] Registrar QA funcional de esa versión publicada antes de promoverla a `main`.

Los checks obligatorios de `dev` y `staging` son **Backend (lint y
tests)**, **Frontend (lint y build)**, **Herramientas de migración (lint y tests)** y
**E2E (Playwright)**. El CI también ejecuta **Imagen de despliegue (T12-6)**; no
confundir los cinco jobs ejecutados con los cuatro checks de la regla actual.
Los cuatro figuran asociados a la app `15368`. Carlos confirmó en la interfaz PR
obligatoria, una aprobación, descarte de revisiones antiguas, status checks, rama
actualizada, resolución de conversaciones y prohibición de bypass; el resto de las
opciones desactivado. La API pública acredita protección y checks, no expone toda
la configuración de revisión.

La configuración de `staging` está activa. La lista conserva pendiente la primera
promoción real con Auto-Deploy y QA, que no debe confundirse con el despliegue
iniciado al cambiar la rama del servicio. El cambio de rama no aplica migraciones
ni crea otra base de datos: siguen vigentes los procedimientos de Supabase.

### Evidencia de activación del 4/11/2026

El primer push que creó `staging` lanzó el [CI 41893440308](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/41893440308)
(cinco jobs correctos en el intento 2), el
[dispatcher 41893440077](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/41893440077)
y el [smoke 41893463763](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/41893463763),
con resultado correcto. Ese smoke terminó a las **20:05:35 Europe/Madrid**,
antes de cambiar la rama en Render: comprobó `c8bb2e1`, que el servicio ya servía
desde `dev`. Acredita el disparador automático, pero no un Auto-Deploy desde `staging`.

Guardar **Branch: staging** inició un despliegue **Branch updated** el 4/11 a las
**20:30:32 Europe/Madrid**:
[dep-dblofm56e07s739hg11g](https://dashboard.render.com/web/srv-dbh7tt3bc2fs73fr1i20/deploys/dep-dblofm56e07s739hg11g).
Quedó `Live`; después `deploy:wait` identificó el SHA completo
`c8bb2e1ec3ab88056c829e633b3ddd92f7ea5314` y `deploy:check` contra la URL real
terminó con salida `0`. Este resultado acredita la activación del servicio sobre
`staging`; no sustituye la evidencia pendiente de un Auto-Deploy por una nueva
promoción. Capturas y detalle: [evidencia de staging](evidencias/staging-2026-11-04/README.md).

## Servicio publicado y evidencia histórica de dev

| Dato | Valor |
|---|---|
| URL HTTPS | [https://sportsplace-pruebas.onrender.com](https://sportsplace-pruebas.onrender.com) |
| Servicio | `sportsplace-pruebas` |
| Alojamiento | Render Free, Frankfurt (EU Central). |
| Workspace / proyecto | `My Workspace` / `My project`. |
| Rama de la evidencia histórica | `dev` (el servicio actual está configurado en `staging`) |
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
| Branch | `staging` |
| Language / Runtime | `Docker` |
| Root Directory | Vacío: se necesita la raíz con `frontend/` y `backend/`. |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context Directory | `.` si aparece el campo. |
| Docker Command | Vacío: se utiliza el `CMD` de la imagen. |
| Instance Type | `Free` |
| Health Check Path | `/api/health` |
| Auto-Deploy | `After CI Checks Pass` |

3. Añadir las variables y, si procede, el CA como se explica abajo. Comprobar el
   CI del commit de `staging` elegido antes de crear el servicio: **Create Web Service**
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
para `staging`, configuración guardada y verificada el 4/11/2026. Render espera a que
terminen las comprobaciones del nuevo commit y no
despliega si alguna falla o si no detecta ninguna. Para GitHub, considera aprobadas
las conclusiones `success`, `neutral` y `skipped`; revisar también que los jobs
requeridos se hayan ejecutado correctamente en GitHub.

Se utiliza la integración nativa de GitHub con Render. Las variables privadas se
guardan en Render, sin duplicarlas en GitHub para esta integración. Si otra
automatización futura necesitase credenciales, se guardarían como secrets, nunca
en el YAML. Tras la transición, solo se despliega `staging`; `dev` conserva la
integración y `main` la entrega aprobada. Las historias y ramas de tarea no se
despliegan en este servicio.

El job **Imagen de despliegue (T12-6)** de [CI](../.github/workflows/ci.yml) construye
y comprueba esta imagen en cada PR y push a `main`, `dev` o `staging`. Es una validación del paquete:
no publica un servicio ni equivale a un despliegue remoto. Los otros jobs de CI y
E2E conservan su función.

### Smoke automático de cada push a staging

[`.github/workflows/smoke-render.yml`](../.github/workflows/smoke-render.yml) tiene
dos ejecuciones para evitar una dependencia circular con **After CI Checks Pass**:

1. Cada push a `staging` ejecuta el dispatcher **Programar smoke de staging**. Usa el `GITHUB_TOKEN`
   temporal del job, con `actions: write`, para lanzar `workflow_dispatch` del
   mismo workflow sobre la rama conservada `chore/T12-6-smoke-render-automatico`,
   pasando el SHA completo del push como `expected_sha`. Después termina.
2. **Esperar commit y comprobar Render** se ejecuta sobre el SHA de esa rama
   auxiliar, con `contents: read`. Descarga el commit objetivo de `staging`, espera
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
si la rama auxiliar falta o apunta al propio SHA que se va a desplegar, antes de crear ese ciclo.
No necesita claves de Render, credenciales de Supabase ni dependencias npm.

**Conservar `chore/T12-6-smoke-render-automatico`** después de fusionar la PR. Se usa
como ref del runner y ya está incluida en la regla del equipo de conservar ramas.
El runner se mantiene en `3572138766c4bb2a1ddb289249aa9dd5950e545b`: recibe
`expected_sha` y descarga ese commit, por lo que también admite el objetivo de
`staging` sin modificar la rama auxiliar. Algunas etiquetas de su YAML conservado
todavía mencionan `dev`; la versión comprobada es el SHA objetivo del nombre y del
resumen del run, no el `head_sha` de esa rama auxiliar.

Render debe desplegar únicamente `staging`. Si se cambia la ref del runner,
actualizar `SMOKE_RUNNER_REF` y mantenerla en un SHA distinto del commit desplegable.
El workflow debe seguir presente en la rama por defecto `dev` para poder recibir
`workflow_dispatch`, y su disparador de push debe estar integrado en `staging`.
No dejar simultáneamente un smoke por push a `dev` contra esta misma URL: ese commit
ya no se despliega y la espera fallaría aunque el servicio estuviera sano.

Si hay pushes muy seguidos y Render omite una versión intermedia, el smoke de esa
versión agotará el plazo y fallará: una versión posterior no se registra como éxito
del commit anterior. Si falla el CI, Render no despliega y la espera tampoco podrá
dar un resultado correcto. Un reintento manual desde **Actions → Smoke Render
(T12-6) → Run workflow** debe elegir la rama auxiliar e indicar el SHA completo de
`staging` que se quiere comprobar; no sustituye la evidencia del disparador automático.

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
completo de `staging` que se espera publicado:

```bash
npm --prefix tools run deploy:wait -- https://sportsplace-pruebas.onrender.com SHA_COMPLETO_DE_STAGING
```

Después de integrar la transición, registrar la URL, el SHA de `staging`, el run
de CI, el Auto-Deploy de Render y el **run automático del smoke en verde**. Un
despliegue manual, una comprobación local o un smoke lanzado a mano no acreditan
el disparador automático. Mantener aprobación ajena y **Create a merge commit** en
las PR `dev` → `staging` y `staging` → `main`, sin borrar ninguna rama. QA valida la
versión publicada antes de abrir la promoción final a `main`; un nuevo commit en
`staging` requiere que la evidencia de QA corresponda a esa versión.

Las migraciones al Supabase compartido siguen el procedimiento de
[T12-8](base-pruebas.md#migraciones-nuevas-al-supabase-compartido), con revisión de
Anass/Alex y ejecución coordinada. El arranque del contenedor no aplica SQL.

La preparación de la imagen ya está integrada mediante la
[PR #127](https://github.com/UB-ES-A4-2026/sportsplace/pull/127). Evidencia histórica
aceptada para el cierre de #86, anterior al cambio de rama:

- [x] Servicio Render Free creado y URL HTTPS real documentada en `dev`.
- [x] Variables y CA configurados en Render, sin publicar sus valores.
- [x] Comprobación HTTP contra la URL real correcta, con código de salida `0`.
- [x] Conexión PostgreSQL real desde el servicio con TLS verificado, acreditada en los logs.
- [x] Auto-Deploy de #145 con commit, CI, fecha y versión publicada, aceptado por Alex.
- [x] Documentación de #145 integrada mediante merge commit.
- [x] Workflow de smoke por SHA integrado mediante #147, con espera limitada.
- [x] Ejecución automática real en verde después del merge en `dev`: [run 40931635595](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/40931635595).

Esa tarea cerrada no acredita la transición a `staging`; sus comprobaciones
pendientes se mantienen en la lista de activación al principio de esta guía.

Referencias de configuración: [Docker en Render](https://render.com/docs/docker),
[despliegues y CI](https://render.com/docs/deploys),
[variables y Secret Files](https://render.com/docs/configure-environment-variables)
y [limitaciones de Free](https://render.com/docs/free).
El dispatch usa las [excepciones de `GITHUB_TOKEN` para lanzar workflows](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
y la [API de workflows de GitHub](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).
