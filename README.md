# Sportsplace

Proyecto universitario de una plataforma de compraventa de material deportivo entre clubes y centros deportivos.

## Estado del proyecto

El Sprint 0 está entregado en `main` (21/10/2026). Historias completadas:

- US-01: registrar un centro en la plataforma.
- US-02: confirmar el email tras el registro.
- US-03: iniciar sesión con email y contraseña.
- US-66: pedir un enlace de confirmación nuevo.
- US-67: cerrar sesión.

Validación de infraestructura del sprint: [validación DevOps](docs/sprint-0-validacion-devops.md).

Sprint 1: [pruebas e2e con Playwright (T12-7)](docs/pruebas-e2e.md) y
[base de pruebas aislada y semilla de QA (T12-8)](docs/base-pruebas.md).

## Tecnologías

- Frontend: React con Vite, en JavaScript.
- Backend: Node.js 24 con Express 5. El contrato de la API está en [docs/api-contrato.md](docs/api-contrato.md).
- Base de datos: PostgreSQL mediante Supabase; el servidor utiliza `pg` para la conexión privada.
- Entorno de desarrollo: Docker y Docker Compose, con servicios separados para web y servidor.
- Integración continua: GitHub Actions. Cada pull request instala las dependencias y ejecuta el lint, las pruebas y la compilación ([.github/workflows/ci.yml](.github/workflows/ci.yml)).
- Autenticación: Supabase Auth, a través de nuestra API (ver el contrato).

## Equipo y responsabilidades

| Persona | Rol | Responsabilidades principales | Permiso del repositorio |
|---|---|---|---|
| Carlos | DevOps | Repositorio, accesos, protección de ramas, entorno con Docker, configuración compartida y documentación de arranque. | Admin |
| Asier | QA | Casos de prueba, validación de criterios de aceptación, workflow de instalación, lint y tests, y seguimiento de resultados. | Write |
| Anass | Backend | API, datos, validaciones del servidor y autenticación, coordinado con Alex. | Write |
| Alex | Backend | API, datos, validaciones del servidor y autenticación, coordinado con Anass. | Write |
| Lucía | Frontend | Interfaz, formularios, navegación e integración con la API, coordinada con Marta. | Write |
| Marta | Frontend | Interfaz, formularios, navegación e integración con la API, coordinada con Lucía. | Write |

Las responsabilidades se concretan mediante tareas asignadas a cada persona.

Todos los miembros pueden crear ramas, abrir pull requests y revisar cambios ajenos. La aprobación necesaria para fusionar debe proceder de una persona distinta del autor.

El autor puede fusionar su pull request cuando se cumplan todos los requisitos de revisión y comprobación. Carlos administra la configuración del repositorio.

## Reglas de trabajo y procedimientos

### Organización del trabajo

- Los identificadores, títulos, puntos y criterios de aceptación deben mantenerse coherentes en Excel, Trello y GitHub.
- Cada tarea debe tener una o varias personas responsables y un resultado verificable.
- Las historias usan su identificador original, por ejemplo US-01.
- No se crean TR. Todo el trabajo técnico (entorno, base de datos, CI, estructura, configuración) es una **tarea** de la historia que lo necesita.
- El Kanban de GitHub es el homólogo del de Trello y contiene **tareas**, no historias. Cada tarea es una issue con su propio ID en el título (por ejemplo, `T12-3 · Formulario de alta de producto (web)`) y es *sub-issue* de la issue de su historia.
- El número de una issue de GitHub, como #5, no sustituye al identificador de la historia o tarea.
- Frontend y backend pueden trabajar en tareas y pull requests diferentes de una misma historia.

### Cómo se escriben historias y criterios

Cada historia debe poder implementarse igual por cualquier persona o agente a partir de su texto, sin decidir nada por su cuenta.

- **Historia:** lo que vive el usuario, desde el primer clic del flujo (por ejemplo, desde que pulsa «Registrarse» en la página de inicio), no solo la pantalla final.
- **Boceto:** cada historia con interfaz enlaza un sketch o mockup de sus pantallas.
- **Criterios de aceptación:** todo lo técnico y toda decisión, concretado al detalle. Botones y enlaces (texto exacto y a qué pantalla llevan), campos (tipo, obligatorio, longitud y formato, por ejemplo contraseña de mínimo 8 caracteres), mensajes de error y de éxito, rutas de la API, estados y redirecciones. Si algo no está en los criterios, no se hace; si falta, se pregunta y se añade antes de empezar.

### Estrategia de ramas

Trabajamos con dos ramas permanentes, `main` y `dev`, y con ramas temporales por historia y por tarea:

```text
main                                  versiones entregables (builds)
 └── dev                              integración, siempre funcional
      ├── story/US-01-registro        una historia de usuario completa
      │    ├── feature/T01-3-registro-api
      │    ├── feature/T01-4-registro-web
      │    └── chore/T01-5-ci-github-actions    tarea técnica de la historia
      └── fix/T03-4-...                   corrección de algo ya integrado
```

