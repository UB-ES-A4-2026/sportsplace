# Sportsplace

Proyecto universitario de una plataforma de compraventa de material deportivo entre clubes y centros deportivos.

## Estado del proyecto

El proyecto está en el Sprint 0: preparación del repositorio, entorno de desarrollo, decisiones técnicas y primeras funcionalidades de registro y acceso.

Historias seleccionadas para este sprint:

- US-01: registrar un centro en la plataforma.
- US-02: confirmar el email tras el registro.
- US-03: iniciar sesión con email y contraseña.
- US-67: cerrar sesión.

La implementación y validación de estas historias se siguen en el Kanban.

## Tecnologías

- Frontend: React con Vite, en JavaScript.
- Backend: Node.js 24; el servidor inicial usa `node:http`. Anass y Alex deben confirmar Express o NestJS para la API funcional.
- Base de datos: PostgreSQL mediante Supabase.
- Entorno de desarrollo: Docker y Docker Compose, con servicios separados para web y servidor.
- Integración continua: GitHub Actions, pendiente de configurar.
- Autenticación: pendiente de confirmar el uso de Supabase Auth.

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
- Las historias usan su identificador original, por ejemplo US-01. Las tareas técnicas usan el suyo, por ejemplo TR-01.
- El número de una issue de GitHub, como #5, no sustituye al identificador de la historia o tarea.
- Frontend y backend pueden trabajar en tareas y pull requests diferentes de una misma historia.

### Estrategia de ramas

Trabajamos con una rama principal `main` y ramas temporales por tarea.

#### Rama principal: main

`main` contiene la versión integrada del proyecto y debe mantenerse utilizable según el estado del sprint.

- Todos los cambios se incorporan mediante pull request.
- Cada pull request necesita al menos una aprobación de otra persona.
- Las conversaciones pendientes deben resolverse antes de fusionar.
- Las comprobaciones automáticas serán obligatorias cuando el workflow esté configurado y operativo.
- La protección debe aplicarse también a los administradores.

#### Ramas temporales: categorías

El nombre sigue este formato:

`categoria/ID-descripcion`

La categoría indica el tipo de cambio. El ID identifica la historia o tarea original de Excel/Trello.

| Categoría | Cuándo utilizarla | Ejemplo |
|---|---|---|
| `feature/` | Añadir una funcionalidad o una parte de ella. | `feature/US-01-registro-web` |
| `fix/` | Corregir un comportamiento que funciona incorrectamente. | `fix/US-03-error-login` |
| `docs/` | Cambiar exclusivamente documentación. | `docs/TR-01-reglas-trabajo` |
| `chore/` | Configurar herramientas, dependencias, Docker, CI o mantenimiento del repositorio. | `chore/TR-01-plantilla-pr` |
| `test/` | Añadir o mejorar pruebas como tarea independiente. | `test/US-03-pruebas-login` |
| `refactor/` | Reorganizar código manteniendo su comportamiento. | `refactor/US-03-servicio-login` |

Las categorías son una convención del equipo. Cualquier miembro puede utilizar cualquiera de ellas según la tarea que tenga asignada.

Si una funcionalidad incluye código y sus pruebas, ambos cambios pueden ir en la misma rama `feature/`. Se usa `test/` cuando la tarea consiste principalmente en pruebas.

#### Reglas de nombres y alcance

- Conservar el ID original: `US-01`, `TR-01`, etc.
- Escribir la descripción en minúsculas, con guiones y sin espacios ni tildes.
- Crear la rama desde `main` actualizada.
- Mantener un cambio coherente y revisable por rama.
- Usar ramas temporales por trabajo concreto, evitando ramas permanentes por persona, área o sprint.
- Eliminar la rama después de fusionar su pull request.

#### Trabajo paralelo de frontend y backend

Una historia puede necesitar varias ramas:

- `feature/US-01-registro-web`: formulario e interfaz.
- `feature/US-01-registro-api`: API y validaciones del servidor.

Cada rama tiene su responsable y su pull request. Ambas hacen referencia a US-01.

La historia completa pasa a **Hecho** cuando las partes están integradas y se cumplen todos sus criterios de aceptación.

### Procedimiento para desarrollar una tarea

