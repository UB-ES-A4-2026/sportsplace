# Guía común para redactar el backlog de Sportsplace

Todas las historias pendientes se reescriben con esta guía. Lo ya entregado en el Sprint 0 (US-01, US-02, US-03, US-66 y US-67) no se cambia: es la base sobre la que se construye.

## Feedback del profesor que aplicamos

1. **Historias mucho más concretas.** No vale «datos básicos»: hay que decir qué datos son (nombre del centro, localidad…) y qué valor se acepta como correcto en cada uno.
2. **La historia empieza con el primer clic del flujo,** no en la pantalla final: desde dónde entra el usuario, qué pulsa y adónde llega.
3. **Bocetos.** Cada historia con interfaz describe sus pantallas para poder dibujar el mockup.
4. **Historia = lo que vive el usuario. Criterios de aceptación = todo lo técnico.** Todas las decisiones técnicas van en los criterios: botones, enlaces, pantallas, campos, reglas, mensajes, API, datos y permisos.
5. **No dejar nada a la imaginación.** Dos personas o dos agentes que lean la misma historia tienen que construir exactamente lo mismo.
6. **Los criterios acabarán siendo tests.** Cada criterio es comprobable, con su resultado esperado, y cada historia incluye uno o varios flujos e2e paso a paso.
7. **No existen las TR.** El trabajo técnico (tablas, Storage, configuración) es una tarea de la historia que lo necesita.
8. **En GitHub, el Kanban es de tareas.** Cada historia lista sus tareas con un ID propio, `T<número de historia>-<n>` (T12-1, T12-2…), que también da nombre a sus ramas y PR.
9. **Si una historia es demasiado grande o mezcla cosas, se divide.** Si falta una historia para que el flujo tenga sentido, se crea. Las historias nuevas toman el número libre siguiente a partir de US-84 y se indica de dónde salen.

## Formato obligatorio de cada historia

```
## (puntos) US-xx · Título en primera persona

**Épica:** Exx · **Prioridad:** Must/Should/Could · **Puntos:** n · **Sprint:** n · **Depende de:** US-..
**Cambios respecto al backlog original:** (qué se ha acotado, dividido o movido y por qué; «Ninguno» si no hay)

**Historia**
Como <rol concreto>, quiero <objetivo>, para <beneficio>.
Flujo que vive el usuario, numerado, desde el primer clic (pantalla de origen → botón o enlace exacto → pantalla → resultado).

**Pantallas para el boceto**
- `/ruta`: nombre de la pantalla. Qué elementos tiene y en qué orden.

**Criterios de aceptación**
Numerados (CA1, CA2…), agrupados por subtítulos: Navegación · Campos y validación · Comportamiento · Mensajes · API · Datos · Permisos y seguridad · Casos límite.
Cada criterio es una frase comprobable con el resultado exacto: textos entre «», códigos HTTP, `code` de error y valores límite (el mínimo y el máximo aceptados, y el primer valor rechazado).

**Flujos e2e**
E2E-1 (camino feliz), E2E-2… (errores y casos límite). Pasos numerados: datos de entrada concretos → acción → resultado esperado en pantalla y en la base de datos.

**Tareas**
- Txx-1 · Base de datos: …
- Txx-2 · Backend: …
- Txx-3 · Frontend: …
- Txx-n · QA: automatizar los e2e y los casos de prueba de los CA.

**Decisiones pendientes** (solo si hay algo que el equipo o el PO deben confirmar; cada una con una propuesta concreta por defecto)
```

## Convenciones ya existentes (Sprint 0: no se cambian)

