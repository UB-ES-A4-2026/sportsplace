# E03 Publicación de material

Historias: US-12, US-13, US-14, US-15, US-16, US-70, US-17, US-18 (Sprint 1), US-71 (Sprint 3), US-19, US-20, US-90 (nueva) y US-72 (Sprint 6).

Esta sección recoge las definiciones que comparten todas las historias de la épica. Cada historia las referencia por su nombre («Tabla de campos», «Objeto `anuncio`»…) y las concreta; si una historia contradice esta sección, manda la historia.

## Base común de la épica

### Qué existe y qué no en el Sprint 1

- Existe (Sprint 0, no se cambia): registro, confirmación de email, inicio y cierre de sesión, `requireAuth`, `requireEmailConfirmado`, formato de error, tabla `centros`, rutas web `/`, `/registro`, `/confirmar-email`, `/entrar`, `/panel`.
- No existe todavía: catálogo y búsqueda (US-21), detalle público de un anuncio (US-24), perfil editable (US-07), pedidos (US-32 y siguientes), mensajes, avisos. Ninguna historia de esta épica depende de ellos; donde haría falta, se marca «[Depende de US-xx]» y no se implementa.
- El «centro de la sesión» es la fila de `centros` cuyo `usuario_id` coincide con el usuario del token. Todas las rutas de esta épica son privadas y usan `requireAuth` + `requireEmailConfirmado`.

### Cabecera de la zona privada en el Sprint 1

De izquierda a derecha: logo «Sportsplace» (→ `/mis-anuncios` mientras no exista US-21), «Mis anuncios» (→ `/mis-anuncios`), botón «Publicar anuncio» (→ `/anuncios/nuevo`) y el menú del centro que ya existe. «Catálogo», «Pedidos», «Mensajes» y la campana no se muestran hasta sus historias [Depende de US-21, US-32, US-26, US-56]. La añade US-12 (botón) y US-18 (enlace).

### Valores fijos (texto en pantalla ↔ valor en la API y la base de datos)

| Campo | Valores (pantalla → API) |
|---|---|
| `categoria` | Balones → `balones` · Ropa y equipación → `ropa_equipacion` · Calzado → `calzado` · Protecciones → `protecciones` · Material de entrenamiento → `material_entrenamiento` · Porterías y redes → `porterias_redes` · Máquinas y fitness → `maquinas_fitness` · Otros → `otros` |
| `deporte` | Fútbol → `futbol` · Baloncesto → `baloncesto` · Balonmano → `balonmano` · Voleibol → `voleibol` · Tenis → `tenis` · Pádel → `padel` · Natación → `natacion` · Atletismo → `atletismo` · Gimnasio y fitness → `gimnasio_fitness` · Varios → `varios` |
| `estado_material` | Nuevo → `nuevo` · Como nuevo → `como_nuevo` · Buen estado → `buen_estado` · Usado → `usado` · Para reparar → `para_reparar` |
| `modalidad` | Venta → `venta` · Donación → `donacion` |
| `estado` | Borrador → `borrador` (US-20) · Activo → `activo` · Pausado → `pausado` · Reservado → `reservado` · Entregado → `entregado` · `retirado` (no se muestra nunca) |

Los desplegables muestran los valores en el orden de la tabla. La API solo acepta los valores en minúsculas de la columna derecha (sensible a mayúsculas).

### Tabla de campos (reglas y mensajes exactos)

Antes de validar se quitan los espacios del principio y del final. Las longitudes se cuentan en caracteres Unicode (un emoji o una «ñ» cuentan 1). El mismo mensaje se muestra en la web (debajo del campo) y lo devuelve la API en `details`.

| Campo (etiqueta) | Clave API | Tipo y regla | Límite aceptado / primer rechazado | Mensaje si falta | Mensaje si no cumple |
|---|---|---|---|---|---|
| Título | `titulo` | Texto, obligatorio, 5-80, una línea (con salto de línea: «El título no puede tener saltos de línea.»). | «Balón» (5) acepta, «Balo» (4) rechaza; 80 acepta, 81 rechaza. | «El título es obligatorio.» | «El título debe tener entre 5 y 80 caracteres.» |
| Descripción | `descripcion` | Texto, obligatorio, 20-1000, admite saltos de línea (cuentan 1 cada uno). | 20 acepta, 19 rechaza; 1000 acepta, 1001 rechaza. | «La descripción es obligatoria.» | «La descripción debe tener entre 20 y 1000 caracteres.» |
| Categoría | `categoria` | Desplegable, obligatorio, primera opción «Elige una categoría» sin valor. | Solo los 8 valores. `"Balones"` (mayúscula) rechaza en la API. | «Elige una categoría.» | «La categoría no es válida.» |
| Deporte | `deporte` | Desplegable, obligatorio, primera opción «Elige un deporte» sin valor. | Solo los 10 valores. | «Elige un deporte.» | «El deporte no es válido.» |
| Unidades disponibles | `unidades_disponibles` | Entero, obligatorio, 1-9999. Campo numérico, paso 1. | 1 y 9999 aceptan; 0 y 10000 rechazan; «2,5», «2.5», «-1», «abc» rechazan. En la API, `"3"` (texto) y `3.0` rechazan; solo entero JSON. | «Indica las unidades disponibles.» | «Las unidades deben ser un número entero entre 1 y 9999.» |
| Estado del material | `estado_material` | Desplegable, obligatorio, primera opción «Elige el estado» sin valor. | Solo los 5 valores. | «Elige el estado del material.» | «El estado del material no es válido.» |
| Modalidad | `modalidad` | Dos opciones (radio) «Venta» y «Donación», ninguna marcada al empezar. Obligatorio. (US-14) | Solo `venta` o `donacion`. | «Elige si es venta o donación.» | «La modalidad no es válida.» |
| Precio por unidad (€) | `precio_unitario_centimos` | Solo si modalidad = Venta. En la web: texto con formato `^\d{1,5}([,.]\d{1,2})?$` (coma o punto decimal, sin separador de miles, sin «€»). En la API: entero en céntimos 1-9.999.999. Si es donación, debe ser `null` o no venir. (US-14) | Web: «0,01» acepta, «0» y «0,00» rechazan; «99999,99» acepta, «100000» rechaza; «12,345» y «1.234,50» rechazan por formato. API: 1 y 9999999 aceptan; 0 y 10000000 rechazan; 12.5 rechaza. | «Indica el precio por unidad.» | Formato: «Escribe el precio con hasta 2 decimales, por ejemplo 12,50.» Rango: «El precio debe estar entre 0,01 € y 99.999,99 €.» Donación con precio (solo API): «Una donación no puede tener precio.» |
| Fotos | `fotos` | 1-8 ficheros JPG, PNG o WebP de 5 MB (5.242.880 bytes) como máximo cada uno; una es la principal. (US-13) | 1 y 8 aceptan; 0 y 9 rechazan; 5.242.880 bytes acepta, 5.242.881 rechaza. | «Añade al menos una foto.» | «Solo se admiten fotos JPG, PNG o WebP.» · «Cada foto debe pesar 5 MB como máximo.» · «Puedes añadir 8 fotos como máximo.» |

La API ignora cualquier otra clave del cuerpo (por ejemplo `estado`, `centro_id`, `id`): nunca se pueden fijar desde el cliente.

### Estados del anuncio y transiciones

| Estado | Etiqueta en pantalla (color) | Transiciones permitidas | Historia |
|---|---|---|---|
| `borrador` | «Borrador» (morado) | → `activo` (al completar y publicar), → `retirado` | US-20, US-90, US-70 |
| `activo` | «Activo» (verde) | → `pausado`, `reservado`, `entregado`, `retirado` | US-12, US-16, US-17, US-70 |
| `pausado` | «Pausado» (gris) | → `activo`, `retirado` | US-16, US-70 |
| `reservado` | «Reservado» (naranja) | → `activo`, `entregado`, `retirado` | US-17, US-70 |
| `entregado` | «Entregado» (azul) | Ninguna (final) | US-17 |
| `retirado` | No se muestra | Ninguna (final, retirada lógica) | US-70 |

Cualquier transición que no esté en la tabla responde `409 TRANSICION_NO_PERMITIDA` con `message` «Esta acción no está disponible en el estado actual del anuncio.» y `details: { "estado_actual": "<estado>" }`. Las transiciones se hacen con un `UPDATE ... WHERE id = $1 AND centro_id = $2 AND estado IN (...)`, de modo que dos peticiones simultáneas no pueden saltarse la regla.

### Propiedad

Un centro solo ve y modifica sus propios anuncios. Cualquier ruta `/api/anuncios/:id...` sobre un anuncio que no existe, que es de otro centro o que está `retirado` responde `404 NO_ENCONTRADO` con `message` «Anuncio no encontrado.». Un `:id` que no es un UUID válido también responde `404 NO_ENCONTRADO` (no 400 ni 500). En la web, cualquier 404 de un anuncio muestra la pantalla «Anuncio no encontrado» con el texto «Este anuncio no existe o ya no está disponible.» y el botón «Volver a mis anuncios» (→ `/mis-anuncios`).

### Objeto `anuncio` (respuesta de la API)

```json
{
  "id": "6b1f0c1e-2a4d-4c7e-9f53-0d2b7c1a9e10",
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
    { "id": "uuid", "url": "https://.../anuncios/<centro_id>/<anuncio_id>/<foto_id>.jpg", "orden": 1, "es_principal": true }
  ],
  "publicado_en": "2026-11-03T10:15:00.000Z",
  "creado_en": "2026-11-03T10:15:00.000Z",
  "actualizado_en": "2026-11-03T10:15:00.000Z"
}
```

`fotos` va ordenado por `orden` (1..n). `publicado_en` es `null` en un borrador. Las fechas son ISO 8601 en UTC; la web las muestra en hora de Madrid.

### Modelo de datos (resultado final de la épica)

Tabla `anuncios` (migración de US-12, ampliada por US-14, US-20):

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | `uuid` PK | `default gen_random_uuid()` |
| `centro_id` | `uuid` | `NOT NULL`, FK a `centros(id)` `ON DELETE CASCADE` |
| `titulo` | `varchar(80)` | `NOT NULL`, `CHECK (char_length(titulo) BETWEEN 5 AND 80)` |
| `descripcion` | `varchar(1000)` | `NOT NULL`, `CHECK (char_length(descripcion) BETWEEN 20 AND 1000)` |
| `categoria` | `text` | `NOT NULL`, `CHECK (categoria IN (...8 valores))` |
| `deporte` | `text` | `NOT NULL`, `CHECK (deporte IN (...10 valores))` |
| `unidades_disponibles` | `integer` | `NOT NULL`, `CHECK (unidades_disponibles BETWEEN 0 AND 9999)` (0 se reserva para US-34) |
| `estado_material` | `text` | `NOT NULL`, `CHECK (... 5 valores)` |
| `modalidad` | `text` | `NOT NULL`, `CHECK (modalidad IN ('venta','donacion'))` (US-14) |
| `precio_unitario_centimos` | `integer` | `CHECK ((modalidad='venta' AND precio_unitario_centimos BETWEEN 1 AND 9999999) OR (modalidad='donacion' AND precio_unitario_centimos IS NULL))` (US-14) |
| `estado` | `text` | `NOT NULL default 'activo'`, `CHECK (estado IN ('borrador','activo','pausado','reservado','entregado','retirado'))` (`borrador` lo añade US-20) |
| `publicado_en` | `timestamptz` | Nulo solo en borradores. |
| `creado_en`, `actualizado_en` | `timestamptz` | `NOT NULL default now()`. `actualizado_en` se renueva en cada cambio de datos o de estado. |
| `retirado_en`, `entregado_en` | `timestamptz` | Nulos salvo en ese estado. |

Índice `(centro_id, estado, actualizado_en DESC)`.

