# E07 Entrega · E09 Avisos

Historias: US-40, US-41, US-81, US-114 (nueva), US-42, US-43, US-82, US-115 (nueva) · US-116 (nueva), US-47, US-83, US-118 (nueva), US-117 (nueva), US-48.

## Decisiones comunes a las dos épicas

**Datos de ejemplo usados en todos los e2e.**
- Centro vendedor **A**: «Polideportivo Montjuïc Sport», `localidad` «Barcelona», `direccion` «Carrer de l'Estadi 40», `codigo_postal` «08038», email `montjuic@ejemplo.es`.
- Centro comprador **B**: «Club Bàsquet Gràcia», `localidad` «Barcelona», `direccion` «Carrer de Verdi 12», `codigo_postal` «08012», `telefono` «612345678», email `gracia@ejemplo.es`.
- Centro ajeno **C**: «CF Sant Andreu» (no participa en el pedido).
- Anuncio de A: «Balones de baloncesto talla 7», venta, 12,00 € por unidad, 10 unidades disponibles.
- Pedido P1: B pide 4 unidades del anuncio de A (48,00 €).
- Reloj de referencia en los e2e (se fija en los tests): **miércoles 21/10/2026 10:00, hora de Madrid**.

**Zona horaria.** Toda fecha y hora de entrega se interpreta en `Europe/Madrid`. Las fechas y horas de una cita se guardan como `date` + `time` locales (no como `timestamptz`) para que el cambio de hora del 25/10/2026 no desplace la cita. Los momentos de auditoría (`creado_en`, `respondida_en`, `leido_en`…) son `timestamptz` y se muestran en hora de Madrid.

**Pantalla de detalle del pedido.** La ruta `/pedidos/:id` y su cabecera (anuncio, unidades, importe, estado, centros) son de E06 [Depende de US-33]. E07 añade, debajo de esa cabecera y en este orden, las secciones «Entrega» (US-40, US-41, US-81, US-114, US-42) e «Incidencias» (US-43, US-82, US-115). `GET /api/pedidos/:id` se amplía con los objetos `entrega` e `incidencias` descritos en cada historia.

**Permisos comunes (E07).**
- Todas las rutas usan `requireAuth` y `requireEmailConfirmado`.
- Si el centro no es comprador ni vendedor del pedido: `404 NO_ENCONTRADO`.
- Si es parte del pedido pero no le toca esa acción (por ejemplo, el vendedor intenta confirmar la recepción): `403 SIN_PERMISO`, «No puedes hacer esta acción en este pedido.»
- Si el estado del pedido no permite la acción: `409 TRANSICION_NO_PERMITIDA`, «El pedido ya no está en un estado que permita esta acción.»

**Estados del pedido que usa E07 (de la guía, no se añaden estados nuevos).** `aceptado` → `recibido` (US-42). La entrega acordada y las incidencias no son estados del pedido: son datos aparte (`entrega_estado` y la tabla `incidencias`); el «subestado `incidencia`» de la guía se representa con `pedidos.incidencia_abierta = true`.

---

## (3) US-40 · Elijo al pedir si recojo el material o me lo envían, y doy la dirección de envío

**Épica:** E07 · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** 3 · **Depende de:** US-32, US-33
**Cambios respecto al backlog original:** Se concretan los campos de la dirección de envío y la dirección de recogida que ve el comprador. Sube de 2 a 3 puntos porque añade la dirección de envío. El formulario de pedido es de US-32; esta historia solo añade su bloque «Entrega».

**Historia**
Como responsable de un centro comprador, quiero indicar al hacer el pedido si pasaré a recoger el material o prefiero que me lo envíen, y a qué dirección, para organizar la entrega a mi manera.
1. En el detalle de un anuncio de otro centro pulso «Pedir» y llego a `/anuncios/:id/pedir` [Depende de US-32].
2. En el bloque «Entrega» elijo «Paso a recogerlo» o «Que me lo envíen».
3. Si elijo envío, aparece el formulario de dirección, ya rellenado con los datos de mi centro; lo reviso o lo cambio.
4. Pulso «Enviar pedido» (botón de US-32) y llego al detalle del pedido, donde la sección «Entrega» muestra lo que he elegido.
5. El vendedor abre el pedido en `/pedidos/:id` y ve el método y, si es envío, la dirección completa.
6. Si elegí recogida, cuando el vendedor acepta veo la dirección donde recogerlo.

**Pantallas para el boceto**
- `/anuncios/:id/pedir` (formulario de US-32), bloque «Entrega», tras «Unidades» y antes de «Mensaje»:
  1. Título «Entrega».
  2. Dos opciones de radio: «Paso a recogerlo» y «Que me lo envíen». Ninguna marcada al entrar.
  3. Texto fijo bajo las opciones: «El coste y la forma del envío los acordáis entre los dos centros.»
  4. Solo con «Que me lo envíen»: campos «Persona de contacto», «Dirección», «Piso, puerta (opcional)», «Código postal», «Localidad», «Provincia» (desplegable), «Teléfono de contacto», «Indicaciones para la entrega (opcional)».
- `/pedidos/:id`, sección «Entrega» (cabecera fija de la sección):
  1. «Método: Recogida en el centro vendedor» o «Método: Envío a tu dirección» (comprador) / «Método: Envío a la dirección del comprador» (vendedor).
  2. Si es envío: bloque con la dirección en 4 líneas (persona · dirección y piso · CP localidad (provincia) · teléfono) y, si hay, «Indicaciones: …».
  3. Si es recogida: «Dirección de recogida:» seguida de la dirección del vendedor (solo visible para el comprador cuando el pedido está `aceptado` o `recibido`).

**Criterios de aceptación**

*Campos y validación*
- CA1. `metodo_entrega` es obligatorio: `recogida` o `envio`. Sin elegir: «Elige cómo quieres recibir el material.»
- CA2. Los campos de dirección solo se muestran, se validan y se envían si `metodo_entrega = envio`. Si es `recogida` y llega `direccion_envio` en el cuerpo, la API la ignora y guarda `null`.
- CA3. Al elegir «Que me lo envíen» por primera vez, se rellenan: «Persona de contacto» vacío, «Dirección» con `centros.direccion`, «Código postal» con `centros.codigo_postal`, «Localidad» con `centros.localidad`, «Teléfono de contacto» con `centros.telefono`. Provincia vacía. Cambiar estos campos no modifica el perfil del centro.
- CA4. `destinatario` («Persona de contacto»): obligatorio, 2-100 caracteres. 2 se acepta, 1 o 101 se rechazan: «Indica la persona de contacto (entre 2 y 100 caracteres).»
- CA5. `calle_numero` («Dirección»): obligatorio, 5-150 caracteres. 5 y 150 se aceptan; 4 y 151 se rechazan: «Indica la calle y el número (entre 5 y 150 caracteres).»
- CA6. `piso_puerta`: opcional, 0-50 caracteres; 51 se rechaza: «Máximo 50 caracteres.» Vacío se guarda `null`.
- CA7. `codigo_postal`: obligatorio, exactamente 5 dígitos con prefijo de provincia válido (01-52), regex `^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$`. «08012» y «52001» se aceptan; «8012», «00123», «53001» y «08A12» se rechazan: «Introduce un código postal español de 5 cifras.»
- CA8. `localidad`: obligatoria, 2-120 caracteres; 1 y 121 se rechazan: «Indica la localidad (entre 2 y 120 caracteres).»
- CA9. `provincia`: obligatoria, una de las 52 provincias de España (lista fija en `shared/provincias`, en castellano: «Álava» … «Zaragoza», incluidas «Ceuta» y «Melilla»). Valor fuera de la lista: «Elige una provincia.»
- CA10. Coherencia CP-provincia: los dos primeros dígitos del CP deben corresponder a la provincia elegida (tabla de prefijos INE en `shared/provincias`). «08012» con «Girona» se rechaza en el campo CP: «El código postal no corresponde a la provincia elegida.»
- CA11. `telefono_contacto`: obligatorio, 9 dígitos que empiezan por 6, 7, 8 o 9; se eliminan espacios antes de validar. «612 345 678» se guarda «612345678»; «512345678» y «61234567» se rechazan: «Introduce un teléfono español de 9 cifras.»
- CA12. `indicaciones`: opcional, 0-300 caracteres; 301 se rechaza: «Máximo 300 caracteres.»

*Comportamiento*
- CA13. La dirección se guarda copiada en el pedido (columna `direccion_envio` JSONB). Si después el comprador cambia su perfil, la dirección del pedido no cambia.
- CA14. Dirección de recogida: es la del centro vendedor (`direccion`, `codigo_postal`, `localidad`) leída en el momento de mostrarla. Si el vendedor no tiene `direccion`, el comprador ve «El vendedor aún no ha indicado su dirección. Escríbele para acordarla.» con el enlace «Escribir al vendedor» [Depende de US-28].
- CA15. El comprador ve la dirección de recogida solo con el pedido en `aceptado` o `recibido`; en `pendiente` ve «Verás la dirección de recogida cuando el vendedor acepte el pedido.»; en `rechazado` o `cancelado`, no se muestra.
- CA16. El vendedor ve la dirección de envío en cualquier estado del pedido, para poder decidir si acepta.
- CA17. El método de entrega y la dirección no se pueden cambiar después de enviar el pedido (cambiarlo = cancelar y pedir de nuevo [Depende de US-39]).
- CA18. En «Pedidos» (`/pedidos`, lista de E06) cada fila muestra un icono con texto «Recogida» o «Envío».

*API*
- CA19. `POST /api/pedidos` [Depende de US-32] acepta además `metodo_entrega` y `direccion_envio: { destinatario, calle_numero, piso_puerta, codigo_postal, localidad, provincia, telefono_contacto, indicaciones }`. Errores de validación: `400 DATOS_INVALIDOS` con `details` por campo, usando claves `direccion_envio.codigo_postal`, etc.
- CA20. `GET /api/pedidos/:id` devuelve `entrega: { metodo, direccion_envio, direccion_recogida }`. `direccion_recogida` es `null` para el vendedor, y para el comprador cuando no aplica según CA15.

*Datos*
- CA21. Migración: `pedidos.metodo_entrega text not null check (metodo_entrega in ('recogida','envio'))` y `pedidos.direccion_envio jsonb null` con `check ((metodo_entrega = 'envio') = (direccion_envio is not null))`.

*Permisos y seguridad*
- CA22. Un centro C ajeno que pide `GET /api/pedidos/:id` de P1 recibe `404 NO_ENCONTRADO` y no ve ninguna dirección.

