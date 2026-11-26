# E05 Comunicación entre centros

Historias del Sprint 2: US-28 y US-77. Sprint 3: US-65. El resto de historias de la épica (US-30, US-78 y US-102) y las de E08 se añadirán cuando entren en un sprint.

Este documento sigue `00-guia-comun.md`. Anuncios (E03), catálogo (E04) y pedidos (E06/E07) están en sus archivos: aquí solo se usan sus campos y estados y se marcan con «[Depende de US-xx]».

---

## Reglas comunes de la épica

**Centros de ejemplo usados en todos los e2e**
- **Club Natació Sabadell** (CNS), localidad Sabadell, email `material@cnsabadell.cat`. Es el **vendedor**: publica el anuncio A1.
- **CE Gràcia Bàsquet** (CEG), localidad Barcelona, email `compras@cegracia.cat`. Es el **comprador**.
- **Escola Esportiva Terrassa** (EET), localidad Terrassa. Es un **tercer centro** sin relación con la operación.
- Anuncio **A1** de CNS: «Balones de baloncesto Molten talla 7», categoría Balones, deporte Baloncesto, 20 unidades, Buen estado, venta a 12,00 € (1200 céntimos), estado `activo`.
- Anuncio **A2** de CNS: «Corcheras de competición 25 m», donación, 4 unidades, `activo`.

**Acceso.** Todas las rutas web de estas épicas son privadas: sin sesión redirigen a `/entrar`. Todos los endpoints usan `requireAuth` (`401 NO_AUTENTICADO`) y `requireEmailConfirmado` (`403 EMAIL_NO_CONFIRMADO`), salvo los de solo lectura del perfil público, que solo usan `requireAuth`.

**Actúa el centro, no la persona.** Mensajes, ofertas, valoraciones y reportes pertenecen al centro. Si el centro tiene varias personas (US-08), todas ven y responden lo mismo. Se guarda además `autor_usuario_id` para trazabilidad, pero no se muestra.

**Centro eliminado (US-11).** Las filas no se borran: el `centro_id` se conserva y la API devuelve el nombre como «Centro eliminado» y sin enlace al perfil [Depende de US-11].

**Recursos de otro centro.** Una conversación, oferta o pedido en el que el centro no participa responde `404 NO_ENCONTRADO`.

---

## (5) US-28 · Escribo al centro que ofrece un anuncio

**Épica:** E05 · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** 2 · **Depende de:** US-24
**Cambios respecto al backlog original:** Se concreta que la conversación se abre desde el botón «Escribir al centro» del detalle del anuncio y que hay una sola conversación por par (anuncio, centro interesado). Sube de 3 a 5 puntos porque incluye las tablas `conversaciones` y `mensajes` y la pantalla `/mensajes/:id`, que reutilizan US-77, US-65 y US-30. La respuesta del vendedor es US-77 y la lista de conversaciones es US-65.

**Historia**
Como responsable de un centro comprador, quiero escribir al centro que ofrece un anuncio desde el propio anuncio, para resolver mis dudas antes de hacer un pedido.
1. En `/catalogo` pulso la tarjeta de un anuncio y llego a `/anuncios/:id` [Depende de US-24].
2. Debajo del nombre del centro que lo ofrece pulso «Escribir al centro».
3. Si todavía no he hablado de este anuncio, llego a `/mensajes/nueva?anuncio=:id`: veo el resumen del anuncio y un cuadro de texto.
4. Escribo la pregunta y pulso «Enviar».
5. Llego a `/mensajes/:id` (la conversación ya creada) y veo mi mensaje como el último del hilo.
6. Si ya había hablado de este anuncio, el paso 2 me lleva directamente a `/mensajes/:id` de esa conversación.

**Pantallas para el boceto**
- `/anuncios/:id` (de US-24; esta historia solo añade el botón): bajo el bloque «Ofrecido por <nombre del centro>», botón secundario «Escribir al centro».
- `/mensajes/nueva?anuncio=:id`: «Nueva conversación».
  1. Enlace «← Volver al anuncio» (→ `/anuncios/:id`).
  2. Cabecera de anuncio: foto principal en miniatura (64×64), título del anuncio (enlace a `/anuncios/:id`), precio unitario «12,00 € / unidad» o «Donación», nombre del centro vendedor.
  3. Texto de ayuda «Escribe tu pregunta a <nombre del centro>. Solo vosotros dos veréis esta conversación.»
  4. Área de texto (5 líneas), placeholder «Escribe tu mensaje…», contador «0/2000».
  5. Botón principal «Enviar».
