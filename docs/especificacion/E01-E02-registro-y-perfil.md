# E01 Registro y acceso · E02 Perfil y equipo del centro

Historias de este documento: US-04, US-06 (E01) y US-07, US-68, US-08, US-84 (nueva), US-69, US-10 y US-11 (E02).

Base del Sprint 0 que **no se cambia** y sobre la que se construye:
- Tabla `centros` (`nombre`, `email`, `localidad`, `direccion`, `codigo_postal`, `telefono`, `politica_privacidad_aceptada`, `email_confirmado_en`, `usuario_id UNIQUE → auth.users ON DELETE CASCADE`, `creado_en`).
- Rutas `/api/auth/registro`, `/confirmar`, `/reenviar-confirmacion`, `/login`, `/refresh`, `/me`, `/logout`; middlewares `requireAuth` y `requireEmailConfirmado`.
- Pantallas `/`, `/registro`, `/confirmar-email`, `/entrar`, `/panel`.
- Reglas ya fijadas que se reutilizan tal cual: email `^[^\s@]+@[^\s@]+\.[^\s@]+$`, máximo 254 caracteres, guardado en minúsculas, mensajes «El email es obligatorio.» y «El email no es válido.»; contraseña de 8 caracteres a 72 bytes, mensajes «La contraseña es obligatoria.», «La contraseña debe tener al menos 8 caracteres.» y «La contraseña es demasiado larga.».

Códigos de error nuevos que introduce este documento: `ENLACE_INVALIDO` (400, ya existe; se reutiliza para el enlace de recuperación), `INVITACION_INVALIDA` (400), `YA_ES_MIEMBRO` (409), `INVITACION_YA_PENDIENTE` (409), `EMAIL_DE_OTRO_CENTRO` (409), `SIN_PERMISO` (403), `CONTRASENA_INCORRECTA` (401), `CODIGO_POSTAL_DESCONOCIDO` (400), `CONFIRMACION_INCORRECTA` (400).

---

## (2) US-04 · Quiero recuperar mi contraseña si la olvido

**Épica:** E01 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-03
**Cambios respecto al backlog original:** Se concreta que el enlace caduca a la hora, que solo sirve una vez y que al cambiar la contraseña se cierran todas las sesiones abiertas de esa cuenta. Tras fijar la contraseña no se entra automáticamente: se vuelve a `/entrar` (así el criterio «entrar con ella» se comprueba con el login de US-03). Sirve también para los miembros invitados (US-84), porque usan la misma cuenta de Supabase Auth.

**Historia**
Como responsable de un centro que ha olvidado su contraseña, quiero pedir un enlace por email y fijar una contraseña nueva, para volver a entrar sin crear otra cuenta.
1. En `/entrar` pulso el enlace «¿Has olvidado la contraseña?» (debajo del campo Contraseña) → llego a `/recuperar-contrasena`.
2. Escribo mi email `piscina@clubnatacio.cat` y pulso «Enviar enlace» → veo «Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña. Caduca en 1 hora.».
3. Abro el email «Cambia tu contraseña de Sportsplace» y pulso «Cambiar contraseña» → se abre `/restablecer-contrasena?token_hash=…&type=recovery`.
4. Escribo dos veces la contraseña nueva `Natacio2026!` y pulso «Guardar contraseña» → llego a `/entrar` con el aviso verde «Contraseña cambiada. Ya puedes entrar con la nueva.».
5. Entro con mi email y la contraseña nueva → llego a `/panel`.

**Pantallas para el boceto**
- `/entrar` (existente): se añade solo el enlace «¿Has olvidado la contraseña?» debajo del campo Contraseña, alineado a la derecha.
- `/recuperar-contrasena`: «Recuperar contraseña». Título; texto «Escribe el email de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.»; campo «Email»; botón «Enviar enlace»; enlace «Volver a entrar» (→ `/entrar`). Tras enviar, el formulario se sustituye por el texto de confirmación y el enlace «Volver a entrar».
- `/restablecer-contrasena`: «Nueva contraseña». Título; campo «Contraseña nueva (mínimo 8 caracteres)»; campo «Repite la contraseña»; botón «Guardar contraseña». Variante de error: título «Enlace no válido», texto «El enlace para cambiar la contraseña no es válido, ya se ha usado o ha caducado.» y botón «Pedir otro enlace» (→ `/recuperar-contrasena`).

**Criterios de aceptación**

*Navegación*
- CA1. En `/entrar` hay un enlace «¿Has olvidado la contraseña?» que lleva a `/recuperar-contrasena`.
- CA2. `/recuperar-contrasena` y `/restablecer-contrasena` son públicas: se abren sin sesión. Si hay sesión iniciada, también se abren (no redirigen a `/panel`).
- CA3. En `/recuperar-contrasena`, el enlace «Volver a entrar» lleva a `/entrar`.
- CA4. Si `/restablecer-contrasena` se abre sin `token_hash` o con `type` distinto de `recovery`, muestra directamente la variante «Enlace no válido» sin llamar a la API.
- CA5. Tras guardar la contraseña con éxito, la web borra los tokens guardados (si los había) y redirige a `/entrar` con el aviso verde «Contraseña cambiada. Ya puedes entrar con la nueva.».

*Campos y validación*
- CA6. Email (en `/recuperar-contrasena`): obligatorio, se recortan espacios, máximo 254 caracteres, regla y mensajes de US-01: vacío → «El email es obligatorio.»; `centro@ejemplo` → «El email no es válido.»; un email de 254 caracteres válido se acepta, uno de 255 se rechaza con «El email no es válido.».
- CA7. Contraseña nueva: obligatoria; 8 caracteres se aceptan (`abcdefg1`), 7 se rechazan con «La contraseña debe tener al menos 8 caracteres.»; 72 bytes se aceptan, 73 bytes se rechazan con «La contraseña es demasiado larga.»; vacía → «La contraseña es obligatoria.». No se recortan los espacios de la contraseña.
- CA8. Repite la contraseña: obligatoria; si no coincide exactamente → «Las contraseñas no coinciden.» (solo se valida en la web).

*Comportamiento*
- CA9. Al pulsar «Enviar enlace» con un email válido, el botón pasa a «Enviando…» y se deshabilita; al responder la API con 204 se muestra el texto de confirmación de CA16 tanto si el email existe como si no.
- CA10. El email de recuperación usa la plantilla `supabase/templates/recuperar-contrasena.html` (asunto «Cambia tu contraseña de Sportsplace», botón «Cambiar contraseña») y enlaza a `{{ .SiteURL }}/restablecer-contrasena?token_hash={{ .TokenHash }}&type=recovery`.
- CA11. El enlace caduca a los 3600 s (configuración de Supabase *Email OTP Expiration* = 3600). Un enlace usado a los 59 min funciona; uno usado a los 61 min responde `ENLACE_INVALIDO`.
- CA12. El enlace solo sirve una vez: tras un cambio correcto, el mismo enlace responde `400 ENLACE_INVALIDO`.
- CA13. Si se piden dos enlaces seguidos, solo funciona el último; el primero responde `ENLACE_INVALIDO`.
- CA14. Tras cambiar la contraseña, la anterior deja de servir (login → `401 CREDENCIALES_INCORRECTAS`) y todas las sesiones abiertas de esa cuenta se cierran (sus `refresh_token` dan `401 NO_AUTENTICADO`).
- CA15. Si la cuenta tenía el email sin confirmar, cambiar la contraseña no lo confirma: el login posterior sigue dando `403 EMAIL_NO_CONFIRMADO`.

*Mensajes*
- CA16. Confirmación del envío: «Si hay una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña. Caduca en 1 hora.».
- CA17. `429` en cualquiera de los dos formularios: «Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.» en aviso rojo.
- CA18. Red caída, 500 o 503: «No se ha podido completar la acción. Inténtalo de nuevo.»; los campos conservan su valor.

*API*
- CA19. `POST /api/auth/recuperar-contrasena` (pública), cuerpo `{ "email": "…" }` → `204` sin cuerpo, exista o no la cuenta. Errores: `400 DATOS_INVALIDOS` con `details.email`; `400 JSON_INVALIDO`; `429 DEMASIADOS_INTENTOS`; `503 AUTH_NO_DISPONIBLE`.
- CA20. `POST /api/auth/restablecer-contrasena` (pública), cuerpo `{ "token_hash": "…", "password": "…" }` → `204`. El servidor hace `verifyOtp({ type: 'recovery', token_hash })`, cambia la contraseña con ese usuario y cierra todas sus sesiones (`signOut` con `scope: 'global'`). Errores: `400 DATOS_INVALIDOS` (`details.token_hash` «Falta el token del enlace.» o `details.password` con los mensajes de CA7); `400 ENLACE_INVALIDO` «El enlace para cambiar la contraseña no es válido o ha caducado.»; `429 DEMASIADOS_INTENTOS`; `503 AUTH_NO_DISPONIBLE`.
- CA21. Las dos respuestas llevan `Cache-Control: no-store`; ninguna devuelve sesión.