**Flujos e2e**
- E2E-1 (envío). B entra en el anuncio de A → «Pedir» → 4 unidades → «Que me lo envíen». Comprueba que «Dirección» = «Carrer de Verdi 12», CP «08012», «Localidad» «Barcelona», teléfono «612345678». Rellena «Persona de contacto» «Marta Puig», provincia «Barcelona», indicaciones «Entrada por el pabellón». «Enviar pedido» → en `/pedidos/:id` ve «Método: Envío a tu dirección» y las 4 líneas. BD: `metodo_entrega='envio'`, `direccion_envio.codigo_postal='08012'`. A abre el pedido y ve la misma dirección.
- E2E-2 (recogida). B pide con «Paso a recogerlo». En `pendiente` ve «Verás la dirección de recogida cuando el vendedor acepte el pedido.» A acepta [Depende de US-33]. B recarga y ve «Dirección de recogida: Carrer de l'Estadi 40, 08038 Barcelona». BD: `direccion_envio` es `null`.
- E2E-3 (validación). B elige envío, deja CP «08012» y provincia «Girona» → «Enviar pedido» → bajo CP: «El código postal no corresponde a la provincia elegida.» Cambia a «Barcelona» → el error desaparece. Pone teléfono «512345678» → «Introduce un teléfono español de 9 cifras.» No se crea pedido.
- E2E-4 (sin método). B pulsa «Enviar pedido» sin elegir método → «Elige cómo quieres recibir el material.»; la API, llamada directamente sin `metodo_entrega`, responde 400 `DATOS_INVALIDOS` con `details.metodo_entrega`.
- E2E-5 (vendedor sin dirección). A borra su `direccion`. B, con pedido de recogida aceptado, ve «El vendedor aún no ha indicado su dirección. Escríbele para acordarla.»

**Tareas**
- T40-1 · Base de datos: migración de `metodo_entrega` y `direccion_envio` con sus checks.
- T40-2 · Compartido: `shared/provincias` (52 provincias + prefijo de CP) y validador de dirección (Zod) usado en web y API.
- T40-3 · Backend: ampliar `POST /api/pedidos` y `GET /api/pedidos/:id` (`entrega`, regla de visibilidad de `direccion_recogida`).
- T40-4 · Frontend: bloque «Entrega» en el formulario de pedido con prerrelleno; sección «Entrega» del detalle; icono en la lista.
- T40-5 · QA: automatizar E2E-1 a E2E-5 y los casos límite de CA4-CA12.

**Decisiones pendientes**
- ¿Se admiten envíos fuera de España? Propuesta: no; solo direcciones españolas (CP de 5 cifras y provincias de España).
- ¿Puede el vendedor desactivar el envío en un anuncio? Propuesta: no en este backlog; el vendedor puede rechazar el pedido [Depende de US-79] explicándolo en el motivo.

---

## (3) US-41 · Propongo un día y una franja horaria para la entrega

**Épica:** E07 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 4 · **Depende de:** US-40, US-33
**Cambios respecto al backlog original:** La propuesta sirve para recogida (cuándo paso a buscarlo) y para envío (cuándo puedo recibirlo). Se fijan franjas, antelación y límite de propuestas. Retirar mi propuesta pendiente se incluye aquí. Responder es US-81; cambiar o anular una cita ya acordada es US-114 (nueva). Sube a 3 puntos.

**Historia**
Como responsable del centro comprador, quiero proponer al vendedor un día y una franja horaria para la entrega de un pedido aceptado, para organizarla sin ir y venir de mensajes.
1. En «Pedidos» (`/pedidos`) abro un pedido aceptado → `/pedidos/:id`.
2. En la sección «Entrega» veo «Aún no habéis acordado cuándo se entrega.» y pulso «Proponer fecha».
3. Se abre el diálogo «Proponer fecha de entrega»: elijo fecha, hora de inicio, hora de fin y, si quiero, una nota.
4. Pulso «Enviar propuesta». El diálogo se cierra, sale «Propuesta enviada.» y la sección muestra «Has propuesto el jue 22/10/2026 de 10:00 a 11:00. Esperando respuesta de Polideportivo Montjuïc Sport.»
5. Si cambio de idea, pulso «Retirar propuesta», confirmo y vuelvo a poder proponer.

**Pantallas para el boceto**
- `/pedidos/:id`, sección «Entrega», bloque «Fecha de entrega» (debajo del método y la dirección de US-40):
  - Sin propuestas: texto «Aún no habéis acordado cuándo se entrega.» + botón «Proponer fecha».
  - Con propuesta mía pendiente: «Has propuesto el {día} {dd/mm/aaaa} de {hh:mm} a {hh:mm}. Esperando respuesta de {centro}.», la nota si existe («Nota: …») y el botón secundario «Retirar propuesta».
  - Historial plegable «Ver propuestas anteriores (n)»: lista con fecha, franja, quién la propuso y su estado («Contrapropuesta», «Retirada», «Anulada», «Aceptada»).
- Diálogo «Proponer fecha de entrega»:
  1. «Fecha» (selector de fecha; los domingos y los días fuera de rango aparecen deshabilitados).
  2. «Desde» y «Hasta» (desplegables de 08:00 a 20:00 de 30 en 30 min).
  3. «Nota para el otro centro (opcional)» (área de texto, contador «0/300»).
  4. Texto fijo: «Hora de Madrid. Debe haber al menos 24 horas de antelación.»
  5. Botones «Enviar propuesta» y «Cancelar».

**Criterios de aceptación**

*Navegación*
- CA1. «Proponer fecha» solo se ve para el comprador, con el pedido en `aceptado`, sin cita pendiente ni acordada (`entrega_estado = 'sin_cita'`). En cualquier otro caso no aparece.
- CA2. «Cancelar» o la tecla Esc cierran el diálogo sin enviar nada.

*Campos y validación* (hora de Madrid; reloj de referencia mié 21/10/2026 10:00)
- CA3. `fecha` obligatoria, formato `aaaa-mm-dd` en la API y `dd/mm/aaaa` en pantalla. Vacía: «Elige una fecha.»
- CA4. Días permitidos: lunes a sábado. Domingo 25/10/2026 se rechaza: «Elige un día de lunes a sábado.»
- CA5. `hora_inicio` y `hora_fin` obligatorias, formato `hh:mm`, minutos `00` o `30`. «10:15» se rechaza: «Elige una hora en punto o y media.»
- CA6. Rango horario: `hora_inicio` ≥ 08:00 y `hora_fin` ≤ 20:00. «07:30» y fin «20:30» se rechazan: «La franja debe estar entre las 08:00 y las 20:00.»
- CA7. Duración de la franja: de 30 min a 4 h. 10:00-10:30 y 10:00-14:00 se aceptan; 10:00-10:00, 11:00-10:00 y 10:00-14:30 se rechazan: «La franja debe durar entre 30 minutos y 4 horas.»
- CA8. Antelación mínima: fecha + `hora_inicio` ≥ ahora + 24 h. Jue 22/10/2026 10:00 se acepta; jue 22/10/2026 09:30 se rechaza: «Propón una hora con al menos 24 horas de antelación.»
- CA9. Antelación máxima: fecha ≤ hoy + 60 días. Dom 20/12/2026 no vale por domingo; sáb 19/12/2026 se acepta; lun 21/12/2026 se rechaza: «Propón una fecha dentro de los próximos 60 días.»
- CA10. `nota` opcional, 0-300 caracteres; 301 se rechaza: «Máximo 300 caracteres.»
- CA11. La validación se hace igual en web y API con `Europe/Madrid` (no con la zona del navegador). Un navegador en UTC que propone 22/10/2026 10:00 guarda `fecha=2026-10-22`, `hora_inicio=10:00`.

*Comportamiento*
- CA12. Al enviar, se crea la cita en `pendiente` con `propuesta_por = 'comprador'` y el pedido pasa a `entrega_estado = 'cita_propuesta'`. El pedido sigue en `aceptado`.
- CA13. Solo puede haber una cita `pendiente` por pedido.
- CA14. Límite: 10 propuestas por pedido (contando las de los dos centros, de US-41 y US-81). La 11.ª se rechaza: «Habéis alcanzado el máximo de 10 propuestas. Acordad la fecha por mensaje.»
- CA15. «Retirar propuesta» abre el diálogo «¿Retirar la propuesta?» / «El otro centro ya no podrá aceptarla.» / «Retirar» y «Cancelar». Al confirmar: cita → `retirada`, pedido → `entrega_estado = 'sin_cita'`, aviso «Propuesta retirada.». Las retiradas cuentan para el límite de CA14.
- CA16. Si el pedido pasa a `cancelado` [Depende de US-39], la cita `pendiente` pasa a `anulada`.
- CA17. Al crear la propuesta se genera el aviso `cita_propuesta` al vendedor [Depende de US-118].

*Mensajes*
- CA18. Éxito: «Propuesta enviada.» (verde). Error de red/500/503: texto común de la guía, el diálogo sigue abierto con los datos.

