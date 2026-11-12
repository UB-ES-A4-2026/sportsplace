# Contrato de la API: TR-06

Responsables: Anass y Alex (backend), revisado con Lucía y Marta (frontend). Sprint 0.

Este documento es el acuerdo entre backend y frontend para las historias del Sprint 0: US-01, US-02, US-03 y US-67. Si un endpoint cambia, se actualiza aquí en la misma pull request.

T04-1 añade la configuración del correo de recuperación de US-04. T04-2 añade sus endpoints (`POST /api/auth/recuperar-contrasena` y `/restablecer-contrasena`) y T04-3 sus pantallas; la plantilla por sí sola no completa el flujo.

## Decisiones

| Decisión | Elegido | Motivo |
|---|---|---|
| Framework del servidor | Express 5 | Ligero, conocido por el equipo y compatible con la base de TR-02 sin reescribirla. |
| Autenticación | Supabase Auth | Guarda las contraseñas con hash y sal (NFR-03), envía el email de confirmación (US-02) y emite los tokens. No hace falta un servicio de email propio en el Sprint 0. |
| Sesión | Token `Bearer` de Supabase | El servidor no guarda estado de sesión; cada petición privada se comprueba contra Supabase. |

El frontend **solo habla con nuestra API** (`/api/...`). No llama a Supabase Auth directamente, para que las reglas y los mensajes de error estén en un único sitio.

## Convenciones

- Todas las rutas empiezan por `/api`. En desarrollo, Vite redirige `/api` al servidor.
- Peticiones y respuestas en JSON (`Content-Type: application/json`). Excepción: `POST /api/anuncios` recibe `multipart/form-data` (US-13); su respuesta sigue siendo JSON.
- Las rutas privadas necesitan la cabecera `Authorization: Bearer <access_token>`.
- Los campos se escriben en `snake_case` y en castellano, igual que en la base de datos.
- Todas las respuestas llevan `Cache-Control: no-store`.

### Formato común de errores

Cualquier error de la API tiene esta forma:

```json
{
  "error": {
    "code": "CREDENCIALES_INCORRECTAS",
    "message": "Email o contraseña incorrectos.",
    "details": { "email": "El email es obligatorio." }
  }
}
```

- `code`: identificador estable en mayúsculas. El frontend decide qué hacer según el `code`, nunca según el texto.
- `message`: texto en castellano que se puede mostrar al usuario.
- `details`: opcional. En errores de validación, un objeto `campo → mensaje`.

| Estado | `code` | Cuándo |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Faltan campos o tienen un formato incorrecto. |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido. |
| 400 | `ENLACE_INVALIDO` | El enlace de confirmación o de recuperación de la contraseña (US-04) no existe, ya se ha usado o ha caducado. |
| 400 | `CODIGO_POSTAL_DESCONOCIDO` | El código postal tiene un formato válido pero no está en `codigos_postales` (US-68). |
| 401 | `NO_AUTENTICADO` | Falta el token, ha caducado o la sesión se ha cerrado. |
| 401 | `CREDENCIALES_INCORRECTAS` | Email o contraseña incorrectos (no se dice cuál). |
| 403 | `EMAIL_NO_CONFIRMADO` | La cuenta todavía no ha confirmado su email. |
| 404 | `NO_ENCONTRADO` | La ruta o el recurso no existe. |
| 405 | `METODO_NO_PERMITIDO` | Método HTTP no admitido en esa ruta. |
| 409 | `EMAIL_YA_REGISTRADO` | Ya existe una cuenta con ese email. |
| 409 | `ANUNCIO_NO_EDITABLE` | El anuncio está entregado y ya no se puede modificar (US-15). |
| 409 | `TRANSICION_NO_PERMITIDA` | El estado actual del anuncio no permite esa acción; `details.estado_actual` dice cuál es (E03, US-16). |
| 413 | `PETICION_DEMASIADO_GRANDE` | El cuerpo JSON supera 100 kB, o la petición multipart de `POST /api/anuncios` o `PATCH /api/anuncios/:id` supera 40 MB (41.943.040 bytes). |
| 429 | `DEMASIADOS_INTENTOS` | Supabase limita los intentos. |
| 500 | `ERROR_INTERNO` | Error inesperado del servidor. |
| 503 | `BASE_DATOS_NO_DISPONIBLE` | PostgreSQL no responde o no está configurado. |
| 503 | `AUTH_NO_DISPONIBLE` | Supabase Auth no responde o no está configurado. |
| 503 | `ALMACENAMIENTO_NO_DISPONIBLE` | Supabase Storage no responde o falta `SUPABASE_SERVICE_ROLE_KEY` (fotos de los anuncios, US-13). |

### Objetos comunes

`usuario`:

```json
{ "id": "uuid", "email": "centro@example.com", "email_confirmado": true }
```

`sesion`:

```json
{ "access_token": "jwt", "refresh_token": "token", "expires_at": 1760000000 }
```

`expires_at` está en segundos Unix. El `access_token` dura una hora; antes de que caduque, el frontend usa `POST /api/auth/refresh`.

`anuncio` (E03, «Objeto `anuncio`» de `docs/especificacion/E03-publicacion-de-material.md`):

```json
{
  "id": "uuid",
  "centro_id": "uuid",
  "titulo": "Balones de fútbol talla 5",
  "descripcion": "Doce balones Mikasa usados una temporada, sin pinchazos.",
  "categoria": "balones",
  "deporte": "futbol",
  "unidades_disponibles": 12,
  "estado_material": "buen_estado",
  "modalidad": "venta",
  "precio_unitario_centimos": 850,
  "estado": "activo",
  "fotos": [
    { "id": "uuid", "url": "https://<proyecto>.supabase.co/storage/v1/object/public/anuncios/<centro_id>/<anuncio_id>/<foto_id>.jpg", "orden": 1, "es_principal": true }
  ],
  "publicado_en": "2026-11-03T10:15:00.000Z",
  "creado_en": "2026-11-03T10:15:00.000Z",
  "actualizado_en": "2026-11-03T10:15:00.000Z"
}
```