*Datos*
- CA22. No se crea ninguna tabla ni columna: la contraseña la guarda Supabase Auth con hash (NFR-03). La tabla `centros` no cambia.

*Permisos y seguridad*
- CA23. La respuesta de `recuperar-contrasena` es idéntica (código, cuerpo y cabeceras) para un email registrado, uno no registrado y uno sin confirmar.
- CA24. El `token_hash` no se guarda en logs del servidor.

*Casos límite*
- CA25. Email con mayúsculas y espacios (`  Piscina@ClubNatacio.CAT `) se normaliza y el email llega a la cuenta `piscina@clubnatacio.cat`.
- CA26. Elegir como nueva la misma contraseña que la anterior se acepta (`204`).

**Flujos e2e**
- E2E-1 (camino feliz). Cuenta confirmada `piscina@clubnatacio.cat` / `Antigua2025`. 1) `/entrar` → «¿Has olvidado la contraseña?». 2) Email `piscina@clubnatacio.cat` → «Enviar enlace» → texto CA16. 3) Abrir el enlace del email (Inbucket/Mailpit local). 4) Escribir `Natacio2026!` dos veces → «Guardar contraseña» → `/entrar` con aviso verde. 5) Entrar con `Natacio2026!` → `/panel`. 6) Entrar con `Antigua2025` → «Email o contraseña incorrectos.».
- E2E-2 (email no registrado). Pedir enlace para `nadie@ejemplo.com` → mismo texto CA16; no se envía ningún email.
- E2E-3 (enlace reutilizado). Repetir E2E-1 pasos 1-4 y volver a abrir el mismo enlace → escribir `Otra2026!!` → variante «Enlace no válido»; «Pedir otro enlace» → `/recuperar-contrasena`.
- E2E-4 (validación). En `/restablecer-contrasena` con enlace válido: `abc` / `abc` → «La contraseña debe tener al menos 8 caracteres.»; `Natacio2026!` / `Natacio2026?` → «Las contraseñas no coinciden.»; no se llama a la API.
- E2E-5 (sesiones cerradas). Con la sesión abierta en el navegador A, completar el cambio en el navegador B → en A, la siguiente renovación de token devuelve 401 y A acaba en `/entrar`.

**Tareas**
- T04-1 · Configuración: plantilla `supabase/templates/recuperar-contrasena.html`, *Reset password* en Supabase y caducidad de 3600 s; documentarlo en `docs/api-contrato.md`.
- T04-2 · Backend: `POST /api/auth/recuperar-contrasena` y `POST /api/auth/restablecer-contrasena` con validación compartida de email y contraseña.
- T04-3 · Frontend: enlace en `/entrar`, páginas `/recuperar-contrasena` y `/restablecer-contrasena`, aviso en `/entrar`.
- T04-4 · QA: automatizar E2E-1 a E2E-5 y los CA de la API.

**Decisiones pendientes**
- ¿Entrar automáticamente tras cambiar la contraseña? Propuesta: no; volver a `/entrar` (CA5).

---

## (2) US-06 · Quiero ver un catálogo público limitado sin registrarme

**Épica:** E01 · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-12, US-21 (catálogo privado)
**Cambios respecto al backlog original:** «Anuncios de ejemplo» se concreta como los 12 anuncios `activo` más recientes reales, con información limitada (sin centro, sin dirección ni contacto, localidad sí). Se añade la dependencia de US-21, porque reutiliza su tarjeta de anuncio. No hay filtros ni detalle del anuncio para visitantes.

**Historia**
Como visitante que aún no tiene cuenta, quiero ver una muestra del material que se ofrece, para decidir si vale la pena registrar mi centro.
1. En la portada `/` pulso el botón «Ver material disponible» → llego a `/explorar`.
2. Veo hasta 12 tarjetas con foto, título, categoría, deporte, estado, precio o «Donación» y localidad.
3. Pulso una tarjeta → se abre el diálogo «Regístrate para ver más» con el botón «Registrar mi centro» → llego a `/registro`.

**Pantallas para el boceto**
- `/` (existente): se añade el botón secundario «Ver material disponible» junto al botón de registro.
- `/explorar`: «Material disponible». Cabecera pública (logo «Sportsplace» → `/`, «Entrar» → `/entrar`, botón «Registrar mi centro» → `/registro`); título; texto «Una muestra del material que los centros deportivos ofrecen ahora mismo. Regístrate para ver todos los anuncios, contactar y pedir material.»; rejilla de hasta 12 tarjetas (foto principal, título, categoría · deporte, estado del material, precio o «Donación», localidad); al final, bloque con «¿Quieres ver más?» y botón «Registrar mi centro».
- Diálogo «Regístrate para ver más»: texto «Para ver el anuncio completo, hablar con el centro y pedir material, registra tu centro. Es gratis.»; botones «Registrar mi centro» y «Cancelar».

**Criterios de aceptación**

*Navegación*
- CA1. En `/` hay un botón «Ver material disponible» que lleva a `/explorar`.
- CA2. `/explorar` es pública. Si hay sesión iniciada, redirige a `/catalogo` [Depende de US-21].
- CA3. Pulsar una tarjeta abre el diálogo; «Registrar mi centro» lleva a `/registro`; «Cancelar» o Esc lo cierran sin navegar.
- CA4. Los dos botones «Registrar mi centro» de la página llevan a `/registro`; «Entrar» lleva a `/entrar`.

*Comportamiento*
- CA5. Se muestran como máximo 12 anuncios en estado `activo` de centros no eliminados (US-11), ordenados por fecha de publicación descendente.
- CA6. Con 13 anuncios activos, se ven los 12 más recientes; con 3, se ven 3.
- CA7. No hay paginación, búsqueda, filtros ni orden seleccionable.
- CA8. Los anuncios `pausado`, `reservado`, `entregado` y `retirado` no aparecen.
- CA9. Mientras carga: «Cargando…». Si falla: «No se ha podido cargar. » y «Reintentar».
- CA10. Sin anuncios activos: «Todavía no hay material publicado. Registra tu centro y sé el primero en publicar.» y botón «Registrar mi centro».

*Mensajes y formatos*
- CA11. Precio en euros con formato «1.234,50 €»; si `modalidad = donacion`, el texto «Donación» en lugar del precio.
- CA12. Si un anuncio no tiene foto principal accesible, se muestra el marcador gris «Sin foto».

*API*
- CA13. `GET /api/publico/anuncios` (pública, sin `requireAuth`) → `200 { "anuncios": [ { "id", "titulo", "categoria", "deporte", "estado_material", "modalidad", "precio_unitario_centimos", "localidad", "foto_principal_url" } ] }`, máximo 12 elementos.
- CA14. La respuesta no contiene ningún otro campo: ni `centro_id`, ni nombre, email, teléfono, dirección o código postal del centro, ni `descripcion`, ni `unidades_disponibles`.
- CA15. `foto_principal_url` es una URL firmada de Storage válida 1 hora [Depende de US-13].
- CA16. La respuesta lleva `Cache-Control: public, max-age=60`. Errores: `503 BASE_DATOS_NO_DISPONIBLE`, `500 ERROR_INTERNO`, `405 METODO_NO_PERMITIDO` para cualquier método que no sea GET.

*Permisos y seguridad*
- CA17. Un visitante no puede abrir `/anuncios/:id` ni `/centros/:id`: redirigen a `/entrar` (rutas privadas de US-24 y US-10).
- CA18. `GET /api/anuncios/:id` sin token sigue dando `401 NO_AUTENTICADO`.

*Casos límite*
- CA19. Un anuncio que pasa a `pausado` deja de salir en la siguiente carga (como mucho 60 s después por la caché).
- CA20. Un anuncio con título de 80 caracteres se recorta visualmente a 2 líneas con «…»; el título completo está en el atributo `title`.