*API*
- CA19. `POST /api/pedidos/:id/citas` con `{ fecha, hora_inicio, hora_fin, nota }` → `201` con `{ cita: { id, fecha, hora_inicio, hora_fin, nota, propuesta_por, estado, creado_en } }`.
- CA20. Errores: `400 DATOS_INVALIDOS` (con `details`), `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (pedido inexistente o ajeno), `403 SIN_PERMISO` (lo llama el vendedor), `409 TRANSICION_NO_PERMITIDA` (pedido no `aceptado`), `409 CITA_YA_EXISTE` («Ya hay una fecha propuesta o acordada para este pedido.»), `409 LIMITE_PROPUESTAS`.
- CA21. `POST /api/pedidos/:id/citas/:cita_id/retirar` → `200 { cita }`. Errores: `404 NO_ENCONTRADO`, `403 SIN_PERMISO` (no la propuso este centro), `409 CITA_NO_PENDIENTE` («Esta propuesta ya no está pendiente.»).
- CA22. `GET /api/pedidos/:id` devuelve `entrega.estado` (`sin_cita`, `cita_propuesta`, `cita_acordada`), `entrega.cita_actual` (la `pendiente` o `aceptada`, o `null`) y `entrega.historial` (resto, de la más nueva a la más antigua).

*Datos*
- CA23. Tabla `citas_entrega`: `id uuid pk`, `pedido_id fk`, `propuesta_por text check in ('comprador','vendedor')`, `fecha date`, `hora_inicio time`, `hora_fin time`, `nota text null`, `estado text check in ('pendiente','aceptada','contrapropuesta','retirada','anulada')`, `motivo_anulacion text null`, `creado_en timestamptz`, `respondida_en timestamptz null`. Índice único parcial: un solo `pendiente` o `aceptada` por `pedido_id`.
- CA24. Columna `pedidos.entrega_estado text not null default 'sin_cita'` con check de los tres valores.

*Casos límite*
- CA25. Dos peticiones simultáneas de propuesta para el mismo pedido: una da 201 y la otra `409 CITA_YA_EXISTE` (lo garantiza el índice único).

**Flujos e2e**
- E2E-1 (feliz). P1 aceptado, reloj mié 21/10/2026 10:00. B abre P1 → «Proponer fecha» → 22/10/2026, 10:00-11:00, nota «Vendremos con furgoneta» → «Enviar propuesta» → «Propuesta enviada.»; la sección muestra «Has propuesto el jue 22/10/2026 de 10:00 a 11:00. Esperando respuesta de Polideportivo Montjuïc Sport.» BD: cita `pendiente`, `propuesta_por='comprador'`; `entrega_estado='cita_propuesta'`.
- E2E-2 (límites de tiempo). B prueba 22/10/2026 09:30-10:30 → error de antelación; 25/10/2026 → error de domingo; 21/12/2026 → error de 60 días; 19/12/2026 18:00-20:00 → se acepta.
- E2E-3 (franja). 10:00-14:30 → «La franja debe durar entre 30 minutos y 4 horas.»; 07:30-08:30 → error de rango.
- E2E-4 (retirar). Con la propuesta de E2E-1, B pulsa «Retirar propuesta» → «Retirar» → «Propuesta retirada.»; vuelve «Proponer fecha»; el historial muestra 1 propuesta «Retirada».
- E2E-5 (permisos). A llama `POST /api/pedidos/P1/citas` → 403 `SIN_PERMISO`. C llama → 404 `NO_ENCONTRADO`. Con P1 en `pendiente`, B llama → 409 `TRANSICION_NO_PERMITIDA`.

**Tareas**
- T41-1 · Base de datos: tabla `citas_entrega`, índice único parcial, columna `entrega_estado`.
- T41-2 · Compartido: validador de franja (`Europe/Madrid`, con date-fns-tz o equivalente) usado en web y API.
- T41-3 · Backend: `POST /citas`, `POST /citas/:id/retirar`, ampliar `GET /api/pedidos/:id`; anular citas al cancelar.
- T41-4 · Frontend: bloque «Fecha de entrega», diálogo de propuesta, historial.
- T41-5 · QA: automatizar e2e con reloj fijo y casos límite CA4-CA10.

**Decisiones pendientes**
- ¿Se permiten domingos? Propuesta: no (la mayoría de instalaciones tienen horario reducido).
- ¿Puede proponer primero el vendedor? Propuesta: no; el comprador abre la negociación y el vendedor contrapropone (US-81).

---

## (3) US-81 · Respondo a una propuesta de fecha: la acepto o propongo otra

**Épica:** E07 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 4 · **Depende de:** US-41
**Cambios respecto al backlog original:** La respuesta la da el centro que recibe la propuesta: el vendedor ante la del comprador y el comprador ante una contrapropuesta del vendedor. Así la negociación se puede alternar hasta acordar. Sube a 3 puntos.

**Historia**
Como responsable del centro vendedor, quiero aceptar la fecha que me propone el comprador o proponer otra, para acordar una entrega que me venga bien.
1. Abro el pedido desde «Pedidos» o desde el aviso → `/pedidos/:id`.
2. En «Entrega» veo «Club Bàsquet Gràcia propone el jue 22/10/2026 de 10:00 a 11:00.» con «Aceptar» y «Proponer otra fecha».
3. Si pulso «Aceptar» y confirmo, ambos vemos «Entrega acordada: jue 22/10/2026 de 10:00 a 11:00.»
4. Si pulso «Proponer otra fecha», relleno el mismo diálogo que en US-41 y envío; ahora es el comprador quien ve la propuesta con «Aceptar» y «Proponer otra fecha».

**Pantallas para el boceto**
- `/pedidos/:id`, bloque «Fecha de entrega»:
  - Propuesta pendiente del otro centro: «{centro} propone el {día} {dd/mm/aaaa} de {hh:mm} a {hh:mm}.», «Nota: …» si hay, botón principal «Aceptar» y secundario «Proponer otra fecha».
  - Cita acordada: recuadro verde «Entrega acordada: {día} {dd/mm/aaaa} de {hh:mm} a {hh:mm}.», debajo «Acordada el {dd/mm/aaaa hh:mm}.» y el método/dirección de US-40.
- Diálogo de confirmación: título «¿Aceptar esta fecha?», texto «La entrega quedará acordada para el {día} {dd/mm/aaaa} de {hh:mm} a {hh:mm}.», botones «Aceptar fecha» y «Cancelar».
- Diálogo «Proponer otra fecha»: igual al de US-41, con título «Proponer otra fecha» y botón «Enviar contrapropuesta».

**Criterios de aceptación**

*Navegación*
- CA1. «Aceptar» y «Proponer otra fecha» solo se ven al centro que no hizo la propuesta pendiente, con el pedido en `aceptado`.
- CA2. El que propuso sigue viendo el texto de espera y «Retirar propuesta» (US-41).

*Comportamiento*
- CA3. Aceptar: cita → `aceptada`, `respondida_en = now()`, pedido → `entrega_estado = 'cita_acordada'`. Aviso «Fecha de entrega acordada.».
- CA4. Contraproponer: en una transacción, la cita pendiente → `contrapropuesta` (`respondida_en = now()`) y se crea una nueva `pendiente` con `propuesta_por` = rol del que responde. `entrega_estado` sigue `cita_propuesta`.
- CA5. La contrapropuesta valida exactamente las reglas CA3-CA11 de US-41 (días, horas, franja, 24 h, 60 días, nota, `Europe/Madrid`) y cuenta para el límite de 10 propuestas.
- CA6. Se puede aceptar una propuesta aunque falten menos de 24 h para su inicio, siempre que no haya empezado. Si `fecha + hora_inicio` ≤ ahora: `409 CITA_CADUCADA`, «Esta fecha ya ha pasado. Propón otra.», y solo se ofrece «Proponer otra fecha».
- CA7. Avisos: aceptar genera `cita_acordada` para el otro centro; contraproponer genera `cita_propuesta` para el otro centro [Depende de US-118].
- CA8. El comprador ve la cita acordada también en la lista `/pedidos` como «Entrega: 22/10/2026 10:00».

*Mensajes*
- CA9. Éxito al contraproponer: «Propuesta enviada.». Si mientras tanto la otra parte retiró la propuesta: `409 CITA_NO_PENDIENTE` y la web muestra «Esta propuesta ya no está pendiente.» y recarga la sección.

*API*
- CA10. `POST /api/pedidos/:id/citas/:cita_id/aceptar` (sin cuerpo) → `200 { cita }`.
- CA11. `POST /api/pedidos/:id/citas/:cita_id/contraproponer` con `{ fecha, hora_inicio, hora_fin, nota }` → `201 { cita }` (la nueva).
- CA12. Errores de ambos: `404 NO_ENCONTRADO` (pedido o cita ajenos o inexistentes; cita de otro pedido), `403 SIN_PERMISO` («No puedes responder a tu propia propuesta.»), `409 CITA_NO_PENDIENTE`, `409 TRANSICION_NO_PERMITIDA` (pedido no `aceptado`), `409 CITA_CADUCADA` (solo aceptar), `409 LIMITE_PROPUESTAS` y `400 DATOS_INVALIDOS` (solo contraproponer).

*Casos límite*
- CA13. Si el comprador retira y el vendedor acepta a la vez, solo una operación gana (bloqueo `select … for update` sobre la cita); la otra recibe `409 CITA_NO_PENDIENTE`.

**Flujos e2e**
- E2E-1 (aceptar). Propuesta de B del 22/10/2026 10:00-11:00. A abre P1 → «Aceptar» → «Aceptar fecha» → «Fecha de entrega acordada.»; recuadro verde. B recarga y ve lo mismo. BD: cita `aceptada`, `entrega_estado='cita_acordada'`.
- E2E-2 (contrapropuesta y vuelta). A → «Proponer otra fecha» → 23/10/2026 17:00-19:00 → «Enviar contrapropuesta». B ve «Polideportivo Montjuïc Sport propone el vie 23/10/2026 de 17:00 a 19:00.» B → «Aceptar» → «Aceptar fecha». BD: primera cita `contrapropuesta`, segunda `aceptada`.
- E2E-3 (límite). Tras 10 propuestas alternas sin acuerdo, la siguiente contrapropuesta → «Habéis alcanzado el máximo de 10 propuestas. Acordad la fecha por mensaje.»; «Aceptar» sigue disponible.
- E2E-4 (caducada). Reloj avanzado a jue 22/10/2026 10:05 con la propuesta 10:00-11:00 sin responder; A pulsa «Aceptar» → «Esta fecha ya ha pasado. Propón otra.»
- E2E-5 (permisos). B llama `aceptar` sobre su propia propuesta → 403 `SIN_PERMISO`; C → 404.

**Tareas**
- T81-1 · Backend: endpoints `aceptar` y `contraproponer` con transacción y bloqueo.
- T81-2 · Frontend: estados del bloque «Fecha de entrega» para quien responde; diálogos; texto en la lista de pedidos.
- T81-3 · QA: automatizar e2e y concurrencia de CA13.

---

## (2) US-114 · Cambio o anulo una fecha de entrega ya acordada

**Épica:** E07 · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-81
**Cambios respecto al backlog original:** Historia nueva; sale de US-41/US-81. Faltaba qué pasa si a uno de los centros le surge un imprevisto tras acordar la fecha.

**Historia**
Como responsable de cualquiera de los dos centros del pedido, quiero anular la fecha acordada explicando el motivo, para poder acordar otra si me surge un imprevisto.
1. En `/pedidos/:id`, con la entrega acordada, pulso «Anular fecha».
2. En el diálogo elijo el motivo y confirmo.
3. La sección vuelve a «Aún no habéis acordado cuándo se entrega.» y el comprador puede proponer otra (US-41).

**Pantallas para el boceto**
- Recuadro «Entrega acordada» (US-81) con enlace secundario «Anular fecha».
- Diálogo: título «¿Anular la fecha acordada?», texto «Tendréis que acordar una fecha nueva.», campo «Motivo» (área de texto, «0/300»), botones «Anular fecha» y «Cancelar».

**Criterios de aceptación**
- CA1. «Anular fecha» lo ven los dos centros con el pedido en `aceptado` y `entrega_estado = 'cita_acordada'`.
- CA2. `motivo` obligatorio, 10-300 caracteres. 9 se rechaza: «Explica el motivo (entre 10 y 300 caracteres).»; 301 se rechaza igual.
- CA3. No se puede anular si faltan menos de 2 h para `hora_inicio` o si ya ha empezado: `409 CITA_DEMASIADO_PROXIMA`, «Faltan menos de 2 horas. Avisa al otro centro por mensaje.»
- CA4. Al anular: cita → `anulada`, `motivo_anulacion` guardado, `entrega_estado = 'sin_cita'`. Aviso «Fecha anulada.».
- CA5. La cita anulada aparece en el historial como «Anulada por {centro}: {motivo}».
- CA6. Se genera el aviso `cita_anulada` para el otro centro [Depende de US-118].
- CA7. Las anulaciones no cuentan para el límite de 10 propuestas.
- CA8. API `POST /api/pedidos/:id/cita-acordada/anular` con `{ motivo }` → `200 { cita }`. Errores: `400 DATOS_INVALIDOS`, `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO`, `409 TRANSICION_NO_PERMITIDA` (sin cita acordada o pedido no `aceptado`), `409 CITA_DEMASIADO_PROXIMA`.
- CA9. Con el pedido en `recibido` la fecha no se puede anular (botón oculto, API 409 `TRANSICION_NO_PERMITIDA`).

**Flujos e2e**
- E2E-1. Cita acordada 23/10/2026 17:00. A → «Anular fecha» → motivo «Se nos ha averiado la furgoneta» → «Anular fecha». B ve «Aún no habéis acordado cuándo se entrega.» y en el historial «Anulada por Polideportivo Montjuïc Sport: Se nos ha averiado la furgoneta».
- E2E-2. Reloj vie 23/10/2026 15:30; B intenta anular → «Faltan menos de 2 horas. Avisa al otro centro por mensaje.»
- E2E-3. Motivo «No puedo» (8) → error de longitud; C llama la API → 404.

**Tareas**
- T114-1 · Backend: endpoint de anulación y regla de 2 h en `Europe/Madrid`.
- T114-2 · Frontend: enlace y diálogo; historial con motivo.
- T114-3 · QA: automatizar e2e.

---

## (2) US-42 · Confirmo que he recibido el material

**Épica:** E07 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-33, US-40
**Cambios respecto al backlog original:** «Cerrado» se llama `recibido`, como en el diccionario de la guía. Se concreta quién, cuándo y qué ocurre con la cita pendiente.

**Historia**
Como responsable del centro comprador, quiero confirmar que he recibido el material, para cerrar el pedido y que conste que todo ha ido bien.
1. En `/pedidos/:id` de un pedido aceptado pulso «He recibido el material».
2. Confirmo en el diálogo.
3. El pedido pasa a «Recibido» y el vendedor lo ve así; ya podemos valorarnos [Depende de US-44].

**Pantallas para el boceto**
- `/pedidos/:id`, al final de la sección «Entrega»: botón principal «He recibido el material» (solo comprador).
- Diálogo: título «¿Confirmas que has recibido el material?», texto «Confirmas que has recibido {n} unidades de «{titulo}». El pedido quedará cerrado y no se podrá deshacer.», botones «Sí, lo he recibido» y «Cancelar».
- Tras confirmar: etiqueta de estado «Recibido» y línea «Recibido el {dd/mm/aaaa hh:mm}.» en la sección «Entrega».

**Criterios de aceptación**
- CA1. El botón solo lo ve el comprador, con el pedido en `aceptado` y sin incidencia abierta (`incidencia_abierta = false`).
- CA2. Con incidencia abierta el botón se sustituye por el texto «Cierra la incidencia antes de confirmar la recepción.» (US-115).
- CA3. Se puede confirmar con o sin fecha acordada y antes o después de la fecha acordada.
- CA4. Al confirmar: `pedidos.estado = 'recibido'`, `pedidos.recibido_en = now()`. Aviso «Pedido marcado como recibido.».
- CA5. Si había una cita `pendiente`, pasa a `anulada` con `motivo_anulacion = 'Pedido recibido'`; si había una `aceptada`, se queda como está.
- CA6. La transición es irreversible: en `recibido` no existe ninguna acción para volver a `aceptado`.
- CA7. Las unidades ya se restaron al aceptar (US-34); confirmar no cambia `unidades_disponibles`. El paso del anuncio a `entregado` cuando no quedan unidades ni pedidos aceptados lo resuelve [Depende de US-34].
- CA8. Se genera el aviso `pedido_recibido` para el vendedor [Depende de US-83].
- CA9. En `/pedidos` el pedido aparece con la etiqueta «Recibido» (gris) para los dos centros.
- CA10. Desde `recibido` el comprador puede abrir una incidencia durante 7 días (US-43).
- CA11. API `POST /api/pedidos/:id/recibir` (sin cuerpo) → `200 { pedido: { id, estado: 'recibido', recibido_en } }`.
- CA12. Errores: `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (ajeno), `403 SIN_PERMISO` (lo llama el vendedor), `409 TRANSICION_NO_PERMITIDA` (estado distinto de `aceptado`, incluido ya `recibido`), `409 INCIDENCIA_ABIERTA` («Cierra la incidencia antes de confirmar la recepción.»).
- CA13. Migración: `pedidos.recibido_en timestamptz null`; check `estado <> 'recibido' or recibido_en is not null`.
- CA14. Dos confirmaciones simultáneas: la primera da 200 y la segunda `409 TRANSICION_NO_PERMITIDA`; `recibido_en` no cambia.

