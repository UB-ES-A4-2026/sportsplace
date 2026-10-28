# T12-6 · Entorno de pruebas desplegado

Responsable: Carlos. [Tarea #86](https://github.com/UB-ES-A4-2026/sportsplace/issues/86),
historia US-12. **Estado: servicio Render Free creado y primer despliegue disponible
por HTTPS; `deploy:check` correcto el 29/10/2026.** La imagen está integrada en `dev`
mediante la PR #127. Quedan pendientes las comprobaciones funcionales de PostgreSQL
y Auth, la integración de esta documentación y la evidencia de un nuevo despliegue
automático tras CI.
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

El despliegue registrado es de tipo **First Deploy**: acredita la publicación del
servicio, no una integración posterior en `dev`. La política automática está
configurada, pero esa segunda evidencia queda pendiente de la PR de documentación.

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

Desde un clon actualizado de `dev`, con Node.js 24, sustituir el marcador por el
origen HTTPS real del servicio, sin rutas ni parámetros:

```bash
npm --prefix tools run deploy:check -- https://sportsplace-pruebas.onrender.com
```

No necesita `npm ci` ni credenciales: utiliza módulos incluidos en Node. Conservar
la salida real y el código de salida del proceso; el resultado correcto incluye:

```text
Despliegue HTTP verificado: web compilada, rutas SPA, API y assets en el mismo origen.
Esta comprobación no acredita conexión PostgreSQL, Auth ni criterios funcionales de QA.
```

Después de obtener y comprobar la URL, actualizar el README y esta guía mediante
una PR hacia `dev`, según la indicación específica de Alex en #86. Solicitar una
aprobación ajena y fusionar con **Create a merge commit**, sin borrar la rama.
Usar esa integración para verificar el despliegue automático: registrar el commit
de `dev`, enlace al CI correcto, despliegue de Render posterior y versión publicada.
El primer despliegue al crear el servicio, o uno manual, no acredita este paso.
Volver a ejecutar `deploy:check` contra la versión publicada y pegar la evidencia
en #86. Mientras queden criterios pendientes, utilizar `Refs #86`.

Las migraciones al Supabase compartido siguen el procedimiento de
[T12-8](base-pruebas.md#migraciones-nuevas-al-supabase-compartido), con revisión de
Anass/Alex y ejecución coordinada. El arranque del contenedor no aplica SQL.

La preparación de la imagen ya está integrada mediante la
[PR #127](https://github.com/UB-ES-A4-2026/sportsplace/pull/127). Seguimiento de #86:

- [x] Servicio Render Free creado y URL HTTPS real documentada en esta rama.
- [x] Variables y CA configurados en Render, sin publicar sus valores.
- [x] Comprobación HTTP contra la URL real correcta, con código de salida `0`.
- [ ] Conexión PostgreSQL real desde el servicio con TLS verificado.
- [ ] Un flujo de autenticación de prueba autorizado; health no demuestra que funcione.
- [ ] Evidencia de un despliegue provocado por la integración de un commit en dev,
  con su commit, CI, fecha y versión publicada.
- [ ] PR de documentación hacia `dev`, aprobación ajena y fusión mediante merge commit.

Hasta entonces se utiliza `Refs #86` y no se declara la tarea terminada.

Referencias de configuración: [Docker en Render](https://render.com/docs/docker),
[despliegues y CI](https://render.com/docs/deploys),
[variables y Secret Files](https://render.com/docs/configure-environment-variables)
y [limitaciones de Free](https://render.com/docs/free).
