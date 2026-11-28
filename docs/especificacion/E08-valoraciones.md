# E08 Valoraciones entre centros

Historias del Sprint 3 (segundo corte): US-44 y US-45. El resto de historias de la épica (US-46, responder a una valoración, y las de reportes) se añadirán cuando entren en un sprint.

Este documento sigue `00-guia-comun.md`. Pedidos (E06/E07), detalle del anuncio (E04) y perfil de otro centro (E01-E02) están en sus archivos: aquí solo se usan sus campos y estados y se marcan con «[Depende de US-xx]». Lo que dependa de US-11 (centro eliminado) o de US-46 (respuesta) no entra en el Sprint 3: hasta entonces ningún centro está eliminado y `respuesta` sale siempre `null`.

Los e2e usan los centros y anuncios de ejemplo de la «Base común» de E06: «Club Esportiu Les Corts» (vendedor), «Escola de Bàsquet Gràcia» (comprador) y «CN Sabadell Demo» (tercero), y el anuncio A1 «Balones de baloncesto talla 7».

---

## (3) US-44 · Valoro al otro centro cuando el pedido se ha cerrado

**Épica:** E08 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 3 · **Depende de:** US-42, US-108, US-109
**Cambios respecto al backlog original:** Se concreta que «pedido cerrado» es el estado `recibido` (US-42), el plazo para valorar (30 días), que la valoración no se edita ni se borra, y el botón exacto en el detalle del pedido. El detalle es el de US-108 y la lista la de US-109 (no US-38). Los textos de la web son los de los CA de Trello.

**Historia**
Como responsable de un centro que ha participado en un pedido ya recibido, quiero puntuar de 1 a 5 estrellas y comentar a la otra parte, para ayudar a los demás a saber si es de fiar.
1. En la cabecera pulso «Pedidos» → `/pedidos` y abro un pedido «Recibido» → `/pedidos/:id`.
2. Pulso «Valorar a Club Esportiu Les Corts».
3. En el diálogo elijo las estrellas, escribo un comentario opcional y pulso «Publicar valoración».
4. Veo «Valoración publicada.», el botón desaparece y en su lugar veo mi valoración «Tu valoración: ★★★★☆ · Material en buen estado…».

**Pantallas para el boceto**
- `/pedidos/:id` (US-108; esta historia añade el bloque «Valoración», solo en pedidos `recibido`):
  1. Si puedo valorar: texto «¿Qué tal ha ido con <otro centro>? Tienes hasta el dd/mm/aaaa para valorar.» y botón «Valorar a <otro centro>».
  2. Si ya he valorado: «Ya has valorado este pedido.» y debajo «Tu valoración», estrellas, comentario y fecha.
  3. Si el plazo terminó sin valorar: «El plazo para valorar este pedido ha terminado.».
  4. Si el otro centro me ha valorado: «Valoración de <otro centro>», estrellas, comentario y fecha.
- Diálogo «Valorar a <otro centro>»:
  1. Cinco estrellas seleccionables (accesibles con teclado; etiquetas «1 estrella» … «5 estrellas»).
  2. Área de texto «Comentario (opcional)», contador «0/500».
  3. Texto «Tu valoración será pública en el perfil de <otro centro> y no se podrá modificar.»
  4. Botones «Publicar valoración» / «Cancelar».
- `/pedidos` (US-109): en los pedidos `recibido` que todavía puedo valorar, etiqueta «Pendiente de valorar»; la tarjeta lleva a `/pedidos/:id`, como las demás.

**Criterios de aceptación**