**Flujos e2e**
- E2E-1. P1 aceptado con cita acordada. B → «He recibido el material» → «Sí, lo he recibido» → «Pedido marcado como recibido.», etiqueta «Recibido», «Recibido el 22/10/2026 11:10.» A recarga y ve «Recibido». BD: `estado='recibido'`, `recibido_en` no nulo.
- E2E-2. P1 aceptado con cita pendiente → B confirma → la cita queda `anulada` con motivo «Pedido recibido».
- E2E-3. A llama `POST /api/pedidos/P1/recibir` → 403 `SIN_PERMISO`; C → 404; B repite tras E2E-1 → 409 `TRANSICION_NO_PERMITIDA`; con P1 `pendiente` → 409.
- E2E-4. P1 con incidencia abierta: B no ve el botón y ve «Cierra la incidencia antes de confirmar la recepción.»; la API → 409 `INCIDENCIA_ABIERTA`.

**Tareas**
- T42-1 · Base de datos: `recibido_en` y check.
- T42-2 · Backend: endpoint `recibir` con transacción (pedido + cita pendiente).
- T42-3 · Frontend: botón, diálogo, etiqueta y línea «Recibido el…».
- T42-4 · QA: automatizar e2e.

**Decisiones pendientes**
- ¿Se confirma automáticamente si el comprador no lo hace? Propuesta: no en este backlog; el pedido queda `aceptado` hasta que confirme o se cancele.
- En ventas por transferencia, ¿hace falta la marca «cobrado» (US-80) para confirmar? Propuesta: no; pago y recepción son independientes.

---

## (3) US-43 · Comunico una incidencia en un pedido

**Épica:** E07 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-33, US-42
**Cambios respecto al backlog original:** Se fija una lista cerrada de tipos de incidencia, desde qué estados y en qué plazo se abre, y los límites. Sin administrador: se resuelve entre los dos centros (respuesta en US-82, cierre en US-115, nueva). Sube a 3 puntos.

**Historia**
Como responsable del centro comprador, quiero avisar de que el material no ha llegado o no es como el del anuncio, para resolverlo con el vendedor.
1. En `/pedidos/:id`, en la sección «Incidencias», pulso «Comunicar una incidencia».
2. En el diálogo elijo el tipo, indico unidades afectadas si se pide y explico lo ocurrido.
3. Pulso «Enviar incidencia»; el pedido muestra la etiqueta «Incidencia abierta» y el vendedor recibe un aviso.

**Pantallas para el boceto**
- `/pedidos/:id`, sección «Incidencias»:
  - Sin incidencias: «No hay incidencias en este pedido.» + botón «Comunicar una incidencia» (si se puede, CA1).
  - Con incidencias: tarjetas de la más nueva a la más antigua: tipo, «Abierta el {dd/mm/aaaa hh:mm}», descripción, unidades afectadas, estado («Abierta · Esperando respuesta del vendedor», «Abierta · Respondida», «Resuelta», «Cerrada sin acuerdo»), y la respuesta y el cierre si los hay (US-82, US-115).
- Diálogo «Comunicar una incidencia»:
  1. «Tipo de incidencia» (radios, CA3).
  2. «Unidades afectadas» (numérico; solo para los tipos que lo piden).
  3. «¿Qué ha pasado?» (área de texto, «0/1000»).
  4. Texto fijo: «La incidencia la resolvéis entre los dos centros. Sportsplace no hace de intermediario en pagos ni devoluciones.»
  5. Botones «Enviar incidencia» y «Cancelar».
- Etiqueta naranja «Incidencia abierta» junto al estado del pedido, en el detalle y en `/pedidos`.

**Criterios de aceptación**

*Navegación*
- CA1. «Comunicar una incidencia» lo ve solo el comprador cuando: pedido en `aceptado`, o en `recibido` con `recibido_en` hace ≤ 7 días (168 h); no hay otra incidencia `abierta`; y hay menos de 3 incidencias en el pedido.
- CA2. Fuera de plazo, en `recibido`, se muestra «El plazo para comunicar incidencias terminó el {dd/mm/aaaa hh:mm}.» (recibido_en + 7 días).

*Campos y validación*
- CA3. `tipo` obligatorio, lista cerrada (valor API → texto):
  - `no_llegado` → «El material no ha llegado» (solo con el pedido en `aceptado`).
  - `no_coincide` → «El material no coincide con el anuncio».
  - `faltan_unidades` → «Faltan unidades».
  - `material_danado` → «El material ha llegado dañado».
  - `otro` → «Otro problema».
  Sin elegir: «Elige el tipo de incidencia.» `no_llegado` en un pedido `recibido`: `400 DATOS_INVALIDOS`, «Si has confirmado la recepción, el material ya ha llegado.» (en la web ese radio no aparece).
