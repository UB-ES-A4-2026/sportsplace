# TR-03: validación de la base de datos Supabase

Responsables: Anass y Alex. Sprint: 0. Épica: E00. Prioridad: Must.

## Criterios de aceptación y estado

| Criterio | Estado | Evidencia que falta para cerrarlo |
|---|---|---|
| El proyecto de Supabase está creado y compartido con el equipo. | Creación e invitaciones comunicadas por Carlos. | Confirmar que las seis personas pueden acceder al proyecto compartido. |
| La tabla de centros tiene email único, datos básicos, aceptación de privacidad y estado de confirmación del email. | Esquema propuesto y probado localmente. | Anass y Alex revisan los campos; aplicar la migración al proyecto compartido y comprobar su tabla. |
| La primera migración está en el repositorio. | Archivo preparado en la rama local `chore/TR-03-base-datos-supabase`. | Guardar los cambios en Git, publicar la rama, revisar la PR e integrarla en `main`. |
| El servidor se conecta a la base de datos. | Conexión PostgreSQL y TLS comprobados contra el Supabase compartido. | Conservar la evidencia y repetir `db:check` después de aplicar la migración para comprobar también la tabla. |

TR-03 todavía no está terminado. La conexión al Supabase compartido ya está comprobada. La migración queda preparada para la revisión de Anass y Alex y no se aplicará al proyecto compartido hasta que confirmen la propuesta de esquema. Los cambios siguen locales, sin commit ni publicación.

## Propuesta de esquema para revisar

La migración es `supabase/migrations/20261008090000_crear_centros.sql`. Los datos básicos propuestos son **nombre, email y localidad obligatorios**, con **dirección, código postal y teléfono opcionales**.

- El email es único ignorando mayúsculas y espacios al principio o al final.
- La aceptación de la política de privacidad debe ser explícita y tener una fecha; no se acepta automáticamente al insertar un centro.
- `email_confirmado_en` empieza vacío. `email_confirmado` se calcula desde esa fecha y no se escribe directamente.
- La tabla tiene RLS activado. Los roles `anon` y `authenticated` no pueden leer ni modificar centros hasta acordar la autenticación y los permisos.
- No hay contraseñas ni relación con `auth.users`. La decisión sobre Supabase Auth sigue pendiente de Anass y Alex.

Esta representación de la confirmación no implementa US-02. El envío de emails, los enlaces o tokens y su comprobación requieren el diseño de autenticación y el desarrollo de esa historia.

## Evidencia técnica local

Comprobaciones realizadas el **8 de octubre de 2026** en Windows sobre los cambios locales de `chore/TR-03-base-datos-supabase`. Para la base se utilizó PostgreSQL **17** en un contenedor temporal, con TLS y un certificado CA de pruebas cuya verificación estaba activada. No se ha aplicado ninguna migración al Supabase compartido.

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

La conexión del servidor ya funciona. El comando termina con error mientras falte la tabla, aunque su primera comprobación haya sido correcta. No se ha aplicado la migración al proyecto remoto.

## Validación en el proyecto compartido

1. Carlos confirma el proyecto que se utilizará y que las seis personas han aceptado la invitación y pueden abrirlo.
2. Anass y Alex revisan la propuesta de campos y la migración. Registrar en la issue el acuerdo sobre el esquema. La elección de autenticación debe quedar anotada cuando se tome.
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

7. Con el esquema revisado y el proyecto de destino comprobado, aplicar la primera migración:

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
| Revisión del esquema propuesto | Anass y Alex | Pendiente | Pendiente |
| Migración aplicada al Supabase compartido | Pendiente de asignar | Pendiente | Pendiente |
| `db:check` contra el Supabase compartido | Ejecución técnica en el ordenador de Carlos | 8 de octubre de 2026 | Conexión TLS correcta; tabla pendiente de migración |
| Migración revisada e integrada en `main` | Equipo | Pendiente | Pendiente |

## Cierre de la issue

La tarea pasa a **En revisión** cuando la migración y la conexión están preparadas para revisar. Se cierra después de integrar los cambios en `main` y reunir la evidencia de los cuatro criterios en el proyecto compartido.

Mientras falte aplicar o comprobar la base remota, referenciar TR-03 en la PR sin `Closes #numero`. El endpoint `/api/health` solo acredita la salud de la API; no prueba la conexión con PostgreSQL ni completa las historias de registro y acceso.