**Flujos e2e**
- E2E-1 (camino feliz). Base con 13 anuncios activos (A1…A13 publicados en ese orden). 1) Visitante abre `/` → «Ver material disponible». 2) `/explorar` muestra A13…A2 (12 tarjetas), no A1. 3) Pulsar A13 → diálogo → «Registrar mi centro» → `/registro`.
- E2E-2 (datos ocultos). Llamar a `GET /api/publico/anuncios` y comprobar que ningún objeto tiene claves fuera de las de CA13 y que el texto de la respuesta no contiene el email ni el teléfono del centro vendedor.
- E2E-3 (vacío). Base sin anuncios activos (uno `pausado`) → texto de CA10.
- E2E-4 (con sesión). Centro con sesión abre `/explorar` → acaba en `/catalogo`.

**Tareas**
- T06-1 · Backend: `GET /api/publico/anuncios` con la consulta limitada y la proyección cerrada de campos.
- T06-2 · Frontend: botón en `/`, página `/explorar`, diálogo y cabecera pública; reutilizar la tarjeta de US-21 con una variante sin enlace.
- T06-3 · QA: automatizar E2E-1 a E2E-4.

**Decisiones pendientes**
- ¿Anuncios reales o de ejemplo inventados? Propuesta: reales, los 12 más recientes, con la proyección limitada de CA13; si no hay ninguno, el texto de CA10 (no se fabrican anuncios falsos).
- ¿Mostrar la localidad? Propuesta: sí (es pública en el perfil, US-68); nunca la dirección.

---

## (2) US-07 · Quiero editar la descripción y los datos de contacto del perfil de mi centro

**Épica:** E02 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-03
**Cambios respecto al backlog original:** Se concreta qué se edita: nombre, descripción, teléfono, email de contacto y web. El email de acceso (`centros.email`) no se cambia aquí. La ubicación es US-68. El criterio «los cambios se ven en el perfil que consultan los demás» se comprueba con una vista previa propia; la vista para otros centros es US-10.

**Historia**
Como responsable del Club Natació Exemple, quiero describir mi centro y dar un contacto público, para que otros centros sepan quiénes somos y se fíen.
1. En la cabecera privada abro el menú «Club Natació Exemple ▾» → «Mi perfil» → llego a `/perfil`.
2. Veo mis datos actuales y pulso «Editar perfil» → `/perfil/editar`.
3. Escribo la descripción «Club de natación con 2 piscinas de 25 m. Renovamos material cada temporada.», el teléfono `+34 931 234 567`, el email de contacto `material@clubnatacio.cat` y la web `https://clubnatacio.cat`, y pulso «Guardar cambios».
4. Vuelvo a `/perfil` con el aviso verde «Perfil actualizado.» y veo los datos nuevos.

**Pantallas para el boceto**
- Cabecera privada: se añade el menú del centro (nombre del centro ▾) con «Mi perfil» (→ `/perfil`); el resto de entradas las añaden US-08 («Equipo»), US-11 («Ajustes») y US-67 ya tiene «Cerrar sesión».
- `/perfil`: «Mi perfil». Nombre del centro (título); localidad (y zona de US-68); bloque «Sobre nosotros» con la descripción o el texto gris «Todavía no has escrito una descripción.»; bloque «Contacto» con teléfono, email de contacto y web (cada uno o «—»); fecha «En Sportsplace desde dd/mm/aaaa»; botón «Editar perfil».
- `/perfil/editar`: «Editar perfil». Campos en este orden: «Nombre del centro», «Descripción» (área de texto de 6 líneas con contador «n/1000»), «Teléfono de contacto», «Email de contacto», «Web»; botones «Guardar cambios» y «Cancelar» (→ `/perfil` sin guardar).

**Criterios de aceptación**

*Navegación*
- CA1. El menú del centro muestra el `nombre` del centro y contiene «Mi perfil» → `/perfil`.
- CA2. `/perfil` y `/perfil/editar` son privadas: sin sesión redirigen a `/entrar` y, tras entrar, vuelven a la ruta pedida.
- CA3. «Editar perfil» lleva a `/perfil/editar` con los campos rellenados con los valores actuales.
- CA4. «Cancelar» vuelve a `/perfil` sin llamar a la API. Si había cambios sin guardar, primero pide confirmación: título «¿Descartar cambios?», texto «Los cambios que has hecho no se guardarán.», botones «Descartar» y «Cancelar».
- CA5. Tras guardar con éxito: redirige a `/perfil` y aviso verde «Perfil actualizado.».

*Campos y validación* (se recortan espacios antes de validar; un campo opcional vacío se guarda como `null`)
- CA6. Nombre del centro: obligatorio, 1-160 caracteres. Vacío → «El nombre del centro es obligatorio.»; 160 se acepta, 161 → «Como máximo 160 caracteres.».
- CA7. Descripción: opcional, 0-1000 caracteres, admite saltos de línea. 1000 se acepta, 1001 → «Como máximo 1000 caracteres.». El contador muestra «1001/1000» en rojo.
- CA8. Teléfono de contacto: opcional, solo dígitos, espacios y un `+` inicial, entre 9 y 30 caracteres. `931234567` y `+34 931 234 567` se aceptan; `93123456` (8) → «El teléfono no es válido.»; `93-123-45-67` → «El teléfono no es válido.»; 31 caracteres → «Como máximo 30 caracteres.».
- CA9. Email de contacto: opcional, misma regla que el email de US-01 (máx. 254, guardado en minúsculas). `material@clubnatacio` → «El email no es válido.».
- CA10. Web: opcional, máx. 255 caracteres, debe empezar por `http://` o `https://` y tener un dominio con punto. `https://clubnatacio.cat` se acepta; `clubnatacio.cat` → «La web debe empezar por http:// o https://.»; `https://localhost` → «La web no es válida.»; 256 caracteres → «Como máximo 255 caracteres.».
- CA11. La web valida exactamente las mismas reglas que la API y muestra los `details` de la API bajo cada campo si la API los devuelve.

*Comportamiento*
- CA12. «Guardar cambios» pasa a «Guardando…» y se deshabilita durante el envío.
- CA13. Si no hay ningún cambio, «Guardar cambios» está deshabilitado.
- CA14. El nuevo nombre aparece en el menú del centro sin recargar la página.
- CA15. La descripción se muestra respetando los saltos de línea y como texto plano (`<b>hola</b>` se ve literal, no en negrita).

*Mensajes*
- CA16. Red caída, 500 o 503: «No se ha podido completar la acción. Inténtalo de nuevo.» y los campos conservan lo escrito.

*API*
- CA17. `GET /api/centros/mio` (`requireAuth`) → `200 { "centro": { "id", "nombre", "email", "localidad", "direccion", "codigo_postal", "telefono", "descripcion", "email_contacto", "web", "creado_en" } }` del centro al que pertenece el usuario. `401 NO_AUTENTICADO`.
- CA18. `PATCH /api/centros/mio` (`requireAuth` + `requireEmailConfirmado`), cuerpo con cualquiera de `nombre`, `descripcion`, `telefono`, `email_contacto`, `web` → `200 { "centro": … }` actualizado. Campos no enviados no cambian; enviar `null` o `""` borra un campo opcional.
- CA19. Errores de `PATCH`: `400 DATOS_INVALIDOS` con `details` por campo y los mensajes de CA6-CA10; `400` si llega un campo desconocido o no editable (`email`, `usuario_id`, `localidad`…) con `details.<campo>` «Este campo no se puede modificar.»; `400 JSON_INVALIDO`; `401`; `403 EMAIL_NO_CONFIRMADO`; `503 BASE_DATOS_NO_DISPONIBLE`.

*Datos*
- CA20. Migración nueva que añade a `centros`: `descripcion TEXT NULL CHECK (char_length(descripcion) <= 1000)`, `email_contacto VARCHAR(254) NULL`, `web VARCHAR(255) NULL`, `actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()`. Se reutiliza la columna existente `telefono`.
- CA21. Cada `PATCH` correcto actualiza `actualizado_en`.

*Permisos y seguridad*
- CA22. Solo se puede editar el centro propio: no existe ruta para editar otro centro por id.
- CA23. Con el email sin confirmar, `/perfil` se ve pero «Guardar cambios» devuelve `403` y la web muestra el aviso de US-02.

*Casos límite*
- CA24. Descripción solo con espacios → se guarda `null` y `/perfil` muestra «Todavía no has escrito una descripción.».
- CA25. Un emoji cuenta como 1 carácter en todos los límites (se cuenta por puntos de código, en web y API).

