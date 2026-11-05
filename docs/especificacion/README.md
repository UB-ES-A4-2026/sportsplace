# Especificación y forma de trabajar

Esta carpeta es la especificación funcional y técnica del proyecto. Se implementa exactamente lo que dice; lo que no esté aquí no se hace. Si falta algo o algo no cuadra, se comenta en la issue de la historia antes de programarlo.

| Archivo | Contenido |
|---|---|
| [00-guia-comun.md](00-guia-comun.md) | Normas de redacción, convenciones de API e interfaz y diccionario de datos. |
| [E01-E02-registro-y-perfil.md](E01-E02-registro-y-perfil.md) | Sprint 1: US-04 (recuperar contraseña), US-07 (perfil del centro) y US-68 (ubicación). Sprint 2: US-10 (perfil de otro centro). El resto de historias del archivo son de sprints posteriores. |
| [E03-publicacion-de-material.md](E03-publicacion-de-material.md) | Sprint 1: «Base común» de los anuncios y las historias US-12 a US-18 y US-70, con sus criterios (CA), flujos e2e y tareas. |
| [E04-busqueda-y-exploracion.md](E04-busqueda-y-exploracion.md) | Sprint 2: «Base común» del catálogo y US-96, US-21, US-22, US-73, US-74 y US-24. El resto de historias del archivo son de sprints posteriores. |
| [E06-pedidos-y-pago.md](E06-pedidos-y-pago.md) | Sprint 2: «Base común» de los pedidos y US-32, US-108, US-109, US-33, US-79, US-35, US-34 y US-80. US-39 y US-38 son de sprints posteriores. |
| [E07-E09-entrega-y-avisos.md](E07-E09-entrega-y-avisos.md) | Sprint 2: «Decisiones comunes» y US-40 y US-42. El resto de historias del archivo son de sprints posteriores. |

## Historias del Sprint 2

Siguiendo el criterio del Sprint 1 (las variantes de una historia son criterios de esa historia, no historias aparte), en GitHub y en Trello el Sprint 2 tiene 6 historias. Cada una incluye las secciones de la especificación que se indican: sus CA, e2e y tareas se aplican todos.

| Historia (GitHub y Trello) | Secciones que incluye | Archivo |
|---|---|---|
| US-21 · Buscar material | US-96 (catálogo), US-21 (palabras), US-22 (categoría y deporte), US-73 (estado y precio), US-74 (venta o donación) | E04 |
| US-24 · Ver un anuncio en detalle | US-24 | E04 |
| US-10 · Ver el perfil de otro centro | US-10 | E01-E02 |
| US-32 · Pedir material | US-32 (pedido), US-108 (detalle del pedido), US-35 (forma de pago), US-40 (recogida o envío) | E06 y E07-E09 |
| US-33 · Aceptar o rechazar un pedido | US-109 (bandeja de pedidos), US-33 (aceptar), US-79 (rechazar con motivo), US-34 (reserva de unidades) | E06 |
| US-42 · Cerrar un pedido: cobrado y recibido | US-80 (cobrado), US-42 (recibido) | E06 y E07-E09 |

Dentro de una historia, las tareas de las secciones incluidas se juntan por área (base de datos y backend, frontend, QA); la issue de cada tarea indica qué tareas originales cubre. Lo que una sección marque como dependiente de una historia de un sprint posterior (por ejemplo, la devolución de unidades al cancelar, de US-39, o la cita de entrega, de US-41) no se hace en este sprint.

Las demás épicas se añaden aquí cuando entran en un sprint. La misma información está en Trello (historias) y en GitHub (historias y tareas).

## Cómo se organiza el trabajo en GitHub

- **Historia** (`US-12 · …`): una issue con la especificación completa y sus criterios como checklist. Etiqueta `historia` e hito del sprint. **No está en el Kanban.**
- **Tarea** (`T12-2 · Backend: …`): una issue por cada parte del trabajo. Es *sub-issue* de su historia y **es lo único que hay en el Kanban**. Etiquetas `tarea` y `area: …`.
- **Ramas:**
  - `story/US-12-…` para la historia; sale de `dev`.
  - `feature/T12-2-…`, `test/T12-5-…`, etc. para cada tarea; salen de la rama de su historia.
  - El nombre exacto de cada rama está escrito en la issue de la tarea.