- CA4. `unidades_afectadas`: obligatorio para `faltan_unidades` y `material_danado`; entero de 1 a `pedido.unidades` (en P1, 1-4; 0 y 5 se rechazan): «Indica entre 1 y {unidades} unidades.». Para el resto de tipos se ignora y se guarda `null`.
- CA5. `descripcion` obligatoria, 20-1000 caracteres; 19 y 1001 se rechazan: «Explica qué ha pasado (entre 20 y 1000 caracteres).»

*Comportamiento*
- CA6. Al enviar: incidencia `abierta`, `abierta_en = now()`; `pedidos.incidencia_abierta = true`. El estado del pedido (`aceptado` o `recibido`) no cambia. Aviso «Incidencia comunicada.».
- CA7. Mientras haya una incidencia abierta: el comprador no puede confirmar la recepción (US-42 CA1) ni abrir otra.
- CA8. Se genera el aviso `incidencia_abierta` para el vendedor [Depende de US-118].
- CA9. La sección incluye el enlace «Escribir al vendedor» a la conversación del anuncio [Depende de US-28].
- CA10. Las incidencias no se pueden editar ni borrar.

*API*
- CA11. `POST /api/pedidos/:id/incidencias` con `{ tipo, unidades_afectadas, descripcion }` → `201 { incidencia: { id, tipo, unidades_afectadas, descripcion, estado, abierta_en } }`.
- CA12. Errores: `400 DATOS_INVALIDOS`, `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO`, `403 SIN_PERMISO` (vendedor), `409 TRANSICION_NO_PERMITIDA` (estado `pendiente`, `rechazado` o `cancelado`), `409 PLAZO_INCIDENCIA_VENCIDO`, `409 INCIDENCIA_ABIERTA` («Ya hay una incidencia abierta en este pedido.»), `409 LIMITE_INCIDENCIAS` («Este pedido ya tiene 3 incidencias.»).
- CA13. `GET /api/pedidos/:id` devuelve `incidencias: [...]` (todas, más nuevas primero) e `incidencia_abierta`.

*Datos*
- CA14. Tabla `incidencias`: `id uuid`, `pedido_id fk`, `tipo text check (5 valores)`, `unidades_afectadas int null`, `descripcion text`, `estado text check in ('abierta','resuelta','sin_acuerdo')`, `abierta_en`, `respuesta text null`, `resolucion_propuesta text null`, `respondida_en null`, `comentario_cierre text null`, `cerrada_en null`. Índice único parcial: una `abierta` por pedido.
- CA15. Columna `pedidos.incidencia_abierta boolean not null default false`.

*Casos límite*
- CA16. Plazo exacto: `recibido_en` 22/10/2026 11:10 → abrir el 29/10/2026 11:10 se acepta; 11:11 se rechaza con `PLAZO_INCIDENCIA_VENCIDO`, «Han pasado más de 7 días desde que confirmaste la recepción.»

**Flujos e2e**
- E2E-1. P1 `recibido` el 22/10/2026 11:10. B → «Comunicar una incidencia» → «Faltan unidades», 1 unidad, «Solo han llegado 3 balones de los 4 pedidos.» → «Enviar incidencia» → «Incidencia comunicada.», etiqueta «Incidencia abierta», tarjeta «Abierta · Esperando respuesta del vendedor». A ve la misma tarjeta. BD: `incidencias.estado='abierta'`, `pedidos.incidencia_abierta=true`.
- E2E-2. P1 `aceptado`, cita pasada → B abre «El material no ha llegado» con descripción de 25 caracteres → OK; no aparece «He recibido el material».
- E2E-3. «Material dañado» con 5 unidades → «Indica entre 1 y 4 unidades.»; descripción «Roto» → error de longitud.
- E2E-4. Reloj 29/10/2026 11:11 → botón oculto y texto de plazo; API 409 `PLAZO_INCIDENCIA_VENCIDO`.
- E2E-5. Con una abierta, B llama la API otra vez → 409 `INCIDENCIA_ABIERTA`; A llama → 403; C → 404.

**Tareas**
- T43-1 · Base de datos: tabla `incidencias`, índice, `pedidos.incidencia_abierta`.
- T43-2 · Backend: endpoint de alta con reglas de estado, plazo y límite; ampliar `GET`.
- T43-3 · Frontend: sección «Incidencias», diálogo, etiqueta en detalle y lista.
- T43-4 · QA: automatizar e2e.

**Decisiones pendientes**
- ¿Se adjuntan fotos a la incidencia? Propuesta: no en esta historia; se envían por mensaje [Depende de US-28]. Si se quiere, historia aparte.
- Plazo tras `recibido`: propuesta 7 días.

---

## (3) US-82 · Respondo a una incidencia proponiendo una solución

**Épica:** E07 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-43
**Cambios respecto al backlog original:** La respuesta incluye una solución elegida de una lista fija y un texto. El cierre lo hace el comprador en US-115 (nueva). Sube a 3 puntos porque añade el filtro de incidencias en «Pedidos».

**Historia**
Como responsable del centro vendedor, quiero ver las incidencias abiertas en mis pedidos y responder con una solución, para resolver el problema con el comprador.
1. En «Pedidos» (`/pedidos`) marco el filtro «Con incidencia abierta» y veo los pedidos afectados.
2. Abro uno → `/pedidos/:id`; en la tarjeta de la incidencia pulso «Responder».
3. Elijo la solución, escribo la respuesta y pulso «Enviar respuesta»; el comprador la ve en su tarjeta.

**Pantallas para el boceto**
- `/pedidos`: casilla «Con incidencia abierta (n)» encima de la lista; al marcarla solo se ven pedidos con `incidencia_abierta = true`, de los dos roles.
- Tarjeta de incidencia abierta sin respuesta (vista del vendedor): botón «Responder».
- Diálogo «Responder a la incidencia»:
  1. Resumen de la incidencia (tipo, unidades, descripción).
  2. «Solución que propones» (radios, CA2).
  3. «Respuesta» (área de texto, «0/1000»).
  4. Botones «Enviar respuesta» y «Cancelar».
- Tarjeta ya respondida (los dos): bloque «Respuesta de {vendedor} · {dd/mm/aaaa hh:mm}» con la solución en negrita y el texto.

**Criterios de aceptación**
- CA1. «Responder» solo lo ve el vendedor en una incidencia `abierta` sin respuesta (`respondida_en` nulo).
- CA2. `resolucion_propuesta` obligatoria, lista cerrada (valor → texto):
  - `entregar_lo_que_falta` → «Entregaré o enviaré el material que falta».
  - `sustituir_material` → «Cambiaré el material por otro correcto».
  - `devolucion_parcial` → «Devolveré parte del importe» (solo en ventas).
  - `devolucion_total` → «Devolveré el importe completo y recogeré el material» (solo en ventas).
  - `no_procede` → «No estoy de acuerdo con la incidencia».
  Sin elegir: «Elige una solución.». Devoluciones en una donación: `400 DATOS_INVALIDOS`, «En una donación no hay importe que devolver.» (en la web no aparecen).