**Flujos e2e**
- E2E-1 (camino feliz). Centro «Club Natació Exemple» confirmado. 1) Menú → «Mi perfil». 2) «Editar perfil». 3) Datos de la historia → «Guardar cambios». 4) `/perfil` muestra los valores; en BD `centros.descripcion`, `telefono`, `email_contacto = 'material@clubnatacio.cat'`, `web` guardados y `actualizado_en` actualizado.
- E2E-2 (límites). Descripción de 1001 caracteres → error de CA7 y no se guarda; con 1000 → se guarda.
- E2E-3 (formatos). Teléfono `93-123` y web `clubnatacio.cat` → los dos errores bajo sus campos; BD sin cambios.
- E2E-4 (borrar un opcional). Vaciar «Web» y guardar → `centros.web IS NULL` y en `/perfil` «—».
- E2E-5 (cancelar con cambios). Cambiar el nombre → «Cancelar» → «Descartar» → `/perfil` con el nombre antiguo.

**Tareas**
- T07-1 · Base de datos: migración de `descripcion`, `email_contacto`, `web`, `actualizado_en`.
- T07-2 · Backend: helper `centroDelUsuario(usuario_id)` (en este sprint, por `centros.usuario_id`; US-84 lo amplía a miembros), `GET` y `PATCH /api/centros/mio` con validación.
- T07-3 · Frontend: menú del centro en la cabecera, `/perfil`, `/perfil/editar`.
- T07-4 · QA: automatizar E2E-1 a E2E-5 y casos de CA6-CA10.

**Decisiones pendientes**
- ¿Se puede cambiar el nombre del centro? Propuesta: sí, sin revisión (no hay administrador).
- ¿Teléfono y email de contacto visibles para todos los centros? Propuesta: sí, para centros con sesión (US-10); nunca para visitantes.

---

## (2) US-68 · Quiero indicar dónde está mi centro

**Épica:** E02 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-07
**Cambios respecto al backlog original:** La ubicación se fija con dirección, código postal y localidad (columnas ya existentes). Las coordenadas salen del código postal mediante una tabla local de códigos postales, sin servicios externos. Los demás ven solo la «zona» (localidad y provincia), nunca la dirección. El criterio «se usa en todos mis anuncios» queda como dato disponible para US-23 y US-27 [Depende de US-23, US-27]. Se cambia la dependencia a US-07 porque comparte las pantallas de perfil.

**Historia**
Como responsable del centro, quiero indicar la dirección de mi centro, para que los compradores sepan en qué zona está el material.
1. En `/perfil` veo el bloque «Ubicación» y pulso «Editar ubicación» → `/perfil/ubicacion`.
2. Escribo dirección `Carrer de la Piscina 12`, código postal `08025` y localidad `Barcelona` y pulso «Guardar ubicación».
3. Vuelvo a `/perfil` con el aviso verde «Ubicación guardada.» y veo «Zona: Barcelona (Barcelona)» y «Dirección (solo la ves tú): Carrer de la Piscina 12, 08025 Barcelona».

**Pantallas para el boceto**
- `/perfil` (US-07): bloque «Ubicación» con «Zona: <localidad> (<provincia>)», «Dirección (solo la ves tú): …» y botón «Editar ubicación». Si falta el código postal, banda amarilla «Indica tu código postal para que los demás centros sepan a qué distancia estás.» con el botón «Indicar ubicación».
- `/perfil/ubicacion`: «Ubicación del centro». Texto «Los demás centros solo verán tu localidad y tu provincia.»; campos «Dirección», «Código postal», «Localidad»; botones «Guardar ubicación» y «Cancelar» (→ `/perfil`).

**Criterios de aceptación**

*Navegación*
- CA1. «Editar ubicación» e «Indicar ubicación» llevan a `/perfil/ubicacion` con los valores actuales; la ruta es privada.
- CA2. «Cancelar» vuelve a `/perfil` sin guardar. Tras guardar: `/perfil` y aviso verde «Ubicación guardada.».

*Campos y validación* (espacios recortados)
- CA3. Dirección: opcional, 0-255 caracteres. 255 se acepta; 256 → «Como máximo 255 caracteres.».
- CA4. Código postal: obligatorio en este formulario, exactamente 5 dígitos entre `01000` y `52999`. Vacío → «El código postal es obligatorio.»; `0802` o `080251` o `08O25` → «El código postal debe tener 5 cifras.»; `00999` o `53000` → «El código postal no es de España.»; `52999` y `01000` se aceptan si existen en la tabla.
- CA5. Si el código postal tiene un formato válido pero no está en la tabla `codigos_postales` → «No conocemos este código postal. Revísalo.» (`CODIGO_POSTAL_DESCONOCIDO`).
- CA6. Localidad: obligatoria, 1-120 caracteres. Vacía → «La localidad es obligatoria.»; 121 → «Como máximo 120 caracteres.».

*Comportamiento*
- CA7. Al guardar, el servidor busca el código postal en `codigos_postales` y copia `latitud`, `longitud` y `provincia` en el centro.
- CA8. La localidad la escribe el usuario (no se autocompleta) y la provincia sale del código postal.
- CA9. «Guardar ubicación» pasa a «Guardando…» durante el envío.
- CA10. Los centros que se registraron sin código postal (Sprint 0) muestran la banda amarilla de `/perfil` hasta que lo indiquen.

*API*
- CA11. `PUT /api/centros/mio/ubicacion` (`requireAuth` + `requireEmailConfirmado`), cuerpo `{ "direccion", "codigo_postal", "localidad" }` → `200 { "centro": … }` con `provincia`, `latitud`, `longitud`.
- CA12. Errores: `400 DATOS_INVALIDOS` con `details` y mensajes de CA3-CA6; `400 CODIGO_POSTAL_DESCONOCIDO` con `details.codigo_postal`; `401`; `403 EMAIL_NO_CONFIRMADO`; `503`.
- CA13. `GET /api/centros/mio` (US-07) incluye `provincia`, `latitud` y `longitud`.
- CA14. Ninguna respuesta sobre otro centro incluye `direccion`, `codigo_postal`, `latitud` ni `longitud` exactas (ver US-10).

*Datos*
- CA15. Migración nueva: tabla `codigos_postales (codigo_postal CHAR(5) PK, provincia VARCHAR(60) NOT NULL, latitud NUMERIC(8,5) NOT NULL, longitud NUMERIC(8,5) NOT NULL)` cargada con un dataset abierto de códigos postales españoles (fichero de semilla en el repositorio, con su licencia citada).
- CA16. Migración nueva en `centros`: `provincia VARCHAR(60) NULL`, `latitud NUMERIC(8,5) NULL`, `longitud NUMERIC(8,5) NULL`. Las columnas `direccion`, `codigo_postal` y `localidad` existentes se reutilizan.
- CA17. Hay una sola ubicación por centro (US-09 descartada).

*Casos límite*
- CA18. Cambiar el código postal de `08025` a `17001` actualiza provincia a «Girona» y las coordenadas en la misma petición.
- CA19. Borrar la dirección (vacía) y guardar → `direccion = NULL`; la zona sigue igual.

**Flujos e2e**
- E2E-1 (camino feliz). Datos de la historia → en BD `codigo_postal = '08025'`, `provincia = 'Barcelona'`, `latitud`/`longitud` no nulas; `/perfil` muestra la zona.
- E2E-2 (formato). `0802` → error de CA4; BD sin cambios.
- E2E-3 (desconocido). `52998` sin fila en la tabla → «No conocemos este código postal. Revísalo.».
- E2E-4 (centro antiguo). Centro de Sprint 0 sin código postal → banda amarilla → «Indicar ubicación» → guardar `17001`, `Girona` → la banda desaparece.

**Tareas**
- T68-1 · Base de datos: tabla y semilla `codigos_postales`; columnas `provincia`, `latitud`, `longitud` en `centros`.
- T68-2 · Backend: `PUT /api/centros/mio/ubicacion`.
- T68-3 · Frontend: bloque «Ubicación» y banda en `/perfil`, página `/perfil/ubicacion`.
- T68-4 · QA: automatizar E2E-1 a E2E-4.

**Decisiones pendientes**
- Fuente de coordenadas. Propuesta: dataset abierto de códigos postales (p. ej. GeoNames ES, CC BY 4.0) cargado como semilla; precisión de código postal, suficiente para distancias aproximadas (US-23).
- ¿Pedir el código postal obligatorio en el registro? Propuesta: no se toca US-01 (Sprint 0); se usa la banda amarilla.

---

## (2) US-08 · Quiero invitar a otra persona de mi centro a gestionar el material

**Épica:** E02 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 5 · **Depende de:** US-07
**Cambios respecto al backlog original:** Dividida. Esta historia cubre solo enviar la invitación y ver el equipo (miembros e invitaciones pendientes). Aceptar la invitación y gestionar el centro con un usuario propio pasa a la nueva **US-84**. Cancelar invitaciones y retirar accesos están en US-69. Sin roles de gestión, pero existe la figura de «titular» (quien registró el centro) por las reglas de US-69 y US-11.