Fechas ISO 8601 en UTC. `fotos` va ordenado por `orden` (1..n) y exactamente una tiene `es_principal: true`; `url` es la URL pública del bucket `anuncios`, que responde sin sesión (US-13). `modalidad` es `venta` o `donacion` (US-14); `precio_unitario_centimos` es el precio por unidad en céntimos enteros (850 = 8,50 €) y es `null` en una donación.

## Endpoints

| Método y ruta | Historia | Privada | Responsable backend |
|---|---|---|---|
| `GET /api/health` | TR-02 | No | Carlos |
| `POST /api/auth/registro` | US-01 | No | Anass |
| `POST /api/auth/confirmar` | US-02 | No | Anass y Alex |
| `POST /api/auth/reenviar-confirmacion` | US-66 | No | Anass |
| `POST /api/auth/recuperar-contrasena` | US-04 | No | Anass |
| `POST /api/auth/restablecer-contrasena` | US-04 | No | Anass |
| `POST /api/auth/login` | US-03 | No | Alex |
| `POST /api/auth/refresh` | US-03 | No | Alex |
| `GET /api/auth/me` | US-03, US-67 | Sí | Alex |
| `POST /api/auth/logout` | US-67 | Sí | Alex |
| `POST /api/anuncios` | US-12, US-13, US-14 | Sí (email confirmado) | Anass |
| `GET /api/anuncios/mios` | US-18 | Sí (email confirmado) | Alex |
| `GET /api/anuncios/:id` | US-12 | Sí (email confirmado) | Anass |
| `PATCH /api/anuncios/:id` | US-15, US-14 | Sí (email confirmado) | Alex |
| `GET /api/centros/mio` | US-07 | Sí | Alex |
| `PATCH /api/centros/mio` | US-07 | Sí, con email confirmado | Alex |
| `PUT /api/centros/mio/ubicacion` | US-68 | Sí, con email confirmado | Alex |
| `GET /api/centros/:id` | US-10 | Sí (email confirmado) | Alex |
| `GET /api/centros/:id/anuncios` | US-10 | Sí (email confirmado) | Alex |
| `POST /api/anuncios/:id/pausar` | US-16 | Sí (email confirmado) | Anass |
| `POST /api/anuncios/:id/reactivar` | US-16 | Sí (email confirmado) | Anass |
| `DELETE /api/anuncios/:id` | US-70 | Sí (email confirmado) | Anass |
| `POST /api/anuncios/:id/reservar` | US-17 | Sí (email confirmado) | Anass |
| `POST /api/anuncios/:id/quitar-reserva` | US-17 | Sí (email confirmado) | Anass |
| `POST /api/anuncios/:id/entregar` | US-17 | Sí (email confirmado) | Anass |

### `GET /api/health`

`200 { "status": "ok", "service": "sportsplace-api" }`

En Render añade el campo opcional `commit` con el SHA completo de 40 caracteres
hexadecimales de `RENDER_GIT_COMMIT`, normalizado a minúsculas. Sin esa variable o
con un valor inválido se omite el campo. `/health` es un alias de la misma sonda;
ambas respuestas conservan `Cache-Control: no-store`. El smoke de T12-6 compara
`commit` con el SHA de `dev` esperado antes de comprobar la web publicada. Esta
sonda no acredita Auth ni la conexión PostgreSQL.

### `POST /api/auth/registro` (US-01)

```json
{
  "nombre": "Club Natació Exemple",
  "email": "centro@example.com",
  "password": "********",
  "localidad": "Barcelona",
  "direccion": "Opcional",
  "codigo_postal": "Opcional",
  "telefono": "Opcional",
  "acepta_politica_privacidad": true
}
```

- `201 { "usuario": usuario }`. No devuelve sesión: el centro tiene que confirmar el email. El frontend muestra "Revisa tu email".
- `400 DATOS_INVALIDOS` con `details` por campo. Si `acepta_politica_privacidad` no es `true`, también.
- `409 EMAIL_YA_REGISTRADO`. Para cumplir US-01 el servidor comprueba `centros` antes de llamar a Supabase, porque Supabase no avisa de los emails repetidos.
- Contraseña: entre 8 caracteres y 72 bytes (límite de bcrypt). En Supabase se configura el mismo mínimo.
- El servidor crea el centro y la cuenta en la misma transacción: si Supabase falla, el centro no se guarda.
- `429 DEMASIADOS_INTENTOS` si Supabase limita el envío de emails; `503 AUTH_NO_DISPONIBLE` o `503 BASE_DATOS_NO_DISPONIBLE`.

### `POST /api/auth/confirmar` (US-02)

El email de confirmación de Supabase enlaza a la web: `/confirmar-email?token_hash=...&type=email`. La página de confirmación envía esos valores a la API:

```json
{ "token_hash": "...", "type": "email" }
```

- `200 { "usuario": usuario, "sesion": sesion }`. La cuenta queda activa y el servidor rellena `centros.email_confirmado_en`.
- `400 ENLACE_INVALIDO`: el enlace no existe, ya se ha usado o ha caducado. Para pedir un enlace nuevo, `POST /api/auth/reenviar-confirmacion` (US-66).

- `200` aunque no se pueda copiar la fecha en `centros`: Supabase Auth ya ha activado la cuenta y el enlace no se puede reutilizar. El servidor registra el error.

Configuración necesaria en Supabase (Carlos):

1. **Authentication → Sign In / Providers → Email**: *Confirm email* activado y contraseña mínima de 8 caracteres.
2. **Authentication → URL Configuration → Site URL**: la URL de la web (`http://localhost:5173` en desarrollo).
3. **Authentication → Emails → Confirm signup**: copiar [supabase/templates/confirmar-email.html](../supabase/templates/confirmar-email.html).
4. El servidor de email que trae Supabase solo envía a los miembros del proyecto y muy pocos mensajes por hora. Sirve para la demo con nuestros emails; para usuarios reales hay que configurar un SMTP propio (**Authentication → Emails → SMTP Settings**).

### `POST /api/auth/reenviar-confirmacion` (US-66)

Para cuando el enlace de confirmación ha caducado o se ha perdido el email. La web puede ofrecerlo en la pantalla "Enlace no válido" y en la de "Revisa tu email".

