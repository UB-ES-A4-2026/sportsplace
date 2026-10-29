# Contrato de la API: TR-06

Responsables: Anass y Alex (backend), revisado con Lucía y Marta (frontend). Sprint 0.

Este documento es el acuerdo entre backend y frontend para las historias del Sprint 0: US-01, US-02, US-03 y US-67. Si un endpoint cambia, se actualiza aquí en la misma pull request.

## Decisiones

| Decisión | Elegido | Motivo |
|---|---|---|
| Framework del servidor | Express 5 | Ligero, conocido por el equipo y compatible con la base de TR-02 sin reescribirla. |
| Autenticación | Supabase Auth | Guarda las contraseñas con hash y sal (NFR-03), envía el email de confirmación (US-02) y emite los tokens. No hace falta un servicio de email propio en el Sprint 0. |
| Sesión | Token `Bearer` de Supabase | El servidor no guarda estado de sesión; cada petición privada se comprueba contra Supabase. |

El frontend **solo habla con nuestra API** (`/api/...`). No llama a Supabase Auth directamente, para que las reglas y los mensajes de error estén en un único sitio.

## Convenciones

- Todas las rutas empiezan por `/api`. En desarrollo, Vite redirige `/api` al servidor.
- Peticiones y respuestas en JSON (`Content-Type: application/json`).
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
| 400 | `ENLACE_INVALIDO` | El enlace de confirmación no existe, ya se ha usado o ha caducado. |
| 400 | `CODIGO_POSTAL_DESCONOCIDO` | El código postal tiene un formato válido pero no está en `codigos_postales` (US-68). |
| 401 | `NO_AUTENTICADO` | Falta el token, ha caducado o la sesión se ha cerrado. |
| 401 | `CREDENCIALES_INCORRECTAS` | Email o contraseña incorrectos (no se dice cuál). |
| 403 | `EMAIL_NO_CONFIRMADO` | La cuenta todavía no ha confirmado su email. |
| 404 | `NO_ENCONTRADO` | La ruta o el recurso no existe. |
| 405 | `METODO_NO_PERMITIDO` | Método HTTP no admitido en esa ruta. |
| 409 | `EMAIL_YA_REGISTRADO` | Ya existe una cuenta con ese email. |
| 413 | `PETICION_DEMASIADO_GRANDE` | El cuerpo supera 100 kB. |
| 429 | `DEMASIADOS_INTENTOS` | Supabase limita los intentos. |
| 500 | `ERROR_INTERNO` | Error inesperado del servidor. |
| 503 | `BASE_DATOS_NO_DISPONIBLE` | PostgreSQL no responde o no está configurado. |
| 503 | `AUTH_NO_DISPONIBLE` | Supabase Auth no responde o no está configurado. |

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
  "modalidad": "donacion",
  "precio_unitario_centimos": null,
  "estado": "activo",
  "fotos": [],
  "publicado_en": "2026-11-03T10:15:00.000Z",
  "creado_en": "2026-11-03T10:15:00.000Z",
  "actualizado_en": "2026-11-03T10:15:00.000Z"
}
```

Fechas ISO 8601 en UTC. Mientras US-13 y US-14 no estén en `dev`, todos los anuncios salen como `modalidad: "donacion"`, `precio_unitario_centimos: null` y `fotos: []` (US-12, CA30).

## Endpoints

| Método y ruta | Historia | Privada | Responsable backend |
|---|---|---|---|
| `GET /api/health` | TR-02 | No | Carlos |
| `POST /api/auth/registro` | US-01 | No | Anass |
| `POST /api/auth/confirmar` | US-02 | No | Anass y Alex |
| `POST /api/auth/reenviar-confirmacion` | US-66 | No | Anass |
| `POST /api/auth/login` | US-03 | No | Alex |
| `POST /api/auth/refresh` | US-03 | No | Alex |
| `GET /api/auth/me` | US-03, US-67 | Sí | Alex |
| `POST /api/auth/logout` | US-67 | Sí | Alex |
| `POST /api/anuncios` | US-12 | Sí (email confirmado) | Anass |
| `GET /api/anuncios/:id` | US-12 | Sí (email confirmado) | Anass |
| `GET /api/centros/mio` | US-07 | Sí | Alex |
| `PATCH /api/centros/mio` | US-07 | Sí, con email confirmado | Alex |
| `PUT /api/centros/mio/ubicacion` | US-68 | Sí, con email confirmado | Alex |

### `GET /api/health`

`200 { "status": "ok", "service": "sportsplace-api" }`

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

### `POST /api/anuncios` (US-12)

Privada: `requireAuth` + `requireEmailConfirmado`. Cuerpo JSON:

```json
{
  "titulo": "Balones de fútbol talla 5",
  "descripcion": "Doce balones Mikasa usados una temporada, sin pinchazos.",
  "categoria": "balones",
  "deporte": "futbol",
  "unidades_disponibles": 12,
  "estado_material": "buen_estado"
}
```

- `201 { "anuncio": anuncio }` con la cabecera `Location: /api/anuncios/<id>`. El anuncio se crea `activo`, del centro de la sesión, con `publicado_en` = `creado_en` = `actualizado_en`.
- Reglas y mensajes: «Tabla de campos» de E03. Los textos se recortan de espacios y las longitudes se cuentan en caracteres Unicode. `unidades_disponibles` solo acepta un entero JSON entre 1 y 9999: `"3"`, `3.0` o `2.5` se rechazan.
- `400 DATOS_INVALIDOS`, `message` «Revisa los campos marcados.», con una entrada en `details` por **cada** campo incorrecto. No se crea nada. Un cuerpo JSON que no es un objeto (p. ej. `[]`) devuelve los seis campos obligatorios; un cuerpo que no es JSON, `400 JSON_INVALIDO`.
- Las claves `estado`, `centro_id`, `id`, `publicado_en` (y cualquier otra no prevista) se ignoran.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.
- US-13 cambiará el cuerpo a `multipart/form-data` (fotos) y US-14 añadirá `modalidad` y `precio_unitario_centimos`.

### `GET /api/anuncios/:id` (US-12)

Privada: `requireAuth` + `requireEmailConfirmado`.

- `200 { "anuncio": anuncio }` si el anuncio es del centro de la sesión y no está retirado.
- `404 NO_ENCONTRADO`, `message` «Anuncio no encontrado.», si no existe, es de otro centro, está retirado o `:id` no es un UUID. Las cuatro respuestas son idénticas, para no revelar qué anuncios existen.
- `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `503 BASE_DATOS_NO_DISPONIBLE`.

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