*Quién y cuándo*
- CA1. Pueden valorar solo los dos centros del pedido: el comprador valora al vendedor y el vendedor al comprador.
- CA2. Solo pedidos en estado `recibido`. Con `pendiente`, `aceptado`, `rechazado` o `cancelado` el bloque y el botón no aparecen y la API responde `409 PEDIDO_NO_VALORABLE` («Solo puedes valorar pedidos recibidos.»).
- CA3. Plazo: hasta 30 días naturales después de `recibido_en` (hora de Madrid, hasta las 23:59 del día 30). El día 30 se acepta; el 31 → `409 PLAZO_VALORACION_TERMINADO` («El plazo para valorar este pedido ha terminado.»).
- CA4. Una sola valoración por centro y pedido. La segunda → `409 VALORACION_YA_EXISTE` («Ya has valorado este pedido.»).
- CA5. [Depende de US-11; no entra en el Sprint 3] Si el centro valorado está eliminado, no se puede valorar: el bloque muestra «Este centro ya no está en Sportsplace.» y la API responde `409 CENTRO_ELIMINADO`.

*Campos y validación*
- CA6. Puntuación: obligatoria, entero de 1 a 5. Sin elegir → «Elige de 1 a 5 estrellas.»; en la API `0`, `6`, `4.5` o sin el campo → `400 DATOS_INVALIDOS` con ese mensaje en `details.puntuacion`.
- CA7. Comentario: opcional, 0-500 caracteres tras quitar espacios; 500 se acepta; 501 → «El comentario no puede superar los 500 caracteres.» (`400 DATOS_INVALIDOS`, `details.comentario`). Un comentario vacío o solo de espacios se guarda como nulo.

*Comportamiento y mensajes*
- CA8. Mientras se envía: «Publicando…» y el botón deshabilitado. Éxito: aviso verde «Valoración publicada.»; el diálogo se cierra, sigo en `/pedidos/:id` y el bloque muestra mi valoración sin recargar. Error de red o 5xx: «No se ha podido publicar la valoración. Inténtalo de nuevo.» y el diálogo sigue abierto con lo escrito.
- CA9. La valoración es pública en cuanto se publica (US-45) y no se puede editar ni borrar (no hay endpoint).
- CA10. En `/pedidos` la etiqueta «Pendiente de valorar» sale solo cuando `puedo_valorar` es `true`; desaparece al valorar o cuando termina el plazo.

