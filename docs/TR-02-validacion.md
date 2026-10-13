# TR-02: validación del entorno de desarrollo

Responsable: Carlos. Sprint: 0. Épica: E00.

## Criterios de aceptación

- [x] El servidor Node.js y la web React arrancan con un solo comando.
- [x] El README explica los pasos para arrancar el proyecto.
- [x] Hay un `.env.example` sin secretos y los secretos no están en el repositorio.
- [ ] Las seis personas del equipo han arrancado el proyecto en su ordenador.

Marcar los tres primeros tras revisar la implementación y su evidencia. El último requiere seis confirmaciones reales; no basta con una ejecución en el ordenador de Carlos.

## Prueba que realiza cada persona

1. Obtener la versión de la rama o el commit que se está validando y anotarla con `git rev-parse --short HEAD`. Antes de fusionar, Carlos debe compartir la rama de TR-02; después se utiliza `main`.
2. Seguir **Arranque y comprobaciones** del README: abrir Docker Desktop, copiar `.env.example` a `.env` y ejecutar `docker compose up --build --detach --wait` desde la raíz del repositorio.
3. Abrir `http://localhost:5173`: debe aparecer React en funcionamiento y la API conectada. Si se han cambiado los puertos, usar los valores de `.env`.
4. Abrir `http://localhost:3000/api/health`: debe devolver `{"status":"ok","service":"sportsplace-api"}`. Si se cambió `API_PORT`, utilizar ese puerto.
5. Ejecutar `docker compose ps`: los dos servicios deben estar `healthy`.
6. Ejecutar `docker compose exec backend npm test` y `docker compose exec frontend npm run build`: deben finalizar sin errores.
7. Confirmar en la issue TR-02 nombre, sistema operativo, fecha, rama/commit y resultado. Adjuntar evidencia sin claves ni contenido de `.env`. Si falla, aportar el mensaje de error y dejar el resultado pendiente.

## Confirmaciones individuales

| Persona | Sistema operativo | Fecha | Rama / commit | Resultado y evidencia |
|---|---|---|---|---|
| Carlos | Pendiente | Pendiente | Pendiente | Pendiente de confirmación |
| Asier | Pendiente | Pendiente | Pendiente | Pendiente de confirmación |
| Anass | Pendiente | Pendiente | Pendiente | Pendiente de confirmación |
| Alex | Pendiente | Pendiente | Pendiente | Pendiente de confirmación |
| Lucía | Pendiente | Pendiente | Pendiente | Pendiente de confirmación |
| Marta | Pendiente | Pendiente | Pendiente | Pendiente de confirmación |

## Evidencia técnica de la implementación

Prueba realizada el **8 de octubre de 2026** en Windows, en el ordenador de Carlos, sobre los cambios locales de `chore/TR-02-entorno-desarrollo`. Esta ejecución técnica no sustituye las confirmaciones personales de la tabla.

| Comprobación | Resultado |
|---|---|
| `docker compose config --quiet` | Configuración válida. |
| `docker compose up --build --detach --wait` desde el entorno inicial | Imágenes construidas, volúmenes de dependencias creados y ambos servicios `healthy`. |
| API directa y `/api/health` a través de la web | Respuesta correcta en ambos accesos. |
| `docker compose exec backend npm test` | Cuatro pruebas HTTP aprobadas. |
| `docker compose exec frontend npm run build` | Compilación correcta dentro del contenedor Linux. |
| Navegador: comprobación, API detenida y reintento después de arrancarla | Muestra conexión correcta, informa del error y recupera la conexión al reintentar. |
| Usuario del contenedor y variantes UID/GID 1001 y UID 1001 / GID existente 100 del Dockerfile del servidor | Usuario sin privilegios y carpetas de trabajo con permisos de escritura. |
| Exclusión de configuración local | `.env` ignorado por Git; contextos Docker excluyen `.env` y `.env.*`. |

Docker utilizado: Engine 29.5.2 y Compose 5.1.4. Las pruebas de otros sistemas y ordenadores se registrarán mediante las confirmaciones individuales.

## Cierre de la issue

La tarea pasa a **En revisión** cuando el entorno está preparado y se solicita revisión. Pasa a **Hecho** y puede cerrarse después de integrar los cambios en `main`, completar todos los criterios y registrar las seis confirmaciones.

Mientras falten validaciones individuales, la pull request referencia TR-02 sin usar `Closes #numero`. La configuración de GitHub Actions corresponde a Asier y se sigue por separado.