- `/mensajes/:id`: «Conversación» (la usan también US-77, US-65, US-30, US-78 y US-102).
  1. Cabecera: nombre del otro centro (enlace a `/centros/:id`, o «Centro eliminado» sin enlace), y la misma cabecera de anuncio que arriba. Sin enlace a la bandeja `/mensajes`, que es de US-65 (S3).
  2. Banda de estado, solo si aplica (ver CA de casos límite).
  3. Hilo de mensajes en orden cronológico ascendente. Los míos alineados a la derecha con fondo de color; los del otro centro a la izquierda con fondo gris. Cada mensaje: texto (saltos de línea respetados, sin HTML) y debajo la fecha y hora «dd/mm/aaaa hh:mm».
  4. Si hay más de 50 mensajes, arriba del hilo botón «Ver mensajes anteriores».
  5. Pie fijo: área de texto (3 líneas) «Escribe tu mensaje…», contador «n/2000» y botón «Enviar».

**Criterios de aceptación**

*Navegación*
- CA1. En `/anuncios/:id` el botón «Escribir al centro» se ve cuando el anuncio está `activo` o `reservado` y pertenece a otro centro.
- CA2. Si el anuncio es del propio centro, el botón no aparece.
- CA3. Al pulsar «Escribir al centro», la web llama a `GET /api/anuncios/:id/conversacion`. Si `conversacion` es `null`, navega a `/mensajes/nueva?anuncio=:id`; si no, navega a `/mensajes/<conversacion.id>`.
- CA4. Abrir `/mensajes/nueva?anuncio=:id` cuando ya existe la conversación redirige (replace) a `/mensajes/<id>`.
- CA5. Abrir `/mensajes/nueva` sin `anuncio`, con un id inexistente, de un anuncio propio o no disponible muestra «Este anuncio no está disponible.» y el enlace «Ir al catálogo» (→ `/catalogo`).
- CA6. Tras enviar el primer mensaje con éxito, la web navega a `/mensajes/<id>` y el mensaje enviado aparece como último del hilo.

*Campos y validación*
- CA7. El texto del mensaje es obligatorio, de 1 a 2000 caracteres tras quitar los espacios del principio y del final. Se aceptan saltos de línea.
- CA8. Vacío o solo espacios: el botón «Enviar» está deshabilitado. Si llega a la API, `400 DATOS_INVALIDOS` con `details.texto` = «Escribe un mensaje.».
- CA9. 2000 caracteres se aceptan. 2001 caracteres: la web no deja escribir más allá de 2000 (atributo `maxlength`) y la API responde `400 DATOS_INVALIDOS` con `details.texto` = «El mensaje no puede superar los 2000 caracteres.».
- CA10. El contador muestra «n/2000» y se pone en rojo a partir de 1900.

*Comportamiento*
- CA11. Mientras se envía, el botón muestra «Enviando…» y está deshabilitado; el texto se conserva.
- CA12. En `/mensajes/:id`, tras enviar, el cuadro se vacía y el mensaje se añade al final sin recargar la página.
- CA13. Ctrl+Enter (o Cmd+Enter) envía; Enter solo inserta un salto de línea.
- CA14. La conversación se refresca sola cada 15 s mientras la pestaña está visible (`GET /api/conversaciones/:id?despues=<último id>`), para ver respuestas nuevas sin recargar. No hay tiempo real.
- CA15. El texto se muestra como texto plano: `<b>hola</b>` se ve literalmente, sin negrita.

*Mensajes*
- CA16. Envío correcto en `/mensajes/nueva`: aviso verde «Mensaje enviado.».
- CA17. Error de red o 500/503: aviso rojo «No se ha podido completar la acción. Inténtalo de nuevo.» y el texto se conserva.
- CA18. `409 ANUNCIO_NO_DISPONIBLE`: aviso rojo «Este anuncio ya no está disponible.».