*API*
- CA11. `POST /api/pedidos/:id/valoracion` (`requireAuth` + `requireEmailConfirmado`) con `{ "puntuacion": 4, "comentario": "..." }` → `201 { "valoracion": { "id", "pedido_id", "puntuacion", "comentario", "rol_autor": "comprador"|"vendedor", "centro_autor": { "id", "nombre" }, "centro_valorado": { "id", "nombre" }, "creada_en" } }`.
- CA12. El objeto `pedido` de `GET /api/pedidos/:id` [Depende de US-108] añade `mi_valoracion` (objeto `valoracion` o `null`), `valoracion_recibida` (objeto `valoracion` o `null`), `puedo_valorar` (bool) y `valorable_hasta` (fecha `aaaa-mm-dd` de Madrid, o `null` si el pedido no está `recibido`). Cada pedido de `GET /api/pedidos` [Depende de US-109] añade `puedo_valorar`.
- CA13. Errores: `400 DATOS_INVALIDOS`, `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (pedido inexistente, id que no es UUID o pedido de otros centros), `409 PEDIDO_NO_VALORABLE`, `409 PLAZO_VALORACION_TERMINADO`, `409 VALORACION_YA_EXISTE`. El orden de comprobación es: autenticación, pedido visible (404), datos (400), estado (409 `PEDIDO_NO_VALORABLE`), plazo y duplicado.

*Datos*
- CA14. Tabla `valoraciones`: `id uuid`, `pedido_id` FK, `centro_autor_id` FK, `centro_valorado_id` FK, `autor_usuario_id`, `rol_autor text check ('comprador','vendedor')`, `puntuacion smallint check 1-5`, `comentario text null` (check nulo o 1-500), `creada_en timestamptz default now()`. Restricción única (`pedido_id`, `centro_autor_id`) y check `centro_autor_id <> centro_valorado_id`. Dos peticiones a la vez del mismo centro: la restricción única deja una y la otra responde `409 VALORACION_YA_EXISTE`.
- CA15. Índice (`centro_valorado_id`, `creada_en` desc) para US-45. RLS activada como en el resto de tablas; el backend accede con su cliente de servicio.

*Seguridad*
- CA16. Un tercer centro que intenta valorar un pedido ajeno recibe `404 NO_ENCONTRADO`.
- CA17. El comentario se guarda y se muestra como texto plano (sin interpretar HTML).

**Flujos e2e**
- E2E-1 (camino feliz). 1) Pedido P1 de Gràcia a Les Corts (4 balones de A1), `recibido` hoy [Depende de US-42]. 2) Gràcia abre `/pedidos`, ve «Pendiente de valorar» en P1 y lo pulsa. 3) En `/pedidos/P1` ve «Tienes hasta el <hoy+30> para valorar.» y pulsa «Valorar a Club Esportiu Les Corts». 4) Elige 4 estrellas, escribe «Material en buen estado y muy puntuales en la recogida.» y pulsa «Publicar valoración». 5) Aviso «Valoración publicada.», sigue en `/pedidos/P1` y ve «Ya has valorado este pedido.» con su valoración; en `/pedidos` ya no sale «Pendiente de valorar». BD: 1 fila (P1, Gràcia → Les Corts, 4, `rol_autor = comprador`).
- E2E-2 (las dos partes). 1) Les Corts abre `/pedidos/P1` y valora a Gràcia con 5 estrellas sin comentario. 2) BD: 2 valoraciones de P1, `comentario` nulo en la de Les Corts. 3) Cada uno ve en P1 «Valoración de <otro centro>» con la del otro.
- E2E-3 (dos veces). 1) Gràcia llama de nuevo a `POST /api/pedidos/P1/valoracion` → `409 VALORACION_YA_EXISTE`.
- E2E-4 (estado y plazo). 1) Pedido P2 `aceptado`: no hay bloque ni botón y la API responde `409 PEDIDO_NO_VALORABLE`. 2) Pedido P3 con `recibido_en` hace 31 días: «El plazo para valorar este pedido ha terminado.» y `409 PLAZO_VALORACION_TERMINADO`. 3) Pedido P4 con `recibido_en` hace 30 días: se puede valorar.
- E2E-5 (validación y tercero). 1) Publicar sin estrellas → «Elige de 1 a 5 estrellas.»; puntuación 6 en la API → `400 DATOS_INVALIDOS`. 2) Comentario de 501 caracteres → «El comentario no puede superar los 500 caracteres.» y no se publica. 3) CN Sabadell intenta valorar P1 → `404 NO_ENCONTRADO`.

**Tareas**
- T44-1 · Base de datos y backend: tabla `valoraciones` con restricciones e índice, `POST /api/pedidos/:id/valoracion` y campos de valoración en `GET /api/pedidos/:id` y `GET /api/pedidos`, con tests y contrato.
- T44-2 · Frontend: bloque «Valoración» y diálogo en `/pedidos/:id`, etiqueta «Pendiente de valorar» en `/pedidos`, con tests.
- T44-3 · QA: automatizar E2E-1 a E2E-5 y checklist de CA.

**Decisiones pendientes**
- ¿Pueden valorarse pedidos `cancelado` (por ejemplo, si el otro no se presentó)? Propuesta: no; solo `recibido`, para evitar represalias.
- ¿Publicación inmediata o «a ciegas» (se publican las dos cuando ambos valoran)? Propuesta: inmediata, por sencillez.

---

## (3) US-45 · Veo la puntuación media y las valoraciones de un centro

**Épica:** E08 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 3 · **Depende de:** US-44, US-10, US-24
**Cambios respecto al backlog original:** Se define el cálculo y redondeo de la media, el bloque «Valoraciones» del perfil `/centros/:id` (el hueco que dejó US-10), la paginación y el resumen junto al nombre del centro en el detalle del anuncio. El detalle del anuncio es `GET /api/catalogo/:id` (US-24). Las rutas exigen email confirmado, igual que `GET /api/centros/:id` (US-10 CA11). Los textos de la web son los de los CA de Trello.

**Historia**
Como responsable de un centro que está pensando en comprar o pedir material, quiero ver la puntuación media de otro centro y leer sus valoraciones, para decidir si trato con él.
1. En `/anuncios/:id` veo en «Ofrecido por» «★ 4,3 (12 valoraciones)» y lo pulso → `/centros/:id#valoraciones`.
2. En el perfil del centro veo el bloque «Valoraciones»: media, número y reparto por estrellas.
3. Leo los comentarios, de más reciente a más antiguo, y paso a «Siguiente» si hay más de 10.