```json
{ "email": "centro@example.com" }
```

- `204` sin contenido. Supabase envía un email nuevo con la misma plantilla *Confirm signup*, así que el enlace abre `/confirmar-email` igual que el primero. El enlace anterior deja de funcionar.
- La respuesta es la misma si el email no tiene cuenta o ya está confirmado, para no revelar qué emails están registrados. El frontend muestra siempre un mensaje del tipo "Si hay una cuenta pendiente con ese email, te hemos enviado un enlace nuevo".
- `400 DATOS_INVALIDOS` con `details.email` si falta el email o su formato no es válido (misma regla que en el registro).
- `429 DEMASIADOS_INTENTOS` si se piden enlaces demasiado seguidos (Supabase limita los reenvíos); `503 AUTH_NO_DISPONIBLE`.

### `POST /api/auth/recuperar-contrasena` (US-04)

Pública. Pide el email «Cambia tu contraseña de Sportsplace» (plantilla *Reset password* de T04-1), que enlaza a `/restablecer-contrasena?token_hash=…&type=recovery`.

```json
{ "email": "piscina@clubnatacio.cat" }
```

- `204` sin cuerpo, **exista o no la cuenta**: la respuesta (código, cuerpo y cabeceras) es idéntica para un email registrado, uno no registrado y uno sin confirmar (CA23). El email se recorta y se pasa a minúsculas antes de enviarlo (CA25).
- El email solo se envía si la cuenta existe y tiene el email confirmado (se comprueba en `auth.users`). A una cuenta sin confirmar no se le envía, porque Supabase da el email por confirmado al verificar un enlace de recuperación y eso rompería CA15 (#152); la respuesta sigue siendo el mismo `204`.
- `400 DATOS_INVALIDOS` con `details.email`: misma regla y mensajes que en el registro («El email es obligatorio.», «El email no es válido.», máximo 254 caracteres).
- `400 JSON_INVALIDO`, `429 DEMASIADOS_INTENTOS`, `503 AUTH_NO_DISPONIBLE`, `503 BASE_DATOS_NO_DISPONIBLE` (no se ha podido comprobar la cuenta).

### `POST /api/auth/restablecer-contrasena` (US-04)

Pública. La página `/restablecer-contrasena` envía el `token_hash` del enlace y la contraseña nueva (la web ya ha comprobado que las dos contraseñas coinciden):

```json
{ "token_hash": "...", "password": "Natacio2026!" }
```

- `204` sin cuerpo y **sin sesión**: después se entra con `POST /api/auth/login` (US-04 CA5).
- El servidor hace `verifyOtp({ type: 'recovery', token_hash })`, cambia la contraseña con la sesión de recuperación de ese usuario y cierra **todas** sus sesiones (`signOut` con `scope: 'global'`): sus `refresh_token` dan `401 NO_AUTENTICADO` y la contraseña anterior da `401 CREDENCIALES_INCORRECTAS` (CA14). Elegir la misma contraseña que la anterior se acepta (CA26).
- `400 DATOS_INVALIDOS`: `details.token_hash` «Falta el token del enlace.» y/o `details.password` con los mensajes del registro («La contraseña es obligatoria.», «La contraseña debe tener al menos 8 caracteres.», «La contraseña es demasiado larga.»; 8 caracteres a 72 bytes, sin recortar espacios). Si Supabase rechaza la contraseña por débil, `details.password` «La contraseña es demasiado débil.».
- `400 ENLACE_INVALIDO` «El enlace para cambiar la contraseña no es válido o ha caducado.»: enlace usado (solo sirve una vez), caducado (3600 s), sustituido por uno pedido después o inventado (CA11-CA13).
- `400 JSON_INVALIDO`, `429 DEMASIADOS_INTENTOS`, `503 AUTH_NO_DISPONIBLE`.
- El `token_hash` no se escribe en los logs del servidor (CA24).

### `POST /api/auth/login` (US-03)

```json
{ "email": "centro@example.com", "password": "********" }
```

- `200 { "usuario": usuario, "sesion": sesion }`.
- `400 DATOS_INVALIDOS` si falta el email o la contraseña.
- `401 CREDENCIALES_INCORRECTAS` con el mensaje genérico "Email o contraseña incorrectos." tanto si el email no existe como si la contraseña es incorrecta.
- `403 EMAIL_NO_CONFIRMADO` si la contraseña es correcta pero el email está sin confirmar. Supabase comprueba la contraseña antes, así que no revela qué emails existen.
- `429 DEMASIADOS_INTENTOS`, `503 AUTH_NO_DISPONIBLE`.

El email se normaliza (espacios y mayúsculas) antes de enviarlo a Supabase.

### `POST /api/auth/refresh` (US-03)

```json
{ "refresh_token": "token" }
```

- `200 { "usuario": usuario, "sesion": sesion }` con tokens nuevos.
- `401 NO_AUTENTICADO` si el `refresh_token` no es válido o la sesión se ha cerrado. El frontend vuelve a la pantalla de entrada.

### `GET /api/auth/me` (US-03, US-67)

Privada. Devuelve el usuario de la sesión actual.

- `200 { "usuario": usuario }`.
- `401 NO_AUTENTICADO`.

El frontend lo usa al cargar la web y para proteger las rutas privadas.

### `POST /api/auth/logout` (US-67)

Privada. Sin cuerpo.

- `204` sin contenido. La sesión se cierra en Supabase y su `refresh_token` deja de funcionar.
- `401 NO_AUTENTICADO` si la sesión ya no era válida. El frontend lo trata igual que un cierre correcto.

En ambos casos el frontend borra los tokens que guarda y redirige a la pantalla de entrada. Después, cualquier ruta privada devuelve `401`.

### `POST /api/anuncios` (US-12, US-13, US-14)

Privada: `requireAuth` + `requireEmailConfirmado`. Cuerpo `multipart/form-data` (US-13 CA12) con estas partes:

| Parte | Contenido |
|---|---|
| `datos` | Texto JSON con los campos del anuncio (abajo). Como máximo 100 kB. |
| `fotos` | De 1 a 8 archivos JPG, PNG o WebP de 5 MB (5.242.880 bytes) como máximo cada uno, en el orden en que se añadieron. Una parte `fotos` por archivo. |
| `foto_principal` | Opcional. Índice 1..n de la foto principal, como texto. Si falta, la principal es la 1. |

`datos`:

```json
{
  "titulo": "Balones de fútbol talla 5",
  "descripcion": "Doce balones Mikasa usados una temporada, sin pinchazos.",
  "categoria": "balones",
  "deporte": "futbol",
  "unidades_disponibles": 12,
  "estado_material": "buen_estado",
  "modalidad": "venta",
  "precio_unitario_centimos": 850
}
```

En una donación, `"modalidad": "donacion"` y `precio_unitario_centimos` no se envía o vale `null`.

Desde el navegador se construye con `FormData` (sin fijar a mano el `Content-Type`, que lleva el `boundary`):

```js
const formulario = new FormData();
formulario.append('datos', JSON.stringify(datos));
for (const archivo of fotos) formulario.append('fotos', archivo);
formulario.append('foto_principal', String(indicePrincipal));
fetch('/api/anuncios', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formulario });
```

- `201 { "anuncio": anuncio }` con la cabecera `Location: /api/anuncios/<id>`. El anuncio se crea `activo`, del centro de la sesión, con `publicado_en` = `creado_en` = `actualizado_en`, y `fotos` con n elementos (`orden` 1..n, una con `es_principal: true`).
- Reglas y mensajes: «Tabla de campos» de E03. Los textos se recortan de espacios y las longitudes se cuentan en caracteres Unicode. `unidades_disponibles` solo acepta un entero JSON entre 1 y 9999: `"3"`, `3.0` o `2.5` se rechazan.
- Modalidad y precio (US-14, CA9), en `details`:

| Caso | Clave | Mensaje |
|---|---|---|
| Falta `modalidad` | `modalidad` | «Elige si es venta o donación.» |
| `modalidad` distinta de `venta`/`donacion` (p. ej. `"regalo"`, `"Venta"`) | `modalidad` | «La modalidad no es válida.» |
| Venta sin precio o con `null` | `precio_unitario_centimos` | «Indica el precio por unidad.» |
| Venta con un precio que no es un entero JSON entre 1 y 9.999.999 (`0`, `10000000`, `8.5`, `850.0`, `"850"`) | `precio_unitario_centimos` | «El precio debe estar entre 0,01 € y 99.999,99 €.» |
| Donación con cualquier precio distinto de `null` | `precio_unitario_centimos` | «Una donación no puede tener precio.» |

  Si la modalidad falta o no es válida, el precio no se valida (su regla depende de la modalidad).
- `400 DATOS_INVALIDOS`, `message` «Revisa los campos marcados.», con una entrada en `details` por **cada** campo incorrecto, incluidas las fotos (US-13 CA14). No se crea nada ni se sube ninguna foto.
  - `details.datos` «Faltan los datos del anuncio.»: falta la parte `datos`, no es JSON o supera 100 kB. También si el cuerpo no es multipart (por ejemplo, JSON). Un `datos` JSON que no es un objeto (p. ej. `[]`) devuelve los siete campos obligatorios.
  - `details.fotos`: 0 fotos → «Añade al menos una foto.»; más de 8 → «Puedes añadir 8 fotos como máximo.»; algún archivo que no es JPG, PNG o WebP → «Solo se admiten fotos JPG, PNG o WebP.»; alguno de más de 5.242.880 bytes → «Cada foto debe pesar 5 MB como máximo.» (si hay varios problemas, el primero de esta lista).
  - El tipo se decide por el contenido (cabecera binaria: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`), nunca por la extensión ni por el `Content-Type` de la parte (US-13 CA13).
  - `details.foto_principal` «La foto principal no es válida.»: `foto_principal` no es un entero o está fuera de 1..n.
- `413 PETICION_DEMASIADO_GRANDE`: la petición entera supera 41.943.040 bytes (40 MB). Se responde con `Connection: close`.
- Las claves de `datos` `estado`, `centro_id`, `id`, `publicado_en` (y cualquier otra no prevista) se ignoran. Las partes desconocidas también.
- Fotos en Supabase Storage, bucket `anuncios`, ruta `<centro_id>/<anuncio_id>/<foto_id>.<jpg|png|webp>`, sin modificar. El nombre original del archivo no se guarda. Solo el servidor escribe en el bucket, con `SUPABASE_SERVICE_ROLE_KEY`.
- Creación atómica (US-13 CA20): si falla la subida de cualquier foto o la base de datos, no queda ni el anuncio ni ninguna foto (el servidor borra las ya subidas). `503 ALMACENAMIENTO_NO_DISPONIBLE` si falla Storage, `503 BASE_DATOS_NO_DISPONIBLE` si falla PostgreSQL y `500 ERROR_INTERNO` si la base de datos rechaza datos ya validados.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`: se comprueban antes de leer el cuerpo.

### `GET /api/anuncios/:id` (US-12)

Privada: `requireAuth` + `requireEmailConfirmado`.

- `200 { "anuncio": anuncio }` si el anuncio es del centro de la sesión y no está retirado, con sus `fotos` en orden (US-13).
- `404 NO_ENCONTRADO`, `message` «Anuncio no encontrado.», si no existe, es de otro centro, está retirado o `:id` no es un UUID. Las cuatro respuestas son idénticas, para no revelar qué anuncios existen.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.

### `PATCH /api/anuncios/:id` (US-15)

Privada: `requireAuth` + `requireEmailConfirmado`. Modifica un anuncio del centro de la sesión. Cuerpo `multipart/form-data` (US-15 CA11), como `POST /api/anuncios`:

| Parte | Contenido |
|---|---|
| `datos` | Texto JSON con el anuncio **completo** (los mismos campos que al publicar, no es un parche parcial) más `fotos_conservar`. Como máximo 100 kB. |
| `fotos` | De 0 a 8 fotos **nuevas**, JPG, PNG o WebP de 5 MB como máximo cada una, en orden. Una parte `fotos` por archivo. |
| `foto_principal` | Obligatoria. `existente:<id>` (una foto de `fotos_conservar`) o `nueva:<índice 1..n>` (una de las nuevas). |

`datos`:

```json
{
  "titulo": "Balones de fútbol talla 5",
  "descripcion": "Doce balones Mikasa usados una temporada, sin pinchazos.",
  "categoria": "balones",
  "deporte": "futbol",
  "unidades_disponibles": 10,
  "estado_material": "buen_estado",
  "modalidad": "venta",
  "precio_unitario_centimos": 700,
  "fotos_conservar": ["<id de F2>"]
}
```

`fotos_conservar` es el array ordenado de ids de las fotos actuales que se quedan (vacío si se cambian todas).

```js
const formulario = new FormData();
formulario.append('datos', JSON.stringify({ ...datos, fotos_conservar: idsConservados }));
for (const archivo of fotosNuevas) formulario.append('fotos', archivo);
formulario.append('foto_principal', principal); // 'existente:<id>' o 'nueva:<n>'
fetch(`/api/anuncios/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: formulario });
```

- `200 { "anuncio": anuncio }`. No cambia `estado` ni `publicado_en`; `actualizado_en` se renueva siempre, aunque no cambie ningún dato.
- Fotos (CA8, CA12): el orden final es primero las de `fotos_conservar` en su orden y después las nuevas, con `orden` 1..n. Las conservadas mantienen su `id` y su URL; las que no están en `fotos_conservar` se borran de `anuncio_fotos` y de Storage; las nuevas se suben a `<centro_id>/<anuncio_id>/<foto_id>.<ext>`.
- Se pueden editar los anuncios `activo`, `pausado` y `reservado`.
- Modalidad y precio (US-14): mismas reglas que al publicar. Al pasar de venta a donación, `precio_unitario_centimos` se guarda como `null` (CA19); se puede enviar `null` o no enviarlo.
- Reglas y mensajes: los mismos que `POST /api/anuncios` («Tabla de campos» de E03 y tabla de modalidad y precio). `400 DATOS_INVALIDOS`, `message` «Revisa los campos marcados.», con una entrada en `details` por cada campo incorrecto; no se modifica nada ni se sube ninguna foto.
  - `details.datos` «Faltan los datos del anuncio.»: falta la parte `datos`, no es JSON o el cuerpo no es multipart.
  - `details.fotos`: total final (conservadas + nuevas) 0 → «Añade al menos una foto.»; más de 8 → «Puedes añadir 8 fotos como máximo.»; tipo o tamaño de una nueva, como al publicar.
  - `details.fotos_conservar` «Alguna foto no pertenece a este anuncio.»: falta, no es un array de ids distintos o algún id no es una foto de este anuncio (CA13). La pertenencia se comprueba contra la base de datos después del resto de validaciones.
  - `details.foto_principal` «La foto principal no es válida.»: falta, no tiene el formato `existente:<id>` / `nueva:<n>` o no apunta a una foto final.
- Las claves de `datos` `estado`, `centro_id`, `id`, `publicado_en` (y cualquier otra no prevista) se ignoran.
- `404 NO_ENCONTRADO`, `message` «Anuncio no encontrado.», si no existe, es de otro centro, está retirado o `:id` no es un UUID (con un `:id` que no es UUID, antes de leer el cuerpo).
- `409 ANUNCIO_NO_EDITABLE`, `message` «Este anuncio ya no se puede editar.», si está `entregado`. Se comprueba antes de subir las fotos y otra vez dentro de la transacción, con el anuncio bloqueado: si otra persona del centro lo marca como entregado mientras se edita, también 409.
- `413 PETICION_DEMASIADO_GRANDE`: la petición entera supera 40 MB.
- Atomicidad (CA16): datos y fotos se guardan en una transacción. Si algo falla, el anuncio y sus fotos quedan como estaban y se borran las nuevas ya subidas (`503 ALMACENAMIENTO_NO_DISPONIBLE`, `503 BASE_DATOS_NO_DISPONIBLE` o `500 ERROR_INTERNO`, como al publicar). Las fotos quitadas se borran de Storage solo después de confirmar la transacción.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`.

