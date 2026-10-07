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

- Frontend: React.
- Backend: Node.js; pendiente de confirmar Express o NestJS.
- Base de datos: PostgreSQL mediante Supabase.
- Entorno de desarrollo: Docker y Docker Compose, pendientes de configurar.
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

El entorno de ejecución está en preparación durante el Sprint 0.

Esta sección se completará cuando esté disponible el esqueleto de frontend y backend e incluirá:

- Requisitos y versiones.
- Instalación de dependencias.
- Configuración mediante `.env.example`.
- Arranque con Docker Compose.
- Direcciones de acceso a la web y a la API.
- Comandos de lint y tests.

## Seguimiento

- [Repositorio](https://github.com/UB-ES-A4-2026/sportsplace)
- [Trello](https://trello.com/b/O7v4vfgE/kanban)
- Kanban de GitHub: Sportsplace — Sprint 0. Enlace pendiente de añadir.