*API*
- CA19. `GET /api/anuncios/:id/conversacion` → `200 { "conversacion": { "id": "uuid" } }` o `200 { "conversacion": null }`. Anuncio inexistente o retirado → `404 NO_ENCONTRADO`.
- CA20. `POST /api/conversaciones` con `{ "anuncio_id": "uuid", "texto": "..." }` → `201 { "conversacion": {...}, "mensaje": {...} }`. Crea la conversación y su primer mensaje en una única transacción.
- CA21. Errores de `POST /api/conversaciones`: `400 DATOS_INVALIDOS` (texto o `anuncio_id` no válidos), `404 NO_ENCONTRADO` (anuncio inexistente o `retirado`), `409 ANUNCIO_PROPIO` («No puedes escribirte sobre tu propio anuncio.»), `409 ANUNCIO_NO_DISPONIBLE` (estado `pausado` o `entregado`), `409 CONVERSACION_YA_EXISTE` con `details.conversacion_id` (la web navega a esa conversación).
- CA22. `GET /api/conversaciones/:id` → `200 { "conversacion": {...}, "mensajes": [...], "hay_anteriores": bool }` con los 50 mensajes más recientes en orden ascendente. `?antes=<mensaje_id>` devuelve los 50 anteriores a ese. `?despues=<mensaje_id>` devuelve los posteriores.
- CA23. Objeto `conversacion`: `id`, `anuncio` (`id`, `titulo`, `foto_principal_url`, `modalidad`, `precio_unitario_centimos`, `estado`), `otro_centro` (`id`, `nombre`, `eliminado`), `soy` (`comprador` o `vendedor`), `puede_escribir` (bool), `creada_en`.
- CA24. Objeto `mensaje`: `id`, `texto`, `es_mio` (bool), `tipo` (`texto` u `oferta`, ver US-30), `creado_en` (ISO 8601).
- CA25. `POST /api/conversaciones/:id/mensajes` con `{ "texto": "..." }` → `201 { "mensaje": {...} }`. Lo usan el comprador (esta historia) y el vendedor (US-77).
- CA26. Límite anti-abuso: un centro puede enviar como máximo 30 mensajes por minuto en total; el 31.º responde `429 DEMASIADOS_INTENTOS` con el mensaje «Has enviado demasiados mensajes seguidos. Espera un minuto.».

*Datos*
- CA27. Tabla `conversaciones`: `id` uuid, `anuncio_id` FK, `centro_comprador_id` FK, `centro_vendedor_id` FK (copiado del anuncio), `ultimo_mensaje_en` timestamptz, `creada_en`. Restricción única (`anuncio_id`, `centro_comprador_id`) y check `centro_comprador_id <> centro_vendedor_id`.
- CA28. Tabla `mensajes`: `id` uuid, `conversacion_id` FK, `centro_autor_id` FK, `autor_usuario_id` FK, `tipo` (`texto`/`oferta`), `texto` (1-2000, nulo si `tipo = oferta`), `oferta_id` (nulo si `tipo = texto`), `creado_en`. Índice (`conversacion_id`, `creado_en`).
- CA29. Cada mensaje nuevo actualiza `conversaciones.ultimo_mensaje_en`.
- CA30. Los mensajes no se pueden editar ni borrar (no hay endpoint).

*Permisos y seguridad*
- CA31. Solo los dos centros de la conversación pueden leerla o escribir en ella. Para un tercer centro, `GET` y `POST` sobre `/api/conversaciones/:id...` responden `404 NO_ENCONTRADO`.
- CA32. Solo el centro interesado (no el vendedor) puede crear la conversación: el vendedor no puede iniciar conversaciones.

*Casos límite*
- CA33. Anuncio `reservado`: se puede escribir. Anuncio `pausado` o `entregado`: no se puede crear una conversación nueva (`409 ANUNCIO_NO_DISPONIBLE`), pero en las existentes se sigue escribiendo y aparece la banda «Este anuncio ya no está disponible en el catálogo.».
- CA34. Anuncio `retirado` con conversación existente: la conversación se sigue viendo y se puede escribir; banda «El vendedor ha retirado este anuncio.» y el título del anuncio deja de ser enlace.
- CA35. Si el otro centro está eliminado [Depende de US-11]: `puede_escribir = false`, el pie de escritura se sustituye por «Este centro ya no está en Sportsplace. No puedes enviar más mensajes.» y `POST .../mensajes` responde `409 CENTRO_ELIMINADO`.
- CA36. Dos envíos simultáneos del primer mensaje (doble clic, dos pestañas) solo crean una conversación; el segundo recibe `409 CONVERSACION_YA_EXISTE`.