### `GET /api/centros/mio` (US-07)

Privada (`requireAuth`). Devuelve el centro al que pertenece el usuario (en este sprint, el de `centros.usuario_id`; US-84 lo amplía a miembros).

- `200 { "centro": centro }`:

```json
{
  "id": "uuid", "nombre": "Club Natació Exemple", "email": "centro@example.com",
  "localidad": "Barcelona", "direccion": null, "codigo_postal": "08001", "telefono": "+34 931 234 567",
  "descripcion": "Club de natación…", "email_contacto": "material@clubnatacio.cat",
  "web": "https://clubnatacio.cat", "creado_en": "2026-10-09T10:00:00.000Z",
  "provincia": "Barcelona", "latitud": 41.3888, "longitud": 2.159
}
```

`provincia`, `latitud` y `longitud` (números) las pone el servidor a partir del código postal (US-68). Son `null` en los centros que todavía no han indicado su ubicación.

- `401 NO_AUTENTICADO`.
- `404 NO_ENCONTRADO` si la cuenta no tiene ningún centro (no debería pasar: el alta crea los dos en la misma transacción).
- `503 BASE_DATOS_NO_DISPONIBLE`.

### `PATCH /api/centros/mio` (US-07)

Privada (`requireAuth` + `requireEmailConfirmado`). Cuerpo con cualquiera de estos campos; los que no se envían no cambian y `null` o `""` borra un opcional:

```json
{ "nombre": "Club Natació Exemple", "descripcion": "…", "telefono": "+34 931 234 567", "email_contacto": "material@clubnatacio.cat", "web": "https://clubnatacio.cat" }
```

Se recortan los espacios antes de validar. Los límites se cuentan por caracteres (un emoji es 1).

| Campo | Regla | Mensaje en `details` |
|---|---|---|
| `nombre` | Obligatorio, 1-160 | «El nombre del centro es obligatorio.», «Como máximo 160 caracteres.» |
| `descripcion` | Opcional, 0-1000, admite saltos de línea | «Como máximo 1000 caracteres.» |
| `telefono` | Opcional, dígitos, espacios y un `+` inicial, 9-30 | «El teléfono no es válido.», «Como máximo 30 caracteres.» |
| `email_contacto` | Opcional, misma regla que el email del alta, se guarda en minúsculas | «El email no es válido.» |
| `web` | Opcional, máx. 255, `http://` o `https://` y dominio con punto | «La web debe empezar por http:// o https://.», «La web no es válida.», «Como máximo 255 caracteres.» |

- `200 { "centro": centro }` con los datos actualizados. Cada `PATCH` correcto actualiza `centros.actualizado_en`.
- `400 DATOS_INVALIDOS` con `details` por campo. Un campo desconocido o no editable (`email`, `usuario_id`, `localidad`…) da `details.<campo>` «Este campo no se puede modificar.».
- `400 JSON_INVALIDO`, `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (como en `GET`), `503 BASE_DATOS_NO_DISPONIBLE`.

No existe ninguna ruta para editar otro centro por id.

### `PUT /api/centros/mio/ubicacion` (US-68)

Privada (`requireAuth` + `requireEmailConfirmado`). Fija la ubicación del centro propio; se envían siempre los tres campos:

```json
{ "direccion": "Carrer de la Piscina 12", "codigo_postal": "08025", "localidad": "Barcelona" }
```

Se recortan los espacios antes de validar. Las claves que no son estas tres (p. ej. `provincia`, `latitud`) se ignoran.

| Campo | Regla | Mensaje en `details` |
|---|---|---|
| `direccion` | Opcional, 0-255; vacía se guarda como `null` | «Como máximo 255 caracteres.» |
| `codigo_postal` | Obligatorio, 5 cifras entre `01000` y `52999` | «El código postal es obligatorio.», «El código postal debe tener 5 cifras.», «El código postal no es de España.» |
| `localidad` | Obligatoria, 1-120; la escribe el usuario | «La localidad es obligatoria.», «Como máximo 120 caracteres.» |

- `200 { "centro": centro }` (como en `GET /api/centros/mio`). El servidor busca el código postal en `codigos_postales` y copia `provincia`, `latitud` y `longitud` en el centro en la misma sentencia; también actualiza `actualizado_en`.
- `400 DATOS_INVALIDOS` con `details` por campo.
- `400 CODIGO_POSTAL_DESCONOCIDO`, `message` y `details.codigo_postal` «No conocemos este código postal. Revísalo.», si el formato es válido pero el código no está en la tabla. No se cambia nada.
- `400 JSON_INVALIDO`, `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (como en `GET`), `405` con otros métodos, `503 BASE_DATOS_NO_DISPONIBLE`.