Tabla `anuncio_fotos` (US-13): `id uuid PK`, `anuncio_id uuid NOT NULL FK ON DELETE CASCADE`, `ruta text NOT NULL` (ruta dentro del bucket), `tipo_mime text NOT NULL`, `bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 5242880)`, `orden smallint NOT NULL CHECK (orden BETWEEN 1 AND 8)`, `es_principal boolean NOT NULL`, `creado_en`. Restricciones: `UNIQUE (anuncio_id, orden)` y un índice único parcial `(anuncio_id) WHERE es_principal`.

Las rutas del contrato nuevas se documentan en `docs/api-contrato.md` en la misma PR que las implementa.

---

## (3) US-12 · Publicar un anuncio del material que me sobra

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** 1 · **Depende de:** US-03 (sesión), US-02 (email confirmado)
**Cambios respecto al backlog original:** se quita la dependencia de US-07 (para publicar no hace falta el perfil: el centro ya tiene nombre y localidad desde US-01). Se quita el criterio «otros centros lo encuentran en el catálogo», que se comprueba en US-21. Se añade la ficha propia del anuncio (`/anuncios/:id`), necesaria para que el flujo termine en algún sitio. Sprint 2 → 1 según la planificación actual. Fotos (US-13) y modalidad/precio (US-14) amplían este formulario; mientras no estén, el anuncio se crea con `modalidad = 'donacion'` y sin fotos solo en la rama de US-12 (ver CA30).

**Historia**
Como responsable de material de un centro deportivo con la sesión iniciada, quiero publicar un anuncio con lo que me sobra, para ofrecerlo a otros centros que lo necesiten.
1. Estoy en cualquier pantalla de la zona privada (por ejemplo `/panel`) y pulso el botón «Publicar anuncio» de la cabecera.
2. Llego a `/anuncios/nuevo`, pantalla «Publicar anuncio», con el formulario vacío.
3. Escribo el título «Balones de fútbol talla 5», la descripción «Doce balones Mikasa usados una temporada, sin pinchazos.», elijo la categoría «Balones», el deporte «Fútbol», escribo 12 unidades y elijo el estado «Buen estado».
4. Pulso «Publicar». El botón pasa a «Publicando…».
5. Llego a la ficha de mi anuncio `/anuncios/<id>` y veo el aviso verde «Anuncio publicado.» y los datos que he escrito con la etiqueta «Activo».
6. Si me he equivocado en algún campo, al pulsar «Publicar» veo el error debajo de ese campo y no se envía nada hasta que lo corrijo.

**Pantallas para el boceto**
- Cabecera de la zona privada: se añade el botón «Publicar anuncio» (botón primario, a la derecha, antes del menú del centro).
- `/anuncios/nuevo` · «Publicar anuncio». En este orden: título de página «Publicar anuncio»; texto «Los campos marcados con * son obligatorios.»; campo «Título *» (contador «0/80» a la derecha, bajo el campo); «Descripción *» (área de texto de 6 líneas, contador «0/1000»); «Categoría *» (desplegable); «Deporte *» (desplegable); «Unidades disponibles *» (numérico); «Estado del material *» (desplegable); [sección «Fotos» de US-13]; [sección «Modalidad y precio» de US-14]; al pie, botón secundario «Cancelar» a la izquierda y botón primario «Publicar» a la derecha.
- `/anuncios/:id` · Ficha propia del anuncio. En este orden: enlace «← Mis anuncios»; título del anuncio (h1) y a su derecha la etiqueta de estado; [galería de US-13]; [precio o «Donación · Gratis» de US-14]; tabla de datos: «Categoría», «Deporte», «Unidades disponibles», «Estado del material»; bloque «Descripción» con el texto respetando saltos de línea; línea «Publicado el dd/mm/aaaa · Última modificación dd/mm/aaaa hh:mm»; zona «Acciones» con los botones que añaden US-15, US-16, US-17, US-70 y US-19.
- Diálogo «¿Salir sin publicar?» (ver CA9).

**Criterios de aceptación**

*Navegación*
- CA1. En la cabecera de toda pantalla de la zona privada hay un botón «Publicar anuncio» que navega a `/anuncios/nuevo`.
- CA2. Sin sesión, abrir `/anuncios/nuevo` o `/anuncios/:id` redirige a `/entrar`; tras iniciar sesión se vuelve a la ruta pedida.
- CA3. Con la sesión de un centro sin email confirmado, la API responde `403 EMAIL_NO_CONFIRMADO` al publicar y la web muestra el aviso de US-02 sin perder los datos del formulario.
- CA4. Tras publicar con éxito, la web navega a `/anuncios/<id devuelto>` (con `replace`, de modo que «Atrás» del navegador no vuelve al formulario relleno) y muestra el aviso verde «Anuncio publicado.».

*Campos y validación*
- CA5. El formulario muestra exactamente los campos Título, Descripción, Categoría, Deporte, Unidades disponibles y Estado del material, en ese orden, con las reglas y mensajes de la «Tabla de campos».
- CA6. Los contadores muestran «n/80» y «n/1000» con la longitud actual sin espacios iniciales y finales. Los campos no impiden escribir más allá del máximo (para que se vea el error), pero el contador se pone en rojo al superarlo.
- CA7. «Publicar» está siempre habilitado (salvo mientras se envía). Al pulsarlo, se validan todos los campos a la vez; si hay errores, se muestran todos debajo de su campo, el foco va al primer campo con error y no se hace ninguna petición.
- CA8. Tras el primer intento de envío, cada campo se vuelve a validar al cambiarlo y su error desaparece en cuanto es válido.

*Comportamiento*
- CA9. «Cancelar» con el formulario sin tocar navega a `/mis-anuncios`. Si algún campo tiene valor, abre el diálogo: título «¿Salir sin publicar?», texto «Se perderán los datos que has escrito.», botones «Salir» (navega a `/mis-anuncios`) y «Seguir editando» (cierra el diálogo y conserva los datos).
- CA10. Mientras se envía, «Publicar» se deshabilita y muestra «Publicando…»; un segundo clic no hace otra petición.
- CA11. Si la red falla o la API responde 500/503, aparece el aviso rojo «No se ha podido completar la acción. Inténtalo de nuevo.», el botón vuelve a «Publicar» y los datos se conservan.
- CA12. Si la API responde 400 `DATOS_INVALIDOS`, cada mensaje de `details` se muestra debajo de su campo (aunque la web no lo hubiera detectado).
- CA13. Un anuncio recién publicado queda en estado `activo` con `publicado_en` = `creado_en` = `actualizado_en` = hora del servidor.

*Mensajes*
- CA14. Los textos exactos son: aviso «Anuncio publicado.»; los mensajes de la «Tabla de campos»; el diálogo de CA9; el error genérico de CA11.

*API*
- CA15. `POST /api/anuncios` con `Content-Type: application/json` y cuerpo `{ titulo, descripcion, categoria, deporte, unidades_disponibles, estado_material }` (US-13 cambia el cuerpo a `multipart/form-data`; US-14 añade `modalidad` y `precio_unitario_centimos`).
- CA16. Si todo es correcto responde `201` con `{ "anuncio": anuncio }` y la cabecera `Location: /api/anuncios/<id>`.
- CA17. Si algún campo no es válido responde `400 DATOS_INVALIDOS`, `message` «Revisa los campos marcados.» y `details` con una entrada por cada campo incorrecto (todas a la vez, no solo la primera). No se crea nada.
- CA18. Cuerpo que no es JSON: `400 JSON_INVALIDO`. Cuerpo JSON que no es un objeto (p. ej. `[]`): `400 DATOS_INVALIDOS` con `details` de todos los campos obligatorios.
- CA19. Sin token o con token caducado: `401 NO_AUTENTICADO`. Email sin confirmar: `403 EMAIL_NO_CONFIRMADO`. Base de datos caída: `503 BASE_DATOS_NO_DISPONIBLE`.
- CA20. `GET /api/anuncios/:id` responde `200 { "anuncio": anuncio }` si el anuncio es del centro de la sesión y no está retirado; si no, `404 NO_ENCONTRADO` (ver «Propiedad»).
- CA21. Las claves `estado`, `centro_id`, `id`, `publicado_en` del cuerpo se ignoran: el anuncio siempre se crea `activo` y del centro de la sesión.

*Datos*
- CA22. Se crea una fila en `anuncios` con los valores ya recortados de espacios, `centro_id` del centro de la sesión y `estado = 'activo'`.
- CA23. Las restricciones `CHECK` de la tabla impiden guardar valores fuera de rango aunque se salte la validación de la API (comprobable con un `INSERT` directo que falla).

*Permisos y seguridad*
- CA24. Un centro B que pide `GET /api/anuncios/<id de A>` recibe `404 NO_ENCONTRADO`, idéntico al de un id inexistente.
- CA25. El texto de título y descripción se muestra como texto plano: `<script>alert(1)</script>` en la descripción se ve literalmente y no se ejecuta.

*Casos límite*
- CA26. Título de 5 caracteres y de 80 → se publica; de 4 y de 81 → error de longitud. «   Balón   » (5 con espacios alrededor) → se guarda «Balón».
- CA27. Título con salto de línea → API `400 DATOS_INVALIDOS` con `details.titulo` «El título no puede tener saltos de línea.» (la web no permite escribirlo porque es campo de una línea).
- CA28. Unidades 1 y 9999 → se publica; 0, 10000, «2,5» → error.
- CA29. Descripción solo de espacios → «La descripción es obligatoria.».
- CA30. Hasta que US-13 y US-14 estén en `dev`, la rama de US-12 crea los anuncios con `modalidad = 'donacion'`, `precio_unitario_centimos = null` y sin fotos; los tests de US-12 no comprueban fotos ni precio.

**Flujos e2e**

E2E-1 · Publicar con datos correctos
1. Centro «Club Natació Exemple» con sesión y email confirmado, en `/panel`.
2. Pulsa «Publicar anuncio» → URL `/anuncios/nuevo`, formulario vacío.
3. Rellena: Título «Balones de fútbol talla 5»; Descripción «Doce balones Mikasa usados una temporada, sin pinchazos.»; Categoría «Balones»; Deporte «Fútbol»; Unidades «12»; Estado «Buen estado».
4. Pulsa «Publicar» → el botón muestra «Publicando…».
5. Resultado: URL `/anuncios/<uuid>`, aviso «Anuncio publicado.», h1 «Balones de fútbol talla 5», etiqueta «Activo», «Unidades disponibles: 12», «Publicado el <hoy dd/mm/aaaa>».
6. BD: una fila nueva en `anuncios` con `categoria='balones'`, `deporte='futbol'`, `unidades_disponibles=12`, `estado_material='buen_estado'`, `estado='activo'`, `centro_id` del club.

E2E-2 · Formulario vacío
1. En `/anuncios/nuevo` pulsa «Publicar» sin rellenar nada.
2. Resultado: seis errores («El título es obligatorio.», «La descripción es obligatoria.», «Elige una categoría.», «Elige un deporte.», «Indica las unidades disponibles.», «Elige el estado del material.»), foco en Título, ninguna petición en la pestaña de red. BD sin cambios.

E2E-3 · Valores límite
1. Título «Bola» (4) y unidades «10000» → «Publicar» → errores «El título debe tener entre 5 y 80 caracteres.» y «Las unidades deben ser un número entero entre 1 y 9999.».
2. Cambia el título a «Bolas» → su error desaparece al momento. Cambia unidades a «9999» → desaparece.
3. Pulsa «Publicar» → se publica con 9999 unidades.

E2E-4 · Error de servidor
1. Con `POST /api/anuncios` interceptado para que responda `503 BASE_DATOS_NO_DISPONIBLE` (o con la red abortada), rellena el formulario correcto y pulsa «Publicar».
2. Resultado: aviso rojo «No se ha podido completar la acción. Inténtalo de nuevo.», sigue en `/anuncios/nuevo` con todos los datos. BD sin cambios.

E2E-5 · Anuncio de otro centro y API directa
1. Centro A publica un anuncio con id X. Centro B abre `/anuncios/X` → pantalla «Anuncio no encontrado». `GET /api/anuncios/X` con token de B → `404 NO_ENCONTRADO`.
2. `POST /api/anuncios` con token de B y `{ "titulo": "Bal", "unidades_disponibles": "3", "estado": "entregado" }` → `400 DATOS_INVALIDOS` con `details` de `titulo`, `descripcion`, `categoria`, `deporte`, `unidades_disponibles`, `estado_material`.

