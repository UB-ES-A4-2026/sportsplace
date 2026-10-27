# T12-6 · Entorno de pruebas desplegado

Responsable: Carlos. [Tarea #86](https://github.com/UB-ES-A4-2026/sportsplace/issues/86),
historia US-12. **Estado: imagen preparada; proveedor, cuenta/proyecto, URL pública
y automatización del alojamiento pendientes.** No hay un despliegue remoto acreditado.
La [propuesta en #48](https://github.com/UB-ES-A4-2026/sportsplace/issues/48#issuecomment-6350301213)
debe concretarse antes de configurar servicios externos.

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

## Configuración del servicio remoto

Configurar las variables exclusivamente en el entorno del servidor; su referencia
está en [.env.example](../.env.example). No copiarlas al build de la web.

| Variable | Uso |
|---|---|
| `PORT` | Puerto asignado por el alojamiento; la imagen usa 3000 si no se sustituye. |
| `HOST` | `0.0.0.0`, para aceptar las conexiones del proxy del alojamiento. |
| `STATIC_WEB_DIR` | `/app/web` en esta imagen. Fuera de ella, ruta al build compilado. |
| `SUPABASE_URL` | URL del proyecto de Auth del entorno. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable de ese mismo proyecto; la usa el backend. |
| `DATABASE_URL` | Conexión privada PostgreSQL, preferentemente Session pooler según el README. |
| `DATABASE_SSL_CA_FILE` | Ruta al CA montado como archivo del servicio, si la conexión lo necesita. |

La verificación TLS de PostgreSQL permanece activada. El certificado se proporciona
al arrancar, mediante un archivo del alojamiento o un montaje de solo lectura;
no se incluye en la imagen. No configurar `NODE_TLS_REJECT_UNAUTHORIZED=0` ni
desactivar la verificación en la URI. El servicio no necesita permisos para migrar.

Al conocer la URL pública, revisar **Supabase Auth → URL Configuration** y las
plantillas de correo para que los enlaces abran ese entorno. Si se comparte el
proyecto con desarrollo, coordinar el cambio de Site URL con el equipo porque
afecta también a sus correos. No se ha cambiado esa configuración en esta tarea.

## Despliegue automático y aceptación pendiente

El alojamiento debe conectarse al repositorio y desplegar **dev después de que
pasen sus comprobaciones**. No desplegar automáticamente main, una historia ni una
rama de tarea. La configuración concreta depende del proveedor aún por decidir.
Si la automatización necesita una credencial en GitHub, se guarda como secret,
nunca en el YAML. Si utiliza la integración nativa del proveedor, documentar esa
relación y dónde reside cada variable; no duplicar credenciales sin necesidad.

El job **Imagen de despliegue (T12-6)** de [CI](../.github/workflows/ci.yml) construye
y comprueba esta imagen en cada PR y push a main/dev. Es una validación del paquete:
no publica un servicio ni equivale a un despliegue remoto. Los otros jobs de CI y
E2E conservan su función.

Las migraciones al Supabase compartido siguen el procedimiento de
[T12-8](base-pruebas.md#migraciones-nuevas-al-supabase-compartido), con revisión de
Anass/Alex y ejecución coordinada. El arranque del contenedor no aplica SQL.

Para completar #86 falta registrar:

- Proveedor, cuenta/proyecto y plan acordados, servicio y **URL HTTPS real en el README**.
- Variables privadas y CA configurados, sin publicar sus valores.
- La misma comprobación HTTP contra esa URL y conexión PostgreSQL real con TLS.
- Un flujo de autenticación de prueba autorizado; health no demuestra que funcione.
- Evidencia de un despliegue provocado por la integración de un commit en dev,
  con su commit, CI, fecha y versión publicada.
- PR #127 hacia `dev`, aprobación ajena y fusión mediante merge commit.

Hasta entonces se utiliza `Refs #86` y no se declara la tarea terminada.