### `GET /api/centros/:id` (US-10)

Privada: `requireAuth` + `requireEmailConfirmado`. Perfil que ven los demás centros (también el propio, para «Ver cómo ven mi perfil»).

- `200 { "centro": centro }`, con una proyección cerrada:

```json
{
  "centro": {
    "id": "uuid", "nombre": "Club Natació Exemple", "localidad": "Barcelona", "provincia": "Barcelona",
    "descripcion": "Club de natación…", "telefono": "+34 931 234 567",
    "email_contacto": "material@clubnatacio.cat", "web": "https://clubnatacio.cat",
    "creado_en": "2026-10-09T10:00:00.000Z", "es_mio": false
  }
}
```

- `es_mio` es `true` si el centro es el de la sesión.
- Nunca incluye `email` (de acceso), `usuario_id`, `direccion`, `codigo_postal`, `latitud`, `longitud`, `politica_privacidad_aceptada`, `email_confirmado_en` ni los miembros (CA14).
- `404 NO_ENCONTRADO` («Centro no encontrado.») si no existe, si el id no es un UUID o si el centro está eliminado (US-11). Los demás métodos sobre esta ruta también responden 404: no hay ruta para editar otro centro (US-07, CA22).
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.

### `GET /api/centros/:id/anuncios` (US-10)

Privada: `requireAuth` + `requireEmailConfirmado`. Anuncios del perfil del centro: `GET /api/centros/:id/anuncios?pagina=1`.

- `pagina`: entero mayor que 0, por defecto 1. El tamaño de página es fijo, 20; `por_pagina` se ignora.
- `200 { "anuncios": [resumen], "pagina": 1, "total": 21 }`. Cada elemento tiene el mismo formato que en `GET /api/anuncios/mios` (con `foto_principal_url`).
- Solo los anuncios `activo` y `reservado` (la web muestra estos como «No disponible»); nunca `pausado`, `entregado`, `retirado` ni `borrador`, aunque sea el propio centro (CA6, CA15). `total` cuenta los mismos.
- Orden: `publicado_en` descendente y, a igualdad, `id` descendente.
- Una página sin resultados devuelve `anuncios: []` con la `pagina` pedida (no se ajusta a la última).
- `400 DATOS_INVALIDOS` con `details.pagina` «Debe ser un número entero mayor que 0.» (`0`, `abc`, `2.5`, `-1` o el parámetro repetido).
- `404 NO_ENCONTRADO` como en `GET /api/centros/:id`; `405` con otros métodos; `401`, `403` y `503` como arriba.

### `GET /api/anuncios/mios` (US-18)

Privada: `requireAuth` + `requireEmailConfirmado`. Lista «Mis anuncios» del centro de la sesión, paginada: `GET /api/anuncios/mios?pagina=1&por_pagina=20`.

- `pagina`: entero mayor que 0, por defecto 1. `por_pagina`: entero de 1 a 50, por defecto 20.
- `200`:

```json
{
  "anuncios": [
    {
      "id": "uuid",
      "titulo": "Balones de fútbol talla 5",
      "categoria": "balones",
      "deporte": "futbol",
      "unidades_disponibles": 12,
      "modalidad": "donacion",
      "precio_unitario_centimos": null,
      "estado": "activo",
      "foto_principal_url": null,
      "publicado_en": "2026-11-03T10:15:00.000Z",
      "actualizado_en": "2026-11-03T10:15:00.000Z"
    }
  ],
  "total": 21,
  "pagina": 1,
  "por_pagina": 20
}
```