**Flujos e2e**
- E2E-1 (camino feliz). 1) CEG entra y abre `/anuncios/A1`. 2) Pulsa «Escribir al centro» → `/mensajes/nueva?anuncio=A1`. 3) Escribe «Hola, ¿los balones tienen la presión correcta? ¿Podemos recogerlos el sábado?» y pulsa «Enviar». 4) Aviso «Mensaje enviado.» y llega a `/mensajes/<C1>`; el mensaje aparece a la derecha con la fecha. 5) En BD: 1 fila en `conversaciones` (A1, CEG, CNS) y 1 en `mensajes` con `centro_autor_id = CEG`.
- E2E-2 (conversación existente). 1) Tras E2E-1, CEG vuelve a `/anuncios/A1` y pulsa «Escribir al centro». 2) Llega directamente a `/mensajes/<C1>` con el hilo anterior. 3) En BD sigue habiendo 1 conversación.
- E2E-3 (anuncio propio). 1) CNS abre `/anuncios/A1`: no ve «Escribir al centro». 2) Una llamada directa `POST /api/conversaciones` con A1 responde `409 ANUNCIO_PROPIO`.
- E2E-4 (validación). 1) CEG abre `/mensajes/nueva?anuncio=A2` y deja el texto vacío: «Enviar» deshabilitado. 2) Pega 2001 caracteres: solo quedan 2000 y el contador muestra «2000/2000» en rojo. 3) Envía 2000: se crea.
- E2E-5 (tercer centro). 1) EET pide `GET /api/conversaciones/<C1>` → `404 NO_ENCONTRADO`. 2) Abre `/mensajes/<C1>` → «Esta conversación no existe.», sin enlace a la bandeja (US-65, S3).
- E2E-6 (anuncio pausado). 1) CNS pausa A1 [Depende de US-15]. 2) EET intenta escribir: `409 ANUNCIO_NO_DISPONIBLE`, aviso «Este anuncio ya no está disponible.». 3) CEG abre `/mensajes/<C1>`, ve la banda «Este anuncio ya no está disponible en el catálogo.» y envía «¿Lo volveréis a activar?» correctamente.

**Tareas**
- T28-1 · Base de datos: migración de `conversaciones` (con `leida_hasta_comprador` y `leida_hasta_vendedor`, para US-77 CA7) y `mensajes` con restricciones, índices y RLS denegada (solo accede la API).
- T28-2 · Backend: `GET /api/anuncios/:id/conversacion`, `POST /api/conversaciones`, `GET /api/conversaciones/:id` (con `antes`/`despues`), `POST /api/conversaciones/:id/mensajes`, límite de 30/min.
- T28-3 · Frontend: botón «Escribir al centro» en `/anuncios/:id`, pantallas `/mensajes/nueva` y `/mensajes/:id` (hilo, pie de escritura, refresco cada 15 s).
- T28-4 · QA: automatizar E2E-1 a E2E-6 y tests de API de los CA7-CA9, CA21, CA26, CA31-CA36.

**Decisiones pendientes**
- Refresco: sondeo cada 15 s en lugar de tiempo real (Supabase Realtime). Propuesta: sondeo, más simple y suficiente para la asignatura.
- ¿Puede el vendedor iniciar conversación? Propuesta: no; solo responde (US-77). El vendedor contacta al comprador desde el pedido [Depende de US-32].

---

## (2) US-77 · Respondo a los mensajes que recibo sobre mis anuncios

**Épica:** E05 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 2 · **Depende de:** US-28
**Cambios respecto al backlog original:** Se concreta cómo llega el vendedor a la conversación antes de que exista la lista general (US-65): desde un contador en «Mis anuncios». La pantalla de conversación y el endpoint de envío son los de US-28.

**Historia**
Como responsable del centro que ofrece un anuncio, quiero ver las preguntas que me hacen sobre él y responderlas, para resolver dudas y acercar la venta o la donación.
1. En la cabecera pulso «Mis anuncios» → `/mis-anuncios`.
2. En la fila de mi anuncio veo «3 conversaciones» y pulso el enlace.
3. Llego a `/mis-anuncios/:id/conversaciones`, con un centro interesado por fila.
4. Pulso la fila de CE Gràcia Bàsquet → `/mensajes/:id`.
5. Escribo la respuesta, pulso «Enviar» y la veo al final del hilo. El comprador la verá al abrir o refrescar la conversación.