**Pantallas para el boceto**
- `/anuncios/:id` (US-24): en el bloque «Ofrecido por», junto al nombre del centro, «★ 4,3 (12 valoraciones)», o «Sin valoraciones» en gris. Pulsar el resumen lleva a `/centros/:id#valoraciones`.
- `/centros/:id` (US-10; esta historia añade la sección `#valoraciones` en el hueco de la puntuación, antes de «Anuncios activos»):
  1. Título «Valoraciones».
  2. Resumen: número grande «4,3», cinco estrellas con relleno proporcional (4,3 → 4 llenas y la quinta al 30 %), y «12 valoraciones».
  3. Reparto: 5 barras «5 ★ · 7», «4 ★ · 3», «3 ★ · 1», «2 ★ · 0», «1 ★ · 1».
  4. Lista de valoraciones: nombre del centro autor (enlace a su perfil), «como comprador» o «como vendedor», estrellas, fecha «dd/mm/aaaa», comentario (o «Sin comentario» en cursiva gris) y, si existe, la respuesta [Depende de US-46].
  5. Paginación de 10 en 10 con «Anterior» / «Siguiente».
  6. Sin valoraciones: en lugar del resumen, «Sin valoraciones»; no hay reparto ni lista.
- El propio centro ve la misma sección en `/centros/<mi id>` («Ver cómo ven mi perfil», US-10 CA4).

**Criterios de aceptación**

*Cálculo*
- CA1. Media = suma de puntuaciones / número de valoraciones de ese centro como valorado, contando los dos papeles (comprador y vendedor).
- CA2. Se redondea a 1 decimal, mitad hacia arriba (`ROUND(AVG(puntuacion)::numeric, 1)` en PostgreSQL): 4,25 → 4,3; 4,24 → 4,2; 13/3 = 4,333… → 4,3; 5 → 5,0. Se muestra con coma decimal: «4,3», «5,0».
- CA3. Con 0 valoraciones no hay media: la API devuelve `media: null` y la web muestra «Sin valoraciones» en el perfil y en el detalle del anuncio.
- CA4. Singular y plural: «1 valoración», «2 valoraciones».
- CA5. [Depende de US-11; no entra en el Sprint 3] Las valoraciones de centros autores eliminados siguen contando en la media y se muestran como «Centro eliminado», sin enlace.
- CA6. Relleno de estrellas: cada estrella se llena según `min(1, max(0, media − (i−1)))`, para i = 1…5.

*Comportamiento*
- CA7. Orden de la lista: `creada_en` descendente; empate por `id`.
- CA8. Paginación de 10 (`?pagina=n` en la API). El resumen y el reparto no cambian al paginar.
- CA9. Comentarios en texto plano, con saltos de línea respetados.
- CA10. Mientras carga: «Cargando…». Error de red o 5xx: «No se ha podido cargar. » + «Reintentar», que vuelve a pedir la misma página. Si fallan las valoraciones, el resto del perfil se sigue viendo.