- CA3. `respuesta` obligatoria, 10-1000 caracteres; 9 y 1001 se rechazan: «Escribe una respuesta (entre 10 y 1000 caracteres).»
- CA4. Una sola respuesta por incidencia, que no se edita. Al enviar: `respuesta`, `resolucion_propuesta`, `respondida_en`; estado sigue `abierta`; la tarjeta muestra «Abierta · Respondida». Aviso «Respuesta enviada.».
- CA5. Se genera el aviso `incidencia_respondida` para el comprador [Depende de US-118].
- CA6. Si la incidencia lleva más de 72 h abierta sin respuesta, la tarjeta muestra a los dos «Sin respuesta desde hace {n} días.» (n = días completos). No tiene más efectos.
- CA7. El contador del filtro «Con incidencia abierta (n)» cuenta los pedidos del centro (como comprador o vendedor) con `incidencia_abierta = true`.
- CA8. API `POST /api/pedidos/:id/incidencias/:incidencia_id/respuesta` con `{ resolucion_propuesta, respuesta }` → `200 { incidencia }`.
- CA9. Errores: `400 DATOS_INVALIDOS`, `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (pedido ajeno o incidencia de otro pedido), `403 SIN_PERMISO` (comprador), `409 INCIDENCIA_YA_RESPONDIDA` («Ya has respondido a esta incidencia.»), `409 INCIDENCIA_CERRADA` («Esta incidencia ya está cerrada.»).
- CA10. `GET /api/pedidos?incidencia_abierta=true` [amplía la lista de E06] filtra igual que la casilla y devuelve `total_incidencias_abiertas`.

**Flujos e2e**
- E2E-1. Con la incidencia de US-43 E2E-1, A marca «Con incidencia abierta (1)» → ve P1 → «Responder» → «Entregaré o enviaré el material que falta», «Te lo llevamos el lunes con la próxima entrega.» → «Enviar respuesta». B ve «Respuesta de Polideportivo Montjuïc Sport · …». BD: `resolucion_propuesta='entregar_lo_que_falta'`.
- E2E-2. A repite por API → 409 `INCIDENCIA_YA_RESPONDIDA`. B llama → 403. C → 404.
- E2E-3. Pedido de donación: el diálogo solo ofrece 3 soluciones; la API con `devolucion_total` → 400.
- E2E-4. Reloj +73 h sin respuesta → «Sin respuesta desde hace 3 días.»

**Tareas**
- T82-1 · Backend: endpoint de respuesta; filtro `incidencia_abierta` en la lista de pedidos.
- T82-2 · Frontend: casilla de filtro con contador, diálogo, bloque de respuesta, texto de 72 h.
- T82-3 · QA: automatizar e2e.

**Decisiones pendientes**
- ¿Puede el comprador replicar dentro de la incidencia? Propuesta: no; la conversación sigue por mensajes [Depende de US-28] y la incidencia solo guarda respuesta y cierre.

---

## (2) US-115 · Cierro una incidencia como resuelta o sin acuerdo

**Épica:** E07 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 5 · **Depende de:** US-43, US-82
**Cambios respecto al backlog original:** Historia nueva; sale de dividir US-43/US-82. Sin ella las incidencias no se cerraban nunca y el pedido quedaba bloqueado.

**Historia**
Como responsable del centro comprador, quiero cerrar la incidencia indicando si se ha resuelto o no, para que conste el resultado y poder cerrar el pedido.
1. En la tarjeta de la incidencia abierta pulso «Cerrar incidencia».
2. Elijo «Se ha resuelto» o «No hemos llegado a un acuerdo», escribo un comentario opcional y confirmo.
3. La etiqueta «Incidencia abierta» desaparece y, si el pedido está aceptado, ya puedo confirmar la recepción.

**Pantallas para el boceto**
- Tarjeta de incidencia abierta (vista del comprador): botón «Cerrar incidencia».
- Diálogo «Cerrar incidencia»: radios «Se ha resuelto» / «No hemos llegado a un acuerdo», «Comentario (opcional)» («0/500»), texto «Una incidencia cerrada no se puede volver a abrir.», botones «Cerrar incidencia» y «Cancelar».
- Tarjeta cerrada: etiqueta «Resuelta» (verde) o «Cerrada sin acuerdo» (gris), «Cerrada el {dd/mm/aaaa hh:mm}» y el comentario.

**Criterios de aceptación**
- CA1. «Cerrar incidencia» solo lo ve el comprador, en una incidencia `abierta`, haya respuesta o no.
- CA2. `resultado` obligatorio: `resuelta` o `sin_acuerdo`. Sin elegir: «Indica cómo se ha cerrado.»
- CA3. `comentario` opcional, 0-500 caracteres; 501 se rechaza: «Máximo 500 caracteres.»
- CA4. Al cerrar: `incidencias.estado = resultado`, `cerrada_en = now()`, `pedidos.incidencia_abierta = false`. Aviso «Incidencia cerrada.».
- CA5. El estado del pedido no cambia. Si es `aceptado`, vuelve a mostrarse «He recibido el material» (US-42). Si es `recibido`, se podrá abrir otra incidencia dentro del plazo de 7 días y el límite de 3 (US-43).
- CA6. Una incidencia cerrada no se reabre ni se edita.
- CA7. Se genera el aviso `incidencia_cerrada` para el vendedor [Depende de US-118].
- CA8. API `POST /api/pedidos/:id/incidencias/:incidencia_id/cerrar` con `{ resultado, comentario }` → `200 { incidencia }`. Errores: `400 DATOS_INVALIDOS`, `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO`, `403 SIN_PERMISO` (vendedor), `409 INCIDENCIA_CERRADA`.

**Flujos e2e**
- E2E-1. B cierra la incidencia de P1 con «Se ha resuelto», comentario «Ya tenemos los 4 balones.» → etiqueta «Resuelta»; desaparece «Incidencia abierta» en detalle y lista. BD: `estado='resuelta'`, `incidencia_abierta=false`.
- E2E-2. P1 `aceptado` con incidencia `no_llegado`; B cierra «No hemos llegado a un acuerdo» → reaparece «He recibido el material».
- E2E-3. A llama `cerrar` → 403; B repite → 409 `INCIDENCIA_CERRADA`.

**Tareas**
- T115-1 · Backend: endpoint de cierre (transacción incidencia + pedido).
- T115-2 · Frontend: botón, diálogo y tarjeta cerrada.
- T115-3 · QA: automatizar e2e.

---

## (3) US-116 · Veo mis avisos en la campana y en la página de avisos

**Épica:** E09 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-03
**Cambios respecto al backlog original:** Historia nueva; sale de dividir US-47. Recoge la base común de todos los avisos (tabla, campana, contador, lista, marcar como leído) para que US-47, US-83 y US-118 solo tengan que generar sus avisos.

**Historia**
Como responsable de un centro, quiero ver en la cabecera cuántos avisos tengo sin leer y abrirlos, para enterarme de lo que pasa sin revisarlo todo.
1. En cualquier pantalla privada veo la campana con un número rojo, p. ej. «3».
2. Pulso la campana y se despliega el panel con los últimos avisos; los no leídos destacan.
3. Pulso un aviso: voy a su enlace y el aviso queda leído; el número baja a «2».
4. Pulso «Marcar todos como leídos» y el número desaparece.
5. Pulso «Ver todos los avisos» y llego a `/avisos`, con la lista completa paginada.

**Pantallas para el boceto**
- Cabecera privada: campana entre «Mensajes» y «Publicar anuncio». Insignia roja arriba a la derecha con el número de no leídos; sin no leídos no hay insignia. `aria-label` «Avisos ({n} sin leer)».
- Panel desplegable (360 px de ancho, anclado a la campana):
  1. Título «Avisos» y, a la derecha, enlace «Marcar todos como leídos» (solo si hay no leídos).
  2. Los 10 avisos más recientes: punto azul si no está leído, texto (negrita si no leído) y fecha relativa («hace 5 min», «hace 3 h», «ayer», o `dd/mm/aaaa` si tiene más de 7 días).
  3. Vacío: «No tienes avisos.»
  4. Pie: enlace «Ver todos los avisos» (→ `/avisos`).
- `/avisos`: título «Avisos», pestañas «Todos» / «Sin leer», botón «Marcar todos como leídos», lista de 20 en 20 con «Anterior» / «Siguiente». Vacía: «No tienes avisos.» (Todos) o «No tienes avisos sin leer.» (Sin leer).

**Criterios de aceptación**

*Comportamiento de la campana*
- CA1. Insignia: 0 → oculta; 1-9 → el número; ≥ 10 → «9+».
- CA2. Refresco: `GET /api/avisos/contador` al cargar la zona privada, en cada cambio de ruta, cada 30 s mientras la pestaña está visible (`document.visibilityState = 'visible'`) y al volver a hacerla visible. Con la pestaña oculta no se consulta. No hay websockets.
- CA3. Si el contador falla (red o 5xx), se mantiene el último valor y se reintenta en el siguiente ciclo; no se muestra error.
- CA4. Abrir el panel pide `GET /api/avisos?limite=10` y no marca nada como leído. Mientras carga: «Cargando…»; si falla: «No se ha podido cargar. » + «Reintentar».
- CA5. El panel se cierra al pulsar fuera, con Esc, al volver a pulsar la campana o al navegar.

*Marcar como leído*
- CA6. Un aviso se marca leído solo cuando: se pulsa (en el panel o en `/avisos`), se pulsa «Marcar todos como leídos», o la historia que lo genera lo indica al abrir el recurso (US-47 CA6, US-83 CA6).
- CA7. Pulsar un aviso: llama `POST /api/avisos/:id/leer` (sin esperar respuesta para navegar), navega a `enlace` y baja el contador en 1 de forma inmediata si no estaba leído.
- CA8. Pulsar un aviso ya leído solo navega.
- CA9. «Marcar todos como leídos» llama `POST /api/avisos/leer-todos`; el contador pasa a 0 y todos los avisos dejan de estar en negrita. Marca solo los creados hasta ese momento (`creado_en ≤` momento de la petición).

*Contenido*
- CA10. Cada aviso tiene `tipo` (lista cerrada de US-47, US-83 y US-118), `texto` (1-300 caracteres, ya redactado al crearse, no se recalcula), `enlace` (ruta interna que empieza por `/`), `leido` y `creado_en`. Si el recurso del enlace ya no existe, la página destino muestra su propio «no encontrado».
- CA11. Un centro nunca recibe avisos de las acciones que hace él mismo.
- CA12. Los avisos con más de 90 días se borran cada noche (tarea programada a las 03:00 Madrid).

*API*
- CA13. `GET /api/avisos/contador` → `200 { no_leidos }`.
- CA14. `GET /api/avisos?pagina=1&limite=20&solo_no_leidos=false` → `200 { avisos: [{ id, tipo, texto, enlace, leido, creado_en }], pagina, total, no_leidos }`, de más nuevo a más antiguo. `limite` 1-50 (51 → `400 DATOS_INVALIDOS`); `pagina` ≥ 1.
- CA15. `POST /api/avisos/:id/leer` → `200 { aviso }` (idempotente: si ya estaba leído, 200 sin cambiar `leido_en`). Aviso de otro centro o inexistente → `404 NO_ENCONTRADO`.
- CA16. `POST /api/avisos/leer-todos` → `200 { marcados: n }`.
- CA17. Todas con `requireAuth` (`401 NO_AUTENTICADO`). Leer avisos no exige email confirmado; marcarlos sí (`403 EMAIL_NO_CONFIRMADO`).

*Datos*
- CA18. Tabla `avisos`: `id uuid`, `centro_id fk`, `tipo text check (lista cerrada)`, `texto text`, `enlace text`, `referencia_id uuid null` (conversación, pedido…), `leido_en timestamptz null`, `creado_en timestamptz default now()`. Índice `(centro_id, leido_en, creado_en desc)`.
- CA19. Servicio interno `crearAviso({ centro_id, tipo, texto, enlace, referencia_id })` que usan las demás historias; se llama dentro de la misma transacción que la acción que lo provoca y, después del commit, notifica al servicio de email [Depende de US-117].

**Flujos e2e**
- E2E-1. Se insertan 3 avisos no leídos para B. B entra en `/catalogo` → insignia «3». Abre el panel → 3 avisos en negrita. Pulsa el primero → navega a su enlace, insignia «2». BD: `leido_en` no nulo en ese aviso.
- E2E-2. Con 12 no leídos → «9+». «Marcar todos como leídos» → insignia oculta; `/avisos` pestaña «Sin leer» → «No tienes avisos sin leer.»
- E2E-3 (polling). B en `/catalogo`; se inserta un aviso nuevo; antes de 30 s (reloj simulado) la insignia pasa de 0 a «1» sin recargar. Con la pestaña oculta no hay peticiones.
- E2E-4 (paginación). 45 avisos → `/avisos` muestra 20, «Siguiente» → 20, «Siguiente» → 5; «Siguiente» deshabilitado.
- E2E-5 (permisos). B llama `POST /api/avisos/{aviso de A}/leer` → 404; sin token → 401.

**Tareas**
- T116-1 · Base de datos: tabla `avisos`, índice, tarea de limpieza de 90 días.
- T116-2 · Backend: servicio `crearAviso` y los 4 endpoints.
- T116-3 · Frontend: campana con insignia y polling, panel, página `/avisos`.
- T116-4 · QA: automatizar e2e con temporizadores simulados.

**Decisiones pendientes**
- Intervalo de refresco: propuesta 30 s; tiempo real (Supabase Realtime) queda fuera.
- Retención: propuesta 90 días.

---

## (2) US-47 · Recibo un aviso cuando otro centro me escribe

**Épica:** E09 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 5 · **Depende de:** US-116, US-28
**Cambios respecto al backlog original:** La campana, el contador y el marcado pasan a US-116 (nueva). Esta historia solo genera el aviso `mensaje_nuevo` y lo agrupa por conversación. Baja de 3 a 2 puntos.

**Historia**
Como responsable de un centro, quiero recibir un aviso cuando otro centro me escribe, para no tener que entrar a «Mensajes» a mirar.
1. El Club Bàsquet Gràcia me escribe sobre mi anuncio.
2. En mi campana aparece «1» y el aviso «Club Bàsquet Gràcia te ha escrito sobre «Balones de baloncesto talla 7».»
3. Lo pulso y voy a la conversación; el aviso queda leído.

**Pantallas para el boceto**
- Sin pantallas nuevas: el aviso se ve en el panel de la campana y en `/avisos` (US-116), con un icono de bocadillo.

**Criterios de aceptación**
- CA1. Tipo `mensaje_nuevo`. Se genera para el otro centro de la conversación cada vez que se envía un mensaje [Depende de US-28]; nunca para el autor.
- CA2. Texto con 1 mensaje sin leer: «{centro remitente} te ha escrito sobre «{título del anuncio}».»
- CA3. Agrupación: si el destinatario ya tiene un aviso `mensaje_nuevo` no leído de la misma conversación (`referencia_id`), no se crea otro: se actualiza ese con `creado_en = now()` y el texto «{centro} te ha enviado {n} mensajes sobre «{título}».» (n = mensajes recibidos desde que se creó el aviso, contando el primero). El contador de la campana no sube.
- CA4. Si el título del anuncio supera 60 caracteres, en el texto se corta a 57 y se añade «…».
- CA5. Enlace: `/mensajes/{conversacion_id}`. `referencia_id` = `conversacion_id`.
- CA6. Al abrir `/mensajes/{conversacion_id}` (la API de la conversación responde con éxito), se marcan como leídos todos los avisos `mensaje_nuevo` de esa conversación del centro que la abre.
- CA7. El aviso se crea en la misma transacción que el mensaje: si el mensaje falla, no hay aviso.
- CA8. Datos: columna `avisos.contador int not null default 1` para la agrupación.

**Flujos e2e**
- E2E-1. B escribe a A «¿Siguen disponibles?» sobre el anuncio. A: insignia «1», aviso «Club Bàsquet Gràcia te ha escrito sobre «Balones de baloncesto talla 7».». A lo pulsa → `/mensajes/{id}`, insignia oculta. B no tiene ningún aviso.
- E2E-2. B envía 3 mensajes seguidos. A: insignia «1», texto «Club Bàsquet Gràcia te ha enviado 3 mensajes sobre «Balones de baloncesto talla 7».». BD: 1 fila con `contador=3`.
- E2E-3. A entra en la conversación desde «Mensajes» (sin pulsar el aviso) → el aviso queda leído. B escribe otra vez → se crea un aviso nuevo con contador 1.

**Tareas**
- T47-1 · Base de datos: columna `contador`.
- T47-2 · Backend: generar/agrupar en el envío de mensajes; marcar leídos al abrir la conversación.
- T47-3 · QA: automatizar e2e.

---

## (3) US-83 · Recibo un aviso cuando me llega un pedido o cambia el estado de uno mío

**Épica:** E09 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-116, US-32, US-33, US-79, US-39, US-42
**Cambios respecto al backlog original:** Se fija la lista cerrada de avisos de estado de pedido. Los avisos de entrega e incidencias pasan a US-118 (nueva).

**Historia**
Como responsable de un centro, quiero un aviso cada vez que me llega un pedido o cambia el estado de un pedido mío, para enterarme de lo que pasa con mis operaciones.
1. Club Bàsquet Gràcia hace un pedido de mi anuncio; en mi campana aparece el aviso.
2. Lo pulso y voy al pedido; el aviso queda leído.
3. Cuando lo acepto, el comprador recibe su aviso.

**Pantallas para el boceto**
- Sin pantallas nuevas; icono de caja en los avisos de este tipo (panel y `/avisos`).

**Criterios de aceptación**
- CA1. Lista cerrada (tipo · cuándo · destinatario · texto). `{n}` = unidades, `{título}` con el corte de US-47 CA4:
  - `pedido_nuevo` · se crea un pedido [US-32] · vendedor · «{comprador} te ha pedido {n} unidades de «{título}».» (con n = 1: «1 unidad»).
  - `pedido_aceptado` · el vendedor acepta [US-33] · comprador · «{vendedor} ha aceptado tu pedido de «{título}».»
  - `pedido_rechazado` · el vendedor rechaza [US-79] · comprador · «{vendedor} ha rechazado tu pedido de «{título}».»
  - `pedido_cancelado` · un centro cancela [US-39] · el otro centro · «{centro} ha cancelado el pedido de «{título}».»
  - `pedido_recibido` · el comprador confirma [US-42] · vendedor · «{comprador} ha confirmado que ha recibido «{título}».»
- CA2. Enlace de todos: `/pedidos/{pedido_id}`; `referencia_id` = `pedido_id`.
- CA3. Cada transición genera exactamente un aviso al otro centro y ninguno al que actúa.
- CA4. Los avisos no se agrupan: cada evento es un aviso.
- CA5. El aviso se crea en la misma transacción que el cambio de estado; si la transición falla (409, etc.), no se crea.
- CA6. Al abrir `/pedidos/{id}` (la API responde con éxito), se marcan como leídos todos los avisos no leídos del centro con `referencia_id` = ese pedido (incluidos los de US-118).
- CA7. Los nombres de centro y el título se copian en el texto al crear el aviso; si después cambian, el aviso no cambia.

**Flujos e2e**
- E2E-1. B pide 4 unidades → A recibe «Club Bàsquet Gràcia te ha pedido 4 unidades de «Balones de baloncesto talla 7».»; B no recibe nada. A pulsa → `/pedidos/P1`, leído.
- E2E-2. A acepta → B recibe «Polideportivo Montjuïc Sport ha aceptado tu pedido de «Balones de baloncesto talla 7».». B confirma recepción → A recibe «Club Bàsquet Gràcia ha confirmado que ha recibido «Balones de baloncesto talla 7».»
- E2E-3. Otro pedido P2 de 1 unidad → «… te ha pedido 1 unidad de …». A rechaza → aviso de rechazo a B. Pedido P3: B cancela → A recibe «Club Bàsquet Gràcia ha cancelado el pedido de …».
- E2E-4. A intenta aceptar P2 ya rechazado → 409 y B no recibe aviso nuevo.
- E2E-5. A tiene 2 avisos no leídos de P1; abre `/pedidos/P1` desde «Pedidos» → los 2 quedan leídos.

**Tareas**
- T83-1 · Backend: llamar a `crearAviso` en las 5 transiciones (servicio de pedidos) con plantillas de texto en un único módulo `avisos/plantillas`.
- T83-2 · Backend: marcar leídos al abrir el pedido.
- T83-3 · QA: automatizar e2e.

**Decisiones pendientes**
- ¿Aviso cuando el vendedor marca un pedido como cobrado (US-80)? Propuesta: sí, tipo `pedido_cobrado` («{vendedor} ha marcado como cobrado el pedido de «{título}».»), que se añade a esta lista cuando exista la historia de E06 que marca el pago.

---

## (2) US-118 · Recibo avisos de la entrega y de las incidencias de mis pedidos

**Épica:** E09 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 5 · **Depende de:** US-116, US-41, US-81, US-43, US-82, US-115
**Cambios respecto al backlog original:** Historia nueva; sale de US-83. Las historias de E07 generan eventos que el otro centro tiene que conocer para responder.

**Historia**
Como responsable de un centro, quiero un aviso cuando el otro centro propone o acuerda una fecha de entrega o abre, responde o cierra una incidencia, para responder a tiempo.
1. El comprador propone una fecha; me llega el aviso; lo pulso y voy al pedido.

**Pantallas para el boceto**
- Sin pantallas nuevas; icono de calendario (citas) o de exclamación (incidencias).

**Criterios de aceptación**
- CA1. Lista cerrada (tipo · cuándo · destinatario · texto):
  - `cita_propuesta` · propuesta o contrapropuesta (US-41, US-81) · el otro centro · «{centro} propone entregar «{título}» el {dd/mm/aaaa} de {hh:mm} a {hh:mm}.»
  - `cita_acordada` · se acepta una propuesta (US-81) · el que la propuso · «Entrega de «{título}» acordada para el {dd/mm/aaaa} de {hh:mm} a {hh:mm}.»
  - `cita_anulada` · se anula la fecha acordada (US-114) · el otro centro · «{centro} ha anulado la entrega de «{título}» del {dd/mm/aaaa}.»
  - `incidencia_abierta` · US-43 · vendedor · «{comprador} ha comunicado una incidencia en el pedido de «{título}»: {texto del tipo}.»
  - `incidencia_respondida` · US-82 · comprador · «{vendedor} ha respondido a tu incidencia en el pedido de «{título}».»
  - `incidencia_cerrada` · US-115 · vendedor · «{comprador} ha cerrado la incidencia de «{título}»: resuelta.» o «…: sin acuerdo.»
- CA2. Enlace `/pedidos/{pedido_id}`, `referencia_id` = `pedido_id`; se marcan leídos al abrir el pedido (US-83 CA6).
- CA3. Retirar una propuesta (US-41) no genera aviso; si el otro centro tenía un `cita_propuesta` no leído de esa cita, se borra.
- CA4. Mismas reglas que US-83 CA3, CA5 y CA7 (uno por evento, nunca al autor, en la misma transacción, texto congelado).
- CA5. Fechas del texto en `dd/mm/aaaa` y horas `hh:mm` de Madrid, tal como se guardaron en la cita.

**Flujos e2e**
- E2E-1. B propone 22/10/2026 10:00-11:00 → A: «Club Bàsquet Gràcia propone entregar «Balones de baloncesto talla 7» el 22/10/2026 de 10:00 a 11:00.». A acepta → B: «Entrega de «Balones de baloncesto talla 7» acordada para el 22/10/2026 de 10:00 a 11:00.»
- E2E-2. B propone y retira antes de que A lo lea → A no tiene el aviso (insignia vuelve a 0).
- E2E-3. B abre incidencia «Faltan unidades» → A: «… ha comunicado una incidencia en el pedido de «…»: Faltan unidades.». A responde → aviso a B. B cierra resuelta → A: «…: resuelta.»

**Tareas**
- T118-1 · Backend: llamar a `crearAviso` en los 6 eventos; borrar en la retirada.
- T118-2 · QA: automatizar e2e.

---

## (3) US-117 · Recibo por email los avisos importantes

**Épica:** E09 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 6 · **Depende de:** US-116, US-47, US-83, US-118
**Cambios respecto al backlog original:** Historia nueva; sale de dividir US-48. Aquí se envían los emails con sus plantillas exactas; elegir qué tipos llegan por email es US-48.

**Historia**
Como responsable de un centro, quiero recibir por email los avisos que tengo activados, para enterarme aunque no tenga Sportsplace abierto.
1. Me llega un pedido nuevo; recibo en `montjuic@ejemplo.es` un correo «Nuevo pedido de Club Bàsquet Gràcia».
2. Pulso el botón del correo; si tengo sesión, voy directo al pedido; si no, entro y luego llego al pedido.

**Pantallas para el boceto**
- Email (HTML sencillo + versión de texto): logo «Sportsplace», saludo, texto del aviso, botón «Ver en Sportsplace», pie con el motivo del correo y el enlace a ajustes.
- `/entrar?volver={ruta}`: tras entrar, redirige a `volver` si es una ruta interna que empieza por `/`.

**Criterios de aceptación**

*Envío*
- CA1. Tras el commit de `crearAviso`, si el tipo tiene el email activado para ese centro (US-48; mientras US-48 no exista, los valores por defecto de US-48 CA2), se envía un email a `centros.email`.
- CA2. El envío es asíncrono: la acción del usuario no espera ni falla si el email falla.
- CA3. Remitente: «Sportsplace <avisos@{dominio configurado en EMAIL_REMITENTE}>». Proveedor configurable por variables de entorno (`EMAIL_PROVEEDOR_API_KEY`, `EMAIL_REMITENTE`, `URL_PUBLICA_WEB`).
- CA4. Reintentos: si el proveedor falla, 2 reintentos a los 60 s y a los 5 min; después queda `fallido`.
- CA5. `mensaje_nuevo`: como máximo 1 email por conversación y destinatario cada 15 minutos; los que se saltan quedan `omitido`.
- CA6. No se envía email si el centro no tiene el email confirmado.

*Plantilla común* (cuerpo; `{texto}` = texto del aviso)
- CA7. Cuerpo:
  «Hola, {nombre del centro}:
  {texto}
  [Ver en Sportsplace] → {URL_PUBLICA_WEB}/entrar?volver={enlace}
  Recibes este correo porque tienes activados los emails de «{nombre del tipo}». Puedes cambiarlo en {URL_PUBLICA_WEB}/ajustes/avisos.
  — El equipo de Sportsplace»
- CA8. Asuntos exactos por tipo:
  - `mensaje_nuevo`: «Nuevo mensaje de {centro} sobre «{título}»»
  - `pedido_nuevo`: «Nuevo pedido de {comprador}»
  - `pedido_aceptado`: «{vendedor} ha aceptado tu pedido»
  - `pedido_rechazado`: «{vendedor} ha rechazado tu pedido»
  - `pedido_cancelado`: «Pedido cancelado: «{título}»»
  - `pedido_recibido`: «{comprador} ha recibido el material»
  - `cita_propuesta`: «Propuesta de fecha de entrega para «{título}»»
  - `cita_acordada`: «Entrega acordada: {dd/mm/aaaa} {hh:mm}»
  - `cita_anulada`: «Entrega anulada: «{título}»»
  - `incidencia_abierta`: «Incidencia en el pedido de «{título}»»
  - `incidencia_respondida`: «Respuesta a tu incidencia en «{título}»»
  - `incidencia_cerrada`: «Incidencia cerrada en «{título}»»
- CA9. Los textos insertados se escapan en HTML; el asunto se corta a 120 caracteres con «…».
- CA10. Al hacer login desde `/entrar?volver=/pedidos/123`, la web redirige a `/pedidos/123`. Un `volver` que no empieza por `/` o empieza por `//` se ignora y se va a `/catalogo` (evita redirecciones abiertas).

