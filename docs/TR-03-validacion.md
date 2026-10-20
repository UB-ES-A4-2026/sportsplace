# TR-03: validación de la base de datos Supabase

Responsables: Anass y Alex. Sprint: 0. Épica: E00. Prioridad: Must.

## Criterios de aceptación y estado

| Criterio | Estado | Evidencia que falta para cerrarlo |
|---|---|---|
| El proyecto de Supabase está creado y compartido con el equipo. | Proyecto correcto y conexión real verificados; creación e invitaciones comunicadas anteriormente por Carlos. | Confirmar individualmente el acceso de las seis personas; la conexión del servidor no lo demuestra. |
| La tabla de centros tiene email único, datos básicos, aceptación de privacidad y estado de confirmación del email. | Esquema revisado por backend; ambas migraciones aplicadas según Anass en #8 y comprobadas en solo lectura el 20/10. | Conservar el seguimiento del equipo; no volver a aplicar ni modificar las migraciones ya registradas. |
| La primera migración está en el repositorio. | Integrada mediante #11 en `main` y heredada por `dev`; la segunda llega a la historia mediante #28. | La segunda migración acompaña a US-01 hacia `dev` cuando la historia esté completa y validada por QA. |
| El servidor se conecta a la base de datos. | `db:check` correcto contra el proyecto compartido el 20/10, con TLS verificado y tabla encontrada. | Evidencia actual registrada abajo; no equivale a QA de las historias. |