- Incluye los anuncios en `borrador`, `activo`, `pausado`, `reservado` y `entregado`; nunca los `retirado` ni los de otros centros. `total` cuenta los mismos.
- Orden: `actualizado_en` descendente y, a igualdad, `id` descendente.
- Si `pagina` es mayor que la última, se devuelve la última y `pagina` trae su número (con 0 anuncios, la 1). La web debe usar ese valor (CA10).
- `400 DATOS_INVALIDOS`, `message` «Revisa los campos marcados.»: `details.pagina` «Debe ser un número entero mayor que 0.» y/o `details.por_pagina` «Debe ser un número entre 1 y 50.». Solo se aceptan dígitos: `2.5`, `-1`, `abc`, un valor vacío o el parámetro repetido se rechazan.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.
- `foto_principal_url` es la URL pública de la foto con `es_principal` (US-13) o `null` si el anuncio no tiene fotos.
- `modalidad` y `precio_unitario_centimos` son los del anuncio (US-14, CA7): `"donacion"` con `null`, o `"venta"` con el precio en céntimos.

### Cambios de estado de un anuncio (E03)

Siguen la tabla «Estados del anuncio y transiciones» de E03. Cada cambio es un único `UPDATE ... WHERE id = … AND centro_id = <centro de la sesión> AND estado IN (<estados de origen>)`: si el estado actual no está en la lista no se cambia nada, así que dos peticiones simultáneas no pueden saltarse la regla (una recibe `200` y la otra `409`). El servicio común está en `backend/src/services/transiciones-anuncio.js` (tabla de acciones) y en `transicionar` del repositorio de anuncios. Acciones: `pausar`, `reactivar` (US-16), `reservar`, `quitar-reserva`, `entregar` (US-17) y `retirar` (US-70, con `DELETE`).

Un cambio de estado renueva `actualizado_en` y no modifica ningún otro campo ni `publicado_en`.

Errores comunes a todas las transiciones:

- `409 TRANSICION_NO_PERMITIDA`, `message` «Esta acción no está disponible en el estado actual del anuncio.», con `details: { "estado_actual": "<estado>" }`, si el estado actual no permite la acción. Repetir una acción no es idempotente (pausar un anuncio ya pausado → `409`).
- `404 NO_ENCONTRADO` «Anuncio no encontrado.», igual que en `GET /api/anuncios/:id` (otro centro, inexistente, retirado o id que no es UUID).
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.
- `405 METODO_NO_PERMITIDO` (cabecera `Allow: POST`) con cualquier otro método, por ejemplo `GET`, en las rutas `/:id/<acción>`.

### `POST /api/anuncios/:id/pausar` (US-16)

Privada: `requireAuth` + `requireEmailConfirmado`. Sin cuerpo (si llega uno, se ignora). `activo` → `pausado`; `200 { "anuncio": anuncio }` con el anuncio ya pausado.

### `POST /api/anuncios/:id/reactivar` (US-16)

Privada: `requireAuth` + `requireEmailConfirmado`. Sin cuerpo. `pausado` → `activo`; `200 { "anuncio": anuncio }`.

### `POST /api/anuncios/:id/reservar`, `/quitar-reserva` y `/entregar` (US-17)

Privadas: `requireAuth` + `requireEmailConfirmado`. Sin cuerpo; `200 { "anuncio": anuncio }`.

| Ruta | Desde | Hacia |
|---|---|---|
| `POST /api/anuncios/:id/reservar` | `activo` | `reservado` |
| `POST /api/anuncios/:id/quitar-reserva` | `reservado` | `activo` |
| `POST /api/anuncios/:id/entregar` | `activo` o `reservado` | `entregado`, con `entregado_en = now()` |

- `entregado` es final: después, cualquier transición (y `DELETE`) responde `409 TRANSICION_NO_PERMITIDA`. Entregar dos veces → la segunda `409`.
- Desde `pausado` no se puede reservar ni entregar (`409` con `estado_actual: "pausado"`): hay que reactivar antes.
- Ningún cambio de estado modifica `unidades_disponibles`, el precio ni las fotos.
- Errores comunes de «Cambios de estado de un anuncio».

### `DELETE /api/anuncios/:id` (US-70)

Privada: `requireAuth` + `requireEmailConfirmado`. Sin cuerpo. Retirada lógica con el mismo servicio de transiciones: `borrador`, `activo`, `pausado` o `reservado` → `retirado`, con `retirado_en = now()`.

- `204` sin cuerpo.
- La fila no se borra (ni las fotos ni sus archivos de Storage). Desde ese momento, cualquier ruta sobre el anuncio responde `404 NO_ENCONTRADO`, también para su propietario: `GET /api/anuncios/:id`, las transiciones y un segundo `DELETE` (US-70 CA11, CA12).
- `entregado` → `409 TRANSICION_NO_PERMITIDA` con `details.estado_actual`.
- Ya retirado, inexistente, de otro centro o id que no es UUID → `404 NO_ENCONTRADO`.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.
- `/api/anuncios/:id` admite `GET`, `PATCH` y `DELETE`; con otro método, `405` con `Allow: GET, PATCH, DELETE`.
- US-32 añadirá `409 ANUNCIO_CON_PEDIDOS_EN_CURSO` (US-70 CA13); no se implementa aquí.

## Configuración del correo de recuperación (T04-1 / US-04)