`main` y `dev` están protegidas: solo reciben cambios mediante pull request con al menos una aprobación de otra persona, conversaciones resueltas y CI en verde. La protección se aplica también a los administradores.

#### `main`: versiones entregables

`main` contiene solo versiones entregables: lo que se construye y se enseña en cada demo o entrega.

- Solo recibe cambios desde `dev`, mediante pull request, cuando el equipo decide publicar una versión (normalmente al final del sprint, antes de la demo).
- No se crean ramas de trabajo desde `main`.
- Carlos abre y fusiona la pull request `dev` → `main` con **Create a merge commit**, para que las dos ramas compartan historial y no aparezcan conflictos en la siguiente versión.

#### `dev`: rama de integración, siempre funcional

`dev` es la rama sana del proyecto: en todo momento arranca, pasa el CI y lo que contiene funciona de punta a punta.

- Solo recibe historias completas y correcciones, siempre mediante pull request.
- Una historia entra en `dev` únicamente cuando frontend, backend, base de datos y pruebas están terminados y se cumplen todos sus criterios de aceptación. No se fusiona en `dev` una parte suelta de una historia.
- Si `dev` deja de funcionar, arreglarlo tiene prioridad sobre el trabajo nuevo.

#### Ramas de historia: `story/`

Cada historia de usuario tiene una rama que sale de `dev` y reúne todo su trabajo, por ejemplo `story/US-01-registro`.

- La crea la primera persona que empieza la historia y la publica para el resto.
- No se programa directamente en ella: recibe las ramas `feature/` de la historia y las de sus tareas técnicas (`chore/`, `docs/`).
- Cuando la historia está completa, se abre una pull request `story/...` → `dev`. Antes de fusionarla se prueba el conjunto (web, API y base de datos) contra los criterios de aceptación, y Asier, como QA, valida la historia.

#### Ramas de trabajo: categorías

Una historia se divide en tareas. Una tarea es cualquier parte del trabajo necesaria para completarla: frontend, backend, base de datos, pruebas, documentación o configuración. Cada tarea tiene su propia rama, que sale de la rama de la historia, y su pull request hacia ella. Por ejemplo, en US-01:

- `chore/T01-1-estructura-api`: estructura del servidor.
- `chore/T01-2-estructura-web`: estructura de la web.
- `feature/T01-3-registro-api`: API y validaciones del servidor.
- `feature/T01-4-registro-web`: formulario e interfaz.

Cada rama tiene su responsable y su pull request hacia `story/US-01-registro`. Así la historia se monta completa en su propia rama y a `dev` solo llega cuando todo está implementado y probado.

#### Historias que dependen de otra

Si una historia necesita código de otra (por ejemplo, US-03 necesita la estructura del servidor que llega con US-01), no se crean ramas desde la otra historia:

1. Se termina antes la historia de la que depende y se fusiona en `dev`.
2. Se actualiza la rama de la historia desde `dev` (`git merge origin/dev`) y después cada rama de tarea desde su `story/`.
3. Mientras tanto, las pull requests de la historia que espera se abren hacia su `story/` como **borrador** (*draft*) e indican de qué historia dependen. Hasta que se actualicen pueden mostrar también los cambios de la otra historia.

Los nombres distinguen historias de tareas, para que una tarea nunca parezca una historia:

- **Historia:** `story/US-12-descripcion`. Solo su PR hacia `dev` lleva `US-12` en el título.
- **Tarea:** `categoria/T12-3-descripcion`, donde `T12-3` es la tarea 3 de US-12. Su issue y su PR se titulan con ese ID (`T12-3: formulario de alta (web)`), nunca con `US-12`.

| Categoría | Sale de y vuelve a | Cuándo utilizarla | Ejemplo |
|---|---|---|---|
| `story/` | `dev` | Reunir todo el trabajo de una historia de usuario. | `story/US-01-registro` |
| `feature/` | su `story/` | Añadir una funcionalidad o una parte de ella. | `feature/T01-4-registro-web` |
| `test/` | su `story/` | Añadir o mejorar pruebas de una historia. | `test/T03-3-pruebas-login` |
| `refactor/` | su `story/` o `dev` | Reorganizar código manteniendo su comportamiento. | `refactor/T03-5-servicio-login` |
| `fix/` | su `story/` o `dev` | Corregir un comportamiento incorrecto: desde su historia si aún no está en `dev`, desde `dev` si ya está integrada. | `fix/T03-6-error-login` |
| `chore/` | su `story/` | Tarea técnica: herramientas, dependencias, Docker, CI o mantenimiento del repositorio. | `chore/T01-5-ci-github-actions` |
| `docs/` | su `story/` (o `dev` si es documentación del proceso) | Cambiar exclusivamente documentación. | `docs/T01-6-contrato-api` |

Las categorías son una convención del equipo. Cualquier miembro puede utilizar cualquiera de ellas según la tarea que tenga asignada.

Si una funcionalidad incluye código y sus pruebas, ambos cambios pueden ir en la misma rama `feature/`. Se usa `test/` cuando la tarea consiste principalmente en pruebas.

#### Reglas de nombres y alcance