**Historia**
Como responsable del Club Natació Exemple, quiero invitar por email a Marta, la coordinadora de material, para que gestione anuncios y pedidos sin usar mi contraseña.
1. Menú del centro → «Equipo» → `/equipo`.
2. Veo la lista «Personas con acceso» (yo, como titular) y pulso «Invitar a una persona».
3. En el diálogo escribo `marta.material@gmail.com` y pulso «Enviar invitación».
4. Aviso verde «Invitación enviada a marta.material@gmail.com.»; en «Invitaciones pendientes» aparece Marta con «Caduca el dd/mm/aaaa».

**Pantallas para el boceto**
- Cabecera: el menú del centro añade «Equipo» (→ `/equipo`).
- `/equipo`: «Equipo del centro». Texto «Las personas del equipo pueden publicar y gestionar anuncios, pedidos y mensajes del centro con su propio usuario.»; botón «Invitar a una persona»; sección «Personas con acceso»: tabla con Email, «Titular» o «Miembro», «Desde dd/mm/aaaa»; sección «Invitaciones pendientes»: tabla con Email, «Enviada el dd/mm/aaaa», «Caduca el dd/mm/aaaa» (vacía: «No hay invitaciones pendientes.»).
- Diálogo «Invitar a una persona»: campo «Email de la persona»; texto «Le enviaremos un enlace válido durante 7 días.»; botones «Enviar invitación» y «Cancelar».

**Criterios de aceptación**

*Navegación*
- CA1. El menú del centro contiene «Equipo» → `/equipo` (privada).
- CA2. «Invitar a una persona» abre el diálogo; «Cancelar» o Esc lo cierran.

*Campos y validación*
- CA3. Email de la persona: obligatorio, regla de US-01 (máx. 254, minúsculas). Vacío → «El email es obligatorio.»; `marta@gmail` → «El email no es válido.».
- CA4. Si el email ya es miembro de este centro → «Esta persona ya tiene acceso al centro.» (`409 YA_ES_MIEMBRO`).
- CA5. Si ya hay una invitación pendiente no caducada para ese email en este centro → «Ya hay una invitación pendiente para este email.» (`409 INVITACION_YA_PENDIENTE`).
- CA6. Si el email pertenece a una cuenta que ya es titular o miembro de otro centro → «Este email ya gestiona otro centro.» (`409 EMAIL_DE_OTRO_CENTRO`).

*Comportamiento*
- CA7. Al enviar, el servidor crea una invitación con un token aleatorio de 32 bytes (se guarda solo su hash SHA-256) y caducidad de 7 días exactos desde la creación.
- CA8. Se envía el email «Te han invitado a gestionar <nombre del centro> en Sportsplace» con el botón «Aceptar invitación» que enlaza a `/invitacion?token=<token>` [la aceptación es US-84].
- CA9. Máximo 10 invitaciones pendientes por centro: la 10.ª se acepta, la 11.ª → `409 DEMASIADAS_INVITACIONES` «Tienes 10 invitaciones pendientes. Espera a que las acepten o cancela alguna.».
- CA10. Máximo 5 personas con acceso por centro (titular incluido): con 5, el botón «Invitar a una persona» está deshabilitado con el texto «Has llegado al máximo de 5 personas.» y la API responde `409 EQUIPO_COMPLETO`.
- CA11. Las invitaciones caducadas no aparecen en «Invitaciones pendientes» ni cuentan para el límite.
- CA12. «Enviar invitación» pasa a «Enviando…» durante el envío.

*API*
- CA13. `GET /api/centros/mio/equipo` (`requireAuth`) → `200 { "miembros": [ { "usuario_id", "email", "rol": "titular"|"miembro", "desde" } ], "invitaciones": [ { "id", "email", "creada_en", "caduca_en" } ] }`. Miembros ordenados titular primero y luego por `desde`.
- CA14. `POST /api/centros/mio/invitaciones` (`requireAuth` + `requireEmailConfirmado`), cuerpo `{ "email" }` → `201 { "invitacion": { "id", "email", "creada_en", "caduca_en" } }`. Errores: `400 DATOS_INVALIDOS`, `409 YA_ES_MIEMBRO`, `409 INVITACION_YA_PENDIENTE`, `409 EMAIL_DE_OTRO_CENTRO`, `409 DEMASIADAS_INVITACIONES`, `409 EQUIPO_COMPLETO`, `403 SIN_PERMISO`, `429 DEMASIADOS_INTENTOS`, `503`.
- CA15. El token nunca aparece en ninguna respuesta de la API.

*Datos*
- CA16. Migración nueva: tabla `miembros_centro (centro_id FK centros ON DELETE CASCADE, usuario_id UUID UNIQUE FK auth.users ON DELETE CASCADE, rol TEXT CHECK (rol IN ('titular','miembro')), creado_en TIMESTAMPTZ DEFAULT now(), PK (centro_id, usuario_id))`. La migración inserta una fila `titular` por cada centro existente con su `centros.usuario_id`; el registro de US-01 no se cambia y el servidor añade la fila titular al confirmar el email o al crear el centro (trigger `AFTER UPDATE OF usuario_id`).
- CA17. Migración nueva: tabla `invitaciones_centro (id UUID PK, centro_id FK ON DELETE CASCADE, email VARCHAR(254), token_hash CHAR(64) UNIQUE, invitada_por UUID, creada_en, caduca_en, aceptada_en NULL, cancelada_en NULL)`.

*Permisos y seguridad*
- CA18. Solo el titular puede invitar: un miembro ve `/equipo` sin el botón «Invitar a una persona» y la API le responde `403 SIN_PERMISO` «Solo el titular del centro puede gestionar el equipo.».
- CA19. Un usuario solo ve el equipo de su propio centro.

*Casos límite*
- CA20. Invitar `Marta.Material@Gmail.com ` guarda `marta.material@gmail.com`.
- CA21. Invitarse a uno mismo → `409 YA_ES_MIEMBRO`.
- CA22. Reinvitar a un email cuya invitación caducó → se crea una nueva (`201`).

**Flujos e2e**
- E2E-1 (camino feliz). Titular → `/equipo` → invitar `marta.material@gmail.com` → aviso verde; fila en «Invitaciones pendientes» con caducidad hoy + 7 días; email recibido con el enlace; en BD `invitaciones_centro` con `token_hash` y sin token en claro.
- E2E-2 (duplicada). Repetir la invitación → «Ya hay una invitación pendiente para este email.».
- E2E-3 (miembro sin permiso). Marta (ya miembro, US-84) abre `/equipo` → no ve el botón; `POST` directo → `403 SIN_PERMISO`.
- E2E-4 (equipo completo). Centro con 5 miembros → botón deshabilitado; `POST` → `409 EQUIPO_COMPLETO`.
- E2E-5 (otro centro). Invitar el email del titular de otro centro → «Este email ya gestiona otro centro.».

**Tareas**
- T08-1 · Base de datos: `miembros_centro` (con carga de titulares) e `invitaciones_centro`.
- T08-2 · Backend: `GET /api/centros/mio/equipo`, `POST /api/centros/mio/invitaciones`, envío del email (plantilla `supabase/templates/invitacion-centro.html` enviada por el SMTP del proyecto).
- T08-3 · Frontend: entrada «Equipo», página `/equipo` y diálogo.
- T08-4 · QA: automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- ¿Puede invitar cualquier miembro o solo el titular? Propuesta: solo el titular (CA18); todos gestionan anuncios y pedidos por igual.
- Límites de equipo. Propuesta: 5 personas y 10 invitaciones pendientes.
- ¿Una persona en varios centros? Propuesta: no (CA6); simplifica la sesión, que ya va ligada a un centro.
- Envío del email de invitación: Supabase solo manda sus plantillas de Auth. Propuesta: usar `auth.admin.inviteUserByEmail` no encaja (crea la cuenta); se necesita el SMTP propio ya previsto en el contrato para enviarlo desde el servidor (nodemailer).

---

## (3) US-84 · Quiero aceptar la invitación de un centro y gestionarlo con mi propio usuario

**Épica:** E02 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-08
**Cambios respecto al backlog original:** Historia nueva. Sale de dividir US-08 (criterio «La persona invitada entra con su propio usuario y gestiona los anuncios y pedidos de mi centro»). Los 2 puntos de US-08 se mantienen y esta suma 3, porque incluye que todo el backend resuelva el centro por pertenencia y no solo por `centros.usuario_id`.