*Datos*
- CA11. Tabla `emails_avisos`: `id`, `aviso_id fk`, `destinatario`, `asunto`, `estado check in ('pendiente','enviado','fallido','omitido')`, `intentos int`, `ultimo_error text null`, `creado_en`, `enviado_en null`.

**Flujos e2e** (con un proveedor de email simulado que guarda los correos)
- E2E-1. B pide 4 unidades → el buzón simulado de `montjuic@ejemplo.es` recibe asunto «Nuevo pedido de Club Bàsquet Gràcia», cuerpo con «Hola, Polideportivo Montjuïc Sport:» y enlace `…/entrar?volver=/pedidos/{P1}`. BD: `emails_avisos.estado='enviado'`.
- E2E-2. B envía 3 mensajes en 2 minutos → A recibe 1 email; 2 filas `omitido`.
- E2E-3. Proveedor simulado falla siempre → la acción de pedir da 201; tras 3 intentos `fallido`.
- E2E-4. Sin sesión, abrir el enlace del email → `/entrar`; tras entrar → `/pedidos/{P1}`. Con `volver=//evil.com` → `/catalogo`.

**Tareas**
- T117-1 · Base de datos: tabla `emails_avisos`.
- T117-2 · Backend: cola simple en BD + proceso que envía y reintenta; plantillas en `avisos/plantillas-email`.
- T117-3 · Frontend: soporte de `volver` en `/entrar`.
- T117-4 · QA: e2e con proveedor simulado.