E2E-6 · Cancelar con datos
1. Escribe «Conos» en Título y pulsa «Cancelar» → diálogo «¿Salir sin publicar?». Pulsa «Seguir editando» → el título sigue siendo «Conos».
2. Pulsa «Cancelar» → «Salir» → URL `/mis-anuncios`. BD sin cambios.

**Tareas**
- T12-1 · Base de datos: migración `anuncios` con columnas, `CHECK` e índice de la «Base común» (sin `borrador`).
- T12-2 · Backend: módulo de validación compartido de anuncios (reglas y mensajes de la «Tabla de campos»), `POST /api/anuncios`, `GET /api/anuncios/:id` con control de propiedad, y tests de integración de CA15-CA24. En la misma PR, actualizar el contrato: rutas y objeto `anuncio` en `docs/api-contrato.md`.
- T12-3 · Frontend: botón «Publicar anuncio» en la cabecera y pantalla `/anuncios/nuevo` con validación, contadores y diálogo de cancelar (componente de formulario reutilizable por US-15, US-19 y US-90).
- T12-4 · Frontend: ficha `/anuncios/:id` y pantalla «Anuncio no encontrado».
- T12-5 · QA: automatizar E2E-1..6 y los casos límite CA26-CA29.
- T12-6 · DevOps: entorno de pruebas desplegado (web + API) con despliegue automático al fusionar en `dev` (NFR-02 y DoD «desplegada en el entorno de pruebas»); URL en el README y variables documentadas en `.env.example`.
- T12-7 · DevOps: job de e2e en el CI (Playwright, web y API levantadas contra la base de pruebas), obligatorio en las PR hacia `story/*` y `dev`; plantilla de test que usará QA.
- T12-8 · DevOps: base de datos de pruebas separada del Supabase compartido, script de semilla (centros y anuncios de ejemplo de los e2e, incluidos 21 anuncios para US-18) y procedimiento para aplicar las migraciones nuevas al Supabase compartido tras fusionar en `dev`.

**Decisiones pendientes**
- Destino del logo mientras no exista el catálogo. Propuesta: `/mis-anuncios`.
- Si el formulario debe guardar un borrador local si se cierra la pestaña. Propuesta: no en el Sprint 1.

---

## (3) US-13 · Añadir fotos a mi anuncio

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** 1 · **Depende de:** US-12
**Cambios respecto al backlog original:** «Los demás centros ven las fotos» se comprueba en US-24 (detalle público); aquí se comprueba en la ficha propia y en «Mis anuncios». Se fijan límites (1-8 fotos, 5 MB, JPG/PNG/WebP). Gestionar fotos al editar se especifica en US-15. Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero añadir fotos al anuncio y elegir la principal, para que los otros centros vean el estado real del material.
1. En `/anuncios/nuevo`, en la sección «Fotos», pulso «Añadir fotos».
2. Se abre el selector de archivos del sistema; elijo `balones1.jpg` y `balones2.png`.
3. Veo dos miniaturas; la primera lleva la etiqueta «Principal».
4. Pulso la estrella de la segunda: ahora la principal es la segunda.
5. Pulso la ✕ de la primera: desaparece y queda una sola.
6. Pulso «Publicar» y en la ficha veo la foto grande.

**Pantallas para el boceto**
- Sección «Fotos *» de `/anuncios/nuevo` (entre «Estado del material» y «Modalidad»): texto de ayuda «Entre 1 y 8 fotos JPG, PNG o WebP de 5 MB como máximo. La principal es la que se verá primero.»; contador «n/8 fotos»; rejilla de miniaturas de 120×120 px (recortadas, `object-fit: cover`) en el orden añadido; en cada miniatura, arriba a la izquierda el botón estrella (rellena y etiqueta «Principal» si es la principal, vacía con `title` «Marcar como principal» si no) y arriba a la derecha el botón ✕ (`title` «Quitar foto»); al final de la rejilla, la casilla «+ Añadir fotos» (oculta cuando hay 8). La zona también acepta arrastrar y soltar archivos. Debajo, el error del campo.
- Ficha `/anuncios/:id`: foto principal grande (ancho del contenido, máximo 480 px de alto, `object-fit: contain`) y, debajo, la fila de miniaturas 80×80 de todas las fotos en su orden; la que se ve grande lleva borde.
- `/mis-anuncios`: miniatura 64×64 de la principal en cada fila (US-18).

**Criterios de aceptación**

*Campos y validación*
- CA1. «Añadir fotos» abre el selector con `accept="image/jpeg,image/png,image/webp"` y selección múltiple.
- CA2. Al elegir archivos, cada uno se valida en la web: tipo MIME `image/jpeg`, `image/png` o `image/webp` (si no: «Solo se admiten fotos JPG, PNG o WebP.»); tamaño ≤ 5.242.880 bytes (si no: «Cada foto debe pesar 5 MB como máximo.»). Los válidos se añaden; los inválidos no, y se muestra el mensaje debajo de la sección con el nombre: «balones.gif: Solo se admiten fotos JPG, PNG o WebP.».
- CA3. Si al añadir se superarían 8 fotos, se añaden las primeras hasta llegar a 8 y se muestra «Puedes añadir 8 fotos como máximo.».
- CA4. Al pulsar «Publicar» con 0 fotos: «Añade al menos una foto.» y no se envía nada.
- CA5. Valores límite: 1 foto y 8 fotos se publican; un archivo de exactamente 5.242.880 bytes se acepta y uno de 5.242.881 se rechaza.

*Comportamiento*
- CA6. La primera foto añadida queda como principal. Pulsar la estrella de otra la convierte en principal y la anterior deja de serlo; siempre hay exactamente una principal si hay fotos.
- CA7. La ✕ quita la foto sin confirmación. Si era la principal, pasa a serlo la primera de las restantes en orden.
- CA8. El orden de las fotos es el orden en que se añadieron (no se reordenan en esta historia). La principal se guarda con su orden, no se mueve al primer lugar.
- CA9. En la ficha, al pulsar una miniatura se muestra grande en lugar de la principal; al cargar la ficha se ve la principal.
- CA10. Cada imagen tiene `alt` = título del anuncio (principal) o «<título> · foto n» (resto).
- CA11. Mientras se publica, el botón muestra «Publicando…»; si las fotos pesan en total más de 10 MB, debajo aparece «Subiendo fotos…» (sin barra de progreso).

