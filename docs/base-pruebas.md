# T12-8 · Base de pruebas aislada

La base de QA es Supabase local en Docker (CLI 2.120.0, fijada en el lockfile de
`tools`). Incluye PostgreSQL 17, Auth, Storage y un buzón de correo local. Cada
checkout tiene un identificador de proyecto propio. No utiliza la cuenta ni las
credenciales del Supabase compartido y no envía correo externo.

## Arranque desde un clon limpio

Requisitos: Docker con contenedores Linux y Node.js 24. Puertos libres: 54321
(API Supabase), 54322 (PostgreSQL), 54324 (buzón local). Un entorno a la vez en
el mismo ordenador, aunque los identificadores de proyecto estén separados.

```bash
npm --prefix tools ci
npm --prefix tools run test-env:up
```

El comando descarga las imágenes la primera vez, copia exactamente las migraciones
del checkout y las aplica mediante `supabase db reset --local`. **Cada `up` borra
los datos del proyecto de pruebas de este checkout** y reconstruye la semilla.
Nunca ejecuta `link`, `--linked` ni acepta una URL externa. Antes de restablecer
verifica la etiqueta de propietario del contenedor. Las variables de Supabase,
PostgreSQL y migración heredadas se eliminan del entorno de la CLI.

PostgreSQL local recibe un certificado efímero firmado por una CA local. Los
clientes verifican certificado e identidad del servidor; no se cambia el TLS
del backend ni se utiliza `rejectUnauthorized: false`. La CA dura siete días;
repetir `up` la renueva. El canal de administración inicial es `docker exec`
dentro del contenedor propio, no una conexión de red sin verificar.

La configuración se escribe en `.e2e/runtime.env` (fuera de Git): `DATABASE_URL`,
`DATABASE_SSL_CA_FILE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` y las cuatro variables `E2E_*` de las cuentas.
Son credenciales sintéticas locales: no copiarlas a GitHub Secrets ni incluir
`.e2e/` en capturas, logs, commits o artefactos. T12-7 las carga para los e2e.

## Semilla y repetición

- Centro A: «Club Natació Exemple», email confirmado.
- Centro B: «Centre Esportiu Exemple», email confirmado.
- Centro sin confirmar: Auth y `centros` sin fecha de confirmación.
- Cuando existe la tabla canónica de T12-1: **21 anuncios no retirados de A**
  (paginación 20 + 1 de US-18), uno de B y otro retirado de A. IDs y fechas
  deterministas; sin fotos y con modalidad donación según US-12 CA30.

Las credenciales están en el archivo local generado. La semilla vuelve a establecer
las cuentas y anuncios conocidos, sin duplicarlos. Para un estado totalmente limpio
usar `up`; `seed` conserva registros adicionales creados por casos de prueba.

```bash
npm --prefix tools run test-env:seed
npm --prefix tools run test-env:seed -- --require-anuncios
npm --prefix tools run test-env:down
```

Mientras T12-1 no esté integrado, `up` prepara Auth/centros e informa expresamente
que los anuncios están pendientes. **`--require-anuncios` falla** si falta la tabla.
Si existe pero no coincide con el esquema, también falla: no crea ni modifica
columnas para simular la migración del equipo. QA debe usar el modo estricto para
US-12/US-18 cuando entre T12-1. Las pruebas iniciales de infraestructura de T12-7
pueden ejecutarse con Auth/centros; no acreditan los CA de anuncios.

`down` detiene y elimina los volúmenes **solo del proyecto local de este checkout**.
No tocar el entorno normal de Compose ni ejecutar `docker volume prune`.

## Migraciones nuevas al Supabase compartido

1. Anass y Alex revisan el SQL de la historia. No editar migraciones ya aplicadas.
2. La historia completa entra en `dev` por PR con QA, aprobación ajena y CI verde.
3. Una persona coordina la aplicación y registra responsable, commit de `dev`,
   proyecto de destino y versiones de migraciones, sin credenciales.
4. Con `dev` actualizada y el `.env`/CA del compartido preparados según el README,
   revisar pendientes sin ejecutar SQL: `docker compose run --rm --build dbtools --dry-run`.
5. Tras confirmar con los responsables el destino y las migraciones revisadas,
   aplicar: `docker compose run --rm --build dbtools`.
6. Ejecutar `docker compose exec backend npm run db:check` y comprobar el esquema
   afectado y el flujo real de la historia. Registrar resultado en su issue/PR.
7. Si falla, detener la integración y coordinar una migración correctiva; no
   ejecutar semillas e2e, `db reset`, ni borrar datos en el compartido.

El CI prepara exclusivamente su base local. Nunca migra el Supabase compartido.