- `US-xx` solo en ramas `story/`; las ramas de tarea usan el ID de la tarea (`T12-3`).
- Escribir la descripción en minúsculas, con guiones y sin espacios ni tildes.
- Crear cada rama desde su base actualizada, según la tabla anterior.
- Mantener un cambio coherente y revisable por rama.
- No crear ramas permanentes por persona, área o sprint: las únicas permanentes son `main` y `dev`.
- Conservar todas las ramas: `main`, `dev`, las `story/` y las ramas de trabajo. No se eliminan después de fusionarse, para que sigan visibles en el historial (Network).

#### Resumen del flujo

| Pull request | Quién la abre | Requisitos | Cómo se fusiona |
|---|---|---|---|
| `feature/`, `chore/`, `docs/`, `test/` → `story/...` | Responsable de la tarea | 1 aprobación de otra persona y CI en verde. | **Create a merge commit** |
| `story/...` → `dev` | Quien cierra la historia | 1 aprobación, CI en verde, historia probada de punta a punta y validada por QA. | **Create a merge commit** |
| `docs/`, `fix/` → `dev` (documentación del proceso o corrección) | Responsable de la tarea | 1 aprobación de otra persona y CI en verde. | **Create a merge commit** |
| `dev` → `main` | Carlos | Acuerdo del equipo, CI en verde y `dev` probada. | **Create a merge commit** |

### Procedimiento para desarrollar una tarea

1. Revisar la tarea, sus criterios de aceptación y sus dependencias.
2. Asignarse la tarea y moverla a **En curso** en GitHub Projects, manteniendo Trello actualizado según lo acordado.
3. Si la historia aún no tiene rama, crearla desde `dev` actualizada y publicarla:

```bash
git switch dev
git pull --ff-only
git switch -c story/US-03-login
git push -u origin story/US-03-login
```

4. Con los cambios anteriores ya guardados, actualizar la rama de la historia y crear la rama de trabajo:

```bash
git switch story/US-03-login
git pull --ff-only
git switch -c feature/T03-1-login-api
```

5. Implementar el cambio y realizar las comprobaciones que correspondan.
6. Revisar los archivos modificados y crear un commit. Sustituir `ruta/del/archivo` por los archivos que se quieran incluir:

```bash
git status
git add ruta/del/archivo
git diff --cached
git commit -m "US-03: implementar acceso con email y contraseña"
git push -u origin feature/T03-1-login-api
```

7. Abrir una pull request hacia `story/US-03-login` y mover la tarea a **En revisión**.
8. Solicitar revisión a otra persona del equipo y atender sus comentarios.
9. Tras la aprobación y las comprobaciones, fusionar mediante **Create a merge commit**. No se borra la rama: debe seguir visible en el historial (Network).
10. Cuando todas las partes de la historia estén fusionadas en su rama `story/`, probar la historia completa y abrir la pull request `story/US-03-login` → `dev`.

Todas las tareas de una historia (frontend, backend, `chore/`, `docs/`) siguen los mismos pasos: salen de la rama `story/` y su pull request va hacia ella.

Si la rama base cambia durante el desarrollo, incorporar sus cambios desde la rama de trabajo, con los cambios propios ya guardados en commits. Una rama de trabajo se actualiza desde su `story/`, y una `story/` desde `dev`:

```bash
git fetch origin
git merge origin/story/US-03-login
```

Si aparecen conflictos, resolverlos, revisar el resultado y completar el commit de resolución. Después, repetir las comprobaciones aplicables y subir los cambios:

```bash
git push
```

Si se añaden cambios después de una aprobación, solicitar que se revise la nueva versión antes de fusionar.

### Commits y pull requests

- Los commits y el título de la pull request incluyen el identificador de la tarea.
- La descripción explica qué cambia, qué tarea resuelve y cómo se ha comprobado.
- Se enlaza la issue correspondiente. Si todavía no existe, se indica el identificador y el enlace de Trello.
- Se añaden capturas cuando ayuden a revisar cambios de interfaz.
- Se utiliza `Closes #numero` únicamente cuando la pull request completa toda la issue. Para avances parciales se utiliza `Refs #numero`.

### Revisión e integración

- Toda pull request necesita al menos una aprobación de una persona distinta del autor.
- Los comentarios pendientes deben resolverse antes de fusionar.
- Quien revisa debe comprobar los cambios y las pruebas descritas.
- La revisión puede realizarla otra persona del equipo.
- Cada pull request ejecuta el workflow de GitHub Actions y su resultado debe estar en verde antes de fusionar.
- Los tres jobs del workflow deben estar configurados como comprobaciones obligatorias en `main` y `dev`. Carlos verifica esa configuración; los fallos deberán resolverse antes de fusionar.
- No se permite forzar cambios ni eliminar `main` ni `dev`.

### Cómo revisar y fusionar una pull request en GitHub