- **Pull requests:**
  - De la tarea a su historia: `T12-2: …` con `Closes #<issue de la tarea>`.
  - De la historia a `dev`, cuando está completa: `US-12: …` con `Closes #<issue de la historia>`.

## Orden dentro de cada historia

1. **Base de datos** (si la historia tiene esa tarea): la migración.
2. **Backend:** la API y sus tests, y en la misma PR el contrato `docs/api-contrato.md`.
3. **Frontend:** las pantallas. Se puede empezar en paralelo al backend usando el contrato y la especificación. La integración real se prueba cuando el backend ya está en la rama de la historia.
4. **QA:** automatizar los e2e y validar la historia completa en su rama `story/`.

La issue de cada tarea indica de qué tareas depende.

## Paso a paso de una tarea (para todos)

1. **Coger la tarea.** En el Kanban, asígnate la issue (*Assignees* → tú) y muévela a **En curso**. Lee la issue de la historia (CA y e2e) y la «Base común» de la épica.
2. **Preparar la rama de la historia** (solo si aún no existe en GitHub):
   ```bash
   git switch dev && git pull --ff-only
   git switch -c story/US-12-publicar-anuncio-material-sobra
   git push -u origin story/US-12-publicar-anuncio-material-sobra
   ```
3. **Crear la rama de la tarea** desde la historia actualizada (el nombre exacto está en la issue):
   ```bash
   git fetch origin
   git switch -c feature/T12-2-modulo-validacion-compartido-anuncios origin/story/US-12-publicar-anuncio-material-sobra
   ```
4. **Implementar** solo lo que dice la tarea, cumpliendo los CA de su parte. Si usas un agente de IA, dale la tarea así:
   > Implementa la tarea T12-2 de `docs/especificacion/E03-publicacion-de-material.md` (historia US-12 y «Base común»). Cumple exactamente los criterios CA que le corresponden, sigue `AGENTS.md` y el contrato `docs/api-contrato.md`, y añade los tests. No implementes nada que no esté especificado.
5. **Comprobar en local** antes de subir. En `backend/`: `npm run lint` y `npm test`. En `frontend/`: `npm run lint` y `npm run build`.
6. **Commit y push.** El mensaje empieza por el ID de la tarea:
   ```bash
   git add <archivos>
   git commit -m "T12-2: validación compartida y POST/GET de anuncios"
   git push -u origin feature/T12-2-modulo-validacion-compartido-anuncios
   ```
7. **Abrir la PR** hacia la rama de la historia:
   ```bash
   gh pr create --base story/US-12-publicar-anuncio-material-sobra --title "T12-2: validación compartida y POST/GET de anuncios" --body "Closes #<issue de la tarea>"
   ```
   - En la descripción, indica qué CA cumple y cómo se ha probado.
   - Mueve la tarea a **En revisión** y pide revisión a otra persona: backend ↔ backend, frontend ↔ frontend, y QA para las de QA.
8. **Revisión y fusión.**
   - Con 1 aprobación y el CI en verde, el autor fusiona con **Create a merge commit** (nunca *Squash* ni *Rebase*) y no borra la rama.
   - Si la PR sale *out of date*, pulsa **Update branch** antes.
   - La tarea se cierra sola y pasa a **Hecho**.
9. **Cerrar la historia** (quien termina la última tarea, normalmente QA):
   - Cuando todas las sub-issues están cerradas, QA prueba la historia completa en su rama `story/` contra todos los CA y e2e y marca la checklist de la issue de la historia.
   - Después se abre la PR `story/US-12-…` → `dev`, titulada `US-12: …` y con `Closes #<issue de la historia>`.

## Si algo no está claro

- **Falta un dato o un CA es ambiguo:** comenta en la issue de la historia, con una propuesta concreta. No se decide por cuenta propia.
- **Bloqueo por otra tarea:** márcalo en la issue de tu tarea («Bloqueada por #n») y sigue con otra.
- **La especificación cambia:** se cambia aquí, por PR, y se actualizan Trello y las issues.