**Decisiones pendientes**
- Proveedor de email: Supabase Auth solo envía los correos de autenticación. Propuesta: Resend (plan gratuito, API HTTP) con dominio de pruebas.
- Límite de `mensaje_nuevo`: propuesta 1 email cada 15 min por conversación.

---

## (2) US-48 · Elijo qué avisos quiero recibir también por email

**Épica:** E09 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 6 · **Depende de:** US-117
**Cambios respecto al backlog original:** El envío de emails pasa a US-117 (nueva). Esta historia es solo la pantalla de preferencias y su efecto. Baja de 3 a 2 puntos. Los avisos dentro de la plataforma no se pueden desactivar.

**Historia**
Como responsable de un centro, quiero activar o desactivar el email de cada tipo de aviso, para no recibir correos que no me interesan.
1. En el menú del centro pulso «Ajustes» → `/ajustes`, y luego «Avisos» → `/ajustes/avisos`.
2. Veo los tipos agrupados con un interruptor «Email» cada uno.
3. Desactivo «Nuevo mensaje» y pulso «Guardar cambios»; sale «Preferencias guardadas.»
4. A partir de entonces, los mensajes nuevos solo me llegan a la campana.

**Pantallas para el boceto**
- `/ajustes/avisos`: título «Avisos por email», texto «Los avisos siempre aparecen en la campana. Elige cuáles quieres recibir también en {email del centro}.»
  - Grupo «Mensajes»: «Nuevo mensaje».
  - Grupo «Pedidos»: «Pedido nuevo», «Pedido aceptado», «Pedido rechazado», «Pedido cancelado», «Material recibido».
  - Grupo «Entrega»: «Propuesta de fecha», «Fecha acordada», «Fecha anulada».
  - Grupo «Incidencias»: «Incidencia comunicada», «Respuesta a una incidencia», «Incidencia cerrada».
  - Cada fila: nombre del tipo y un interruptor.
  - Abajo: «Desactivar todos», «Restablecer valores por defecto» (enlaces) y botón «Guardar cambios».

**Criterios de aceptación**
- CA1. Los nombres de tipo de la pantalla son los mismos que usa el pie del email (US-117 CA7).
- CA2. Valores por defecto: activado para `mensaje_nuevo`, `pedido_nuevo`, `pedido_aceptado`, `pedido_rechazado`, `pedido_cancelado`, `cita_propuesta`, `cita_acordada`, `cita_anulada`, `incidencia_abierta`, `incidencia_respondida`; desactivado para `pedido_recibido` e `incidencia_cerrada`.
- CA3. «Desactivar todos» pone todos los interruptores en apagado y «Restablecer valores por defecto» los pone como en CA2; ninguno guarda hasta pulsar «Guardar cambios».
- CA4. «Guardar cambios» se deshabilita si no hay cambios y muestra «Guardando…» mientras envía. Éxito: «Preferencias guardadas.»
- CA5. Si se intenta salir con cambios sin guardar: diálogo «¿Salir sin guardar?» / «Perderás los cambios.» / «Salir» y «Cancelar».
- CA6. Efecto: un tipo desactivado no genera email (fila `omitido` no se crea; simplemente no se encola) desde el primer aviso creado después de guardar. El aviso en la campana se crea igual.
- CA7. API `GET /api/ajustes/avisos` → `200 { preferencias: { mensaje_nuevo: true, …12 claves } }` (valores guardados o por defecto).
- CA8. API `PUT /api/ajustes/avisos` con `{ preferencias: { tipo: boolean, … } }`. Se aceptan objetos parciales. Clave desconocida o valor no booleano → `400 DATOS_INVALIDOS` con `details` por clave. Éxito → `200` con las 12 preferencias.
- CA9. Permisos: `requireAuth` y `requireEmailConfirmado`. Cada centro solo ve y cambia las suyas (no hay id en la ruta).
- CA10. Datos: tabla `preferencias_avisos (centro_id fk, tipo text, email boolean, actualizado_en, pk (centro_id, tipo))`. Solo se guardan las filas que el centro ha tocado; el resto usa CA2.
- CA11. Enlace «Avisos» en `/ajustes` y en el pie del panel de la campana («Ajustes de avisos»).

**Flujos e2e**
- E2E-1. A abre `/ajustes/avisos` sin haber guardado nunca → «Nuevo mensaje» activado y «Material recibido» desactivado. Desactiva «Nuevo mensaje» → «Guardar cambios» → «Preferencias guardadas.». B escribe a A → aviso en campana, ningún email.
- E2E-2. A activa «Material recibido» y guarda; B confirma recepción → A recibe email «Club Bàsquet Gràcia ha recibido el material».
- E2E-3. «Desactivar todos» → «Guardar cambios» → B pide → A no recibe email, sí aviso.
- E2E-4. `PUT` con `{ "preferencias": { "spam": true } }` → 400 `DATOS_INVALIDOS`; sin token → 401.
- E2E-5. Cambiar un interruptor y pulsar «Catálogo» → diálogo «¿Salir sin guardar?».

**Tareas**
- T48-1 · Base de datos: tabla `preferencias_avisos`.
- T48-2 · Backend: `GET`/`PUT /api/ajustes/avisos`; consultar preferencias antes de encolar en US-117.
- T48-3 · Frontend: página `/ajustes/avisos`, enlaces en `/ajustes` y en el panel.
- T48-4 · QA: automatizar e2e.

**Decisiones pendientes**
- ¿Resumen diario en lugar de emails sueltos? Propuesta: no en este backlog.