1. Revisar la tarea, sus criterios de aceptación y sus dependencias.
2. Asignarse la tarea y moverla a **En curso** en GitHub Projects, manteniendo Trello actualizado según lo acordado.
3. Con los cambios anteriores ya guardados, actualizar `main` y crear la rama:

```bash
git switch main
git pull --ff-only
git switch -c feature/US-03-login
```

4. Implementar el cambio y realizar las comprobaciones que correspondan.
5. Revisar los archivos modificados y crear un commit. Sustituir `ruta/del/archivo` por los archivos que se quieran incluir:

```bash
git status
git add ruta/del/archivo
git diff --cached
git commit -m "US-03: implementar acceso con email y contraseña"
git push -u origin feature/US-03-login
```

6. Abrir una pull request hacia `main` y mover la tarea a **En revisión**.
7. Solicitar revisión a otra persona del equipo y atender sus comentarios.
8. Tras la aprobación y las comprobaciones, fusionar mediante **Squash and merge** y eliminar la rama utilizada.

Si `main` cambia durante el desarrollo, incorporar sus cambios desde la rama de trabajo, con los cambios propios ya guardados en commits:

```bash
git fetch origin
git merge origin/main
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
- Mientras se prepara el workflow de GitHub Actions, cada pull request documenta las comprobaciones manuales realizadas.
- Cuando el workflow esté operativo, se configurarán sus comprobaciones como obligatorias en `main`. Los fallos deberán resolverse antes de fusionar.
- No se permite forzar cambios ni eliminar `main`.

### Cómo revisar y fusionar una pull request en GitHub

1. El autor abre la pull request hacia `main` y solicita revisión desde **Reviewers** a un compañero con permiso Write.
2. El revisor entra en **Files changed**, revisa los cambios y las comprobaciones descritas.
3. Si todo está correcto, pulsa **Review changes → Approve → Submit review**. Si necesita correcciones, utiliza **Request changes** y explica qué debe cambiar.
4. El autor atiende los comentarios y solicita otra revisión cuando corresponda.
5. Cuando exista una aprobación y se cumplan los demás requisitos, el autor selecciona **Squash and merge** y confirma la fusión.
6. Se elimina la rama con **Delete branch**, si no se elimina automáticamente.

Un comentario normal no cuenta como aprobación. El autor no puede aprobar su propia pull request.

La tarea pasa a **Hecho** cuando cumple todos sus criterios. Una PR parcial no completa automáticamente una historia.

### Estados del Kanban

- **Backlog:** trabajo registrado y pendiente de seleccionar.
- **Sprint actual:** trabajo seleccionado para el sprint, todavía sin empezar.
- **En curso:** trabajo que ya se está realizando.
- **En revisión:** trabajo preparado para revisión y validación.
- **Hecho:** trabajo revisado, validado y con sus criterios cumplidos; los cambios de código están integrados en `main`.

Fusionar una tarea parcial de frontend o backend no completa automáticamente la historia. La historia pasa a **Hecho** cuando funciona el conjunto y se cumplen todos sus criterios de aceptación.

### Configuración y documentación

- No subir contraseñas, claves privadas ni archivos `.env`.
- Mantener `.env.example` con valores de ejemplo.
- Actualizar las instrucciones cuando cambie el arranque o la configuración.
- Mantener las versiones y dependencias acordadas por el equipo.

## Arranque y comprobaciones

### Qué incluye TR-02

La base de desarrollo incluye una web React y una API de comprobación que arrancan juntas. La pantalla inicial verifica que puede comunicarse con el servidor mediante `/api/health`.

Supabase es el proyecto compartido en la nube. Docker ejecuta nuestra web y nuestro servidor; la base de datos permanece en Supabase. La integración con sus datos y Auth se implementará cuando backend confirme las decisiones del sprint. El endpoint de salud comprueba la API, no la conexión con Supabase.

Estructura inicial:

```text
sportsplace/
├── backend/                 # Servidor, pruebas HTTP y Dockerfile
├── frontend/                # Web React, configuración de Vite y Dockerfile
├── docs/TR-02-validacion.md  # Evidencia técnica y confirmaciones del equipo
├── compose.yaml             # Arranque conjunto de web y API
├── .env.example             # Plantilla de configuración sin credenciales
└── README.md                # Trabajo en equipo y uso del entorno
```

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

Antes de integrar TR-02, Carlos debe publicar su rama para que los demás puedan probarla. Después de clonarla, o desde un clon existente sin cambios pendientes, obtener esa rama:

```bash
git fetch origin
git switch chore/TR-02-entorno-desarrollo
```

Una vez fusionada, estas instrucciones se siguen desde `main` actualizada mediante `git switch main` y `git pull --ff-only`.

3. Copiar `.env.example` a `.env` en la raíz. Ejecutar solo el comando correspondiente al sistema:

PowerShell (Windows):

```powershell
Copy-Item .env.example .env
```

macOS o Linux:

```bash
cp .env.example .env
```

Este paso se hace una vez: conservar un `.env` existente para no sobrescribir la configuración local. Los valores de Supabase pueden quedarse vacíos para comprobar el arranque de TR-02.

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
| `SUPABASE_URL` | URL del proyecto compartido. Opcional para el arranque inicial. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable del proyecto compartido. Opcional para el arranque inicial. |

La URL y la clave **publicable** se obtienen en el panel del proyecto Supabase, desde **Connect** o la configuración de claves API. Cada persona rellena su `.env` local. La clave publicable está diseñada para el cliente; los permisos sobre los datos se deberán definir con las políticas de Supabase al implementar la integración.

Compose entrega al frontend únicamente estos valores públicos, con los nombres `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Las variables `VITE_*` son visibles en el navegador: no poner en ellas contraseñas, claves `secret` ni `service_role`. El archivo `.env.example` conserva valores vacíos y `.env` está excluido de Git y de las imágenes.

