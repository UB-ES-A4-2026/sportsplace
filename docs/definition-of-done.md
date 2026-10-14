# Definition of Done

Propuesta de ampliación para revisar por el equipo, preparada el 13/10/2026. Se aplica junto a los criterios específicos de cada issue. No supone que las tareas actuales ya estén terminadas.

## Cierre de una tarea

Una tarea pasa a **Hecho** cuando se cumplen todos estos puntos aplicables:

- [ ] Se cumplen sus criterios de aceptación y sus dependencias están resueltas.
- [ ] El resultado está explicado y se puede comprobar con la evidencia enlazada en la issue o la PR.
- [ ] Los cambios de la historia están integrados en `dev` mediante PR, con aprobación de otra persona sobre la versión actual, conversaciones resueltas y validación de QA. La entrega se publica después mediante PR `dev` → `main`.
- [ ] Las comprobaciones de CI exigidas pasan en la versión que se integra. Durante la incorporación de TR-04, cualquier comprobación aún pendiente se registra como pendiente.
- [ ] Se han realizado las pruebas relevantes del cambio. Se distinguen pruebas unitarias, build, comprobación de conexión y pruebas del flujo real.
- [ ] README, configuración de ejemplo y contrato de API reflejan los cambios cuando corresponde.
- [ ] No se han publicado credenciales ni archivos locales; las dependencias incluyen su lockfile.
- [ ] Excel, Trello y GitHub mantienen el mismo identificador, alcance, puntos y criterios, según el acuerdo del equipo.

Las PR parciales de frontend, backend, pruebas y TR se integran en la rama `story/` correspondiente. Su revisión no completa una historia que requiere todas las partes: la issue de la historia permanece abierta hasta validar el conjunto e integrarlo en `dev`. Los TR iniciales son tareas de US-01. Las tareas sin cambios de código se verifican mediante sus propios criterios y evidencias.

## Comprobaciones específicas de infraestructura

| Tarea | Evidencia necesaria para cerrarla |
|---|---|
| TR-01 | Repositorio y acceso de las seis personas, reglas de ramas documentadas, Kanban con cinco estados y `main`/`dev` con PR, aprobación ajena y CI obligatoria. |
| TR-02 | Arranque conjunto de web y servidor con Compose, README reproducible, `.env.example` sin secretos y confirmación individual de arranque de las seis personas. |
| TR-03 | Proyecto compartido accesible, esquema revisado por Anass y Alex, migraciones integradas y aplicadas al proyecto correcto, tabla presente y conexión real verificada desde el servidor. |
| TR-04 | Workflow integrado, lint/pruebas/build en verde, ejecución en PR y push a `main`/`dev`, y sus tres jobs obligatorios en ambas ramas. |
| TR-05 y TR-06 | Estructuras y contrato acordados entre frontend y backend, cambios integrados y comprobaciones de sus criterios propias de las issues. |
| TR-07 | Seguimiento coherente, planificación del sprint rellenada en la plantilla requerida y evidencias de cierre enlazadas. |

Los jobs de TR-04 son `Backend (lint y tests)`, `Frontend (lint y build)` y `Herramientas de migración (lint y tests)`. El CI actual no aplica migraciones ni prueba por sí solo los correos y las sesiones reales de Supabase.

## Registro, confirmación y sesión

Para dar por completadas US-01, US-02, US-03 y US-67, QA registra las pruebas del contrato y de los criterios acordados, incluyendo:

- Alta con datos válidos, email repetido y aceptación obligatoria de privacidad.
- Recepción del correo, enlace válido, enlace reutilizado o inválido y estado confirmado.
- Acceso válido y mensaje genérico para credenciales incorrectas; bloqueo correspondiente a un email sin confirmar.
- Protección de rutas con sesión válida, ausente o no válida; validación de la sesión con la API.
- Cierre de sesión, borrado de tokens en la web y comportamiento real del refresh token y del access token. Si difiere del contrato, resolver la diferencia antes del cierre.
- Respuesta ante errores de conexión y fallos de registro. Revisar el caso en que se crea la cuenta en Auth pero falla el guardado posterior en PostgreSQL.

Los tests con dobles apoyan esta validación, pero no prueban el envío real de correo, la configuración compartida ni la coherencia entre Auth y `centros`.

## Registro mínimo de evidencia

| Fecha | Persona | Rama o commit | Comprobación | Resultado | Enlace sin secretos |
|---|---|---|---|---|---|
| Por rellenar | Por rellenar | Por rellenar | Por rellenar | Pendiente | Por rellenar |

No adjuntar tokens, contraseñas ni cadenas de conexión. Un bloqueo de revisión o un criterio sin comprobar mantiene la tarea en **En revisión** o **En curso**, según el trabajo pendiente.

La petición de una DoD ampliada procede del mensaje de Asier. Falta contrastarla con los PDFs de agentes y la rúbrica original para confirmar el formato y cualquier requisito adicional.