**Pantallas para el boceto**
- `/mis-anuncios` (de E03; esta historia añade una columna): en cada fila, enlace «n conversaciones» (o «Sin conversaciones», sin enlace). Si alguna tiene mensajes sin leer, punto azul delante.
- `/mis-anuncios/:id/conversaciones`: «Conversaciones sobre <título del anuncio>».
  1. Enlace «← Mis anuncios».
  2. Lista: nombre del centro interesado, primeros 80 caracteres del último mensaje (con «Tú: » delante si es mío), fecha «dd/mm/aaaa hh:mm» del último mensaje, punto azul si no está leída.
  3. Orden: último mensaje más reciente primero.
  4. Vacía: «Todavía nadie te ha escrito sobre este anuncio.».
- `/mensajes/:id`: la de US-28, vista por el vendedor (el otro centro es el comprador).

**Criterios de aceptación**

*Navegación*
- CA1. En `/mis-anuncios`, cada anuncio con al menos una conversación muestra «1 conversación» o «n conversaciones», enlazado a `/mis-anuncios/:id/conversaciones`.
- CA2. Cada fila de la lista lleva a `/mensajes/<conversacion_id>`.
- CA3. `/mis-anuncios/:id/conversaciones` de un anuncio de otro centro muestra «Este anuncio no existe.» (la API responde 404).

*Comportamiento*
- CA4. En `/mensajes/:id` el vendedor ve todos los mensajes del comprador a la izquierda y los suyos a la derecha.
- CA5. El vendedor responde con el mismo pie, reglas (1-2000 caracteres), mensajes y endpoint que US-28 (CA7-CA15 y CA25 de US-28).
- CA6. Tras responder, `ultimo_mensaje_en` se actualiza y la conversación sube a la primera posición de la lista.
- CA7. Una conversación está «sin leer» para un centro si tiene algún mensaje del otro centro posterior a su última lectura (`leida_hasta_comprador` o `leida_hasta_vendedor` de `conversaciones`, nulas al crearse; si es nula, está sin leer). Abrir `/mensajes/:id` la marca como leída (`POST /api/conversaciones/:id/leida` → `204`, pone `leida_hasta_<rol> = now()` para mi centro; otro centro → `404 NO_ENCONTRADO`). En el Sprint 2 estas columnas y este endpoint se adelantan de US-65 (su CA6, CA14 y CA15); la bandeja `/mensajes` y el contador de la cabecera siguen siendo de US-65.

*API*
- CA8. `GET /api/anuncios/:id/conversaciones` → `200 { "conversaciones": [ { "id", "otro_centro": {"id","nombre","eliminado"}, "ultimo_mensaje": {"texto_resumen","es_mio","creado_en"}, "sin_leer": bool } ] }`, ordenadas por `ultimo_mensaje_en` descendente. Sin paginar (máx. 200).
- CA9. Ese endpoint solo lo puede usar el dueño del anuncio: otro centro → `404 NO_ENCONTRADO`. Funciona aunque el anuncio esté `pausado`, `entregado` o `retirado`.
- CA10. `GET /api/mis-anuncios` [Depende de US-13] incluye `num_conversaciones` y `conversaciones_sin_leer` por anuncio.
- CA11. `texto_resumen`: primeros 80 caracteres del texto con «…» si es más largo; para un mensaje de oferta, «Oferta: 10,00 € / unidad» (ver US-30).

*Permisos y casos límite*
- CA12. El vendedor no puede crear conversaciones (`POST /api/conversaciones` sobre un anuncio propio → `409 ANUNCIO_PROPIO`).
- CA13. Si el comprador está eliminado, la fila muestra «Centro eliminado» y la conversación aplica CA35 de US-28.
- CA14. Si una persona del equipo (US-08) responde, la otra persona del mismo centro ve el mensaje como propio (a la derecha).