**Historia**
Como persona invitada a gestionar el material de un centro, quiero aceptar la invitación creando mi propia contraseña, para gestionar el material del club sin usar la cuenta del titular.
1. En el email «Te han invitado a gestionar Club Natació Exemple en Sportsplace» pulso «Aceptar invitación» → `/invitacion?token=…`.
2. Veo «Club Natació Exemple te invita a gestionar su material en Sportsplace», mi email `marta.material@gmail.com` (no editable), los campos de contraseña y la casilla de la política de privacidad.
3. Escribo `Material2026` dos veces, marco la casilla y pulso «Aceptar y crear mi cuenta» → llego a `/panel` con la sesión iniciada y el aviso «Ya formas parte de Club Natació Exemple.».
4. Otro día entro desde `/entrar` con mi email y contraseña y el menú muestra «Club Natació Exemple ▾».

**Pantallas para el boceto**
- `/invitacion`: «Invitación». Título «<Centro> te invita a gestionar su material en Sportsplace»; texto con el email invitado; campos «Contraseña (mínimo 8 caracteres)» y «Repite la contraseña»; casilla «He leído y acepto la política de privacidad» con enlace; botón «Aceptar y crear mi cuenta».
- Variante «Enlace no válido»: texto «La invitación no es válida, ya se ha usado, se ha cancelado o ha caducado. Pide al centro que te invite de nuevo.» y botón «Ir a la portada» (→ `/`).

**Criterios de aceptación**

*Navegación*
- CA1. `/invitacion` es pública. Al cargar, llama a `GET /api/invitaciones/{token}`; mientras, «Cargando…».
- CA2. Token válido → formulario; token inexistente, usado, cancelado o caducado → variante «Enlace no válido».
- CA3. Si había otra sesión abierta en el navegador, al aceptar se sustituye por la de la persona invitada.
- CA4. Tras aceptar → `/panel` con aviso verde «Ya formas parte de <nombre del centro>.».

*Campos y validación*
- CA5. Contraseña: reglas y mensajes de US-01 (8 caracteres a 72 bytes; `abcdefg` rechazada, `abcdefgh` aceptada).
- CA6. Repite la contraseña: «Las contraseñas no coinciden.» si difiere.
- CA7. Casilla de privacidad obligatoria: «Debes aceptar la política de privacidad.».

*Comportamiento*
- CA8. Al aceptar, el servidor en una sola transacción: crea la cuenta en Supabase Auth con el email de la invitación y `email_confirm: true` (abrir el enlace prueba que el email es suyo), inserta `miembros_centro (rol 'miembro')`, marca `aceptada_en` y devuelve sesión.
- CA9. Si el email de la invitación ya tiene cuenta sin centro (p. ej. un miembro retirado en US-69), no se crea cuenta: el formulario pide «Tu contraseña actual» en lugar de las dos contraseñas y el servidor la comprueba (`401 CREDENCIALES_INCORRECTAS` si no coincide).
- CA10. Si mientras tanto el equipo llegó a 5 personas → `409 EQUIPO_COMPLETO` «El equipo de este centro está completo.».
- CA11. Un miembro hace todo lo que hace el titular en anuncios, pedidos, mensajes, valoraciones y perfil (US-07, US-68), con el centro como autor; no puede invitar, retirar accesos (US-69) ni eliminar la cuenta (US-11).
- CA12. Al entrar con `/api/auth/login`, `GET /api/auth/me` devuelve además `centro: { id, nombre }` y `rol`.

*API*
- CA13. `GET /api/invitaciones/{token}` (pública) → `200 { "centro": { "nombre" }, "email", "cuenta_existente": bool }`. Inválida → `400 INVITACION_INVALIDA` «La invitación no es válida o ha caducado.».
- CA14. `POST /api/invitaciones/{token}/aceptar` (pública), cuerpo `{ "password", "acepta_politica_privacidad": true }` → `200 { "usuario", "sesion", "centro": { "id", "nombre" } }`. Errores: `400 DATOS_INVALIDOS`, `400 INVITACION_INVALIDA`, `401 CREDENCIALES_INCORRECTAS` (CA9), `409 EQUIPO_COMPLETO`, `409 EMAIL_DE_OTRO_CENTRO`, `429`, `503`.
- CA15. Middleware nuevo `requireCentro` (después de `requireAuth`) que busca la fila de `miembros_centro` del usuario y deja `request.centro = { id, rol }`. Sin fila → `403 SIN_CENTRO` «Tu usuario no tiene acceso a ningún centro.». Todas las rutas de centro (`/api/centros/mio/*`, anuncios, pedidos…) lo usan en lugar de `centros.usuario_id`.

*Datos*
- CA16. No se guarda la contraseña fuera de Supabase Auth. `invitaciones_centro.aceptada_en` se rellena y el token deja de servir.
- CA17. `centros.usuario_id` sigue apuntando al titular (Sprint 0 sin cambios).

*Permisos y seguridad*
- CA18. El token se compara por su hash SHA-256; una invitación no se puede aceptar dos veces (`400 INVITACION_INVALIDA` en el segundo intento, también con dos peticiones simultáneas).
- CA19. Si el titular cancela la invitación (US-69) antes de aceptarla → `INVITACION_INVALIDA`.

*Casos límite*
- CA20. Invitación aceptada a los 6 días y 23 h → funciona; a los 7 días y 1 min → «Enlace no válido».
- CA21. Una persona sin centro (retirada) que entra en `/entrar` ve la página `/sin-centro` con «Ya no tienes acceso a ningún centro. Si es un error, pide al centro que te invite de nuevo.» y el botón «Cerrar sesión».

**Flujos e2e**
- E2E-1 (camino feliz). Invitación de US-08 E2E-1. 1) Abrir el enlace. 2) `Material2026` ×2, casilla → aceptar → `/panel`. 3) BD: usuario en `auth.users` con email confirmado, fila `miembros_centro` rol `miembro`, `aceptada_en` no nulo. 4) Marta publica un anuncio [Depende de US-12] → el anuncio pertenece al centro.
- E2E-2 (reutilizar). Abrir el mismo enlace otra vez → «Enlace no válido».
- E2E-3 (caducada). Invitación con `caduca_en` en el pasado → «Enlace no válido».
- E2E-4 (sin privacidad). No marcar la casilla → error de CA7; no se crea cuenta.
- E2E-5 (permisos). Marta llama a `POST /api/centros/mio/invitaciones` → `403 SIN_PERMISO`.

**Tareas**
- T84-1 · Backend: middleware `requireCentro` y migrar `centroDelUsuario` de US-07 a `miembros_centro`; `/api/auth/me` con `centro` y `rol`.
- T84-2 · Backend: `GET /api/invitaciones/{token}` y `POST …/aceptar` con transacción.
- T84-3 · Frontend: página `/invitacion`, `/sin-centro`, guardar `centro` y `rol` en el estado de sesión.
- T84-4 · QA: automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- ¿Puede un miembro editar el perfil del centro? Propuesta: sí (CA11).

---

## (2) US-69 · Quiero retirar el acceso a una persona de mi centro

**Épica:** E02 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-84
**Cambios respecto al backlog original:** «Ver las personas con acceso» ya lo da `/equipo` (US-08); aquí se añaden las acciones «Retirar acceso» y «Cancelar invitación». Dependencia cambiada de US-08 a US-84 (hace falta que existan miembros).

**Historia**
Como titular del Club Natació Exemple, quiero quitar el acceso a Marta, que ha dejado el club, para que ya no pueda gestionar nuestro material.
1. Menú → «Equipo» → `/equipo`.
2. En la fila de `marta.material@gmail.com` pulso «Retirar acceso».
3. Diálogo «¿Retirar el acceso a marta.material@gmail.com?» → «Retirar acceso».
4. Aviso verde «Acceso retirado.»; Marta desaparece de la lista. Si Marta tenía la web abierta, su siguiente acción la lleva a `/sin-centro`.

**Pantallas para el boceto**
- `/equipo` (US-08): en «Personas con acceso», columna final con botón «Retirar acceso» en cada fila de rol «Miembro» (no en la del titular); en «Invitaciones pendientes», botón «Cancelar invitación».
- Diálogo de retirar: título «¿Retirar el acceso a <email>?», texto «Dejará de poder entrar a gestionar el centro. Los anuncios y pedidos que haya creado se quedan en el centro.», botones «Retirar acceso» (rojo) y «Cancelar».
- Diálogo de cancelar invitación: título «¿Cancelar la invitación a <email>?», texto «El enlace que le enviamos dejará de funcionar.», botones «Cancelar invitación» y «Volver».