Después de cambiar `.env`, recrear los servicios para aplicar los nuevos valores:

```bash
docker compose up --detach --force-recreate --wait
```

`LOCAL_UID` y `LOCAL_GID` se definen antes del primer arranque: se aplican al construir las imágenes. Si se necesitan cambiar más adelante, reconstruirlas y regenerar los volúmenes de dependencias. En esta base los volúmenes contienen únicamente dependencias de Node:

```bash
docker compose down --volumes
docker compose up --build --detach --wait
```

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

# Pruebas HTTP de la API de comprobación
docker compose exec backend npm test

# Comprobar que la web compila
docker compose exec frontend npm run build
```

Las pruebas del servidor comprueban las rutas de salud, las rutas desconocidas y los métodos no permitidos. La compilación de React comprueba que la base del frontend se puede construir; no sustituye a las pruebas funcionales de las historias.

Lint, pruebas de las historias y el workflow de GitHub Actions se concretarán con Asier. Todavía no hay un comando de lint ni una comprobación de CI que se pueda exigir en `main`.

### Problemas habituales

| Problema | Qué comprobar |
|---|---|
| Docker no puede conectar con el motor | Abrir Docker Desktop, esperar a que termine el arranque y comprobar que utiliza contenedores Linux. |
| Puerto ocupado | Cambiar `WEB_PORT` o `API_PORT` en `.env` y recrear los servicios. |
| Fallo al descargar imágenes o dependencias | Revisar la conexión a Internet y los registros del servicio; repetir el arranque cuando se resuelva. |
| La web muestra un error de API | Comprobar `docker compose ps` y `docker compose logs backend`; después pulsar **Volver a comprobar** en la web. |
| Cambió la configuración y no se aplica | Recrear los servicios con el comando de configuración. Un simple reinicio no actualiza las variables del contenedor. |

### Validación del equipo y cierre de TR-02

Cada persona debe seguir estas instrucciones en su ordenador y registrar el resultado en la issue. El procedimiento y las seis confirmaciones se siguen en [TR-02: validación](docs/TR-02-validacion.md).

TR-02 se cierra cuando los cambios están revisados e integrados y los seis miembros han confirmado el arranque. Preparar el entorno o fusionar esta base no completa por sí solo ese último criterio.

## Seguimiento

- [Repositorio](https://github.com/UB-ES-A4-2026/sportsplace)
- [Trello](https://trello.com/b/O7v4vfgE/kanban)
- Kanban de GitHub: Sportsplace — Sprint 0. Enlace pendiente de añadir.