**Flujos e2e**
- E2E-1 (camino feliz). 1) Partiendo de E2E-1 de US-28, CNS entra en `/mis-anuncios`: A1 muestra «● 1 conversación». 2) Pulsa y ve la fila «CE Gràcia Bàsquet · Hola, ¿los balones tienen la presión correcta? ¿Podemos recog…». 3) La abre, escribe «Sí, están revisados. El sábado de 10 a 13 h.» y pulsa «Enviar». 4) El mensaje aparece a la derecha; en BD hay 2 mensajes en C1, el segundo con `centro_autor_id = CNS`. 5) CEG abre `/mensajes/<C1>` y ve la respuesta a la izquierda.
- E2E-2 (leída). 1) Tras abrir la conversación, CNS vuelve a la lista: el punto azul ha desaparecido.
- E2E-3 (otro centro). 1) EET pide `GET /api/anuncios/A1/conversaciones` → `404 NO_ENCONTRADO`.
- E2E-4 (anuncio retirado). 1) CNS retira A1 [Depende de US-17]. 2) A1 ya no aparece en `/mis-anuncios`, pero `GET /api/anuncios/A1/conversaciones` sigue respondiendo 200 a CNS. 3) CNS entra desde `/mensajes` (US-65) y responde a C1 con la banda «El vendedor ha retirado este anuncio.».

**Tareas**
- T77-1 · Backend: `GET /api/anuncios/:id/conversaciones`, `POST /api/conversaciones/:id/leida` y contadores en `GET /api/mis-anuncios`.
- T77-2 · Frontend: columna en `/mis-anuncios` y pantalla `/mis-anuncios/:id/conversaciones`.
- T77-3 · QA: automatizar E2E-1 a E2E-4.

---

## (3) US-65 · Veo todas mis conversaciones en una bandeja

**Épica:** E05 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 3 · **Depende de:** US-28 y US-77 (en dev)
**Cambios respecto al backlog original:** Se define la bandeja `/mensajes`, el enlace «Mensajes» de la cabecera con contador de no leídas, la regla exacta de «sin leer» y la paginación. El aviso en la campana es US-47 (E09) y no se implementa aquí. CA6, CA14 y las columnas de CA15 ya están en `dev` desde el Sprint 2 (se adelantaron en T28-1 y T77-1, ver US-77 CA7): en esta historia solo se comprueban. Faltan los dos índices de CA15.

**Historia**
Como responsable de un centro, quiero ver juntas todas las conversaciones que tengo como comprador y como vendedor, para retomar lo hablado sin buscar el anuncio.
1. En la cabecera veo «Mensajes (2)» y lo pulso → `/mensajes`.
2. Veo mis conversaciones, la de mensaje más reciente primero; las no leídas en negrita.
3. Filtro por «Como comprador» o «Como vendedor» si lo necesito.
4. Pulso una → `/mensajes/:id`; la conversación queda leída y el contador de la cabecera baja.

**Pantallas para el boceto**
- Cabecera (todas las páginas privadas): enlace «Mensajes» y, si hay conversaciones sin leer, una burbuja con el número (máx. «99+»).
- `/mensajes`: «Mensajes».
  1. Pestañas «Todas» · «Como comprador» · «Como vendedor».
  2. Lista de filas: miniatura del anuncio (48×48), nombre del otro centro en negrita si sin leer, título del anuncio, resumen del último mensaje (80 caracteres, «Tú: » si es mío), fecha relativa («hh:mm» si es de hoy, «Ayer», o «dd/mm/aaaa»), punto azul si sin leer.
  3. Paginación de 20 en 20 con «Anterior» / «Siguiente».
  4. Vacía: «Todavía no tienes conversaciones. Cuando escribas a un centro desde un anuncio, aparecerá aquí.» y botón «Ir al catálogo».

**Criterios de aceptación**

*Navegación*
- CA1. «Mensajes» en la cabecera lleva a `/mensajes` desde cualquier página privada.
- CA2. Cada fila lleva a `/mensajes/<id>`. El enlace «← Mensajes» de la conversación vuelve a `/mensajes` conservando pestaña y página (`?rol=comprador&pagina=2`).
- CA3. Las pestañas cambian la URL: `/mensajes`, `/mensajes?rol=comprador`, `/mensajes?rol=vendedor`. Un `rol` desconocido se trata como «Todas».