**Criterios de aceptación**

*Comportamiento*
- CA1. Solo el titular ve los botones «Retirar acceso» y «Cancelar invitación».
- CA2. La fila del titular nunca tiene «Retirar acceso».
- CA3. Al confirmar, se borra la fila de `miembros_centro` y se cierran todas las sesiones de esa persona (`auth.admin.signOut(usuario, 'global')`); su cuenta de Supabase no se borra.
- CA4. Desde ese momento, cualquier petición suya a una ruta con `requireCentro` responde `403 SIN_CENTRO` y la web la lleva a `/sin-centro` (US-84 CA21); un token aún vigente no sirve para gestionar el centro.
- CA5. Los anuncios, pedidos y mensajes creados por esa persona siguen perteneciendo al centro sin cambios.
- CA6. Cancelar una invitación rellena `cancelada_en`; el enlace pasa a responder `INVITACION_INVALIDA` y la fila desaparece de «Invitaciones pendientes».
- CA7. La persona retirada puede volver a ser invitada (US-08) y aceptar con su contraseña actual (US-84 CA9).
- CA8. Durante la petición, el botón del diálogo pasa a «Retirando…» / «Cancelando…».

*Mensajes*
- CA9. Éxito: «Acceso retirado.» / «Invitación cancelada.». Error de red/500/503: mensaje común de formularios en aviso rojo.

*API*
- CA10. `DELETE /api/centros/mio/miembros/{usuario_id}` (`requireAuth` + `requireEmailConfirmado` + `requireCentro`) → `204`. Errores: `403 SIN_PERMISO` si quien llama no es titular; `409 NO_SE_PUEDE_RETIRAR_TITULAR` «No puedes retirar el acceso al titular del centro.» si el id es el titular; `404 NO_ENCONTRADO` si no es miembro de este centro (también si es de otro centro); `401`; `503`.
- CA11. `DELETE /api/centros/mio/invitaciones/{id}` → `204`. Errores: `403 SIN_PERMISO`; `404 NO_ENCONTRADO` si no existe, ya está aceptada, cancelada o es de otro centro.

*Permisos y seguridad*
- CA12. Un miembro que llama a cualquiera de los dos `DELETE` recibe `403 SIN_PERMISO`.
- CA13. El titular no puede retirarse a sí mismo; para irse debe eliminar la cuenta (US-11).

*Casos límite*
- CA14. Dos clics seguidos sobre «Retirar acceso» del mismo miembro: la primera petición da 204 y la segunda 404; la web muestra solo «Acceso retirado.».
- CA15. Retirar al único miembro deja la lista con solo el titular.

**Flujos e2e**
- E2E-1 (camino feliz). Marta miembro con sesión abierta en el navegador B. Titular en A retira a Marta → aviso verde. En B, Marta pulsa «Mis anuncios» → `/sin-centro`. BD: sin fila en `miembros_centro`; usuario sigue en `auth.users`.
- E2E-2 (titular protegido). `DELETE` con el id del titular → `409 NO_SE_PUEDE_RETIRAR_TITULAR`.
- E2E-3 (miembro sin permiso). Marta intenta retirar a otro miembro → `403 SIN_PERMISO`.
- E2E-4 (cancelar invitación). Cancelar la invitación de `jordi@ejemplo.com` → abrir su enlace → «Enlace no válido».
- E2E-5 (otro centro). Titular A hace `DELETE` con un miembro del centro B → `404 NO_ENCONTRADO`.

**Tareas**
- T69-1 · Backend: los dos `DELETE` y el cierre de sesiones.
- T69-2 · Frontend: botones y diálogos en `/equipo`, gestión de `403 SIN_CENTRO` global → `/sin-centro`.
- T69-3 · QA: automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- ¿Puede el titular traspasar la titularidad? Propuesta: fuera de alcance (no hay historia); si hace falta, nueva historia a partir de US-85.

---

## (3) US-10 · Quiero consultar el perfil de otro centro y sus anuncios activos

**Épica:** E02 · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** 3 · **Depende de:** US-07, US-68, US-12, US-24
**Cambios respecto al backlog original:** Se añaden las dependencias de US-68 (zona) y US-24 (detalle del anuncio, desde donde se abre el perfil). Las valoraciones del perfil son US-45 [Depende de US-45]. Se concreta qué se ve y qué nunca se ve.

**Historia**
Como responsable del CE Hospitalet, que quiere pedir unos balones, quiero ver el perfil del Club Natació Exemple antes de pedir, para decidir si me fío.
1. En el detalle de un anuncio `/anuncios/:id` pulso el nombre del centro «Club Natació Exemple» (en el bloque «Lo ofrece») → `/centros/:id`.
2. Veo su nombre, zona «Barcelona (Barcelona)», «En Sportsplace desde 09/10/2026», la descripción, el contacto y sus anuncios activos.
3. Pulso uno de sus anuncios → vuelvo a `/anuncios/:id` de ese anuncio.

**Pantallas para el boceto**
- `/anuncios/:id` (US-24): el nombre del centro en «Lo ofrece» es un enlace a `/centros/:centro_id`.
- `/centros/:id`: «Perfil de centro». Cabecera con el nombre; «Zona: <localidad> (<provincia>)»; «En Sportsplace desde dd/mm/aaaa»; [hueco para la puntuación de US-45]; bloque «Sobre nosotros»; bloque «Contacto» (teléfono, email de contacto, web como enlace externo; solo los que existan; si no hay ninguno, «Este centro no ha indicado datos de contacto.»); sección «Anuncios activos (n)» con rejilla de tarjetas de US-21, paginada de 20 en 20.
- Si es mi propio centro: banda «Así ven tu perfil los demás centros.» con el botón «Editar perfil» (→ `/perfil/editar`).

**Criterios de aceptación**

*Navegación*
- CA1. En `/anuncios/:id` el nombre del centro vendedor enlaza a `/centros/:centro_id`.
- CA2. `/centros/:id` es privada: sin sesión → `/entrar` y vuelta tras entrar.
- CA3. Cada tarjeta lleva a `/anuncios/:id`. «Anterior»/«Siguiente» cambian de página (`?pagina=2`).
- CA4. Desde `/perfil` (US-07) se añade el enlace «Ver cómo ven mi perfil» → `/centros/<mi id>`.

*Comportamiento*
- CA5. Se muestran los campos públicos: `nombre`, `localidad`, `provincia`, `descripcion`, `telefono`, `email_contacto`, `web`, `creado_en` (como «En Sportsplace desde»).
- CA6. Los anuncios listados son solo los `activo` y `reservado` (este como «No disponible») del centro, ordenados por publicación descendente, 20 por página.
- CA7. Sin anuncios: «Este centro no tiene anuncios activos ahora mismo.».
- CA8. La web se abre en pestaña nueva con `rel="noopener noreferrer"`; el email de contacto como `mailto:`; el teléfono como `tel:`.
- CA9. Si el centro está eliminado (US-11) o no existe → página «Centro no encontrado» con el texto «Este centro no existe o ya no está en Sportsplace.» y el botón «Ir al catálogo».
- CA10. Mientras carga «Cargando…»; si falla, «No se ha podido cargar. » y «Reintentar».