- **Arquitectura:** web React + Vite. La web solo llama a nuestra API, en `/api/...` (Express 5). La API usa Supabase Auth y PostgreSQL de Supabase.
- **Sesión:** cabecera `Authorization: Bearer <access_token>`. Las rutas privadas usan `requireAuth` (si falla, `401 NO_AUTENTICADO`) y, si modifican datos o usan el marketplace, también `requireEmailConfirmado` (si falla, `403 EMAIL_NO_CONFIRMADO`).
- **JSON:** campos en `snake_case` y en castellano.
- **Formato de error:** `{ "error": { "code", "message", "details" } }`. `details` es un objeto `campo → mensaje` en los errores de validación.
- **Códigos de error ya existentes:**
  - `DATOS_INVALIDOS` (400), `JSON_INVALIDO` (400), `NO_AUTENTICADO` (401), `CREDENCIALES_INCORRECTAS` (401), `EMAIL_NO_CONFIRMADO` (403).
  - `NO_ENCONTRADO` (404), `METODO_NO_PERMITIDO` (405), `EMAIL_YA_REGISTRADO` (409), `PETICION_DEMASIADO_GRANDE` (413), `DEMASIADOS_INTENTOS` (429).
  - `ERROR_INTERNO` (500), `BASE_DATOS_NO_DISPONIBLE` (503), `AUTH_NO_DISPONIBLE` (503).
- **Códigos nuevos:** en mayúsculas y castellano, por ejemplo `TRANSICION_NO_PERMITIDA` (409) o `SIN_PERMISO` (403).
- **Recursos de otro centro:** intentar ver o modificar un recurso privado de otro centro responde `404 NO_ENCONTRADO`, no 403, para no revelar que existe.
- **Rutas web ya existentes:** `/` (inicio), `/registro`, `/confirmar-email`, `/entrar`, `/panel` (zona privada). Sin sesión, una ruta privada redirige a `/entrar`.

### Tabla `centros` existente

| Campo | Regla actual |
|---|---|
| `nombre` | 1-160 caracteres, no vacío. |
| `email` | Único (sin distinguir mayúsculas). |
| `localidad` | 1-120 caracteres, no vacía. |
| `direccion` | 255 como máximo. Opcional. |
| `codigo_postal` | 20 como máximo. Opcional. |
| `telefono` | 30 como máximo. Opcional. |
| Otros | `politica_privacidad_aceptada`, `email_confirmado_en`, `usuario_id` (FK a `auth.users`), `creado_en`. |

Cualquier campo nuevo del centro se añade con una migración nueva, dentro de la historia que lo necesita.

## Convenciones de interfaz (para todas las historias)

- **Idioma de los textos:** castellano. NFR-04 (catalán e inglés) se resuelve aparte; los textos se escriben de forma que se puedan traducir.
- **Cabecera de la zona privada,** de izquierda a derecha: logo «Sportsplace» (→ `/catalogo`), «Catálogo» (→ `/catalogo`), «Mis anuncios» (→ `/mis-anuncios`), «Pedidos» (→ `/pedidos`), «Mensajes» (→ `/mensajes`), la campana de avisos, el botón «Publicar anuncio» (→ `/anuncios/nuevo`) y el menú del centro (nombre del centro ▾: «Mi perfil», «Equipo», «Ajustes», «Cerrar sesión»). Cada historia indica qué parte de la cabecera añade.
- **Avisos tras una acción:** mensaje breve en la esquina superior derecha, que desaparece a los 4 s. Verde si ha ido bien y rojo si ha habido un error.
- **Confirmación de acciones destructivas o irreversibles:** diálogo con título, texto y dos botones (la acción y «Cancelar»). Se especifican sus textos exactos.
- **Formularios:**
  - Los errores aparecen debajo de cada campo al pulsar el botón de enviar y vuelven a validarse al corregir el campo.
  - El botón de enviar se deshabilita mientras se envía y cambia a «…ando…» («Publicando…», «Guardando…»).
  - Si falla la red o la API responde 500/503: «No se ha podido completar la acción. Inténtalo de nuevo.» Los datos del formulario se conservan.
  - Los espacios al principio y al final se eliminan antes de validar.
- **Formatos:**
  - Fechas: `dd/mm/aaaa`. Fecha y hora: `dd/mm/aaaa hh:mm` (hora de Madrid).
  - Dinero: euros con coma decimal y punto de miles («1.234,50 €»). En la base de datos, en céntimos enteros.
