# Sprint 0: planificación y seguimiento

Borrador preparado el 13/10/2026. Asier coordina su revisión y traslado a la plantilla oficial cuando se localice. Este documento no acredita el cierre del sprint ni sustituye un formulario exigido por la asignatura.

## Objetivo

Preparar una base compartida y reproducible para Sportsplace: repositorio y flujo de revisión, web React y servidor Node.js con Docker Compose, PostgreSQL en Supabase, migraciones y CI. Integrar y validar el recorrido seleccionado de registro, confirmación del email, entrada y cierre de sesión según los criterios acordados.

Las cuatro historias suman 8 puntos. Las tareas técnicas no añaden puntos de historia en la planificación del documento de Clase 3. El seguimiento debe reflejar el trabajo comprobado, aunque alguna parte del recorrido siga pendiente.

## Fechas

| Hito | Fecha y condición |
|---|---|
| Inicio previsto en el documento de Clase 3 | 07/10/2026. |
| Fecha límite de las tareas | **14/10/2026 a las 15:00, Europe/Madrid**, confirmada por Carlos. |
| Sprint 0 check | 13 o 14/10/2026 según el grupo; sesión concreta por confirmar. |
| Cierre formal del sprint | Por confirmar por el equipo en la plantilla. No se deduce automáticamente de la hora límite de las tareas. |
| Demo de Sprint 0 | 20 o 21/10/2026 según el grupo; sesión concreta por confirmar. |

El plan original de Clase 3 proponía tener todo integrado el 13/10. La fecha límite comunicada ahora por Carlos es la del 14/10 a las 15:00.

## Alcance y reparto

| ID | Resultado previsto | Responsables de área | Puntos |
|---|---|---|---:|
| TR-01 | Repositorio, reglas de ramas, protección de `main`/`dev` y Kanban | Carlos | - |
| TR-02 | Entorno Docker reproducible por las seis personas | Carlos; cada persona confirma su arranque | - |
| TR-03 | Supabase compartido, esquema, migraciones y conexión | Anass y Alex; Carlos apoya la configuración | - |
| TR-04 | CI y comprobaciones obligatorias | Asier; Carlos configura la protección | - |
| TR-05 | Estructura de la web | Lucía y Marta | - |
| TR-06 | Estructura del servidor y contrato de API | Anass y Alex, coordinados con frontend | - |
| TR-07 | Planificación y seguimiento coherente | Asier, con el equipo | - |
| US-01 | Registrar un centro | Backend y frontend, según sus tareas asignadas | 3 |
| US-02 | Confirmar email y proteger las operaciones previstas | Backend y frontend, según sus tareas asignadas | 2 |
| US-03 | Entrar con email y contraseña | Backend y frontend, según sus tareas asignadas | 2 |
| US-67 | Cerrar sesión | Backend y frontend, según sus tareas asignadas | 1 |

Los TR iniciales son tareas de US-01 y se trabajan desde `story/US-01-registro`. Los TR ya integrados en `dev` se heredan al crear la historia; los cambios nuevos van desde una rama de trabajo hacia su `story/`. El responsable concreto de cada implementación se consulta en su issue y PR. QA valida los criterios y cada persona presenta una contribución terminada en la demo.

## Decisiones y dependencias

| Tema | Situación que debe quedar registrada |
|---|---|
| Web y entorno | React con Vite, JavaScript y Docker Compose. |
| Servidor y autenticación | Las PR de Alex usan Express 5, Node.js 24 y Supabase Auth. Pendiente de registrar el acuerdo de Anass y Alex. |
| Datos | PostgreSQL en Supabase; esquema inicial y enlace a `auth.users` pendientes de revisión y aplicación verificada. |
| Integración | GitHub Actions ya integrado en la base técnica: lint en las tres áreas, tests de backend/tools y build de frontend. Falta integrar el ajuste de push a `dev` de #26 y verificar los jobs obligatorios en `main` y `dev`. |
| API | La web consume `/api/...`; `docs/api-contrato.md` define rutas y errores. |
| Despliegue de producción | Por decidir. El documento de Clase 3 lo considera opcional para Sprint 0. |

La confirmación depende del registro. El flujo acordado es ramas de trabajo → `story/US-xx-...` → `dev` → `main`. Las historias entran completas y validadas por QA en `dev`; Carlos publica las entregas de `dev` a `main` mediante merge commit. Las PR encadenadas de la estrategia anterior requieren revisar y separar sus cambios por historia antes de cambiar las bases: una aprobación o un CI de una versión anterior no certifica cambios posteriores. Las migraciones compartidas esperan la revisión del esquema. Las partes se revisan por separado y la historia se valida como un conjunto.

## Validación y preparación de la demo

- [ ] Registrar las seis confirmaciones de Docker y enlazar la evidencia de TR-02.
- [ ] Verificar migraciones y conexión real al proyecto compartido.
- [ ] Registrar el flujo real de registro, correo, confirmación, login y logout.
- [ ] Comprobar los criterios de las historias y documentar los fallos o pendientes.
- [ ] Enlazar al menos una contribución terminada por persona para la demo.
- [ ] Actualizar Excel, Trello y GitHub con el mismo alcance y estado.
- [ ] Completar la tabla de capacidades con las respuestas de cada integrante.
- [ ] Confirmar el formato de plantilla y los documentos adicionales de la rúbrica.

## Seguimiento y fuentes

- [Repositorio y PR](https://github.com/UB-ES-A4-2026/sportsplace)
- [Kanban de GitHub](https://github.com/orgs/UB-ES-A4-2026/projects/1)
- [Trello](https://trello.com/b/O7v4vfgE/kanban)
- Fuente de planificación: PDF aportado `Sprint 0 - Decisiones de diseño (Clase 3)`, fechado el 07/10/2026. Contiene calendario, reparto, historias y criterios de evaluación; no incluye la plantilla oficial.
- Pendiente: plantilla original y PDFs de agentes citados por Asier. La necesidad de AGENTS.md, DoD ampliada y una página de herramientas procede de su mensaje y debe contrastarse con esas fuentes.