*Comportamiento*
- CA4. Orden: `ultimo_mensaje_en` descendente; empate por `id`.
- CA5. Una conversación está sin leer para mi centro si existe un mensaje de la otra parte con `creado_en` > mi `leida_hasta` (o `leida_hasta` es nulo). Mis propios mensajes nunca la ponen como no leída.
- CA6. Abrir `/mensajes/:id` llama a `POST /api/conversaciones/:id/leida`, que pone `leida_hasta = now()` para mi centro. Lo mismo tras cada refresco que traiga mensajes nuevos con la pestaña visible.
- CA7. La burbuja de la cabecera muestra el número de conversaciones (no de mensajes) sin leer. Se actualiza al cargar cada página y cada 60 s. Con 0 no se muestra. Con 100 o más muestra «99+».
- CA8. Conversaciones con centro eliminado o anuncio retirado siguen apareciendo, con «Centro eliminado» o el título tachado y «(retirado)».

*Mensajes*
- CA9. Mientras carga: «Cargando…». Error: «No se ha podido cargar. » + «Reintentar».
- CA10. Pestaña «Como vendedor» vacía: «Nadie te ha escrito todavía sobre tus anuncios.». «Como comprador» vacía: «Todavía no has escrito a ningún centro.».

*API*
- CA11. `GET /api/conversaciones?rol=todas|comprador|vendedor&pagina=n` → `200 { "conversaciones": [...], "pagina": n, "total": N, "por_pagina": 20 }`. Cada elemento: `id`, `soy`, `anuncio` (`id`,`titulo`,`foto_principal_url`,`estado`), `otro_centro` (`id`,`nombre`,`eliminado`), `ultimo_mensaje` (`texto_resumen`,`es_mio`,`creado_en`), `sin_leer`.
- CA12. `pagina` entero ≥ 1; `0`, `-1` o `abc` → `400 DATOS_INVALIDOS` con `details.pagina` = «La página debe ser un número mayor que 0.». Una página mayor que la última devuelve lista vacía.
- CA13. `GET /api/conversaciones/no-leidas` → `200 { "total": n }`.
- CA14. `POST /api/conversaciones/:id/leida` → `204`. Otro centro → `404 NO_ENCONTRADO`.

*Datos*
- CA15. Migración: añadir a `conversaciones` las columnas `leida_hasta_comprador` y `leida_hasta_vendedor` (timestamptz, nulas). Índices (`centro_comprador_id`, `ultimo_mensaje_en`) y (`centro_vendedor_id`, `ultimo_mensaje_en`).

*Permisos*
- CA16. La lista solo incluye conversaciones donde mi centro es comprador o vendedor; una conversación de CNS con CEG nunca aparece para EET.

**Flujos e2e**
- E2E-1 (camino feliz). 1) CNS tiene C1 (A1 con CEG) y C2 (A2 con EET); CEG escribe un mensaje nuevo en C1. 2) CNS ve «Mensajes (1)». 3) Abre `/mensajes`: C1 primera y en negrita, C2 segunda en normal. 4) Abre C1: en BD `leida_hasta_vendedor` = ahora; vuelve y la burbuja ha desaparecido.
- E2E-2 (filtro). 1) CEG tiene C1 como comprador y C3 como vendedor de su anuncio B1. 2) «Como comprador» muestra solo C1; «Como vendedor» solo C3.
- E2E-3 (paginación). 1) Con 25 conversaciones, la página 1 muestra 20 y «Siguiente»; la 2 muestra 5 y «Anterior». 2) `?pagina=0` en la API → `400 DATOS_INVALIDOS`.
- E2E-4 (mis mensajes no cuentan). 1) CEG envía un mensaje en C1 y vuelve a `/mensajes`: C1 no está en negrita para CEG.
- E2E-5 (vacía). 1) EET sin conversaciones abre `/mensajes`: ve el texto de vacía y «Ir al catálogo».

**Tareas**
- T65-1 · Base de datos: índices de CA15 en una migración nueva (las columnas `leida_hasta_*` ya existen, de T28-1).
- T65-2 · Backend: `GET /api/conversaciones`, `GET /api/conversaciones/no-leidas`, `POST /api/conversaciones/:id/leida` (este último ya existe, de T77-1).
- T65-3 · Frontend: enlace y burbuja en la cabecera, pantalla `/mensajes` con pestañas y paginación, marcar leída al abrir.
- T65-4 · QA: automatizar E2E-1 a E2E-5.