*API*
- CA12. `POST /api/anuncios` pasa a `multipart/form-data` con: parte `datos` (texto JSON con los campos de US-12/US-14), partes `fotos` (1-8 archivos, en orden) y parte `foto_principal` (índice 1..n de la principal, texto). Si `foto_principal` falta, la principal es la 1.
- CA13. El servidor valida cada foto por su contenido (cabecera binaria: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`), no por la extensión ni el `Content-Type` declarado. Un `.txt` renombrado a `.jpg` → `400 DATOS_INVALIDOS`, `details.fotos` «Solo se admiten fotos JPG, PNG o WebP.».
- CA14. Errores de fotos: `400 DATOS_INVALIDOS` con `details.fotos` y el mensaje correspondiente de la «Tabla de campos»; 0 fotos → «Añade al menos una foto.»; 9 → «Puedes añadir 8 fotos como máximo.»; `foto_principal` fuera de 1..n o no numérico → `details.foto_principal` «La foto principal no es válida.». Los errores de fotos se devuelven junto con los del resto de campos.
- CA15. `datos` ausente o que no es JSON → `400 DATOS_INVALIDOS` con `details.datos` «Faltan los datos del anuncio.».
- CA16. Petición multipart de más de 41.943.040 bytes (40 MB) en total → `413 PETICION_DEMASIADO_GRANDE`. El límite JSON de 100 kB de Sprint 0 no cambia para el resto de rutas.
- CA17. Si todo es correcto, `201 { anuncio }` con `fotos` (n elementos, `orden` 1..n, una con `es_principal: true`, `url` pública que responde 200 con la imagen).

*Datos*
- CA18. Las fotos se guardan en Supabase Storage, bucket `anuncios`, ruta `<centro_id>/<anuncio_id>/<foto_id>.<jpg|png|webp>`, sin modificar (sin redimensionar). Solo el servidor escribe en el bucket (clave de servicio en la variable `SUPABASE_SERVICE_ROLE_KEY`, nunca en la web).
- CA19. Por cada foto se crea una fila en `anuncio_fotos` con `ruta`, `tipo_mime`, `bytes`, `orden` y `es_principal`.
- CA20. Creación atómica: si falla la subida de cualquier foto o la inserción en BD, no queda ni la fila del anuncio ni ninguna foto en Storage (el servidor borra las ya subidas) y responde `503` o `500` según la causa.

*Permisos y seguridad*
- CA21. El bucket es de lectura pública por URL y sin listado; los nombres de archivo son UUID, no el nombre original.
- CA22. El nombre original del archivo no se guarda ni se muestra fuera del formulario.

*Casos límite*
- CA23. Elegir dos veces el mismo archivo añade dos fotos (no se detectan duplicados).
- CA24. Un PNG de 1×1 px se acepta (no hay mínimo de dimensiones; ver decisión).

**Flujos e2e**

E2E-1 · Publicar con dos fotos y cambiar la principal
1. En `/anuncios/nuevo`, rellena los campos válidos de US-12/US-14 y añade `balones1.jpg` (800 kB) y `balones2.png` (1,2 MB).
2. Pulsa la estrella de `balones2.png` → muestra «Principal».
3. Pulsa «Publicar» → ficha con `balones2.png` grande y dos miniaturas.
4. BD: 2 filas en `anuncio_fotos` (orden 1 y 2; `es_principal` solo en la 2). Storage: 2 objetos bajo `<centro_id>/<anuncio_id>/`.

E2E-2 · Sin fotos
1. Formulario correcto sin fotos → «Publicar» → «Añade al menos una foto.». Sin petición; BD sin cambios.

E2E-3 · Archivos inválidos
1. Añade `logo.gif` y `grande.jpg` (6 MB) y `ok.webp` (100 kB).
2. Resultado: solo `ok.webp` en la rejilla; mensajes «logo.gif: Solo se admiten fotos JPG, PNG o WebP.» y «grande.jpg: Cada foto debe pesar 5 MB como máximo.».

E2E-4 · Límite de 8
1. Añade 7 fotos y luego selecciona 3 más → quedan 8, aparece «Puedes añadir 8 fotos como máximo.» y desaparece «+ Añadir fotos».
2. Quita una con ✕ → 7 fotos y vuelve «+ Añadir fotos».

E2E-5 · Quitar la principal
1. Con 3 fotos y la principal en la 1, pulsa ✕ en la 1 → la antigua 2 pasa a «Principal».

E2E-6 · API con archivo falso
1. `POST /api/anuncios` multipart con `datos` válidos y una parte `fotos` que es un `.txt` con `Content-Type: image/jpeg` → `400 DATOS_INVALIDOS`, `details.fotos` «Solo se admiten fotos JPG, PNG o WebP.». BD y Storage sin cambios.

**Tareas**
- T13-1 · Base de datos y Storage: migración `anuncio_fotos`; crear bucket `anuncios` (público, sin listado) y documentar la variable `SUPABASE_SERVICE_ROLE_KEY` en `.env.example`.
- T13-2 · Backend: recepción multipart (límite 40 MB, 8 archivos, 5 MB por archivo), validación por cabecera binaria, subida a Storage con borrado compensatorio, inclusión de `fotos` en el objeto `anuncio`; tests CA12-CA20. En la misma PR, actualizar el contrato: actualizar `POST /api/anuncios` a multipart en el contrato.
- T13-3 · Frontend: sección «Fotos» (añadir, arrastrar, principal, quitar, validación).
- T13-4 · Frontend: galería en la ficha.
- T13-5 · QA: automatizar E2E-1..6 con imágenes de prueba en `tests/fixtures` (incluida una de 5.242.880 y otra de 5.242.881 bytes).

**Decisiones pendientes**
- Dimensiones mínimas. Propuesta: ninguna en el Sprint 1.
- Redimensionar o comprimir las fotos. Propuesta: no; se sirven tal cual (cuando haya catálogo, US-21 valorará miniaturas).
- Bucket público frente a URLs firmadas. Propuesta: público con nombres UUID (las fotos se enseñarán en el catálogo igualmente). Consecuencia: la URL de una foto de un anuncio retirado sigue funcionando si alguien la guardó.

---

## (2) US-14 · Indicar si el material se vende (con su precio) o se cede gratis

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-12
**Cambios respecto al backlog original:** «Una donación se muestra como gratuita a los compradores» se comprueba en la ficha propia y en «Mis anuncios»; en el catálogo, en US-21/US-24. Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero indicar si vendo el material y a qué precio o si lo cedo gratis, para ofrecerlo en la modalidad que me conviene.
1. En `/anuncios/nuevo`, en la sección «Modalidad y precio», marco «Venta».
2. Aparece «Precio por unidad (€) *»; escribo «8,50».
3. Pulso «Publicar» y en la ficha veo «8,50 € / unidad».
4. En otro anuncio marco «Donación»: no aparece el precio y en la ficha veo «Donación · Gratis».

**Pantallas para el boceto**
- Sección «Modalidad y precio» de `/anuncios/nuevo` (después de «Fotos», antes de los botones): etiqueta «Modalidad *»; dos opciones en fila «Venta» y «Donación» (radio, sin marcar); si «Venta» está marcada, debajo el campo «Precio por unidad (€) *» (texto, ancho 160 px, marcador «0,00», sufijo «€» fuera del campo) y el texto de ayuda «Precio de cada unidad, IVA incluido si lo aplicas.»; si «Donación» está marcada, el texto «El material se cederá gratis.».
- Ficha `/anuncios/:id`: bajo el título, en grande, «8,50 € / unidad» o la etiqueta verde «Donación · Gratis».

**Criterios de aceptación**

*Campos y validación*
- CA1. «Modalidad» sigue la fila correspondiente de la «Tabla de campos»; sin elegir: «Elige si es venta o donación.».
- CA2. El campo de precio solo se muestra y valida con «Venta» marcada. Reglas y mensajes de «Precio por unidad (€)» de la «Tabla de campos».
- CA3. Conversión a céntimos en la web: se cambia la coma por punto y se calcula sin coma flotante (parte entera × 100 + decimales completados a 2 cifras). «8,5» → 850; «8,05» → 805; «0,01» → 1; «99999,99» → 9999999.
- CA4. Casos límite de la web: «0,01» acepta; «0», «0,00» → «El precio debe estar entre 0,01 € y 99.999,99 €.»; «99999,99» acepta; «100000» → mensaje de rango; «12,345», «1.234,50», «12 €», «-5», «abc» → «Escribe el precio con hasta 2 decimales, por ejemplo 12,50.»; vacío → «Indica el precio por unidad.».

*Comportamiento*
- CA5. Cambiar de «Venta» a «Donación» oculta el precio, borra su error y no envía `precio_unitario_centimos`. Volver a «Venta» muestra el campo con el valor que tenía escrito.
- CA6. El precio se muestra con formato español: 850 → «8,50 € / unidad»; 123450 → «1.234,50 € / unidad»; 9999999 → «99.999,99 € / unidad».
- CA7. Una donación se muestra con la etiqueta «Donación · Gratis» en la ficha y en «Mis anuncios».

*API*
- CA8. `datos` de `POST /api/anuncios` (y de `PATCH` en US-15) incluye `modalidad` (obligatoria) y `precio_unitario_centimos` (entero, obligatorio si `venta`).
- CA9. `400 DATOS_INVALIDOS` con estos `details`: sin `modalidad` → `modalidad` «Elige si es venta o donación.»; `modalidad: "regalo"` → «La modalidad no es válida.»; venta sin precio o con `null` → `precio_unitario_centimos` «Indica el precio por unidad.»; venta con 0, 10000000, 8.5 o `"850"` → «El precio debe estar entre 0,01 € y 99.999,99 €.»; donación con cualquier precio distinto de `null` → «Una donación no puede tener precio.».

*Datos*
- CA10. Migración: `modalidad` y `precio_unitario_centimos` con el `CHECK` combinado de la «Base común». Los anuncios creados por la rama de US-12 antes de esta migración se quedan como `donacion` con precio nulo (`default 'donacion'` solo durante la migración, luego se quita el default).
- CA11. El precio se guarda en céntimos enteros; nunca se guardan decimales.

*Casos límite*
- CA12. Precio «8.50» (con punto) se acepta igual que «8,50».
- CA13. Precio con espacios «  8,50  » se acepta.

**Flujos e2e**

E2E-1 · Venta
1. Formulario válido + «Venta» + precio «8,50» → «Publicar».
2. Ficha: «8,50 € / unidad». BD: `modalidad='venta'`, `precio_unitario_centimos=850`.

E2E-2 · Donación
1. Formulario válido + «Donación» → no hay campo de precio → «Publicar».
2. Ficha: «Donación · Gratis». BD: `modalidad='donacion'`, `precio_unitario_centimos IS NULL`.

E2E-3 · Venta sin precio y límites
1. «Venta», precio vacío → «Publicar» → «Indica el precio por unidad.».
2. Precio «0,00» → «El precio debe estar entre 0,01 € y 99.999,99 €.». Precio «12,345» → «Escribe el precio con hasta 2 decimales, por ejemplo 12,50.».
3. Precio «99999,99» → se publica; ficha «99.999,99 € / unidad».

E2E-4 · Cambio de modalidad
1. «Venta», precio «abc» → «Publicar» → error de formato. Marca «Donación» → el error desaparece → «Publicar» → se publica como donación.

E2E-5 · API incoherente
1. `datos` con `{ ..., "modalidad": "donacion", "precio_unitario_centimos": 500 }` → `400`, `details.precio_unitario_centimos` «Una donación no puede tener precio.».

**Tareas**
- T14-1 · Base de datos: migración de `modalidad` y `precio_unitario_centimos` con su `CHECK`.
- T14-2 · Backend: validación de modalidad y precio en el módulo compartido; tests CA9.
- T14-3 · Frontend: sección «Modalidad y precio», conversión a céntimos y utilidad `formatearEuros(centimos)` reutilizable.
- T14-4 · Frontend: precio o «Donación · Gratis» en ficha (y en la fila de US-18).
- T14-5 · QA: automatizar E2E-1..5 y tabla de valores de CA3-CA4.

**Decisiones pendientes**
- IVA. Propuesta: el precio es el final que paga el comprador; no se gestiona IVA (texto de ayuda de la pantalla).

---

## (2) US-15 · Modificar un anuncio ya publicado

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-12, US-13, US-14
**Cambios respecto al backlog original:** «Los demás centros ven la versión actualizada» se comprueba en US-24. «Los pedidos ya aceptados no cambian» queda como «[Depende de US-32]». Se define la edición de fotos. Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero modificar un anuncio que ya he publicado, para que su información sea correcta.
1. En la ficha de mi anuncio «Balones de fútbol talla 5» (activo, 12 unidades, 8,50 €) pulso «Editar».
2. Llego a `/anuncios/<id>/editar`, pantalla «Editar anuncio», con todos los datos y fotos actuales.
3. Cambio las unidades a 10, el precio a «7,00», quito una foto y añado otra.
4. Pulso «Guardar cambios» (pasa a «Guardando…»).
5. Vuelvo a la ficha con el aviso «Cambios guardados.» y veo 10 unidades, «7,00 € / unidad» y las fotos nuevas. El estado sigue siendo «Activo».

**Pantallas para el boceto**
- `/anuncios/:id/editar` · «Editar anuncio»: igual que `/anuncios/nuevo` con título de página «Editar anuncio», los campos rellenos, las fotos actuales en la rejilla (con su principal) y los botones «Cancelar» y «Guardar cambios».
- Ficha `/anuncios/:id`: en «Acciones», botón secundario «Editar».

**Criterios de aceptación**

*Navegación*
- CA1. «Editar» aparece en la ficha y en la fila de «Mis anuncios» si el estado es `activo`, `pausado` o `reservado`. No aparece en `entregado`. (En `borrador` el botón es «Completar y publicar», US-90.)
- CA2. Abrir `/anuncios/:id/editar` de un anuncio `entregado` muestra la ficha con el aviso rojo «Este anuncio ya no se puede editar.» (redirige a `/anuncios/:id`).
- CA3. «Cancelar» sin cambios vuelve a `/anuncios/:id`. Con cambios, diálogo: título «¿Descartar los cambios?», texto «Los cambios que no has guardado se perderán.», botones «Descartar» (vuelve a la ficha) y «Seguir editando».
- CA4. Tras guardar, navega a `/anuncios/:id` (con `replace`) y muestra «Cambios guardados.».

*Campos y validación*
- CA5. Mismos campos, reglas y mensajes que al publicar (US-12, US-13, US-14), incluidas 1-8 fotos y exactamente una principal.
- CA6. «Guardar cambios» siempre habilitado; mientras guarda, deshabilitado y «Guardando…».

*Comportamiento*
- CA7. Editar no cambia el `estado` ni `publicado_en`; renueva `actualizado_en`.
- CA8. Las fotos conservadas mantienen su `id` y su URL; las quitadas se borran de `anuncio_fotos` y de Storage; las nuevas se añaden al final. El `orden` se recalcula 1..n según la rejilla.
- CA9. Si se guarda sin cambiar nada, la API responde 200 igualmente y renueva `actualizado_en`.
- CA10. Errores de red/500/503: aviso genérico y se conservan los datos (también las fotos nuevas aún no subidas).

*API*
- CA11. `PATCH /api/anuncios/:id` con `multipart/form-data`: parte `datos` (JSON con el anuncio completo: los campos de US-12 y US-14 más `fotos_conservar`, array ordenado de ids de fotos existentes que se quedan), partes `fotos` (0-8 nuevas) y parte `foto_principal` con el formato `existente:<id>` o `nueva:<índice 1..n>`.
- CA12. El orden final es: primero las de `fotos_conservar` en su orden, después las nuevas. Total final 1-8; si no, `400 DATOS_INVALIDOS` con `details.fotos` («Añade al menos una foto.» / «Puedes añadir 8 fotos como máximo.»).
- CA13. Un id de `fotos_conservar` que no pertenece a este anuncio → `400 DATOS_INVALIDOS`, `details.fotos_conservar` «Alguna foto no pertenece a este anuncio.». `foto_principal` que no apunta a una foto final → `details.foto_principal` «La foto principal no es válida.».
- CA14. Éxito: `200 { anuncio }`.
- CA15. Errores: `400 DATOS_INVALIDOS`; `401`; `403 EMAIL_NO_CONFIRMADO`; `404 NO_ENCONTRADO` (inexistente, de otro centro o retirado); `409 ANUNCIO_NO_EDITABLE` («Este anuncio ya no se puede editar.») si está `entregado`; `413`.
- CA16. Atomicidad: si falla algo, el anuncio y sus fotos quedan como estaban (las fotos nuevas subidas se borran; las quitadas se borran de Storage solo después de confirmar la transacción).

*Permisos y seguridad*
- CA17. Centro B que hace `PATCH` sobre un anuncio de A → `404 NO_ENCONTRADO` y el anuncio no cambia.

*Casos límite*
- CA18. Quitar todas las fotos y guardar → «Añade al menos una foto.» en la web, sin petición.
- CA19. Cambiar de venta a donación → se guarda `precio_unitario_centimos = null`.
- CA20. Si mientras se edita otro miembro del centro marca el anuncio como entregado, al guardar se recibe 409 y se muestra «Este anuncio ya no se puede editar.» y se navega a la ficha.
- CA21. [Depende de US-32] Los pedidos ya aceptados conservan el precio y la modalidad del momento de aceptar (se copian al pedido); no se implementa aquí.

**Flujos e2e**

E2E-1 · Cambiar datos y fotos
1. Anuncio activo con 12 unidades, 850 céntimos, fotos F1 (principal) y F2.
2. «Editar» → cambia unidades a 10, precio a «7,00», quita F1, añade `nueva.jpg`, marca `nueva.jpg` como principal → «Guardar cambios».
3. Ficha: «Cambios guardados.», «Unidades disponibles: 10», «7,00 € / unidad», `nueva.jpg` grande, estado «Activo».
4. BD: `unidades_disponibles=10`, `precio_unitario_centimos=700`, `anuncio_fotos` = F2 (orden 1, no principal) y nueva (orden 2, principal); F1 no está en Storage.

E2E-2 · Errores de validación
1. Borra el título → «Guardar cambios» → «El título es obligatorio.»; BD sin cambios.

E2E-3 · Anuncio pausado
1. Anuncio `pausado` → «Editar» → cambia título → guarda → sigue «Pausado».

E2E-4 · Entregado
1. Anuncio `entregado`: no hay botón «Editar». Abrir `/anuncios/<id>/editar` → ficha con «Este anuncio ya no se puede editar.». `PATCH` directo → `409 ANUNCIO_NO_EDITABLE`.

E2E-5 · Cancelar con cambios
1. Cambia unidades → «Cancelar» → «Descartar» → ficha con los datos originales.

E2E-6 · Otro centro
1. `PATCH /api/anuncios/<id de A>` con token de B y datos válidos → `404 NO_ENCONTRADO`; BD sin cambios.

**Tareas**
- T15-1 · Backend: `PATCH /api/anuncios/:id` (validación compartida, fotos conservadas/nuevas/principal, atomicidad, 409) y tests. En la misma PR, actualizar el contrato: `PATCH` y `ANUNCIO_NO_EDITABLE` en el contrato.
- T15-2 · Frontend: `/anuncios/:id/editar` reutilizando el formulario de US-12 con fotos existentes; botón «Editar» en la ficha.
- T15-3 · QA: automatizar E2E-1..6.

**Decisiones pendientes**
- Control de edición simultánea (dos personas del mismo centro). Propuesta: gana el último que guarda; sin bloqueo optimista en el Sprint 1.

---

## (2) US-16 · Pausar y reactivar un anuncio

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-12
**Cambios respecto al backlog original:** «Deja de aparecer / vuelve al catálogo» se comprueba en US-21 [Depende de US-21]; aquí se garantiza el estado. Retirar ya estaba en US-70. Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero pausar un anuncio y reactivarlo después, para decidir cuándo ofrezco el material sin borrarlo.
1. En la ficha de mi anuncio activo pulso «Pausar».
2. Sin salir de la página veo el aviso «Anuncio pausado.», la etiqueta cambia a «Pausado» y el botón pasa a ser «Reactivar».
3. Días después, en «Mis anuncios», pulso «Reactivar» en esa fila y vuelve a «Activo» con el aviso «Anuncio reactivado.».

**Pantallas para el boceto**
- Ficha y fila de «Mis anuncios»: botón secundario «Pausar» (solo si activo) o «Reactivar» (solo si pausado). En la ficha, si está pausado, una franja gris bajo el título: «Este anuncio está pausado: los demás centros no lo ven.».

**Criterios de aceptación**

*Navegación y botones*
- CA1. «Pausar» solo se ve en anuncios `activo`; «Reactivar» solo en `pausado`. En `borrador`, `reservado` y `entregado` no se ve ninguno de los dos.
- CA2. Mientras la petición está en curso, el botón se deshabilita y muestra «Pausando…» / «Reactivando…».

*Comportamiento*
- CA3. Sin diálogo de confirmación. Al responder la API, la etiqueta, la franja y los botones se actualizan con el `anuncio` devuelto, sin recargar la página.
- CA4. Avisos: «Anuncio pausado.» y «Anuncio reactivado.» (verde). Si la API responde 409, aviso rojo «Esta acción no está disponible en el estado actual del anuncio.» y se recarga el anuncio para mostrar su estado real.
- CA5. Pausar y reactivar no cambian ningún otro campo ni `publicado_en`; renuevan `actualizado_en`.

*API*
- CA6. `POST /api/anuncios/:id/pausar` sin cuerpo: `activo` → `pausado`; `200 { anuncio }`.
- CA7. `POST /api/anuncios/:id/reactivar` sin cuerpo: `pausado` → `activo`; `200 { anuncio }`.
- CA8. Desde cualquier otro estado → `409 TRANSICION_NO_PERMITIDA` con `details.estado_actual`. Pausar uno ya pausado → 409 (no es idempotente).
- CA9. `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (otro centro, inexistente, retirado), `405 METODO_NO_PERMITIDO` con `GET`.

*Casos límite*
- CA10. Dos peticiones «pausar» simultáneas: una responde 200 y la otra 409.
- CA11. [Depende de US-21] Un anuncio pausado no aparece en catálogo ni búsquedas; al reactivarlo vuelve. No se implementa aquí.

**Flujos e2e**

E2E-1 · Pausar y reactivar desde la ficha
1. Anuncio activo → «Pausar» → «Anuncio pausado.», etiqueta «Pausado», franja gris, botón «Reactivar». BD `estado='pausado'`.
2. «Reactivar» → «Anuncio reactivado.», «Activo». BD `estado='activo'`.

E2E-2 · Desde «Mis anuncios»
1. En `/mis-anuncios`, fila activa → «Pausar» → la fila muestra «Pausado» y «Reactivar» sin recargar.

E2E-3 · Transición no permitida
1. Anuncio `reservado`: no hay «Pausar». `POST /pausar` directo → `409 TRANSICION_NO_PERMITIDA`, `details.estado_actual = "reservado"`.

E2E-4 · Estado desfasado
1. Abre la ficha (activo) en dos pestañas. En la 1 pausa. En la 2 pulsa «Pausar» → aviso rojo y la pestaña 2 pasa a mostrar «Pausado».

E2E-5 · Otro centro
1. `POST /api/anuncios/<id de A>/pausar` con token de B → `404`; estado sin cambios.

**Tareas**
- T16-1 · Backend: servicio común de transiciones (`UPDATE ... WHERE estado IN`) reutilizable por US-17 y US-70; rutas pausar/reactivar; tests. En la misma PR, actualizar el contrato: rutas y `TRANSICION_NO_PERMITIDA` en el contrato.
- T16-2 · Frontend: botones en ficha y fila, franja de pausado, actualización en sitio.
- T16-3 · QA: automatizar E2E-1..5.

---

## (1) US-70 · Retirar un anuncio de forma definitiva

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** 1 · **Depende de:** US-12
**Cambios respecto al backlog original:** «No puedo retirar un anuncio con pedidos en curso» queda [Depende de US-32]. «Deja de existir para los demás» se garantiza con el 404 y, en catálogo, en US-21. Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero retirar un anuncio de forma definitiva, para dejar de ofrecer material que ya no tengo.
1. En la ficha de mi anuncio pulso «Retirar anuncio».
2. Se abre el diálogo «¿Retirar este anuncio?»; pulso «Retirar».
3. Llego a «Mis anuncios» con el aviso «Anuncio retirado.» y el anuncio ya no está en la lista.

**Pantallas para el boceto**
- Ficha: botón rojo de texto «Retirar anuncio», el último de «Acciones». En la fila de «Mis anuncios», dentro del menú «Más ▾» como «Retirar anuncio» en rojo (ver US-18).
- Diálogo de confirmación (ver CA2).

**Criterios de aceptación**

*Botones*
- CA1. «Retirar anuncio» se ve en estados `borrador`, `activo`, `pausado` y `reservado`; no en `entregado`.
- CA2. Al pulsarlo se abre el diálogo: título «¿Retirar este anuncio?», texto «Dejará de estar disponible y no podrás recuperarlo.», botones «Retirar» (rojo, a la derecha) y «Cancelar». «Cancelar», la tecla Esc y el clic fuera cierran sin hacer nada.
- CA3. Mientras se envía, «Retirar» se deshabilita y muestra «Retirando…».

*Comportamiento*
- CA4. Al confirmar desde la ficha, navega a `/mis-anuncios` (con `replace`) y muestra «Anuncio retirado.». Desde «Mis anuncios», la fila desaparece sin recargar y se muestra el mismo aviso.
- CA5. Después, `/anuncios/:id` y `/anuncios/:id/editar` muestran «Anuncio no encontrado» también para el propietario.
- CA6. Errores: 409 → «Esta acción no está disponible en el estado actual del anuncio.»; 500/503/red → aviso genérico y el diálogo se cierra sin cambios.

*API*
- CA7. `DELETE /api/anuncios/:id`: pone `estado='retirado'` y `retirado_en=now()`; responde `204` sin cuerpo.
- CA8. `entregado` → `409 TRANSICION_NO_PERMITIDA`. Ya retirado, inexistente o de otro centro → `404 NO_ENCONTRADO`.
- CA9. `401`, `403 EMAIL_NO_CONFIRMADO`.

*Datos*
- CA10. Retirada lógica: la fila de `anuncios` y las de `anuncio_fotos` no se borran, ni los archivos de Storage.
- CA11. Ninguna ruta de la API devuelve un anuncio retirado (`GET /:id`, `GET /mios`, transiciones, `PATCH`).

*Casos límite*
- CA12. Doble `DELETE` seguido: el primero `204`, el segundo `404`.
- CA13. [Depende de US-32] Si el anuncio tiene pedidos `pendiente` o `aceptado`, `409 ANUNCIO_CON_PEDIDOS_EN_CURSO` («No puedes retirar un anuncio con pedidos en curso.»). No se implementa aquí.

**Flujos e2e**

E2E-1 · Retirar desde la ficha
1. Anuncio activo «Conos de entrenamiento» → «Retirar anuncio» → diálogo → «Retirar».
2. URL `/mis-anuncios`, aviso «Anuncio retirado.», la lista no contiene «Conos de entrenamiento». BD: `estado='retirado'`, `retirado_en` no nulo; fotos intactas.
3. Abre `/anuncios/<id>` → «Anuncio no encontrado».

E2E-2 · Cancelar
1. «Retirar anuncio» → «Cancelar» → el anuncio sigue «Activo». BD sin cambios.

E2E-3 · Entregado
1. Anuncio entregado: no hay botón. `DELETE` directo → `409 TRANSICION_NO_PERMITIDA`.

E2E-4 · Otro centro y repetición
1. `DELETE` con token de B sobre anuncio de A → `404`; sigue activo.
2. A retira su anuncio → `204`; repite → `404`.

**Tareas**
- T70-1 · Backend: `DELETE /api/anuncios/:id` con el servicio de transiciones; filtro `estado <> 'retirado'` en todas las consultas; tests. En la misma PR, actualizar el contrato: ruta en el contrato.
- T70-2 · Frontend: botón, diálogo y redirección; componente de diálogo de confirmación reutilizable (US-17).
- T70-3 · QA: automatizar E2E-1..4.

**Decisiones pendientes**
- Borrar las fotos de Storage al retirar. Propuesta: no en el Sprint 1 (retirada lógica); un proceso de limpieza se decidiría con US-11 (supresión de datos).

---

## (2) US-17 · Marcar un anuncio como reservado o ya entregado

**Épica:** E03 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-12
**Cambios respecto al backlog original:** «No se pueden hacer pedidos sobre un anuncio no disponible» queda [Depende de US-32]. «Se muestra como no disponible» a otros centros, [Depende de US-21/US-24]. Se añade «Quitar reserva». Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero marcar mi anuncio como reservado cuando lo he comprometido y como entregado cuando ya lo he dado, para que nadie pida material que ya no está disponible.
1. En la ficha de mi anuncio activo pulso «Marcar como reservado»: veo «Anuncio reservado.» y la etiqueta «Reservado».
2. Si el trato se cae, pulso «Quitar reserva» y vuelve a «Activo» con «Reserva quitada.».
3. Cuando lo entrego, pulso «Marcar como entregado», confirmo en el diálogo y veo «Anuncio entregado.»; la ficha ya no tiene botones de acción.

**Pantallas para el boceto**
- Ficha y fila: botones según estado (CA1). Ficha de un reservado: franja naranja «Este anuncio está reservado: los demás centros lo ven como no disponible.». Ficha de un entregado: franja azul «Material entregado el dd/mm/aaaa. Este anuncio ya no se puede modificar.» y ningún botón de acción (solo «Crear uno parecido» de US-19).
- Diálogo de entregar (CA3).

**Criterios de aceptación**

*Botones*
- CA1. Por estado: `activo` → «Marcar como reservado» y «Marcar como entregado»; `reservado` → «Quitar reserva» y «Marcar como entregado»; `pausado`, `borrador`, `entregado` → ninguno de estos.
- CA2. Durante la petición: «Reservando…», «Quitando reserva…», «Marcando…» y deshabilitado.

*Comportamiento*
- CA3. «Marcar como entregado» abre el diálogo: título «¿Marcar como entregado?», texto «Ya no podrás editarlo ni cambiar su estado.», botones «Marcar como entregado» y «Cancelar». Reservar y quitar reserva son inmediatos.
- CA4. Avisos: «Anuncio reservado.», «Reserva quitada.», «Anuncio entregado.». 409 → aviso rojo de transición y recarga del anuncio.
- CA5. Al entregar se guarda `entregado_en=now()`. Ningún cambio de estado modifica `unidades_disponibles`, precio ni fotos.
- CA6. Un anuncio entregado no muestra «Editar», «Pausar», «Retirar anuncio» ni los de esta historia.

*API*
- CA7. `POST /api/anuncios/:id/reservar`: `activo` → `reservado`. `POST /api/anuncios/:id/quitar-reserva`: `reservado` → `activo`. `POST /api/anuncios/:id/entregar`: `activo` o `reservado` → `entregado`. Todas sin cuerpo y `200 { anuncio }`.
- CA8. Transiciones fuera de la tabla → `409 TRANSICION_NO_PERMITIDA`. `401`, `403`, `404` como en US-16.

*Casos límite*
- CA9. Entregar desde `pausado` → 409 (hay que reactivar antes).
- CA10. Entregar dos veces → la segunda 409.
- CA11. [Depende de US-32] Crear pedido sobre anuncio `reservado` o `entregado` → rechazado. [Depende de US-34] la reserva automática por pedido aceptado. No se implementa aquí.

**Flujos e2e**

E2E-1 · Reservar, quitar reserva y entregar
1. Anuncio activo → «Marcar como reservado» → «Anuncio reservado.», franja naranja. BD `reservado`.
2. «Quitar reserva» → «Reserva quitada.», «Activo».
3. «Marcar como entregado» → diálogo → «Marcar como entregado» → «Anuncio entregado.», franja azul con la fecha de hoy, sin botones. BD `entregado`, `entregado_en` no nulo.

E2E-2 · Entregar desde reservado y cancelar
1. Reservado → «Marcar como entregado» → «Cancelar» → sigue «Reservado».
2. Repite y confirma → «Entregado».

E2E-3 · Estado final
1. Anuncio entregado: `POST /reservar`, `/quitar-reserva`, `/entregar`, `/pausar` y `PATCH` → 409 (`TRANSICION_NO_PERMITIDA` o `ANUNCIO_NO_EDITABLE`); `DELETE` → 409.

E2E-4 · Pausado
1. Anuncio pausado: no muestra botones de esta historia. `POST /reservar` → 409 con `estado_actual = "pausado"`.

**Tareas**
- T17-1 · Backend: tres rutas con el servicio de transiciones, `entregado_en`, tests de toda la tabla de transiciones (6 estados × 7 acciones). En la misma PR, actualizar el contrato: rutas en el contrato.
- T17-2 · Frontend: botones por estado, franjas, diálogo de entregar.
- T17-3 · QA: automatizar E2E-1..4.

**Decisiones pendientes**
- Indicar con qué centro se ha reservado. Propuesta: no (llegará con los pedidos, US-34).

---

## (2) US-18 · Ver todos mis anuncios con su estado

**Épica:** E03 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 1 · **Depende de:** US-12
**Cambios respecto al backlog original:** «cerrado» se concreta como «Entregado». El filtro sigue en US-71. Se añade paginación de 20. Sprint 2 → 1.

**Historia**
Como responsable de material de un centro, quiero ver todos mis anuncios con su estado, para tener controlado qué material tengo ofrecido.
1. Pulso «Mis anuncios» en la cabecera.
2. Llego a `/mis-anuncios` y veo mis anuncios, del último modificado al más antiguo, con su foto, título, unidades, precio, estado y acciones.
3. Pulso un título y llego a su ficha.

**Pantallas para el boceto**
- Cabecera: enlace «Mis anuncios» (subrayado cuando la ruta empieza por `/mis-anuncios`).
- `/mis-anuncios` · «Mis anuncios»: título h1 «Mis anuncios» y a la derecha el botón «Publicar anuncio»; texto «n anuncios» (o «1 anuncio»); [filtros de US-71]; lista con una fila por anuncio: miniatura 64×64 de la principal (o un recuadro gris «Sin foto» en borradores), título (enlace a `/anuncios/:id`), «Balones · Fútbol», «12 unidades» (o «1 unidad»), precio «8,50 € / unidad» o «Donación · Gratis», etiqueta de estado, «Modificado el dd/mm/aaaa»; a la derecha, los botones de acción: el principal visible («Editar» / «Completar y publicar») y el resto en un menú «Más ▾»; paginación «Anterior» · «Página x de y» · «Siguiente».

**Criterios de aceptación**

*Navegación*
- CA1. «Mis anuncios» en la cabecera navega a `/mis-anuncios`. El título de cada fila navega a `/anuncios/:id`.
- CA2. La página se refleja en la URL (`/mis-anuncios?pagina=2`); recargar mantiene la página. `pagina` no numérica o < 1 → se muestra la 1.

*Comportamiento*
- CA3. Se listan los anuncios del centro en `borrador`, `activo`, `pausado`, `reservado` y `entregado`; nunca `retirado` ni de otros centros.
- CA4. Orden: `actualizado_en` descendente; a igualdad, `id` descendente.
- CA5. 20 por página. «Anterior» deshabilitado en la 1; «Siguiente» deshabilitado en la última; la paginación no se muestra si hay ≤ 20.
- CA6. Acciones por fila según estado: las de US-15, US-16, US-17, US-70, US-19 y US-90. Botón principal visible: «Editar» (activo, pausado, reservado), «Completar y publicar» (borrador), ninguno (entregado). El resto en «Más ▾». Tras una acción, la fila se actualiza con el anuncio devuelto (o desaparece si se retira) sin perder la página.
- CA7. Al pausar, reservar, etc., la fila no cambia de posición hasta la siguiente carga.
- CA8. Vacío: «Todavía no has publicado ningún anuncio.» y botón «Publicar tu primer anuncio» → `/anuncios/nuevo`.
- CA9. Cargando: «Cargando…». Error: «No se ha podido cargar. » y «Reintentar» (repite la petición).
- CA10. Si se pide una página mayor que la última (p. ej. tras retirar), se muestra la última.

*API*
- CA11. `GET /api/anuncios/mios?pagina=1&por_pagina=20` (`por_pagina` 1-50, por defecto 20; valores fuera → `400 DATOS_INVALIDOS` con `details.por_pagina` «Debe ser un número entre 1 y 50.»; `pagina` < 1 o no entero → `details.pagina` «Debe ser un número entero mayor que 0.»).
- CA12. `200 { "anuncios": [resumen], "total": n, "pagina": p, "por_pagina": 20 }`, donde `resumen` = `id, titulo, categoria, deporte, unidades_disponibles, modalidad, precio_unitario_centimos, estado, foto_principal_url (o null), publicado_en, actualizado_en`.
- CA13. `401`, `403 EMAIL_NO_CONFIRMADO`. La ruta `/mios` se declara antes que `/:id` (no responde 404 por tomar «mios» como id).

*Permisos*
- CA14. Con token de B, la lista solo contiene anuncios de B aunque A tenga 30.

*Casos límite*
- CA15. Con 21 anuncios: página 1 con 20, página 2 con 1, «Página 2 de 2».
- CA16. Títulos de 80 caracteres se cortan con «…» en una línea; el título completo en `title`.

**Flujos e2e**

E2E-1 · Lista con estados
1. Centro con 4 anuncios: activo (A), pausado (P), reservado (R), entregado (E) y uno retirado (X). Modificados en orden A < P < R < E.
2. «Mis anuncios» → 4 filas en orden E, R, P, A con sus etiquetas; X no aparece; «4 anuncios».

E2E-2 · Vacío
1. Centro nuevo → «Todavía no has publicado ningún anuncio.» → «Publicar tu primer anuncio» → `/anuncios/nuevo`.

E2E-3 · Paginación
1. 21 anuncios → página 1: 20 filas, «Anterior» deshabilitado → «Siguiente» → URL `?pagina=2`, 1 fila.

E2E-4 · Acción en fila
1. Fila activa → «Más ▾» → «Pausar» → la fila muestra «Pausado» sin recargar.

E2E-5 · Error y reintento
1. `GET /api/anuncios/mios` interceptado para que responda `503` → «No se ha podido cargar.» → se quita la intercepción → «Reintentar» → lista.

E2E-6 · Aislamiento
1. `GET /api/anuncios/mios` con token de B → solo los de B; `total` correcto.

**Tareas**
- T18-1 · Backend: `GET /api/anuncios/mios` con paginación y tests. En la misma PR, actualizar el contrato: ruta en el contrato.
- T18-2 · Frontend: enlace en cabecera, `/mis-anuncios` con filas, menú «Más ▾», paginación, vacío, carga y error.
- T18-3 · QA: automatizar E2E-1..6 (con un script de semilla de 21 anuncios).

---

## (1) US-71 · Filtrar mis anuncios por estado

**Épica:** E03 · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** 3 · **Depende de:** US-18
**Cambios respecto al backlog original:** «cerrados» = «Entregados». Se añade «Borradores» (estado de US-20) que solo se muestra si existe al menos uno.

**Historia**
Como responsable de material de un centro, quiero filtrar mis anuncios por estado, para encontrar rápido los que tengo que gestionar.
1. En `/mis-anuncios` pulso la pestaña «Pausados (3)».
2. Veo solo mis 3 anuncios pausados y la URL pasa a `/mis-anuncios?estado=pausado`.
3. Pulso «Todos (15)» y vuelvo a ver la lista completa.

**Pantallas para el boceto**
- Bajo el h1 de `/mis-anuncios`, una fila de pestañas: «Todos (n)», «Activos (n)», «Pausados (n)», «Reservados (n)», «Entregados (n)» y, solo si n > 0, «Borradores (n)». La seleccionada, resaltada.

**Criterios de aceptación**

*Comportamiento*
- CA1. Cada pestaña filtra por su estado (`activo`, `pausado`, `reservado`, `entregado`, `borrador`); «Todos» quita el filtro. Al cambiar de pestaña se vuelve a la página 1.
- CA2. El filtro se refleja en la URL (`?estado=pausado&pagina=1`); recargar o compartir la URL lo conserva. «Todos» elimina el parámetro. Un `estado` desconocido en la URL se trata como «Todos».
- CA3. Los contadores se muestran siempre, incluso a 0 (salvo la de borradores, que se oculta a 0), y se actualizan tras cualquier acción de la lista.
- CA4. Con un filtro sin resultados: «No tienes anuncios en este estado.» y el botón «Ver todos» (→ «Todos»).
- CA5. Si una acción saca un anuncio del estado filtrado (p. ej. reactivar en «Pausados»), la fila desaparece de la lista y el contador se actualiza.

*API*
- CA6. `GET /api/anuncios/mios?estado=pausado`: acepta uno de `borrador`, `activo`, `pausado`, `reservado`, `entregado`; otro valor (incluido `retirado`) → `400 DATOS_INVALIDOS`, `details.estado` «El estado no es válido.».
- CA7. La respuesta añade `"contadores": { "todos": n, "borrador": n, "activo": n, "pausado": n, "reservado": n, "entregado": n }`, siempre sobre todos los anuncios no retirados del centro, con independencia del filtro.

*Casos límite*
- CA8. `?estado=PAUSADO` (mayúsculas) en la API → 400; en la web, se trata como «Todos».

**Flujos e2e**

E2E-1 · Filtrar y volver
1. Centro con 2 activos, 3 pausados, 1 entregado → pestañas «Todos (6)», «Activos (2)», «Pausados (3)», «Reservados (0)», «Entregados (1)»; sin «Borradores».
2. «Pausados (3)» → 3 filas, URL `?estado=pausado`. «Todos (6)» → 6 filas, URL sin `estado`.

E2E-2 · Vacío
1. «Reservados (0)» → «No tienes anuncios en este estado.» → «Ver todos».

E2E-3 · Acción que saca la fila
1. En «Pausados (3)» → «Reactivar» en una fila → la fila desaparece, «Pausados (2)», «Activos (3)».

E2E-4 · API
1. `GET /api/anuncios/mios?estado=retirado` → `400 DATOS_INVALIDOS`.

**Tareas**
- T71-1 · Backend: parámetro `estado` y `contadores` en `GET /api/anuncios/mios`; tests.
- T71-2 · Frontend: pestañas, URL, vacío filtrado.
- T71-3 · QA: automatizar E2E-1..4.

---

## (2) US-19 · Crear un anuncio a partir de uno que ya tengo

**Épica:** E03 · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-12, US-13, US-14
**Cambios respecto al backlog original:** se concreta que se copian también las fotos y en qué estados se ofrece.

**Historia**
Como responsable de material de un centro, quiero crear un anuncio partiendo de uno existente, para publicar lotes parecidos sin volver a escribirlo todo.
1. En la ficha de mi anuncio «Balones de fútbol talla 5» (entregado) pulso «Crear uno parecido».
2. Llego a `/anuncios/nuevo?desde=<id>`: el formulario «Publicar anuncio» aparece relleno con sus datos y fotos y el aviso «Partes de una copia de “Balones de fútbol talla 5”. Revisa los datos antes de publicar.».
3. Cambio el título a «Balones de fútbol talla 4» y las unidades a 6, quito una foto y pulso «Publicar».
4. Llego a la ficha del nuevo anuncio; el original no ha cambiado.

**Pantallas para el boceto**
- Ficha y menú «Más ▾» de la fila: botón «Crear uno parecido» en estados `activo`, `pausado`, `reservado` y `entregado`.
- `/anuncios/nuevo?desde=:id`: el formulario de US-12 con una franja informativa arriba (texto de CA3).

**Criterios de aceptación**

*Navegación*
- CA1. «Crear uno parecido» navega a `/anuncios/nuevo?desde=<id>`. No aparece en `borrador`.
- CA2. Si `desde` no es un anuncio del centro (inexistente, de otro centro, retirado o UUID inválido), se muestra el formulario vacío con el aviso rojo «No se ha podido copiar el anuncio.».

*Comportamiento*
- CA3. Se rellenan título, descripción, categoría, deporte, unidades disponibles, estado del material, modalidad, precio y fotos (con la misma principal). Franja: «Partes de una copia de “<título>”. Revisa los datos antes de publicar.».
- CA4. Si el original tiene 0 unidades [Depende de US-34], el campo «Unidades disponibles» aparece vacío.
- CA5. Todo se puede cambiar con las reglas de US-12/13/14. «Cancelar» con la copia sin tocar vuelve a `/mis-anuncios` sin diálogo; con cambios, diálogo de US-12.
- CA6. Al publicar se crea un anuncio nuevo `activo` con `id` nuevo; el original no cambia (ni `actualizado_en`).
- CA7. Las fotos copiadas se duplican en Storage bajo la carpeta del nuevo anuncio: quitar o retirar uno no afecta al otro.

*API*
- CA8. `POST /api/anuncios` acepta en `datos` el campo opcional `fotos_copiar_de`: `{ "anuncio_id": "<id>", "fotos": ["<id foto>", ...] }` (en orden). Las fotos copiadas van antes que las nuevas subidas; `foto_principal` admite `copia:<id foto>` además de `nueva:<n>`.
- CA9. `anuncio_id` que no es del centro o retirado → `404 NO_ENCONTRADO`; ids de foto que no son de ese anuncio → `400 DATOS_INVALIDOS`, `details.fotos_copiar_de` «Alguna foto no pertenece al anuncio original.». El total (copiadas + nuevas) debe estar entre 1 y 8.
- CA10. `201 { anuncio }`. La copia de Storage es atómica como en US-13 CA20.

*Casos límite*
- CA11. Copiar un anuncio con 8 fotos y añadir una más → «Puedes añadir 8 fotos como máximo.».

**Flujos e2e**

E2E-1 · Copia con cambios
1. Original O (entregado, 2 fotos, 850 céntimos) → «Crear uno parecido» → formulario relleno.
2. Cambia título y unidades a 6, quita la foto 2 → «Publicar».
3. Ficha nueva N «Activo», 6 unidades, 1 foto. BD: O sin cambios (estado, fotos, `actualizado_en`); N con `anuncio_fotos` propia y objeto en `<centro>/<N>/`.

E2E-2 · Copia sin cambios
1. «Crear uno parecido» → «Publicar» sin tocar → se crea N idéntico salvo `id` y fechas.

E2E-3 · Origen ajeno
1. Abrir `/anuncios/nuevo?desde=<id de otro centro>` → formulario vacío y «No se ha podido copiar el anuncio.».

E2E-4 · Independencia de fotos
1. Tras E2E-1, editar N y quitar su foto → la foto de O sigue accesible.

**Tareas**
- T19-1 · Backend: `fotos_copiar_de` en `POST /api/anuncios` con copia en Storage y tests.
- T19-2 · Frontend: botón, precarga con `?desde`, franja.
- T19-3 · QA: automatizar E2E-1..4.

**Decisiones pendientes**
- Añadir «(copia)» al título. Propuesta: no, se copia igual.

---

## (3) US-20 · Subir varios anuncios a la vez desde un fichero CSV

**Épica:** E03 · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** 6 · **Depende de:** US-12, US-14, US-18
**Cambios respecto al backlog original:** se crea el estado `borrador` para los anuncios importados sin foto. Completar un borrador con fotos y publicarlo pasa a la historia nueva US-90 (sin ella el flujo no termina). El detalle por fila de los errores sigue en US-72; aquí solo se informa del número.

**Historia**
Como responsable de material de un centro con mucho material, quiero subir un CSV con varios anuncios, para darlos de alta sin publicarlos uno a uno.
1. En `/mis-anuncios` pulso «Importar desde CSV».
2. Llego a `/anuncios/importar`, pantalla «Importar anuncios desde CSV». Pulso «Descargar plantilla» y obtengo `plantilla-anuncios.csv`.
3. La relleno en Excel con 30 filas y la guardo como «CSV UTF-8 (delimitado por comas)» (Excel en español usa «;»).
4. Pulso «Elegir fichero», elijo `material.csv` y pulso «Importar».
5. Veo «Se han creado 30 borradores.» y el botón «Ver borradores». Al pulsarlo voy a `/mis-anuncios?estado=borrador`, donde cada uno espera sus fotos (US-90).

**Pantallas para el boceto**
- `/mis-anuncios`: junto a «Publicar anuncio», botón secundario «Importar desde CSV» → `/anuncios/importar`.
- `/anuncios/importar`: h1 «Importar anuncios desde CSV»; bloque «1. Descarga la plantilla» con el botón «Descargar plantilla» y la lista de valores admitidos (CA8); bloque «2. Sube el fichero» con «Elegir fichero» (`accept=".csv,text/csv"`), el nombre y tamaño del fichero elegido y el botón primario «Importar» (deshabilitado hasta elegir); bloque «Resultado» (vacío hasta importar).
- Resultado: texto en verde «Se han creado n borradores.»; si hubo filas con error, texto en rojo «m filas no se han importado.» [detalle en US-72]; botones «Ver borradores» y «Importar otro fichero».

**Criterios de aceptación**

*Formato del fichero*
- CA1. Codificación UTF-8, con o sin BOM. Un fichero que no es UTF-8 válido → error de fichero «El fichero debe estar en UTF-8.».
- CA2. Separador `;`. Delimitador de texto `"` (RFC 4180: un campo puede ir entre comillas, contener `;` o saltos de línea, y una comilla se escribe `""`). Fin de línea `\n` o `\r\n`.
- CA3. Primera línea = cabecera exacta, en este orden y en minúsculas: `titulo;descripcion;categoria;deporte;unidades_disponibles;estado_material;modalidad;precio_unitario`. Se admite una 9.ª columna `errores` al final, que se ignora (la añade el informe de US-72). Si la cabecera no coincide → «La cabecera no coincide con la plantilla. Descarga la plantilla y copia tus datos en ella.».
- CA4. Tamaño máximo 1 MB (1.048.576 bytes, acepta; 1.048.577 rechaza): `413 PETICION_DEMASIADO_GRANDE`, «El fichero no puede superar 1 MB.».
- CA5. Filas de datos: entre 1 y 200 (las líneas totalmente vacías o solo con `;` se ignoran y no cuentan). 0 filas → «El fichero no tiene ningún anuncio.»; 201 → «El fichero no puede tener más de 200 anuncios.».
- CA6. Extensión `.csv` obligatoria (sin distinguir mayúsculas); otra → «Elige un fichero .csv.».
- CA7. Cada valor se recorta de espacios. Una fila con un número de columnas distinto de 8 (o 9 con `errores`) es una fila con error («La fila no tiene 8 columnas.»), no un error del fichero.

*Valores de las columnas*
- CA8. `titulo`, `descripcion`: reglas de la «Tabla de campos». `categoria`, `deporte`, `estado_material`: se acepta el texto de pantalla («Ropa y equipación») o el valor de la API (`ropa_equipacion`), sin distinguir mayúsculas pero con tildes exactas. `unidades_disponibles`: entero 1-9999 sin decimales ni separador de miles. `modalidad`: «Venta»/«venta» o «Donación»/«donacion»/«donación». `precio_unitario`: en euros con el formato de la web («8,50» o «8.50»), obligatorio si venta y vacío si donación. Mensajes por celda iguales a la «Tabla de campos».
- CA9. La plantilla contiene la cabecera y dos filas de ejemplo (una venta y una donación) que el usuario debe borrar: `Balones de fútbol talla 5;Doce balones usados una temporada, sin pinchazos.;Balones;Fútbol;12;Buen estado;Venta;8,50` y `Petos de entrenamiento;Veinte petos naranjas de talla M, lavados.;Ropa y equipación;Varios;20;Usado;Donación;`. Se descarga con BOM UTF-8 para que Excel muestre bien las tildes.

*Comportamiento*
- CA10. Cada fila válida crea un anuncio en estado `borrador`, sin fotos y con `publicado_en = null`. Las filas con error no crean nada y no impiden crear las válidas.
- CA11. Todas las filas válidas se insertan en una única transacción: o se crean todas las válidas o ninguna (si falla la BD, 503 y nada creado).
- CA12. Importar el mismo fichero dos veces crea los borradores dos veces (no se detectan duplicados).
- CA13. Mientras se procesa: «Importar» deshabilitado y «Importando…».
- CA14. Errores de fichero (CA1, CA3-CA6) se muestran en rojo bajo «Elegir fichero» y no se crea nada.
- CA15. Un borrador aparece en «Mis anuncios» con la etiqueta «Borrador», el recuadro «Sin foto», el botón «Completar y publicar» (US-90) y «Retirar anuncio» en «Más ▾». No tiene «Editar», «Pausar», «Reservar», «Entregar» ni «Crear uno parecido».
- CA16. [Depende de US-21] Un borrador nunca se ve en el catálogo.

*API*
- CA17. `GET /api/anuncios/plantilla.csv` (privada): `200`, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="plantilla-anuncios.csv"`.
- CA18. `POST /api/anuncios/importar` `multipart/form-data` con la parte `fichero`. Respuesta `200 { "importacion": { "filas": 30, "creados": 28, "con_errores": 2, "anuncios": [{ "fila": 2, "id": "uuid", "titulo": "..." }], "errores": [...] } }` (`fila` = número de línea del fichero, la cabecera es la 1; `errores` lo define US-72).
- CA19. Errores de fichero → `400 DATOS_INVALIDOS` con `details.fichero` y el mensaje de CA1-CA6; tamaño → `413`. `401`, `403 EMAIL_NO_CONFIRMADO`.
- CA20. Si todas las filas tienen error → `200` con `creados: 0`.

*Datos*
- CA21. Migración: añade `borrador` al `CHECK` de `estado` y permite `publicado_en` nulo solo si `estado='borrador'`.
- CA22. `GET /api/anuncios/:id`, `PATCH` (US-90) y `DELETE` funcionan con borradores; las transiciones de US-16/US-17 desde `borrador` → 409.

**Flujos e2e**

E2E-1 · Importación correcta
1. «Mis anuncios» → «Importar desde CSV» → «Descargar plantilla» → fichero con cabecera y 2 ejemplos.
2. Sube un CSV de 3 filas válidas (una venta «8,50», una donación, una con `ropa_equipacion`) → «Importar».
3. «Se han creado 3 borradores.» → «Ver borradores» → 3 filas «Borrador». BD: 3 anuncios `estado='borrador'`, venta con 850 céntimos, donación con precio nulo, sin fotos.

E2E-2 · Fichero no válido
1. Sube `material.xlsx` → «Elige un fichero .csv.».
2. Sube un CSV con cabecera `title;description;...` → «La cabecera no coincide con la plantilla. …». BD sin cambios.
3. Sube un CSV de 201 filas → «El fichero no puede tener más de 200 anuncios.». Uno de 200 filas válidas → «Se han creado 200 borradores.».

E2E-3 · Mezcla de filas
1. CSV de 5 filas, 2 con unidades «0» → «Se han creado 3 borradores.» y «2 filas no se han importado.».

E2E-4 · Comillas y separadores
1. Fila con descripción `"Redes de 3x2; incluye ganchos ""reforzados"""` → se crea con la descripción `Redes de 3x2; incluye ganchos "reforzados"`.

E2E-5 · Codificación
1. Fichero en Windows-1252 → «El fichero debe estar en UTF-8.».

**Tareas**
- T20-1 · Base de datos: migración del estado `borrador`.
- T20-2 · Backend: parser CSV (librería `csv-parse` con `delimiter: ';'`, `bom: true`, `relax_column_count: true`), validación por fila reutilizando el módulo compartido, inserción en transacción, plantilla; tests de CA1-CA12.
- T20-3 · Frontend: botón en «Mis anuncios», pantalla `/anuncios/importar`, resumen, etiqueta y fila de borrador.
- T20-4 · Documentación: rutas y formato CSV en el contrato.
- T20-5 · QA: ficheros de prueba en `tests/fixtures/csv/` y automatizar E2E-1..5.

**Decisiones pendientes**
- Separador. Propuesta: solo `;` (lo que guarda Excel en español). Alternativa: detectar `,` automáticamente.
- Límite de filas. Propuesta: 200 por fichero.
- Importar fotos por URL en el CSV. Propuesta: no; las fotos se añaden en US-90.

---

## (2) US-90 · Completar con fotos y publicar un anuncio importado

**Épica:** E03 · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-20, US-13, US-15
**Cambios respecto al backlog original:** historia nueva. Sale de US-20 («quedan pendientes de añadirles foto para publicarse»): sin ella los borradores importados no se podrían publicar nunca.

**Historia**
Como responsable de material de un centro, quiero añadir las fotos a un anuncio importado y publicarlo, para terminar de dar de alta el material del CSV.
1. En `/mis-anuncios?estado=borrador` pulso «Completar y publicar» en «Petos de entrenamiento».
2. Llego a `/anuncios/<id>/editar`, pantalla «Completar anuncio», con los datos del CSV y la sección «Fotos» vacía.
3. Añado `petos.jpg`, reviso los datos y pulso «Publicar».
4. Llego a la ficha con «Anuncio publicado.» y la etiqueta «Activo».
5. Si solo quiero corregir datos sin fotos todavía, pulso «Guardar borrador» y sigue como borrador.

**Pantallas para el boceto**
- `/anuncios/:id/editar` en un borrador: h1 «Completar anuncio»; franja morada «Este anuncio está en borrador. Añade al menos una foto para publicarlo.»; formulario de US-15; botones «Cancelar», «Guardar borrador» (secundario) y «Publicar» (primario).
- Ficha de un borrador: etiqueta «Borrador», la misma franja, galería vacía con el texto «Sin fotos», acciones «Completar y publicar» y «Retirar anuncio».

**Criterios de aceptación**

*Navegación*
- CA1. «Completar y publicar» (ficha y fila de un borrador) navega a `/anuncios/:id/editar`.
- CA2. Tras «Publicar», navega a `/anuncios/:id` con «Anuncio publicado.». Tras «Guardar borrador», a `/anuncios/:id` con «Borrador guardado.».

*Validación*
- CA3. «Guardar borrador» valida todos los campos salvo las fotos (0-8 permitidas).
- CA4. «Publicar» valida todo, fotos 1-8 incluidas: sin fotos, «Añade al menos una foto.».
- CA5. Mientras se envía: «Guardando…» o «Publicando…» en el botón pulsado y ambos deshabilitados.

*API*
- CA6. `PATCH /api/anuncios/:id` (US-15) acepta borradores; en ellos `fotos` final puede ser 0-8. `datos.publicar: true` (solo en borradores) además pasa a `activo` y fija `publicado_en=now()` en la misma transacción, exigiendo 1-8 fotos (`400 DATOS_INVALIDOS`, `details.fotos` «Añade al menos una foto.»).
- CA7. `datos.publicar: true` en un anuncio que no es borrador → `409 TRANSICION_NO_PERMITIDA`. `publicar` con otro valor que no sea booleano → `400`, `details.publicar` «Debe ser verdadero o falso.».
- CA8. `200 { anuncio }` en ambos casos.

*Casos límite*
- CA9. Un borrador publicado ya no puede volver a borrador.
- CA10. El precio importado se puede corregir al completar (mismas reglas de US-14).

**Flujos e2e**

E2E-1 · Completar y publicar
1. Borrador «Petos de entrenamiento» → «Completar y publicar» → añade `petos.jpg` → «Publicar».
2. Ficha «Activo», «Anuncio publicado.». BD: `estado='activo'`, `publicado_en` no nulo, 1 foto principal.

E2E-2 · Publicar sin foto
1. «Completar y publicar» → «Publicar» sin fotos → «Añade al menos una foto.»; sigue borrador.

E2E-3 · Guardar borrador
1. Cambia unidades a 15 → «Guardar borrador» → «Borrador guardado.», etiqueta «Borrador». BD `unidades_disponibles=15`, `estado='borrador'`.

E2E-4 · API
1. `PATCH` con `publicar: true` sobre un anuncio activo → `409 TRANSICION_NO_PERMITIDA`.

**Tareas**
- T90-1 · Backend: soporte de borrador y `publicar` en `PATCH`; tests.
- T90-2 · Frontend: modo «Completar anuncio» del formulario de edición, ficha de borrador.
- T90-3 · QA: automatizar E2E-1..4.

---

## (2) US-72 · Ver qué filas de mi CSV tienen errores

**Épica:** E03 · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-20
**Cambios respecto al backlog original:** se define el informe en pantalla y un CSV de errores descargable que se puede corregir y volver a subir.

**Historia**
Como responsable de material de un centro, quiero ver qué filas de mi CSV tienen errores y por qué, para corregirlas sin revisar todo el fichero.
1. Importo `material.csv` con 30 filas; veo «Se han creado 28 borradores.» y «2 filas no se han importado.».
2. Debajo hay una tabla con cada error: fila, columna, valor y motivo.
3. Pulso «Descargar filas con errores», obtengo `errores-material.csv` con solo esas 2 filas y la columna `errores` al final.
4. Lo corrijo en Excel y lo vuelvo a subir: se crean los 2 borradores que faltaban.

**Pantallas para el boceto**
- Bloque «Resultado» de `/anuncios/importar` (US-20) con, debajo del resumen: tabla «Filas con errores» con columnas «Fila», «Columna», «Valor» y «Motivo» (una línea por cada error, ordenadas por fila y luego por el orden de las columnas); botón «Descargar filas con errores».

**Criterios de aceptación**

*Comportamiento*
- CA1. Se informa de todos los errores de cada fila (no solo el primero). Una fila con 3 errores ocupa 3 líneas de la tabla.
- CA2. «Fila» es el número de línea del fichero (la cabecera es la 1). Si un valor con comillas ocupa varias líneas, se usa la línea donde empieza la fila.
- CA3. «Columna» es el nombre de la cabecera (`unidades_disponibles`) o «—» para errores de toda la fila. «Valor» es el valor original recortado a 50 caracteres con «…»; vacío se muestra como «(vacío)».
- CA4. «Motivo» es el mensaje exacto de la «Tabla de campos» (p. ej. «Las unidades deben ser un número entero entre 1 y 9999.») o «La fila no tiene 8 columnas.».
- CA5. La tabla muestra como máximo 200 líneas; si hay más: «Se muestran los 200 primeros errores. Descarga el fichero para verlos todos.».
- CA6. Las filas correctas se crean igual (US-20 CA10); el informe no las lista.
- CA7. El resultado se pierde al salir de la pantalla (no se guarda historial).

*Fichero de errores*
- CA8. «Descargar filas con errores» genera en el navegador `errores-<nombre original sin extensión>.csv`: UTF-8 con BOM, separador `;`, cabecera de la plantilla + columna `errores`; una fila por cada fila con error con sus valores originales tal cual y en `errores` los motivos unidos por « | » con el formato `columna: motivo` (p. ej. `unidades_disponibles: Las unidades deben ser un número entero entre 1 y 9999. | precio_unitario: Indica el precio por unidad.`).
- CA9. Ese fichero, corregido, se puede subir sin quitar la columna `errores` (US-20 CA3).

*API*
- CA10. `importacion.errores` de `POST /api/anuncios/importar` es `[{ "fila": 4, "columna": "unidades_disponibles", "valor": "0", "mensaje": "Las unidades deben ser un número entero entre 1 y 9999." }]` (`columna` es `null` en errores de fila) y se añade `importacion.filas_con_error`: `[{ "fila": 4, "valores": ["...", 8 valores originales] }]` para generar el fichero.

*Casos límite*
- CA11. Sin errores: no se muestran la tabla ni el botón.
- CA12. Un valor con `;` o comillas se escribe en el fichero de errores entre comillas y con `""`, de modo que se vuelve a leer igual.

**Flujos e2e**

E2E-1 · Informe
1. CSV de 4 filas: fila 3 con `unidades_disponibles` «0»; fila 5 con `categoria` «Pelotas» y `modalidad` «Venta» sin precio.
2. «Importar» → «Se han creado 2 borradores.», «2 filas no se han importado.» y la tabla: (3, unidades_disponibles, 0, «Las unidades deben ser…»), (5, categoria, Pelotas, «La categoría no es válida.»), (5, precio_unitario, (vacío), «Indica el precio por unidad.»).

E2E-2 · Corregir y resubir
1. «Descargar filas con errores» → `errores-material.csv` con 2 filas y la columna `errores`.
2. Corrige los valores sin borrar la columna y súbelo → «Se han creado 2 borradores.»; sin tabla de errores.

E2E-3 · Fila con columnas de más
1. Fila con 10 columnas → línea con columna «—» y «La fila no tiene 8 columnas.».

**Tareas**
- T72-1 · Backend: lista completa de errores por fila y `filas_con_error`; tests.
- T72-2 · Frontend: tabla de errores y generación del CSV de errores.
- T72-3 · QA: automatizar E2E-1..3.

**Decisiones pendientes**
- Guardar un historial de importaciones. Propuesta: no.
