# Especificación y forma de trabajar

Esta carpeta es la especificación funcional y técnica del proyecto. Se implementa exactamente lo que dice; lo que no esté aquí no se hace. Si falta algo o algo no cuadra, se comenta en la issue de la historia antes de programarlo.

| Archivo | Contenido |
|---|---|
| [00-guia-comun.md](00-guia-comun.md) | Normas de redacción, convenciones de API e interfaz y diccionario de datos. |
| [E01-E02-registro-y-perfil.md](E01-E02-registro-y-perfil.md) | Sprint 1: US-04 (recuperar contraseña), US-07 (perfil del centro) y US-68 (ubicación). El resto de historias del archivo son de sprints posteriores. |
| [E03-publicacion-de-material.md](E03-publicacion-de-material.md) | Sprint 1: «Base común» de los anuncios y las historias US-12 a US-18 y US-70, con sus criterios (CA), flujos e2e y tareas. |

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
   - Con 1 aprobación y el CI en verde, el autor fusiona con **Squash and merge**.
   - Si la PR sale *out of date*, pulsa **Update branch** antes.
   - La tarea se cierra sola y pasa a **Hecho**.
9. **Cerrar la historia** (quien termina la última tarea, normalmente QA):
   - Cuando todas las sub-issues están cerradas, QA prueba la historia completa en su rama `story/` contra todos los CA y e2e y marca la checklist de la issue de la historia.
   - Después se abre la PR `story/US-12-…` → `dev`, titulada `US-12: …` y con `Closes #<issue de la historia>`.

## Si algo no está claro

- **Falta un dato o un CA es ambiguo:** comenta en la issue de la historia, con una propuesta concreta. No se decide por cuenta propia.
- **Bloqueo por otra tarea:** márcalo en la issue de tu tarea («Bloqueada por #n») y sigue con otra.
- **La especificación cambia:** se cambia aquí, por PR, y se actualizan Trello y las issues.