*API*
- CA11. `GET /api/centros/:id/valoraciones?pagina=n` → `200 { "resumen": { "media": 4.3, "total": 12, "reparto": { "1": 1, "2": 0, "3": 1, "4": 3, "5": 7 } }, "valoraciones": [ { "id", "puntuacion", "comentario", "rol_autor", "centro_autor": { "id", "nombre", "eliminado" }, "creada_en", "respuesta": null } ], "pagina", "por_pagina": 10, "total" }`. `eliminado` es siempre `false` y `respuesta` siempre `null` hasta US-11 y US-46.
- CA12. `pagina` < 1 o no numérica → `400 DATOS_INVALIDOS` («La página debe ser un número mayor que 0.»); página sin resultados → lista vacía con el resumen. Centro inexistente o id que no es UUID → `404 NO_ENCONTRADO`.
- CA13. `GET /api/catalogo/:id` [Depende de US-24] añade en `centro` los campos `valoracion_media` (número o `null`) y `total_valoraciones`. Las tarjetas del catálogo (`GET /api/catalogo`) no cambian.

*Permisos*
- CA14. Cualquier centro con sesión y email confirmado puede ver las valoraciones de cualquier centro (`requireAuth` + `requireEmailConfirmado`, como US-10). Sin sesión → `401 NO_AUTENTICADO`; email sin confirmar → `403 EMAIL_NO_CONFIRMADO`.
- CA15. No se muestra nunca el usuario concreto que escribió la valoración ni el pedido al que corresponde (solo el centro autor y su papel): la respuesta no incluye `autor_usuario_id` ni `pedido_id`.

**Flujos e2e**
- E2E-1 (camino feliz). 1) Les Corts tiene 3 valoraciones: 4, 5 y 4. 2) Gràcia abre `/anuncios/A1`: ve «★ 4,3 (3 valoraciones)». 3) Lo pulsa → `/centros/<Les Corts>#valoraciones`: «4,3», «3 valoraciones», reparto 5 ★ · 1 y 4 ★ · 2, y la lista con la más reciente primero, cada una con «como comprador» o «como vendedor».
- E2E-2 (redondeo). 1) Puntuaciones 4, 4, 5, 4 → media 4,25 → se muestra «4,3». 2) Puntuaciones 5, 4, 4, 4, 4 → 4,2 → «4,2». 3) Una sola valoración de 5 → «5,0» y «1 valoración».
- E2E-3 (sin valoraciones). 1) CN Sabadell sin valoraciones: `/centros/<Sabadell>` y el detalle de un anuncio suyo muestran «Sin valoraciones»; la API devuelve `media: null`.
- E2E-4 (paginación). 1) Con 12 valoraciones, la página 1 tiene 10 y «Siguiente»; la página 2 tiene 2 y «Siguiente» deshabilitado; el resumen sigue en «12 valoraciones». 2) `?pagina=0` → `400 DATOS_INVALIDOS`.
- E2E-5 (fallo y seguridad). 1) La API de valoraciones falla → «No se ha podido cargar.»; «Reintentar» vuelve a cargarlas. 2) Un comentario con `<script>alert(1)</script>` se ve como texto. 3) La respuesta no contiene `autor_usuario_id` ni `pedido_id`; sin token → `401`.

**Tareas**
- T45-1 · Backend: `GET /api/centros/:id/valoraciones` con resumen agregado; `valoracion_media` y `total_valoraciones` en `GET /api/catalogo/:id`; tests unitarios del redondeo y contrato.
- T45-2 · Frontend: sección `#valoraciones` en `/centros/:id` y resumen en `/anuncios/:id`, con tests.
- T45-3 · QA: automatizar E2E-1 a E2E-5 y checklist de CA.

**Decisiones pendientes**
- ¿Mostrar la media también en las tarjetas del catálogo? Propuesta: no en esta historia; solo en detalle y perfil.