Responsable: Carlos. Referencias: [tarea #90](https://github.com/UB-ES-A4-2026/sportsplace/issues/90), [historia #89](https://github.com/UB-ES-A4-2026/sportsplace/issues/89) y [US-04, CA10 y CA11](especificacion/E01-E02-registro-y-perfil.md). No necesita cambios en la tabla `centros` ni variables nuevas en la web.

### Aplicar en Supabase

1. Abrir el proyecto del entorno que se va a probar. En **Authentication → URL Configuration**, comprobar **Site URL**: `http://localhost:5173` para el entorno local. El enlace usa ese valor; debe corresponder a la web de ese entorno. No cambiarlo por la URL de la API.
2. En **Authentication → Emails → Reset password**, fijar el asunto exacto **Cambia tu contraseña de Sportsplace** y copiar el contenido de [recuperar-contrasena.html](../supabase/templates/recuperar-contrasena.html). Guardar y volver a abrir para comprobar la persistencia.
3. En la configuración del proveedor **Email**, fijar **Email OTP Expiration** a **3600 segundos**. Guardar y recargar para verificarlo. Es una configuración del proveedor de email, compartida con otros enlaces de Auth; registrar su valor junto con la plantilla.
4. En **Authentication → Emails → SMTP Settings**, conservar el SMTP personalizado existente. La [validación del Sprint 0](sprint-0-validacion-devops.md#resultado-de-la-revisión-manual-comunicada-por-carlos) registra Gmail con puerto 465 y recepción real. Comprobar que sigue habilitado sin mostrar ni reemplazar su contraseña de aplicación. No sustituirlo por el servicio de correo de prueba de Supabase.

El botón debe decir **Cambiar contraseña** y tener exactamente este destino en la plantilla:

```html
{{ .SiteURL }}/restablecer-contrasena?token_hash={{ .TokenHash }}&type=recovery
```

No sustituir `.TokenHash` por `.Token` ni por `.ConfirmationURL`: el navegador abre la página de Sportsplace y el backend de T04-2 verifica el token de tipo `recovery`. No se muestra ni se guarda el enlace real en logs o evidencias públicas.

### Probar el correo real

1. Usar una cuenta de pruebas existente cuyo buzón controle la persona que realiza la comprobación. No repetir su registro ni eliminarla para forzar el envío. Tener disponible la web correspondiente a **Site URL**.
2. Desde **Authentication → Users**, abrir esa cuenta y usar la acción de enviar recuperación de contraseña una sola vez. Cuando T04-2 y T04-3 estén integradas en la historia, repetir la validación mediante el formulario `/recuperar-contrasena` para probar el flujo de la aplicación. Una prueba directa desde el panel solo acredita la configuración y la entrega del correo.
3. Comprobar en el buzón la recepción del asunto **Cambia tu contraseña de Sportsplace**, el botón **Cambiar contraseña**, la indicación de caducidad de una hora y el destino de la web con ruta `/restablecer-contrasena`, `token_hash` no vacío y `type=recovery`. Registrar hora de petición y recepción, sin dirección del buzón, token, contraseña ni URL completa.
4. Con T04-2 y T04-3 disponibles, QA valida el cambio de contraseña y los restantes CA de US-04. Para CA11, probar enlaces distintos a los 59 y 61 minutos: el primero funciona y el segundo devuelve `ENLACE_INVALIDO`. No solicitar un nuevo enlace para una cuenta mientras se mide el anterior: solo sirve el último (CA13). No atribuir estas comprobaciones a una inspección estática de la plantilla.
5. Adjuntar a la issue o PR la fecha, entorno, commit, valor de caducidad comprobado y resultado de recepción. La tarea requiere configuración aplicada, correo real probado, revisión ajena y fusión de su PR en `story/US-04-recuperar-contrasena-olvido`.

### Estado de la configuración

Verificado el **23/10/2026** en `sportsplace-dev`, con la sesión de Carlos:

- Plantilla **Reset password** guardada; asunto y HTML coinciden con el archivo versionado después de recargar el panel.
- **Email OTP expiration = 3600 s**, ya configurado al abrir el proveedor Email.
- **Site URL = http://localhost:5173** y SMTP personalizado habilitado con puerto **465**, conservados.

La incidencia SMTP quedó resuelta al guardar una **contraseña de aplicación de
Google** en el panel. Los intentos previos devolvían 535 (credenciales rechazadas)
y 534 (contraseña de aplicación requerida); no se publicó esa credencial.

La última solicitud, realizada el **23/10/2026 a las 22:14 (Europe/Madrid)**,
produjo un correo recibido a las **22:14** en el buzón de pruebas. La inspección
del mensaje el **24/10/2026** verificó:

- Asunto **Cambia tu contraseña de Sportsplace** y botón **Cambiar contraseña**.
- Texto **El enlace caduca en 1 hora.**
- Destino en `http://localhost:5173`, ruta `/restablecer-contrasena`, parámetro
  `token_hash` no vacío y `type=recovery`, sin registrar el token ni la URL completa.

Esta evidencia acredita la entrega real y el contenido de la plantilla de T04-1.
No se utilizó el enlace ni se cambió la contraseña de una cuenta. Los endpoints,
pantallas y casos de caducidad de 59/61 minutos requieren T04-2 y T04-3.
**Pendiente:** aprobación del último commit e integración mediante merge commit.

## Rutas privadas y confirmación del email (US-02)

El servidor tiene dos middlewares para las rutas privadas:

- `requireAuth`: exige un token válido; si no, `401 NO_AUTENTICADO`. Deja el usuario en `request.usuario`.
- `requireEmailConfirmado`: exige además `email_confirmado`; si no, `403 EMAIL_NO_CONFIRMADO`.

Cualquier ruta para publicar anuncios o hacer pedidos (sprints siguientes) tiene que usar los dos. Con **Confirm email** activado, Supabase ya impide entrar sin confirmar; el segundo middleware evita depender solo de esa opción.

## Enlace de `centros` con las cuentas

Con Supabase Auth, la cuenta vive en `auth.users` y el centro en `public.centros`. La migración `20261009120000_enlazar_centros_usuarios.sql` (US-01) añade:

```sql
ALTER TABLE public.centros
    ADD COLUMN usuario_id UUID UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE;
```

- `usuario_id` enlaza cada centro con su cuenta. Admite nulos solo porque el servidor inserta el centro antes de crear la cuenta, dentro de la misma transacción. `ON DELETE CASCADE` ayuda con la supresión de datos (US-11, NFR-01).
- Las contraseñas no se guardan en `centros`: las guarda Supabase Auth.
- `email_confirmado_en` se rellena en `POST /api/auth/confirmar` con la fecha de `auth.users.email_confirmed_at`. La fuente de verdad del estado de confirmación es Supabase Auth.
- El servidor accede a `centros` con su conexión privada (`DATABASE_URL`). Las políticas RLS para el cliente no hacen falta mientras el frontend solo use nuestra API.