*API*
- CA11. `GET /api/centros/{id}` (`requireAuth` + `requireEmailConfirmado`) → `200 { "centro": { "id", "nombre", "localidad", "provincia", "descripcion", "telefono", "email_contacto", "web", "creado_en", "es_mio" } }`.
- CA12. `GET /api/centros/{id}/anuncios?pagina=n` → `200 { "anuncios": [...], "pagina", "total" }`; `pagina` entera ≥ 1 (por defecto 1); `pagina=0` o `abc` → `400 DATOS_INVALIDOS`; página sin resultados → lista vacía.
- CA13. Errores comunes: `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (inexistente, id que no es UUID o centro eliminado), `503`.

*Permisos y seguridad*
- CA14. La respuesta nunca contiene `email` (de acceso), `usuario_id`, `direccion`, `codigo_postal`, `latitud`, `longitud`, `politica_privacidad_aceptada`, `email_confirmado_en` ni los miembros del equipo.
- CA15. Nunca se listan anuncios `pausado`, `entregado` ni `retirado`, ni siquiera al consultar el propio perfil por esta ruta.
- CA16. Visitantes sin cuenta no ven perfiles (US-06 no los enlaza).

*Casos límite*
- CA17. Con 21 anuncios activos: página 1 con 20, página 2 con 1; «Siguiente» deshabilitado en la 2.
- CA18. Descripción con HTML o un enlace se muestra como texto plano.
- CA19. Un centro sin código postal muestra «Zona: <localidad>» sin provincia.

**Flujos e2e**
- E2E-1 (camino feliz). CE Hospitalet abre un anuncio del Club Natació Exemple → nombre del centro → perfil con zona, descripción, contacto y 3 anuncios activos; uno pausado no aparece.
- E2E-2 (datos privados). `GET /api/centros/{id}` del Club → la respuesta no contiene `piscina@clubnatacio.cat` (email de acceso) ni `Carrer de la Piscina 12`.
- E2E-3 (paginación). Centro con 21 activos → 20 + 1.
- E2E-4 (inexistente). `/centros/00000000-0000-0000-0000-000000000000` → «Centro no encontrado».
- E2E-5 (propio). El Club abre su propio perfil → banda «Así ven tu perfil los demás centros.».

**Tareas**
- T10-1 · Backend: `GET /api/centros/{id}` y `GET /api/centros/{id}/anuncios` con proyección cerrada.
- T10-2 · Frontend: página `/centros/:id`, enlace en el detalle del anuncio y en `/perfil`.
- T10-3 · QA: automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- ¿Mostrar los anuncios `reservado`? Propuesta: sí, como «No disponible» (coherente con el catálogo).

---

## (3) US-11 · Quiero eliminar la cuenta de mi centro y sus datos

**Épica:** E02 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-03, US-84 (equipo), US-12, US-32
**Cambios respecto al backlog original:** Se concreta como eliminación inmediata con anonimización: el registro del centro se conserva vacío para no romper los pedidos de la otra parte. Se añade la confirmación con contraseña y escribiendo el nombre. Solo el titular puede hacerlo. Lo que afecta a anuncios y pedidos se marca con sus dependencias.

**Historia**
Como titular del Club Natació Exemple, quiero eliminar la cuenta del centro, para ejercer mi derecho de supresión (RGPD, NFR-01).
1. Menú → «Ajustes» → `/ajustes`.
2. En la zona «Eliminar la cuenta del centro» pulso «Eliminar cuenta».
3. En el diálogo escribo el nombre exacto «Club Natació Exemple» y mi contraseña, y pulso «Eliminar definitivamente».
4. Se cierra la sesión y llego a `/` con el aviso «La cuenta del centro se ha eliminado.».

**Pantallas para el boceto**
- Cabecera: el menú del centro añade «Ajustes» (→ `/ajustes`).
- `/ajustes`: «Ajustes». Sección «Cuenta» con el email de acceso (solo lectura); sección roja «Eliminar la cuenta del centro» con el texto «Se borrarán los datos del centro y de su equipo, se retirarán sus anuncios y se cancelarán sus pedidos en curso. Los pedidos ya cerrados se conservan sin tus datos. No se puede deshacer.» y botón rojo «Eliminar cuenta» (solo titular; un miembro ve «Solo el titular puede eliminar la cuenta del centro.»).
- Diálogo «Eliminar la cuenta de <nombre>»: campo «Escribe el nombre del centro para confirmar»; campo «Tu contraseña»; botones «Eliminar definitivamente» (rojo, deshabilitado hasta que el nombre coincide) y «Cancelar».

**Criterios de aceptación**

*Navegación*
- CA1. El menú contiene «Ajustes» → `/ajustes` (privada).
- CA2. Tras eliminar: la web borra los tokens y va a `/` con el aviso verde «La cuenta del centro se ha eliminado.».

*Campos y validación*
- CA3. Nombre: debe coincidir exactamente con `centros.nombre` (distingue mayúsculas, sin espacios extremos). Mientras no coincide, el botón está deshabilitado; la API responde `400 CONFIRMACION_INCORRECTA` «El nombre no coincide.» si no coincide.
- CA4. Contraseña: obligatoria («La contraseña es obligatoria.»); incorrecta → `401 CONTRASENA_INCORRECTA` «La contraseña no es correcta.» bajo el campo (no cierra la sesión).

*Comportamiento* (todo en una transacción; si algo falla, no cambia nada)
- CA5. Anuncios del centro → estado `retirado` [Depende de US-12/US-17]; dejan de verse en catálogo, `/explorar` y perfiles.
- CA6. Pedidos `pendiente` o `aceptado` del centro (como comprador o vendedor) → `cancelado` con motivo «Cuenta del centro eliminada» y unidades devueltas [Depende de US-32, US-34]; la otra parte recibe aviso [Depende de E09].
- CA7. Anonimización de `centros`: `nombre = 'Centro eliminado'`, `email = 'eliminado+<id>@sportsplace.invalid'`, `direccion`, `codigo_postal`, `telefono`, `descripcion`, `email_contacto`, `web`, `latitud`, `longitud` a `NULL`, `localidad = '—'`, `usuario_id = NULL` y `eliminado_en = now()`.
- CA8. Se borran todas las filas de `miembros_centro` e `invitaciones_centro` del centro y, después de poner `usuario_id = NULL`, las cuentas de `auth.users` del titular y de cada miembro (`auth.admin.deleteUser`); así el `ON DELETE CASCADE` del Sprint 0 no borra la fila del centro.
- CA9. En pedidos y conversaciones pasados, la otra parte ve «Centro eliminado» y ningún dato de contacto [Depende de US-32, E05].
- CA10. Las fotos de los anuncios se borran de Storage [Depende de US-13].
- CA11. Tras eliminar, el email de acceso queda libre: se puede registrar un centro nuevo con él (US-01 → `201`).

*API*
- CA12. `DELETE /api/centros/mio` (`requireAuth` + `requireCentro`), cuerpo `{ "nombre_confirmacion", "password" }` → `204`. Errores: `400 DATOS_INVALIDOS`, `400 CONFIRMACION_INCORRECTA`, `401 CONTRASENA_INCORRECTA`, `403 SIN_PERMISO` (miembro), `401 NO_AUTENTICADO`, `429`, `503`.
- CA13. No exige `requireEmailConfirmado`: una cuenta sin confirmar también puede eliminarse.

*Datos*
- CA14. Migración nueva: `centros.eliminado_en TIMESTAMPTZ NULL`; todas las consultas públicas y de catálogo filtran `eliminado_en IS NULL`.
- CA15. No se conserva ningún dato personal del centro tras la eliminación (comprobable con una consulta sobre la fila anonimizada).

*Permisos y seguridad*
- CA16. Solo el titular: un miembro recibe `403 SIN_PERMISO` y no ve el botón.
- CA17. Tras eliminar, los tokens antiguos de todos los miembros dan `401 NO_AUTENTICADO` y el login con esas credenciales da `401 CREDENCIALES_INCORRECTAS`.

*Casos límite*
- CA18. Nombre con distinta mayúscula («club natació exemple») → botón deshabilitado.
- CA19. Si Supabase Auth falla al borrar una cuenta → `503 AUTH_NO_DISPONIBLE` y la transacción se deshace (centro intacto).

**Flujos e2e**
- E2E-1 (camino feliz). Club con 2 anuncios activos, 1 pedido pendiente y Marta como miembro. Titular elimina la cuenta → `/` con aviso. BD: centro anonimizado con `eliminado_en`; anuncios `retirado`; pedido `cancelado`; sin filas en `miembros_centro`; titular y Marta fuera de `auth.users`.
- E2E-2 (otra parte). El CE Hospitalet abre su pedido antiguo con el Club → ve «Centro eliminado» sin teléfono ni email.
- E2E-3 (contraseña errónea). Nombre correcto y contraseña `mala` → «La contraseña no es correcta.»; nada cambia.
- E2E-4 (miembro). Marta abre `/ajustes` → texto de solo titular; `DELETE` directo → `403 SIN_PERMISO`.
- E2E-5 (email reutilizable). Registrar de nuevo `piscina@clubnatacio.cat` → `201`.

**Tareas**
- T11-1 · Base de datos: `centros.eliminado_en` y filtros en vistas/consultas.
- T11-2 · Backend: `DELETE /api/centros/mio` con transacción, anonimización y borrado de cuentas.
- T11-3 · Frontend: «Ajustes» en el menú, `/ajustes` y diálogo.
- T11-4 · QA: automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- ¿Borrado inmediato o con periodo de gracia? Propuesta: inmediato e irreversible.
- ¿Conservar pedidos cerrados anonimizados? Propuesta: sí, la otra parte necesita su historial (y posibles obligaciones contables).
- ¿Valoraciones recibidas/escritas? Propuesta: se conservan con autor «Centro eliminado» [Depende de E08].
