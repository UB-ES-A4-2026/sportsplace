# Trabajo con agentes en Sportsplace

Propuesta para revisar por el equipo antes de incorporarla al repositorio. Complementa el README; no sustituye los criterios de las issues ni acredita el cumplimiento de una rúbrica de agentes aún pendiente de localizar.

## Antes de cambiar código

- Leer `README.md`, la issue de la tarea y, para autenticación o interfaz, `docs/api-contrato.md`.
- Comprobar la rama y los cambios locales. Conservar el trabajo de otras personas y no incluirlo por accidente en la propia PR.
- Mantener `main` para las entregas y `dev` para la integración. Crear una rama `story/US-xx-descripcion` desde `dev` por historia, y las ramas de trabajo desde esa historia. No subir cambios directamente a `main`, `dev` ni programar directamente en `story/`.
- Las ramas `feature/`, `test/`, `chore/` y `docs/` de una historia vuelven a su `story/` mediante PR. Los TR iniciales forman parte de US-01; el trabajo técnico ya incluido en `dev` se hereda al crear su rama. Una TR independiente solo sale de `dev` si el Product Owner la define como tal.
- Si una PR depende de otra, dejar explícita esa dependencia y comprobar su base antes de integrarla. No borrar una rama que siga siendo base de otra PR.

## Arquitectura y responsabilidades

- `frontend/`: React con Vite. La web utiliza `/api/...`; el backend centraliza el acceso a Supabase y las reglas de negocio.
- `backend/`: Node.js 24. Las PR de backend incorporan Express 5 y Supabase Auth; estas decisiones requieren el acuerdo pendiente de Anass y Alex.
- `tools/`: herramientas y pruebas de migración. `supabase/migrations/`: cambios SQL versionados.
- Carlos mantiene el entorno y la configuración; Asier coordina QA; Anass y Alex revisan API y datos; Lucía y Marta revisan interfaz e integración.
- Actualizar el contrato en la misma PR si cambian rutas, campos, respuestas o códigos de error. Coordinar el cambio con el área que lo consume.

## Configuración y datos

- Guardar credenciales en el `.env` local. Mantener `.env.example` sin secretos; no subir `.env`, certificados locales, `node_modules` ni `dist`.
- Las variables `VITE_*` llegan al navegador. No incluir en ellas contraseñas de PostgreSQL ni claves privilegiadas de Supabase.
- Conservar la verificación TLS de PostgreSQL. Resolver problemas de URI o certificado sin desactivar esa verificación.
- No aplicar las migraciones propuestas al Supabase compartido hasta la revisión del esquema por Anass y Alex. Una persona coordina la ejecución y registra el resultado.
- Tras aplicar una migración, añadir los siguientes cambios en otro archivo SQL. No reescribir una migración ya aplicada.
- No usar el proyecto compartido para pruebas destructivas. Las pruebas unitarias utilizan dobles; las pruebas del esquema se ejecutan en una base de pruebas preparada para ello.

## Comprobaciones

Desde la raíz, validar Compose sin mostrar las variables y arrancar los servicios:

```bash
docker compose config --quiet
docker compose up --build --detach --wait
```

Con Node.js 24, ejecutar en cada carpeta los comandos de su `package.json`. La PR #19 incorpora el lint en las tres áreas:

| Carpeta | Comprobaciones de CI tras incorporar TR-04 |
|---|---|
| `backend/` | `npm ci`, `npm run lint`, `npm test` |
| `frontend/` | `npm ci`, `npm run lint`, `npm run build` |
| `tools/` | `npm ci`, `npm run lint`, `npm test` |

Si la rama aún no contiene TR-04, comprobar qué scripts existen y dejar registrada la comprobación pendiente; no afirmar que el lint ha pasado. No hay un `package.json` de raíz ni un comando único `npm test` para todo el repositorio.

La conexión real se verifica con `docker compose exec backend npm run db:check`, después de configurar el `.env` y el certificado locales. `/api/health` y el build del frontend no demuestran que Supabase o el flujo de autenticación funcionen.

## Entrega y revisión

- Mantener el cambio acotado a la tarea. Añadir o adaptar pruebas cuando verifiquen un comportamiento relevante.
- Revisar el diff antes del commit, incluyendo los archivos preparados para subir.
- Explicar en la PR el resultado, las comprobaciones ejecutadas y cualquier criterio pendiente. Un resultado de pruebas local no equivale a un CI verde en el último commit.
- Solicitar una aprobación de otra persona. Tras modificar una versión aprobada, pedir revisión de la nueva versión.
- Integrar las ramas de trabajo en su `story/` mediante **Squash and merge**. La historia completa entra en `dev` por PR, con **Squash and merge**, criterios cumplidos y validación de QA. Publicar `dev` en `main` mediante **Create a merge commit**, según el acuerdo del equipo. No eludir la protección de `main` ni de `dev`.
- Conservar `main` y `dev`. Eliminar únicamente ramas temporales después de su fusión, cuando ninguna otra PR las utilice como base.
- Usar `Refs #n` para una contribución parcial. Usar `Closes #n` cuando se complete la issue entera según `docs/definition-of-done.md`.
- Actualizar documentación y seguimiento sin marcar como realizado algo preparado, simulado o aún pendiente de otra persona.