1. El autor abre la pull request hacia su rama base (`story/...` o `dev`, según la estrategia de ramas) y solicita revisión desde **Reviewers** a un compañero con permiso Write.
2. El revisor entra en **Files changed**, revisa los cambios y las comprobaciones descritas.
3. Si todo está correcto, pulsa **Review changes → Approve → Submit review**. Si necesita correcciones, utiliza **Request changes** y explica qué debe cambiar.
4. El autor atiende los comentarios y solicita otra revisión cuando corresponda.
5. Cuando exista una aprobación y se cumplan los demás requisitos, el autor selecciona **Create a merge commit** y confirma la fusión. No se usa **Squash and merge** ni **Rebase and merge**: el profesor pidió que las ramas no desaparezcan del historial (Network), y el squash provocó los conflictos de la integración del Sprint 0.
6. No se pulsa **Delete branch**: se conservan todas las ramas, también `main` y `dev` después de publicar una entrega.

Un comentario normal no cuenta como aprobación. El autor no puede aprobar su propia pull request.

La tarea pasa a **Hecho** cuando cumple todos sus criterios. Una PR parcial hacia `story/` no completa la historia.

### Estados del Kanban

- **Backlog:** trabajo registrado y pendiente de seleccionar.
- **Sprint actual:** trabajo seleccionado para el sprint, todavía sin empezar.
- **En curso:** trabajo que ya se está realizando.
- **En revisión:** trabajo preparado para revisión y validación.
- **Hecho:** trabajo revisado, validado y con sus criterios cumplidos; los cambios de código están integrados en `dev`.

Fusionar una tarea parcial de frontend o backend en la rama `story/` no completa la historia. La historia pasa a **Hecho** cuando funciona el conjunto, se cumplen todos sus criterios de aceptación y su rama `story/` está fusionada en `dev`.

### Configuración y documentación

- No subir contraseñas, claves privadas ni archivos `.env`.
- Mantener `.env.example` con valores de ejemplo.
- Actualizar las instrucciones cuando cambie el arranque o la configuración.
- Mantener las versiones y dependencias acordadas por el equipo.

## Arranque y comprobaciones

### Qué incluye el entorno de desarrollo

La base de desarrollo incluye una web React y una API de comprobación que arrancan juntas. La pantalla inicial verifica que puede comunicarse con el servidor mediante `/api/health`.