No se declara TR-03 terminado: falta acreditar el acceso de las seis personas y completar las condiciones de integración de la historia. Ya no están pendientes la primera publicación, la aplicación remota ni la existencia de la tabla. Fuentes: [revisión de Anass en #28](https://github.com/UB-ES-A4-2026/sportsplace/pull/28#issuecomment-6252864966) y [validación real en #8](https://github.com/UB-ES-A4-2026/sportsplace/issues/8#issuecomment-6175158124).

## Esquema revisado y aplicado

La migración inicial es `supabase/migrations/20261008090000_crear_centros.sql`. Los datos básicos son **nombre, email y localidad obligatorios**, con **dirección, código postal y teléfono opcionales**.

- El email es único ignorando mayúsculas y espacios al principio o al final.
- La aceptación de la política de privacidad debe ser explícita y tener una fecha; no se acepta automáticamente al insertar un centro.
- `email_confirmado_en` empieza vacío. `email_confirmado` se calcula desde esa fecha y no se escribe directamente.
- La tabla tiene RLS activado. Los roles `anon` y `authenticated` no pueden leer ni modificar centros; el acceso acordado pasa por la conexión privada del backend, no por un cliente web de Supabase.
- No hay contraseñas en `centros`. La segunda migración añade `usuario_id`, único y relacionado con `auth.users` mediante `ON DELETE CASCADE`. Express 5 y Supabase Auth están acordados por backend en [#12](https://github.com/UB-ES-A4-2026/sportsplace/pull/12#issuecomment-6157083082).

Esta representación de la confirmación no implementa US-02 por sí sola. Supabase Auth envía el email y #17 incorpora su comprobación; esa historia sigue pendiente de integración y QA, no de elegir el mecanismo de autenticación.

## Evidencia técnica local

Comprobaciones históricas realizadas el **8 de octubre de 2026** en Windows sobre los cambios locales de `chore/TR-03-base-datos-supabase`. Para la base se utilizó PostgreSQL **17** en un contenedor temporal, con TLS y un certificado CA de pruebas cuya verificación estaba activada. En esa ejecución no se aplicó ninguna migración al Supabase compartido; su aplicación posterior está acreditada en #8.

| Comprobación | Resultado |
|---|---|
| Aplicación del SQL mediante `psql` con interrupción ante errores | Tabla e índice creados correctamente. |
| `supabase/tests/centros.sql` | Inserción válida, email duplicado, consentimiento, campos vacíos, confirmación derivada y denegación de permisos comprobados; `ROLLBACK` correcto y cero centros persistidos. |
| Pruebas del backend | 19 pruebas aprobadas, incluidas configuración y errores de PostgreSQL/TLS, comprobación del esquema y API HTTP. |
| Pruebas de la herramienta de migración | Seis pruebas aprobadas, incluidas configuración y ocultación de credenciales en la salida. |
| Supabase CLI 2.120.0: `--dry-run` contra otra base temporal sin migraciones | Detectada la primera migración pendiente. |
| Aplicación mediante la CLI contra esa base de pruebas | Migración `20261008090000` aplicada y registrada; cero centros creados. |
| Segundo `--dry-run` | Base al día, sin migraciones pendientes. |
| Pruebas SQL sobre la base migrada por la CLI | Ejecución y `ROLLBACK` correctos. |
| `db:check` desde el backend contra la base migrada por la CLI | Conexión TLS verificada y `public.centros` encontrada. |

Estas pruebas utilizan credenciales y un CA propios del entorno temporal. La integración continua de GitHub Actions se sigue por separado con Asier.

## Comprobación real de Supabase

El **8 de octubre de 2026**, tras configurar el certificado descargado de Supabase y recrear el backend con el `.env` local, `docker compose exec backend npm run db:check` comprobó la conexión TLS con el proyecto compartido y devolvió:

```text
Conexión PostgreSQL: correcta.
Tabla public.centros: no encontrada; migración pendiente.
```

Este resultado del 8/10 es histórico: entonces la conexión funcionaba y faltaba la tabla. No describe el estado remoto actual.

### Estado remoto comprobado el 20/10/2026

Ejecución técnica del agente en el ordenador de Carlos sobre `story/US-01-registro` @ `e755687`, proyecto `tmzxoosguozwrndqnkwn`:

- `docker compose exec backend npm run db:check`: conexión correcta y `public.centros` encontrada, con la verificación TLS conservada.
- Consulta en transacción de **solo lectura** a `supabase_migrations.schema_migrations`: `20261008090000` y `20261009120000` registradas.
- Columnas `usuario_id`, `email` y estado/fecha de confirmación presentes.
- RLS activado; `anon` y `authenticated` sin permiso de lectura sobre `centros`.
- No se aplicaron migraciones, no se editaron las existentes y no se eliminaron datos.

Anass acredita el registro, la recepción del correo y la confirmación del 14/10 en #8. Alex acredita las pruebas de sesión reales del 20/10 en [#4](https://github.com/UB-ES-A4-2026/sportsplace/issues/4#issuecomment-6291838966). Son pruebas de backend en ramas que incluyen otras historias, no una validación del recorrido web integrado ni una comprobación actual de la plantilla o del SMTP desde este agente.

## Validación en el proyecto compartido

1. Carlos confirma el proyecto que se utilizará y que las seis personas han aceptado la invitación y pueden abrirlo.
2. Para cambios nuevos, Anass y Alex revisan los campos y la migración. Los acuerdos de backend y las migraciones iniciales ya constan en las fuentes anteriores; no repetir sus cambios en el panel.
3. Configurar el `.env` local con la URI privada de **Connect → Session pooler**. Descargar el CA desde **Database Settings → SSL Configuration → Download certificate**, guardarlo en `backend/.certs/supabase-ca.crt` y definir `DATABASE_SSL_CA_FILE=/app/.certs/supabase-ca.crt`.

   Si se conserva otro nombre para el certificado descargado, ajustar la variable para que coincida con el archivo dentro de `/app/.certs/`. En el ordenador de Carlos esta configuración y la conexión ya se han comprobado; los demás miembros deben utilizar su configuración local.

4. Si la conexión del servidor no tiene permisos para migrar, configurar `MIGRATION_DATABASE_URL` con una conexión administrativa. Si está vacía, la herramienta utiliza `DATABASE_URL`. No publicar ninguna de estas credenciales.
5. Recrear los servicios desde la raíz para aplicar la configuración:

```bash
docker compose up --build --detach --force-recreate --wait
```

6. Una persona responsable revisa primero las migraciones pendientes:

```bash
docker compose run --rm --build dbtools --dry-run
```

7. Solo si hay migraciones nuevas pendientes, revisadas por backend, y con el proyecto de destino comprobado, aplicarlas de forma coordinada. Las dos migraciones iniciales ya están registradas:

```bash
docker compose run --rm --build dbtools
```

8. Comprobar en Supabase la tabla `public.centros`, sus columnas e índice de email; comprobar la conexión desde el servidor:

```bash
docker compose exec backend npm run db:check
```

Debe terminar sin errores y mostrar:

```text
Conexión PostgreSQL: correcta.
Tabla public.centros: encontrada.
```

9. Registrar fecha, responsable, rama/commit, proyecto de destino y resultado en la issue. Añadir evidencia de la tabla y de la comprobación sin contraseñas, URI privadas ni contenido de `.env`.

## Registro de validación remota

| Comprobación | Responsable | Fecha | Resultado |
|---|---|---|---|
| Acceso de las seis personas al proyecto | Carlos | Pendiente | Pendiente de verificar |
| Revisión del esquema | Backend | 18/10/2026 | Anass deja revisión de código y migración en #28; revisión previa de Alex como autor. |
| Migraciones aplicadas al Supabase compartido | Alex, según evidencia de Anass | Acreditado el 14/10/2026 | Ambas versiones registradas; verificadas en solo lectura por el agente el 20/10. |
| `db:check` contra el Supabase compartido | Agente en el ordenador de Carlos | 20/10/2026 | Conexión TLS correcta y tabla encontrada. |
| Migraciones integradas | Equipo | Comprobado el 20/10/2026 | Primera en `main`/`dev`; segunda en `story/US-01-registro` mediante #28, pendiente de la integración completa de US-01. |

## Cierre de la issue

La tarea pasa a **En revisión** cuando la migración y la conexión están preparadas para revisar. Se cierra después de integrar los cambios en `main` y reunir la evidencia de los cuatro criterios en el proyecto compartido.

Mientras falte aplicar o comprobar la base remota, referenciar TR-03 en la PR sin `Closes #numero`. El endpoint `/api/health` solo acredita la salud de la API; no prueba la conexión con PostgreSQL ni completa las historias de registro y acceso.