- **Listas:**
  - Mientras cargan, «Cargando…».
  - Si están vacías, un texto propio de cada historia.
  - Si fallan, «No se ha podido cargar. » y el botón «Reintentar».
  - Se paginan de 20 en 20 con «Anterior» / «Siguiente» cuando la historia lo indica.

## Diccionario de datos del marketplace (propuesta base; cada historia lo concreta)

### Anuncio (E03)
**Campos:**
| Campo | Regla |
|---|---|
| `titulo` | 5-80 caracteres. |
| `descripcion` | 20-1000 caracteres. |
| `categoria` | Lista fija: Balones, Ropa y equipación, Calzado, Protecciones, Material de entrenamiento, Porterías y redes, Máquinas y fitness, Otros. |
| `deporte` | Lista fija: Fútbol, Baloncesto, Balonmano, Voleibol, Tenis, Pádel, Natación, Atletismo, Gimnasio y fitness, Varios. |
| `unidades_disponibles` | Entero, 1-9999 al publicar. |
| `estado_material` | Nuevo, Como nuevo, Buen estado, Usado, Para reparar. |
| `modalidad` | `venta` o `donacion`. |
| `precio_unitario_centimos` | 1-9.999.999 si es venta; nulo si es donación. |
| Fotos | 1-8, en JPG, PNG o WebP, de 5 MB como máximo cada una. Una es la principal. |

**Estados:**
| Estado | Se ve en el catálogo | Transiciones |
|---|---|---|
| `activo` | Sí | → `pausado`, `reservado` o `entregado` |
| `pausado` | No | → `activo` |
| `reservado` | Sí, como «No disponible» | → `activo` o `entregado` |
| `entregado` | No | Final |
| `retirado` | No; para nadie | Retirada lógica |

### Pedido (E06/E07)
Un centro comprador pide unidades de un anuncio de otro centro. Sirve tanto para compras como para donaciones.

**Campos:**
| Campo | Regla |
|---|---|
| `unidades` | 1 ≤ unidades ≤ unidades disponibles. |
| `modalidad` | Copiada del anuncio. |
| `precio_unitario_centimos` | Copiado del anuncio en el momento de pedir. |
| `metodo_pago` | `transferencia` o `efectivo_recogida`; solo en ventas. |
| `metodo_entrega` | `recogida` o `envio`. |
| `mensaje` | 0-500 caracteres. |

**Estados:**
- `pendiente` → `aceptado` o `rechazado` (lo decide el vendedor).
- `pendiente` o `aceptado` → `cancelado` (por cualquiera de los dos, con motivo).
- `aceptado` → `recibido`, cuando el comprador confirma la recepción.
- `incidencia` es un subestado que se abre desde `aceptado` o `recibido`.
- Pago: `pagado` es una marca del vendedor en las ventas aceptadas.

**Reserva de unidades (US-34):** al aceptar, se restan de las unidades disponibles. Si se cancela, se devuelven.

### Mensajes (E05)
- Una conversación por cada par (anuncio, centro interesado).
- Mensajes de 1-2000 caracteres.

### Valoraciones (E08)
- Una valoración por centro y pedido cerrado, de 1 a 5 estrellas (entero).
- Comentario de 0-500 caracteres.
- Una sola respuesta del valorado, de 1-500 caracteres.

### Avisos (E09)
- Avisos dentro de la plataforma con: tipo, texto, enlace, leído y fecha.
- Preferencias de email por tipo de aviso.

## Calidad que se espera

- Una historia típica tiene entre 15 y 40 criterios y entre 3 y 6 flujos e2e.
- Para cada campo: obligatorio u opcional, tipo, longitud o rango, formato, valor límite aceptado, primer valor rechazado y el mensaje exacto.
- Para cada botón: texto exacto, dónde está, cuándo se ve o está deshabilitado y qué hace.
- Para cada endpoint: método, ruta, cuerpo, respuesta correcta y todos sus errores (código HTTP + `code`).
- Permisos: quién puede hacer qué, y qué pasa si lo intenta otro centro o alguien sin sesión.
- No inventar funcionalidades fuera de la historia. Si algo depende de otra historia, se marca como «[Depende de US-xx]» y no se implementa.