Supabase es el proyecto compartido en la nube. Docker ejecuta nuestra web y nuestro servidor; la base de datos permanece en Supabase. El backend utiliza Express 5 y Supabase Auth, según el acuerdo de backend registrado en [#12](https://github.com/UB-ES-A4-2026/sportsplace/pull/12#issuecomment-6157083082). En esta rama está integrada la API de registro; confirmación, login y logout siguen en sus PR de historia. El endpoint de salud comprueba la API, no la conexión con Supabase ni el envío de correo.

Estructura inicial:

```text
sportsplace/
├── backend/                 # API, conexión PostgreSQL, pruebas y Dockerfile
├── frontend/                # Web React, configuración de Vite y Dockerfile
├── docs/
│   ├── TR-02-validacion.md   # Arranque y confirmaciones del equipo
│   └── TR-03-validacion.md   # Base de datos y evidencia de validación
├── supabase/
│   ├── migrations/          # Cambios del esquema mediante SQL versionado
│   └── tests/centros.sql    # Pruebas de restricciones y permisos
├── tools/                   # Herramienta Docker para aplicar migraciones
├── compose.yaml             # Arranque conjunto de web y API
├── .env.example             # Plantilla de configuración sin credenciales
└── README.md                # Trabajo en equipo y uso del entorno
```

### Estructura de la web: TR-05

La web es una aplicación de una sola página con React Router. `frontend/src` se organiza así:

```text
frontend/src/
├── main.jsx                 # Arranque de React y BrowserRouter
├── App.jsx                  # Definición de las rutas
├── styles.css               # Estilos globales
├── api/
│   ├── cliente.js           # api(ruta, opciones): llamadas a /api/... con errores ErrorApi
│   └── sesion.js            # Lectura y guardado de la sesión en el navegador
├── auth/
│   ├── AuthProvider.jsx     # Sesión: usuario, entrar, restaurar y renovar el token
│   ├── contexto.js          # Contexto de la sesión
│   └── useAuth.js           # Hook para leer la sesión en cualquier componente
├── components/
│   ├── Campo.jsx            # Campo de formulario con etiqueta y error accesibles
│   ├── Layout.jsx           # Cabecera, menú y pie comunes a todas las páginas
│   ├── BotonCerrarSesion.jsx  # Botón de cierre de sesión (US-67)
│   └── RutaPrivada.jsx      # Redirige a /entrar si no hay sesión
├── validacion/              # Validación de formularios, con las mismas reglas que el servidor
└── pages/                   # Una página por ruta
```

| Ruta | Página | Privada | Historia |
|---|---|---|---|
| `/` | `InicioPage`: estado del entorno y de la API | No | TR-02 |
| `/registro` | `RegistroPage`: formulario de alta del centro | No | US-01 |
| `/confirmar-email` | `ConfirmarEmailPage`: lee `token_hash` y `type` de la URL y los envía a la API para activar la cuenta | No | US-02 |
| `/entrar` | `EntrarPage`: formulario de acceso con email y contraseña | No | US-03 |
| `/panel` | `PanelPage`: zona privada con botón para cerrar sesión | Sí | US-03, US-67 |
| `*` | `NoEncontradaPage` | No | TR-05 |

Para añadir una página: crear `pages/NombrePage.jsx`, añadir su `<Route>` en `App.jsx` y su fila en esta tabla. Todas las llamadas al servidor pasan por `api()` de `api/cliente.js`, que añade la cabecera `Authorization` cuando hay sesión y convierte los errores del contrato en `ErrorApi` (se decide según `error.code`).

TR-05 incorpora la estructura: las páginas de registro, confirmación y entrada todavía son marcadores de posición. `RutaPrivada` solo comprueba la presencia local de un token; la validación con `/api/auth/me`, el formulario y el cierre de sesión corresponden a las implementaciones de sus historias. Que una ruta sirva el HTML de React no acredita su funcionamiento.

### Requisitos

- Git para clonar el repositorio.
- Docker Desktop actualizado, abierto y con contenedores Linux. En Windows utiliza su configuración con WSL 2.
- Docker Compose con soporte para `docker compose up --wait`.
- Conexión a Internet para descargar la imagen de Node y las dependencias.
- Puertos locales 5173 y 3000 libres, o configurar otros en `.env`.

Las imágenes utilizan Node.js 24 y npm. No hace falta instalar Node ni npm en el ordenador para trabajar con Docker. Las versiones de las dependencias están fijadas en los `package-lock.json`.

### Primer arranque

1. Abrir Docker Desktop y esperar a que el motor esté en ejecución.
2. Clonar el repositorio y entrar en su carpeta. Si ya está clonado, actualizar la rama que se vaya a utilizar:

```bash
git clone https://github.com/UB-ES-A4-2026/sportsplace.git
cd sportsplace
```

TR-02 ya está integrado en la base técnica. Desde un clon sin cambios pendientes, utilizar `dev` para el arranque base:

```bash
git fetch origin
git switch dev
git pull --ff-only
```

Para reproducir la integración de #28 y #30 antes de que US-01 llegue completa a `dev`, utilizar `story/US-01-registro` actualizada con `git switch story/US-01-registro` y `git pull --ff-only`. Anotar el commit probado. No desarrollar directamente sobre la historia: crear una rama de tarea desde ella.

3. Copiar `.env.example` a `.env` en la raíz. Ejecutar solo el comando correspondiente al sistema:

PowerShell (Windows):

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

macOS o Linux:

```bash
if [ ! -f .env ]; then cp .env.example .env; fi
```

Este paso se hace una vez: conservar un `.env` existente para no sobrescribir la configuración local. Los valores de Supabase y `DATABASE_URL` pueden quedarse vacíos para comprobar el arranque de TR-02. TR-03 requiere configurar la conexión privada antes de ejecutar `db:check`.

En Windows y macOS, conservar `LOCAL_UID=1000` y `LOCAL_GID=1000`. En Linux, obtener el usuario y grupo con `id -u` e `id -g` y poner esos valores en `.env` antes de construir las imágenes. Así el contenedor puede escribir los archivos del proyecto sin errores de permisos.

4. Desde la raíz del repositorio, arrancar ambos servicios con un comando:

```bash
docker compose up --build --detach --wait
```

El primer arranque tarda más porque descarga y construye las imágenes. Compose instala las dependencias de los lockfiles dentro de los contenedores y espera a que ambos servicios estén saludables. La web arranca después de que la API esté disponible.

5. Abrir la web en **http://localhost:5173**. Debe mostrar React en funcionamiento y la API conectada. La API responde también en **http://localhost:3000/api/health**:

```json
{"status":"ok","service":"sportsplace-api"}
```

Si se cambiaron `WEB_PORT` o `API_PORT`, utilizar esos puertos. Los servicios se publican únicamente en el ordenador local. El navegador utiliza `/api/health` y Vite redirige la petición al servidor dentro de Docker.

### Configuración de Supabase

El archivo `.env` contiene:

| Variable | Uso |
|---|---|
| `WEB_PORT` | Puerto de la web en el ordenador. Por defecto, 5173. |
| `API_PORT` | Puerto de la API en el ordenador. Por defecto, 3000. |
| `LOCAL_UID` / `LOCAL_GID` | Usuario y grupo del contenedor de desarrollo. Por defecto, 1000. Ajustarlos al usuario local en Linux. |
| `SUPABASE_URL` | URL del proyecto compartido; la utiliza Supabase Auth en el backend. Opcional para el arranque inicial. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable que utiliza el backend para Supabase Auth. Opcional para el arranque inicial. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Storage, solo para el backend. Permite subir y borrar fotos en `anuncios` cuando T13-2 esté integrado. Nunca usarla en `VITE_*`. |
| `DATABASE_URL` | URI PostgreSQL privada que utiliza el servidor. Necesaria para comprobar TR-03. |
| `MIGRATION_DATABASE_URL` | URI privada de un usuario con permisos para migrar. Opcional: si está vacía, las herramientas utilizan `DATABASE_URL`. |
| `DATABASE_SSL_CA_FILE` | Ruta del certificado CA para verificar PostgreSQL. En Docker: `/app/.certs/supabase-ca.crt`. |

La URL y la clave **publicable** se obtienen en el panel del proyecto Supabase, desde **Connect** o la configuración de claves API. Cada persona rellena su `.env` local. La web consume exclusivamente `/api/...`; el backend centraliza Supabase Auth y accede a `centros` mediante PostgreSQL privado.

Compose conserva también las variables públicas `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de la base inicial, pero el cliente web integrado no las utiliza para acceder a Supabase. Las variables `VITE_*` son visibles en el navegador: no poner en ellas contraseñas, claves `secret` ni `service_role`. El archivo `.env.example` conserva valores vacíos y `.env` está excluido de Git y de las imágenes.

`DATABASE_URL` y `MIGRATION_DATABASE_URL` contienen credenciales privadas. Solo se configuran en el `.env` local, nunca con un prefijo `VITE_`, en el README, en capturas ni en comentarios de GitHub. La clave publicable de Supabase no sustituye a la contraseña de PostgreSQL.

La preparación del bucket `anuncios`, sus permisos, la dependencia de US-12 y la validación de T13-1 están en [Storage de anuncios](docs/storage-anuncios.md).

#### Preparar la conexión PostgreSQL para TR-03

1. En el proyecto compartido de Supabase, abrir **Connect → Session pooler** y copiar su URI PostgreSQL. Este modo permite conectar desde redes IPv4. Conservar exactamente el servidor, el usuario, el puerto y la base que muestra el panel.
2. Poner la URI en `DATABASE_URL` del `.env` local y sustituir el marcador de contraseña por la contraseña de la base de datos. Codificar los caracteres reservados de la contraseña, por ejemplo `@`, `#` o espacios, para que formen parte de la URI y no cambien su estructura.
3. Abrir **Database Settings → SSL Configuration → Download certificate**. Guardar el certificado CA en `backend/.certs/supabase-ca.crt` y configurar `DATABASE_SSL_CA_FILE=/app/.certs/supabase-ca.crt` en `.env`. La carpeta `.certs` está excluida de Git y de las imágenes; Docker la lee mediante el montaje local del backend. Las herramientas de migración adaptan esa ruta a su propio contenedor.

El nombre del archivo puede ser otro: si se conserva el nombre descargado, ajustar `DATABASE_SSL_CA_FILE` para que coincida, manteniendo el prefijo Docker `/app/.certs/`.

El servidor y las herramientas verifican TLS y la identidad del servidor de PostgreSQL. Si la verificación falla, revisar el certificado y la URI; no desactivar la comprobación. Los detalles de conexión y del certificado están en la [documentación oficial de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Después de cambiar `.env`, recrear los servicios para aplicar los nuevos valores:

```bash
docker compose up --detach --force-recreate --wait
```

Después de configurar PostgreSQL y aplicar la migración, comprobar su conexión desde el servidor:

```bash
docker compose exec backend npm run db:check
```

El comando ejecuta `SELECT 1` y comprueba que existe `public.centros`. Debe mostrar **Conexión PostgreSQL: correcta** y **Tabla public.centros: encontrada**. Si la tabla falta, la conexión puede estar funcionando aunque la migración siga pendiente. Ver la web y `/api/health` en verde solo valida el arranque de TR-02.

`LOCAL_UID` y `LOCAL_GID` se definen antes del primer arranque: se aplican al construir las imágenes. Si se necesitan cambiar más adelante, revisar con Carlos los permisos de los volúmenes existentes antes de reconstruir. No eliminar volúmenes como parte de una comprobación de arranque.

### Desarrollo diario

Editar el código desde VS Code en `frontend/src` o `backend/src`. Docker monta estas carpetas y conserva las dependencias en volúmenes independientes, para que las instalaciones de Windows y Linux no se mezclen.

La web recarga los cambios mediante polling para que funcione con archivos editados desde Windows. El servidor utiliza `node --watch`; si un cambio del servidor no se detecta, reiniciarlo con `docker compose restart backend`.

Comandos desde la raíz:

```bash
# Estado de los servicios: ambos deben estar healthy
docker compose ps

# Ver los registros; Ctrl+C deja de mostrarlos sin detener el proyecto
docker compose logs --follow

# Detener y retirar los contenedores; conserva los volúmenes de dependencias
docker compose down
```

Para volver a arrancar, utilizar el comando de **Primer arranque**. `npm ci` se ejecuta al iniciar cada servicio y sincroniza sus dependencias con el lockfile.

Para añadir una dependencia, utilizar el contenedor del área correspondiente y guardar tanto `package.json` como `package-lock.json` en Git. Ejemplo para frontend, sustituyendo `nombre-del-paquete`:

```bash
docker compose exec frontend npm install nombre-del-paquete
```

Para backend se utiliza `docker compose exec backend npm install nombre-del-paquete`. Después, volver a ejecutar `docker compose up --build --detach --wait` y realizar las comprobaciones. No subir `node_modules` ni `dist`.

### Comprobaciones disponibles

```bash
# Comprobar la configuración sin mostrar variables del entorno
docker compose config --quiet

# Lint del servidor y de la web
docker compose exec backend npm run lint
docker compose exec frontend npm run lint

# Pruebas HTTP y de la configuración PostgreSQL del servidor
docker compose exec backend npm test

# Comprobar que la web compila
docker compose exec frontend npm run build

# Conexión y existencia de la tabla: requiere configurar TR-03
docker compose exec backend npm run db:check
```

Las pruebas del servidor comprueban salud, errores, registro con dobles, configuración y TLS de PostgreSQL. Las pruebas unitarias no necesitan credenciales de Supabase. `db:check` realiza la comprobación contra la base configurada. La compilación de React comprueba que la base del frontend se puede construir; no sustituye a las pruebas funcionales de las historias.

Para ejecutar lint y tests de `tools/` sin migrar, sin montar `.env` y sin instalar dependencias en el host, ejecutar desde la raíz (PowerShell, macOS o Linux):

```bash
docker run --rm -v "${PWD}/tools:/repo:ro" -w /tmp/sportsplace-tools node:24-bookworm-slim sh -c "cp -R /repo/. . && npm ci --no-audit --no-fund && npm run lint && npm test"
```

La copia y sus dependencias quedan en el contenedor temporal. No invocar el servicio `dbtools` sin `--dry-run` para ejecutar estas pruebas: su entrada está destinada a aplicar migraciones.

El workflow de esta rama ([.github/workflows/ci.yml](.github/workflows/ci.yml)) se ejecuta en cada pull request y en cada cambio de `main` y `dev` (#26 integrado en la historia). Con Node.js 24, instala las dependencias con `npm ci` y ejecuta el lint (ESLint) en `backend/`, `frontend/` y `tools/`, las pruebas del servidor y de las herramientas, y la compilación de la web. La versión del workflow de cada rama depende de sus integraciones; no se ha adelantado US-01 a `dev` para publicar este ajuste.

Para reproducir el CI completo en local antes de abrir una pull request, ejecutar desde la raíz:

```bash
docker run --rm -v "${PWD}:/repo:ro" -w /tmp/sportsplace-ci node:24-bookworm-slim sh -c "cp -R /repo/backend /repo/tools /repo/frontend . && cd backend && npm ci && npm run lint && npm test && cd ../tools && npm ci && npm run lint && npm test && cd ../frontend && npm ci && npm run lint && npm run build"
```

El contenedor lee el repositorio y copia las tres carpetas a su espacio temporal. Las dependencias y la compilación se generan dentro de ese espacio, que se elimina al terminar; así no crea archivos con propietario root en la carpeta de trabajo de Linux.

### Problemas habituales

| Problema | Qué comprobar |
|---|---|
| Docker no puede conectar con el motor | Abrir Docker Desktop, esperar a que termine el arranque y comprobar que utiliza contenedores Linux. |
| Puerto ocupado | Cambiar `WEB_PORT` o `API_PORT` en `.env` y recrear los servicios. |
| Fallo al descargar imágenes o dependencias | Revisar la conexión a Internet y los registros del servicio; repetir el arranque cuando se resuelva. |
| La web muestra un error de API | Comprobar `docker compose ps` y `docker compose logs backend`; después pulsar **Volver a comprobar** en la web. |
| Cambió la configuración y no se aplica | Recrear los servicios con el comando de configuración. Un simple reinicio no actualiza las variables del contenedor. |
| Falta `DATABASE_URL` | Rellenar la URI privada en `.env` y recrear backend. El arranque de TR-02 funciona sin esta configuración, pero `db:check` la necesita. |
| No se pudo verificar TLS o leer el certificado | Descargar el CA del proyecto, comprobar `backend/.certs/supabase-ca.crt` y configurar su ruta Docker en `DATABASE_SSL_CA_FILE`. No usar una ruta de Windows dentro del contenedor. |
| PostgreSQL no conecta | Comprobar la contraseña codificada en la URI, los datos de **Session pooler**, el estado del proyecto y la conexión de red. |
| La tabla `public.centros` no aparece | Comprobar el proyecto configurado y las migraciones pendientes con el comando de TR-03. |

### Validación del equipo y cierre de TR-02

Cada persona debe seguir estas instrucciones en su ordenador y registrar el resultado en la issue. El procedimiento y las seis confirmaciones se siguen en [TR-02: validación](docs/TR-02-validacion.md).

TR-02 se cierra cuando los cambios están revisados e integrados y los seis miembros han confirmado el arranque. Preparar el entorno o fusionar esta base no completa por sí solo ese último criterio.

## Base de datos y migraciones: TR-03

Responsables: Anass y Alex. La primera migración está integrada en la base técnica; #28 añade a esta historia `20261009120000_enlazar_centros_usuarios.sql`, que relaciona `centros.usuario_id` con `auth.users`. Las contraseñas se gestionan en Supabase Auth, nunca en `centros`. Ambas migraciones están aplicadas en el proyecto compartido: evidencia de Anass en [#8](https://github.com/UB-ES-A4-2026/sportsplace/issues/8#issuecomment-6175158124) y comprobación de solo lectura del 20/10 en la [validación DevOps](docs/sprint-0-validacion-devops.md).

### Esquema inicial de centros

La migración [20261008090000_crear_centros.sql](supabase/migrations/20261008090000_crear_centros.sql) crea `public.centros` con estos campos:

| Campo | Regla |
|---|---|
| `id` | UUID generado al crear el centro; clave primaria. |
| `nombre` | Obligatorio, no vacío; hasta 160 caracteres. |
| `email` | Obligatorio, no vacío; hasta 254 caracteres. Único ignorando mayúsculas y espacios al principio o al final. |
| `localidad` | Obligatoria, no vacía; hasta 120 caracteres. |
| `direccion` | Opcional; hasta 255 caracteres. |
| `codigo_postal` | Opcional; hasta 20 caracteres. |
| `telefono` | Opcional; hasta 30 caracteres. |
| `politica_privacidad_aceptada` | Debe indicarse explícitamente como `true`; no tiene un valor automático de aceptación. |
| `politica_privacidad_aceptada_en` | Fecha obligatoria y explícita del consentimiento. |
| `email_confirmado_en` | Fecha de confirmación; inicialmente vacía. |
| `email_confirmado` | Valor generado a partir de la fecha anterior: `false` sin fecha y `true` cuando existe. No se modifica directamente. |
| `creado_en` | Fecha de creación generada automáticamente. |
| `usuario_id` | Añadido por la segunda migración: UUID único que referencia `auth.users`, con `ON DELETE CASCADE`. |

Nombre, email y localidad son obligatorios; dirección, código postal y teléfono son opcionales. La API integrada valida estos campos según el contrato. El formulario de US-01 sigue pendiente de integración.

La tabla registra el estado de confirmación; Supabase Auth envía el correo. El endpoint que verifica el token y copia la fecha de confirmación pertenece a US-02 (#17), no está integrado todavía en esta historia. RLS está activado y `anon`/`authenticated` no pueden acceder a `centros`. El servidor utiliza su conexión privada, sin necesitar políticas de cliente mientras la web solo consuma nuestra API.

### Revisar y aplicar nuevas migraciones

La herramienta `dbtools` utiliza Supabase CLI **2.120.0**, fijada en sus dependencias. Es un servicio opcional del perfil `tools`: no se inicia con el comando normal de la web y la API ni instala una base de datos local. No hace falta instalar la CLI en el ordenador.

Las migraciones `20261008090000` y `20261009120000` ya están aplicadas: no volver a crear sus cambios manualmente ni editar sus archivos. El procedimiento siguiente es para cambios nuevos revisados por sus responsables.

1. Anass y Alex revisan el SQL y los campos propuestos. Una persona coordina la aplicación al proyecto compartido para evitar ejecuciones simultáneas.
2. Configurar las credenciales privadas y el CA del proyecto como se indica arriba. Para migrar se utiliza `MIGRATION_DATABASE_URL` si está definida; en caso contrario, `DATABASE_URL`. El usuario de esa URI necesita permisos para crear la tabla y registrar las migraciones.
3. Desde la raíz del repositorio, revisar las migraciones pendientes sin aplicar su SQL:

```bash
docker compose run --rm --build dbtools --dry-run
```

4. Después de revisar la propuesta y comprobar que la URI corresponde al proyecto compartido correcto, aplicar las migraciones pendientes:

```bash
docker compose run --rm --build dbtools
```

5. Comprobar `public.centros` en Supabase y ejecutar `docker compose exec backend npm run db:check`. Guardar la evidencia sin credenciales en la issue TR-03.

La CLI mantiene el historial de las migraciones aplicadas. Los siguientes cambios del esquema se añaden en nuevos archivos SQL; no se edita una migración ya aplicada ni se duplican sus cambios manualmente en el panel. Referencia: [migraciones de Supabase](https://supabase.com/docs/guides/deployment/database-migrations).

Las pruebas SQL están en [supabase/tests/centros.sql](supabase/tests/centros.sql). Se ejecutan en una base de pruebas después de aplicar la migración, con un usuario administrador y los roles `anon` y `authenticated`. Verifican las restricciones y los permisos dentro de una transacción que termina en `ROLLBACK`, sin conservar centros de prueba.

La evidencia local y los criterios todavía pendientes se registran en [TR-03: validación](docs/TR-03-validacion.md). TR-03 podrá cerrarse cuando se confirme el acceso del equipo, se revise y aplique el esquema al Supabase compartido, la migración esté integrada en el repositorio y el servidor compruebe la conexión real con ese proyecto.

## Seguimiento

- [Repositorio](https://github.com/UB-ES-A4-2026/sportsplace)
- [Trello](https://trello.com/b/O7v4vfgE/kanban)
- [Kanban de GitHub: Sportsplace — Sprint 0](https://github.com/orgs/UB-ES-A4-2026/projects/1)
