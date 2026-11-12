# E06 Pedidos y pago

Historias de la épica, en orden de construcción: US-32 (pedir), US-108 (detalle del pedido, nueva), US-109 (bandeja de pedidos, nueva), US-33 (aceptar), US-79 (rechazar), US-35 (método de pago), US-34 (reserva de unidades), US-80 (marcar como cobrado), US-39 (cancelar), US-38 (historial con filtros).

Fuera de alcance (hoja Descartadas): US-29 (absorbida por US-32: el mismo pedido sirve para donación), US-36 (pago online) y US-37 (justificantes). La plataforma **no mueve dinero**: solo registra lo acordado.

## Base común de la épica (todas las historias la usan)

### Centros y datos de ejemplo de los e2e
| Papel | Centro | Email | Localidad |
|---|---|---|---|
| Vendedor | «Club Esportiu Les Corts» | `lescorts@example.com` | Barcelona |
| Comprador | «Escola de Bàsquet Gràcia» | `gracia@example.com` | Barcelona |
| Tercero (sin relación) | «CN Sabadell Demo» | `sabadell@example.com` | Sabadell |

Anuncios de ejemplo (de Les Corts, creados con E03):
- **A1** «Balones de baloncesto talla 7», venta, 8,50 € por unidad (`850` céntimos), `unidades_disponibles` = 12, estado `activo`.
- **A2** «Petos de entrenamiento reversibles», donación, `unidades_disponibles` = 30, estado `activo`.

### Tabla `pedidos` (la crea US-32; cada historia añade sus columnas con una migración propia)
| Columna | Tipo y regla | Historia |
|---|---|---|
| `id` | uuid, PK. | US-32 |
| `anuncio_id` | FK a `anuncios`, no nulo. | US-32 |
| `comprador_centro_id` | FK a `centros`, no nulo. | US-32 |
| `vendedor_centro_id` | FK a `centros`, no nulo, copiado de `anuncios.centro_id`. Check: distinto de `comprador_centro_id`. | US-32 |
| `titulo_anuncio` | Copia del título al pedir (el anuncio puede editarse después). | US-32 |
| `unidades` | Entero, check `unidades >= 1`. | US-32 |
| `modalidad` | `venta` o `donacion`, copiada del anuncio. | US-32 |
| `precio_unitario_centimos` | Entero copiado del anuncio; nulo si donación. | US-32 |
| `total_centimos` | `unidades × precio_unitario_centimos`; `0` si donación. | US-32 |
| `mensaje` | Texto 0-500, nulo si vacío. | US-32 |
| `estado` | Enum `pendiente`, `aceptado`, `rechazado`, `cancelado`, `recibido`. Por defecto `pendiente`. | US-32 (valores) |
| `creado_en`, `actualizado_en` | timestamptz. | US-32 |
| `respondido_en` | timestamptz; al aceptar o rechazar. | US-33/US-79 |
| `motivo_codigo`, `motivo_texto` | Motivo de rechazo o cancelación. | US-79/US-39 |
| `cerrado_por` | `vendedor`, `comprador` o `sistema`; quién rechazó/canceló. | US-79/US-39 |
| `cancelado_en` | timestamptz. | US-39 |
| `metodo_pago` | `transferencia` o `efectivo_recogida`; obligatorio si venta, nulo si donación (check). | US-35 |
| `pagado_en` | timestamptz, nulo = no pagado. | US-80 |
| `metodo_entrega` | `recogida` o `envio`. | [Depende de US-40] |
| Recepción, hora de recogida, incidencia | Columnas propias. | [Lo amplían US-41/81, US-42, US-43/82] |

Índice único parcial: `(anuncio_id, comprador_centro_id) WHERE estado = 'pendiente'` (un solo pedido pendiente por anuncio y comprador).

### Máquina de estados del pedido
| Transición | Quién | Historia | Endpoint |
|---|---|---|---|
| (nuevo) → `pendiente` | Comprador | US-32 | `POST /api/pedidos` |
| `pendiente` → `aceptado` | Vendedor | US-33 (+ reserva US-34) | `POST /api/pedidos/:id/aceptar` |
| `pendiente` → `rechazado` | Vendedor; o sistema (US-34) | US-79 | `POST /api/pedidos/:id/rechazar` |
| `pendiente` → `cancelado` | Comprador o vendedor | US-39 | `POST /api/pedidos/:id/cancelar` |
| `aceptado` → `cancelado` | Comprador o vendedor, si no está pagado ni tiene incidencia abierta | US-39 | ídem |
| `aceptado` → `recibido` | Comprador | [US-42] | — |
| Incidencia (subestado) en `aceptado`/`recibido` | Comprador abre, vendedor responde | [US-43/US-82] | — |
| Marca `pagado_en` en venta `aceptado` o `recibido` | Vendedor | US-80 | `POST /api/pedidos/:id/marcar-pagado` |

Estados finales: `rechazado`, `cancelado`. `recibido` es final para el estado (solo admite incidencia y valoración, E08).

Reglas comunes de la API para toda transición:
- Sin token → `401 NO_AUTENTICADO`; email sin confirmar → `403 EMAIL_NO_CONFIRMADO`.
- Pedido inexistente o en el que el centro no es ni comprador ni vendedor → `404 NO_ENCONTRADO`.
- El centro es parte del pedido pero no tiene ese papel en la transición (p. ej. el comprador intenta aceptar) → `403 SIN_PERMISO`, «No puedes realizar esta acción en este pedido.»
- El pedido no está en el estado de origen permitido → `409 TRANSICION_NO_PERMITIDA`, «El pedido ya no está en un estado que permita esta acción.», `details: { estado_actual }`.
- La transición se hace con `UPDATE ... WHERE id = $1 AND estado = <origen>`; si afecta 0 filas se responde `409 TRANSICION_NO_PERMITIDA` (protege de dos clics o de dos usuarios a la vez).
- Respuesta correcta: `200 { "pedido": pedido }`.

### Objeto `pedido` en la API
```json
{
  "id": "uuid",
  "anuncio": { "id": "uuid", "titulo": "Balones de baloncesto talla 7", "foto_principal_url": "https://...", "estado": "activo" },
  "comprador": { "id": "uuid", "nombre": "Escola de Bàsquet Gràcia", "localidad": "Barcelona" },
  "vendedor": { "id": "uuid", "nombre": "Club Esportiu Les Corts", "localidad": "Barcelona" },
  "mi_papel": "comprador",
  "unidades": 4,
  "modalidad": "venta",
  "precio_unitario_centimos": 850,
  "total_centimos": 3400,
  "metodo_pago": "transferencia",
  "mensaje": "Los necesitamos para el torneo de junio.",
  "estado": "pendiente",
  "motivo_codigo": null, "motivo_texto": null, "cerrado_por": null,
  "pagado_en": null,
  "creado_en": "2026-10-21T08:30:00Z", "respondido_en": null, "cancelado_en": null,
  "acciones": ["cancelar"]
}
```
`acciones` lista lo que el centro que consulta puede hacer ahora (`aceptar`, `rechazar`, `cancelar`, `marcar_pagado`); la web muestra los botones según esta lista y nunca calcula permisos por su cuenta. Datos de contacto del otro centro (email y teléfono): solo cuando el pedido está `aceptado` o `recibido` (US-108).

### Etiquetas de estado en la web
| Estado | Texto | Color |
|---|---|---|
| `pendiente` | «Pendiente» | Amarillo |
| `aceptado` | «Aceptado» | Verde |
| `rechazado` | «Rechazado» | Rojo |
| `cancelado` | «Cancelado» | Gris |
| `recibido` | «Recibido» | Azul |
| Marca de pago | «Pagado» (etiqueta extra junto al estado) | Verde oscuro |

### Listas fijas de motivos
**Rechazo (US-79, vendedor):**
| `motivo_codigo` | Texto |
|---|---|
| `sin_unidades` | «Ya no tengo unidades suficientes» |
| `comprometido_otro_centro` | «El material está comprometido con otro centro» |
| `entrega_inviable` | «No puedo hacer la entrega que se pide» |
| `condiciones_pago` | «No acepto las condiciones de pago» |
| `otro` | «Otro motivo» |
| `anuncio_sin_stock` | «Se han agotado las unidades del anuncio» (solo sistema, US-34; no aparece en el desplegable) |

**Cancelación (US-39, cualquiera de los dos):**
| `motivo_codigo` | Texto | Quién lo ve en el desplegable |
|---|---|---|
| `ya_no_necesario` | «Ya no necesitamos el material» | Comprador |
| `otra_opcion` | «Hemos encontrado otra opción» | Comprador |
| `material_no_disponible` | «El material ya no está disponible» | Vendedor |
| `sin_acuerdo_entrega` | «No hemos podido acordar la entrega» | Ambos |
| `sin_respuesta` | «La otra parte no responde» | Ambos |
| `error_pedido` | «El pedido tenía un error» | Ambos |
| `otro` | «Otro motivo» | Ambos |

**Texto del motivo (`motivo_texto`):** se eliminan espacios al principio y al final; si el motivo es `otro` es obligatorio con 10-300 caracteres; con cualquier otro motivo es opcional con 0-300. Mensajes: «Explica el motivo (entre 10 y 300 caracteres).» y «El texto no puede superar 300 caracteres.»

---

## (3) US-32 · Pedir unidades de un anuncio para comprarlas o recibirlas en donación

**Épica:** E06 · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** 3 · **Depende de:** US-24 (detalle del anuncio), US-12
**Cambios respecto al backlog original:** era de 5 puntos. Se queda con el formulario y la creación del pedido. Ver el pedido pendiente pasa a la nueva US-108 y la lista de pedidos a la nueva US-109. Absorbe US-29 (pedir en donación con mensaje). El método de pago lo añade US-35 y el de entrega US-40 sobre este mismo formulario.

**Historia**
Como responsable de un centro deportivo que necesita material, quiero pedir un número de unidades de un anuncio de otro centro, sea en venta o en donación, para conseguir el material que necesito.
1. En `/anuncios/:id` (detalle de un anuncio de otro centro, US-24) pulso «Pedir».
2. Llego a `/anuncios/:id/pedir`, veo el resumen del anuncio, indico cuántas unidades quiero y, si quiero, un mensaje para el vendedor.
3. Veo el importe total calculado (o «Donación: sin coste») y pulso «Enviar pedido».
4. Llego al detalle de mi pedido `/pedidos/:id` (US-108) con el aviso verde «Pedido enviado. El vendedor lo revisará.» y el estado «Pendiente».

**Pantallas para el boceto**
- `/anuncios/:id` (US-24): bajo el precio y las unidades disponibles, botón principal «Pedir» junto a «Escribir al centro» (E05). Si ya tengo un pedido pendiente en este anuncio, en lugar del botón: texto «Ya tienes un pedido pendiente en este anuncio.» y enlace «Ver mi pedido» → `/pedidos/:id`.
- `/anuncios/:id/pedir`: «Hacer un pedido». En orden: (1) tarjeta resumen: foto principal, título, centro vendedor y localidad, modalidad («Venta · 8,50 € por unidad» o «Donación»), «Disponibles: 12»; (2) campo «Unidades» (número, con botones − y +, valor inicial 1); (3) [US-35: «Forma de pago»]; (4) [US-40: «Entrega»]; (5) campo «Mensaje para el vendedor (opcional)» (área de texto, contador «0/500»); (6) bloque «Total: 34,00 €» o «Donación: sin coste»; (7) texto «El pago y la entrega se acuerdan entre los dos centros. Sportsplace no cobra ni gestiona el dinero.» (solo venta); (8) botones «Enviar pedido» (principal) y «Cancelar».

**Criterios de aceptación**

*Navegación*
- CA1. En `/anuncios/:id` el botón «Pedir» se ve solo si el anuncio es de otro centro, está `activo` y el centro no tiene un pedido `pendiente` en él.
- CA2. Si el anuncio es propio, no se ve «Pedir» (en su lugar están las acciones de E03). Si el anuncio está `reservado`, se ve deshabilitado con el texto «No disponible».
- CA3. Con pedido pendiente propio, se ve «Ya tienes un pedido pendiente en este anuncio.» y «Ver mi pedido» lleva a `/pedidos/:id` de ese pedido.
- CA4. «Pedir» lleva a `/anuncios/:id/pedir`. Sin sesión, la ruta redirige a `/entrar` y, tras entrar, vuelve a `/anuncios/:id/pedir`.
- CA5. Al abrir `/anuncios/:id/pedir` de un anuncio propio, no activo o inexistente, la web muestra «Este anuncio no está disponible para pedidos.» con el enlace «Volver al catálogo» → `/catalogo`.
- CA6. «Cancelar» vuelve a `/anuncios/:id` sin enviar nada; si se ha cambiado algún campo, primero pregunta con el diálogo «¿Salir sin enviar el pedido?» / «Se perderán los datos.» / «Salir» / «Seguir aquí».

*Campos y validación*
- CA7. «Unidades»: obligatorio, entero, mínimo 1, máximo `unidades_disponibles` del anuncio. Con A1 (12): 1 y 12 se aceptan; 0, 13, 2,5 y vacío se rechazan con «Indica entre 1 y 12 unidades.» (el número es el disponible). El botón − se deshabilita en 1 y el + en el máximo.
- CA8. «Mensaje para el vendedor»: opcional, 0-500 caracteres tras quitar espacios. 500 se acepta; 501 muestra «El mensaje no puede superar 500 caracteres.» El contador se actualiza al escribir.
- CA9. El total se recalcula al cambiar unidades: venta = unidades × precio, en formato «34,00 €» (4 × 8,50 €); donación = «Donación: sin coste».
- CA10. «Enviar pedido» siempre está habilitado; al pulsar valida en la web y si hay errores no envía. Mientras envía muestra «Enviando…» y está deshabilitado.

*Comportamiento*
- CA11. Al crearse, el pedido queda `pendiente`, con `modalidad`, `precio_unitario_centimos` y `titulo_anuncio` copiados del anuncio en ese momento y `total_centimos` calculado en el servidor (el cliente no envía precio ni total).
- CA12. Crear un pedido **no** cambia `unidades_disponibles` ni el estado del anuncio (la reserva se hace al aceptar, US-34).
- CA13. Pueden existir a la vez varios pedidos pendientes de centros distintos sobre el mismo anuncio, aunque juntos superen las unidades disponibles.
- CA14. Tras crear, la web navega a `/pedidos/:id` y muestra el aviso verde «Pedido enviado. El vendedor lo revisará.»
- CA15. Si el precio o las unidades del anuncio han cambiado mientras el formulario estaba abierto, se aplica lo que hay en la base de datos al enviar (precio) y se valida contra las unidades actuales (CA19).

*API*
- CA16. `POST /api/pedidos` con `{ "anuncio_id": "uuid", "unidades": 4, "mensaje": "texto o vacío" }` (+ `metodo_pago` de US-35, `metodo_entrega` de US-40). Requiere `requireAuth` y `requireEmailConfirmado`. Respuesta `201 { "pedido": pedido }`.
- CA17. `400 DATOS_INVALIDOS` con `details` por campo: `anuncio_id` ausente o no uuid («Anuncio no válido.»), `unidades` no entero o < 1 («Indica al menos 1 unidad.»), `mensaje` > 500.
- CA18. Anuncio inexistente o `retirado` → `404 NO_ENCONTRADO`.
- CA19. `unidades` > `unidades_disponibles` actuales → `409 UNIDADES_INSUFICIENTES`, «Solo quedan N unidades disponibles.», `details: { unidades_disponibles: N }`. La web muestra el texto bajo «Unidades» y actualiza el máximo a N.
- CA20. Anuncio `pausado`, `reservado` o `entregado` → `409 ANUNCIO_NO_DISPONIBLE`, «Este anuncio ya no está disponible.» La web muestra el aviso rojo y vuelve a `/anuncios/:id`.
- CA21. Anuncio propio → `403 PEDIDO_PROPIO`, «No puedes pedir tu propio anuncio.»
- CA22. Ya existe un pedido `pendiente` del mismo centro en ese anuncio → `409 PEDIDO_YA_PENDIENTE`, «Ya tienes un pedido pendiente en este anuncio.», `details: { pedido_id }`. La web navega a ese pedido.
- CA23. `GET /api/anuncios/:id` (US-24) añade `mi_pedido_pendiente_id` (uuid o null) para pintar CA1-CA3.

*Datos*
- CA24. Migración que crea la tabla `pedidos` con las columnas marcadas US-32 en la base común, sus checks y el índice único parcial. Una violación del índice se traduce a `409 PEDIDO_YA_PENDIENTE`, nunca a 500.
- CA25. El mensaje vacío se guarda como `null`.

*Permisos y seguridad*
- CA26. `comprador_centro_id` sale del token, nunca del cuerpo; si el cuerpo trae `comprador_centro_id`, `estado`, `precio_unitario_centimos` o `total_centimos` se ignoran.

*Casos límite*
- CA27. Doble clic en «Enviar pedido»: solo se crea un pedido (botón deshabilitado + índice único).
- CA28. Un pedido rechazado o cancelado no impide hacer uno nuevo en el mismo anuncio.

**Flujos e2e**
- E2E-1 (venta, camino feliz). Gràcia abre A1 → «Pedir» → Unidades 4, mensaje «Los necesitamos para el torneo de junio.» → ve «Total: 34,00 €» → «Enviar pedido» → llega a `/pedidos/:id`, aviso verde, estado «Pendiente». BD: fila `pedidos` con `unidades=4`, `precio_unitario_centimos=850`, `total_centimos=3400`, `estado='pendiente'`; A1 sigue con 12 disponibles y `activo`.
- E2E-2 (donación). Gràcia pide 10 de A2 con mensaje vacío → ve «Donación: sin coste» → pedido `donacion`, `precio_unitario_centimos=null`, `total_centimos=0`, `mensaje=null`.
- E2E-3 (validación). Unidades 13 en A1 → «Indica entre 1 y 12 unidades.», no hay petición. Mensaje de 501 caracteres → error de CA8.
- E2E-4 (unidades cambiadas). Con el formulario abierto, Les Corts edita A1 a 3 unidades; Gràcia envía 4 → `409 UNIDADES_INSUFICIENTES`, «Solo quedan 3 unidades disponibles.», máximo pasa a 3.
- E2E-5 (duplicado y propio). Gràcia vuelve a A1: ve «Ya tienes un pedido pendiente…» y «Ver mi pedido». Les Corts abre A1: no ve «Pedir»; `POST` directo con su token → `403 PEDIDO_PROPIO`.

**Tareas**
- T32-1 · Base de datos: migración de `pedidos` (columnas US-32, checks, índice único parcial, FKs).
- T32-2 · Backend: `POST /api/pedidos` con validación, copia de datos del anuncio y errores CA17-CA22; `mi_pedido_pendiente_id` en `GET /api/anuncios/:id`.
- T32-3 · Frontend: botón «Pedir» y estados en `/anuncios/:id`.
- T32-4 · Frontend: pantalla `/anuncios/:id/pedir` con validación, total y diálogo de salida.
- T32-5 · QA: automatizar E2E-1…5 y los CA.

**Decisiones pendientes**
- ¿Reservar al pedir o al aceptar? Propuesta: al aceptar (guía común, US-34); pedir no bloquea unidades.
- ¿Más de un pedido pendiente del mismo centro en un anuncio? Propuesta: no (índice único); para cambiar unidades, cancelar y volver a pedir.

---

## (2) US-108 · Ver el detalle y el estado de un pedido

**Épica:** E06 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-32
**Cambios respecto al backlog original:** historia nueva, sale de dividir US-32 («Veo mi pedido como pendiente»). La pantalla `/pedidos/:id` es la base donde US-33, US-79, US-80, US-39 y E07 añaden sus botones.

**Historia**
Como responsable de un centro que participa en un pedido (como comprador o como vendedor), quiero ver toda la información del pedido y su estado, para saber en qué punto está y qué me toca hacer.
1. Llego a `/pedidos/:id` tras enviar el pedido, desde la bandeja `/pedidos` (US-109) o desde un aviso (E09).
2. Veo el estado, el anuncio, las unidades, el importe, el otro centro y el historial de fechas.
3. Veo los botones de las acciones que puedo hacer en ese momento.

**Pantallas para el boceto**
- `/pedidos/:id`: «Pedido de <titulo_anuncio>». En orden: (1) enlace «← Volver a pedidos» → `/pedidos` (pestaña según mi papel); (2) etiqueta de estado y, si aplica, «Pagado»; (3) frase de situación (CA5); (4) tarjeta del anuncio: foto, título (enlace a `/anuncios/:id` si sigue visible), modalidad; (5) «Datos del pedido»: Unidades, Precio por unidad, Total (o «Donación: sin coste»), Forma de pago [US-35], Entrega [US-40], Mensaje del comprador (o «Sin mensaje»); (6) «Comprador» o «Vendedor» (el otro centro): nombre y localidad; email y teléfono solo si aceptado/recibido; (7) «Motivo» si rechazado o cancelado; (8) «Historial»: «Pedido el dd/mm/aaaa hh:mm», «Aceptado el…», «Rechazado el…», «Cancelado el… por <comprador|vendedor>», «Marcado como pagado el…»; (9) barra de acciones (botones de US-33, US-79, US-80, US-39, E07 según `acciones`).

**Criterios de aceptación**

*Navegación*
- CA1. `/pedidos/:id` es privada; sin sesión redirige a `/entrar` y vuelve tras entrar.
- CA2. «← Volver a pedidos» lleva a `/pedidos?pestana=realizados` si soy comprador y a `/pedidos?pestana=recibidos` si soy vendedor.
- CA3. Si el pedido no existe o no soy parte, se muestra «Este pedido no existe o no tienes acceso.» con el enlace «Ir a pedidos».

*Comportamiento*
- CA4. La pantalla muestra «Cargando…» mientras carga y «No se ha podido cargar. » + «Reintentar» si falla.
- CA5. Frase de situación según estado y papel: pendiente/comprador «Esperando la respuesta de <vendedor>.»; pendiente/vendedor «<comprador> te ha pedido este material. Acepta o rechaza el pedido.»; aceptado «Pedido aceptado. Acordad la entrega y el pago.»; rechazado «<vendedor> ha rechazado el pedido.»; cancelado «Pedido cancelado por <centro>.»; recibido «Material recibido. Pedido cerrado.»
- CA6. Importes con formato «1.234,50 €»; fechas «dd/mm/aaaa hh:mm» hora de Madrid.
- CA7. El email y el teléfono del otro centro se muestran solo en `aceptado` y `recibido`; en otro estado la sección muestra solo nombre y localidad.
- CA8. Si el anuncio está `retirado`, el título se muestra sin enlace con «(anuncio retirado)».
- CA9. Los botones se pintan solo a partir de `pedido.acciones`; con `acciones` vacía no hay barra.

*API*
- CA10. `GET /api/pedidos/:id` → `200 { "pedido": pedido }` con el objeto de la base común; `mi_papel` es `comprador` o `vendedor`.
- CA11. `id` no uuid, pedido inexistente o de otros centros → `404 NO_ENCONTRADO`. Sin token `401 NO_AUTENTICADO`; email sin confirmar `403 EMAIL_NO_CONFIRMADO`.
- CA12. `comprador.email`/`telefono` y `vendedor.email`/`telefono` solo vienen en la respuesta en `aceptado` y `recibido`; en otros estados no aparecen esas claves.
- CA13. `acciones` se calcula en el servidor con la misma función que valida las transiciones.

*Permisos*
- CA14. «CN Sabadell Demo» pide `GET /api/pedidos/:id` de un pedido entre Gràcia y Les Corts → `404 NO_ENCONTRADO`.

**Flujos e2e**
- E2E-1. Tras E2E-1 de US-32, Gràcia ve «Pendiente», «Esperando la respuesta de Club Esportiu Les Corts.», Total «34,00 €», sin email del vendedor, botón «Cancelar pedido» [US-39].
- E2E-2. Les Corts abre el mismo pedido: «Escola de Bàsquet Gràcia te ha pedido este material…», botones «Aceptar» y «Rechazar» [US-33/US-79].
- E2E-3. Sabadell abre la URL: «Este pedido no existe o no tienes acceso.»; API `404`.
- E2E-4. Sin sesión, abrir `/pedidos/:id` → `/entrar` → tras login vuelve al pedido.

**Tareas**
- T108-1 · Backend: `GET /api/pedidos/:id`, serializador `pedido` y función `accionesPermitidas(pedido, centro)`.
- T108-2 · Frontend: pantalla `/pedidos/:id` con secciones, frases y estados de carga.
- T108-3 · QA: automatizar E2E-1…4 y los CA.

---

## (2) US-109 · Ver los pedidos que recibo y los que hago

**Épica:** E06 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-108
**Cambios respecto al backlog original:** historia nueva. US-33 dice «puedo ver los pedidos que me llegan», pero la lista no tenía historia en el sprint 3 (US-38 es del sprint 4). Esta crea la bandeja básica; US-38 le añade filtros y el historial completo.

**Historia**
Como responsable de un centro, quiero una pantalla con los pedidos que me hacen y los que hago, para atender los que esperan respuesta y seguir los míos.
1. En la cabecera pulso «Pedidos».
2. Llego a `/pedidos`, pestaña «Recibidos», y veo los pedidos de mis anuncios, primero los pendientes.
3. Cambio a la pestaña «Realizados» y veo los que he hecho.
4. Pulso una fila y llego a `/pedidos/:id`.

**Pantallas para el boceto**
- Cabecera: enlace «Pedidos» con un contador (círculo) de pedidos recibidos pendientes si es > 0.
- `/pedidos`: título «Pedidos». Pestañas «Recibidos (n pendientes)» y «Realizados». Tabla (en móvil, tarjetas) con columnas: foto miniatura, Anuncio (título), Centro (comprador en Recibidos, vendedor en Realizados), Unidades, Total («34,00 €» o «Donación»), Estado (etiqueta), Fecha («dd/mm/aaaa»). Paginación «Anterior» / «Siguiente».

**Criterios de aceptación**
- CA1. «Pedidos» de la cabecera lleva a `/pedidos?pestana=recibidos`. `/pedidos` sin parámetro abre «Recibidos»; `pestana` con otro valor también.
- CA2. Cambiar de pestaña actualiza la URL (`?pestana=realizados`) sin recargar.
- CA3. «Recibidos» lista los pedidos con `vendedor_centro_id` = mi centro; «Realizados» los de `comprador_centro_id` = mi centro.
- CA4. Orden: primero `pendiente` y después el resto; dentro de cada grupo, `creado_en` descendente.
- CA5. Se paginan de 20 en 20; «Anterior» deshabilitado en la página 1 y «Siguiente» en la última.
- CA6. Toda la fila es clicable y lleva a `/pedidos/:id`.
- CA7. Vacíos: Recibidos «Todavía no has recibido pedidos. Cuando otro centro pida tu material, aparecerá aquí.»; Realizados «Todavía no has hecho pedidos.» con el enlace «Ir al catálogo».
- CA8. Carga y error según la convención de listas («Cargando…», «No se ha podido cargar. » + «Reintentar»).
- CA9. El contador de la cabecera y de la pestaña cuenta los pedidos recibidos en `pendiente`; se refresca al cargar cualquier pantalla privada; con 0 no se muestra; con más de 99 muestra «99+».
- CA10. `GET /api/pedidos?rol=recibidos|realizados&pagina=1` → `200 { "pedidos": [pedido_resumen], "pagina": 1, "total": n, "por_pagina": 20 }`. `pedido_resumen` = `id, anuncio{id,titulo,foto_principal_url}, otro_centro{id,nombre}, unidades, modalidad, total_centimos, estado, pagado_en, creado_en`.
- CA11. `rol` ausente o inválido → `400 DATOS_INVALIDOS` `details.rol` «Indica recibidos o realizados.»; `pagina` < 1 o no entera → `400 DATOS_INVALIDOS`; página mayor que la última → `200` con lista vacía.
- CA12. `GET /api/pedidos/contador` → `200 { "recibidos_pendientes": n }`.
- CA13. Las consultas filtran siempre por el centro del token; nunca aparecen pedidos de terceros.
- CA14. Sin token `401`; email sin confirmar `403 EMAIL_NO_CONFIRMADO`.

**Flujos e2e**
- E2E-1. Con el pedido de 4 balones pendiente, Les Corts ve «Pedidos ①» en la cabecera, entra, pestaña «Recibidos (1 pendientes)»: fila «Balones de baloncesto talla 7 · Escola de Bàsquet Gràcia · 4 · 34,00 € · Pendiente».
- E2E-2. Gràcia entra en «Realizados»: ve el pedido de A1 y el de A2 («Donación»), pendientes primero.
- E2E-3. Sabadell: ambas pestañas con los textos vacíos de CA7.
- E2E-4. Con 21 pedidos recibidos sembrados: página 1 con 20, «Siguiente» muestra 1.

**Tareas**
- T109-1 · Backend: `GET /api/pedidos` y `GET /api/pedidos/contador`, índices por `(vendedor_centro_id, estado, creado_en)` y `(comprador_centro_id, estado, creado_en)`.
- T109-2 · Frontend: enlace «Pedidos» con contador en la cabecera y pantalla `/pedidos` con pestañas y paginación.
- T109-3 · QA: automatizar E2E-1…4 y los CA.

**Decisiones pendientes**
- Pluralización «(1 pendientes)». Propuesta: «(1 pendiente)» / «(n pendientes)».

---

## (2) US-33 · Aceptar un pedido que recibo

**Épica:** E06 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-108, US-109
**Cambios respecto al backlog original:** rechazar pasa a US-79 (ya estaba). «Ver los pedidos que me llegan» lo cubre US-109. Restar unidades al aceptar lo hace US-34 (sprint 4): hasta entonces aceptar solo cambia el estado.

**Historia**
Como responsable de un centro que ha publicado material, quiero aceptar un pedido que me llega, para decidir a qué centro le entrego el material.
1. En `/pedidos` (pestaña «Recibidos») pulso un pedido pendiente.
2. En `/pedidos/:id` pulso «Aceptar».
3. Confirmo en el diálogo.
4. El pedido pasa a «Aceptado», veo los datos de contacto del comprador y el aviso «Pedido aceptado.»

**Pantallas para el boceto**
- `/pedidos/:id` (vendedor, pendiente): barra de acciones con «Aceptar» (principal, verde) y «Rechazar» (US-79).
- Diálogo: título «¿Aceptar el pedido?», texto «Te comprometes a entregar <n> unidades de «<título>» a <comprador>. Después tendréis que acordar la entrega y el pago.», botones «Aceptar pedido» y «Cancelar».

**Criterios de aceptación**
- CA1. «Aceptar» se ve solo si `acciones` incluye `aceptar` (soy el vendedor y el pedido está `pendiente`).
- CA2. «Aceptar» abre el diálogo con los textos exactos; «Cancelar» lo cierra sin cambios.
- CA3. «Aceptar pedido» se deshabilita y muestra «Aceptando…» mientras envía.
- CA4. Al ir bien: estado «Aceptado», aviso verde «Pedido aceptado.», aparecen email y teléfono del comprador, el historial añade «Aceptado el dd/mm/aaaa hh:mm» y desaparecen «Aceptar» y «Rechazar».
- CA5. El comprador, al abrir el pedido, ve «Aceptado», la frase «Pedido aceptado. Acordad la entrega y el pago.» y el email y teléfono del vendedor. [El aviso a la campana y por email depende de E09.]
- CA6. `POST /api/pedidos/:id/aceptar` sin cuerpo → `200 { pedido }` con `estado='aceptado'` y `respondido_en` = ahora.
- CA7. Errores: `401 NO_AUTENTICADO`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (no existe o soy tercero), `403 SIN_PERMISO` (soy el comprador), `409 TRANSICION_NO_PERMITIDA` (no está `pendiente`).
- CA8. Anuncio `retirado` o `entregado` → `409 ANUNCIO_NO_DISPONIBLE`, «Este anuncio ya no está disponible.»; anuncio `pausado` se puede aceptar (el vendedor decide).
- CA9. Ante `409`, la web muestra el `message` en rojo y recarga el pedido para enseñar su estado real.
- CA10. Dos aceptaciones simultáneas del mismo pedido (dos pestañas): una responde `200` y la otra `409 TRANSICION_NO_PERMITIDA`; `respondido_en` se escribe una sola vez.
- CA11. Si el comprador cancela (US-39) mientras el vendedor tiene el diálogo abierto, aceptar responde `409 TRANSICION_NO_PERMITIDA` y la pantalla muestra «Cancelado».
- CA12. El contador de pendientes de US-109 baja en 1.
- CA13. Migración: columna `respondido_en`.

**Flujos e2e**
- E2E-1. Les Corts abre el pedido de 4 balones → «Aceptar» → «Aceptar pedido» → «Aceptado», aviso verde, ve `gracia@example.com`. BD: `estado='aceptado'`, `respondido_en` no nulo. Gràcia ve «Aceptado» y el email de Les Corts.
- E2E-2. Gràcia hace `POST /aceptar` sobre su propio pedido → `403 SIN_PERMISO`; no ve el botón.
- E2E-3. Les Corts repite `POST /aceptar` sobre el pedido ya aceptado → `409 TRANSICION_NO_PERMITIDA`, `details.estado_actual='aceptado'`.
- E2E-4. Sabadell → `404 NO_ENCONTRADO`.

**Tareas**
- T33-1 · Base de datos: migración `respondido_en`.
- T33-2 · Backend: `POST /api/pedidos/:id/aceptar` con UPDATE condicional y errores.
- T33-3 · Frontend: botón, diálogo y refresco en `/pedidos/:id`.
- T33-4 · QA: automatizar E2E-1…4 y los CA.

---

## (2) US-79 · Rechazar un pedido que recibo indicando el motivo

**Épica:** E06 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-108
**Cambios respecto al backlog original:** se concreta el motivo como lista fija + texto libre (ver base común).

**Historia**
Como responsable de un centro que ha publicado material, quiero rechazar un pedido indicando el motivo, para que el comprador sepa por qué y pueda buscar otra opción.
1. En `/pedidos/:id` de un pedido pendiente que he recibido pulso «Rechazar».
2. En el diálogo elijo el motivo y, si quiero (o si elijo «Otro motivo»), escribo una explicación.
3. Pulso «Rechazar pedido»: el pedido pasa a «Rechazado» y veo el aviso «Pedido rechazado.»

**Pantallas para el boceto**
- Diálogo «Rechazar el pedido»: texto «<comprador> verá el motivo.»; desplegable «Motivo» (opciones de rechazo de la base común, sin `anuncio_sin_stock`, primera opción vacía «Elige un motivo»); área «Explicación» (opcional u obligatoria según motivo, contador «0/300»); botones «Rechazar pedido» (rojo) y «Cancelar».

**Criterios de aceptación**
- CA1. «Rechazar» se ve solo si `acciones` incluye `rechazar` (vendedor y `pendiente`).
- CA2. «Motivo» es obligatorio: sin elegir, «Elige un motivo.»
- CA3. «Explicación»: con «Otro motivo», obligatoria de 10-300 caracteres (9 se rechaza, 10 y 300 se aceptan, 301 se rechaza); con otro motivo, opcional 0-300. Mensajes de la base común. Al elegir «Otro motivo» la etiqueta cambia a «Explicación (obligatoria)».
- CA4. Mientras envía, «Rechazando…». Al ir bien: estado «Rechazado», aviso verde «Pedido rechazado.», sección «Motivo» con el texto del motivo y la explicación, historial «Rechazado el …».
- CA5. El comprador ve «Rechazado», la frase «<vendedor> ha rechazado el pedido.», el motivo y la explicación, y el enlace «Buscar material parecido» → `/catalogo`.
- CA6. Rechazar no cambia `unidades_disponibles` ni el estado del anuncio.
- CA7. `POST /api/pedidos/:id/rechazar` `{ "motivo_codigo": "entrega_inviable", "motivo_texto": "Solo entregamos en Barcelona." }` → `200 { pedido }` con `estado='rechazado'`, `cerrado_por='vendedor'`, `respondido_en`.
- CA8. `400 DATOS_INVALIDOS`: `motivo_codigo` ausente o fuera de la lista (incluido `anuncio_sin_stock`) → `details.motivo_codigo` «Elige un motivo.»; texto fuera de límites → `details.motivo_texto` con el mensaje de la base común.
- CA9. Resto de errores igual que US-33 CA7 (`401`, `403 EMAIL_NO_CONFIRMADO`, `404`, `403 SIN_PERMISO`, `409 TRANSICION_NO_PERMITIDA`).
- CA10. Migración: `motivo_codigo` (enum que incluye los de rechazo y cancelación), `motivo_texto` (≤ 300), `cerrado_por`. Check: `motivo_codigo` no nulo si estado `rechazado` o `cancelado`.
- CA11. El texto se muestra como texto plano (sin HTML).
- CA12. Tras un rechazo, el comprador puede volver a pedir el mismo anuncio (US-32 CA28).

**Flujos e2e**
- E2E-1. Gràcia pide 10 petos de A2. Les Corts → «Rechazar» → «No puedo hacer la entrega que se pide», explicación «Solo entregamos en Barcelona.» → «Rechazado». BD: `motivo_codigo='entrega_inviable'`, `cerrado_por='vendedor'`. Gràcia ve motivo y explicación.
- E2E-2. «Otro motivo» con «No sé» (5) → «Explica el motivo (entre 10 y 300 caracteres).»; sin petición.
- E2E-3. `POST /rechazar` con `motivo_codigo='anuncio_sin_stock'` → `400 DATOS_INVALIDOS`.
- E2E-4. Rechazar un pedido ya aceptado → `409 TRANSICION_NO_PERMITIDA`.

**Tareas**
- T79-1 · Base de datos: migración de columnas de motivo.
- T79-2 · Backend: `POST /api/pedidos/:id/rechazar` con validación de motivos.
- T79-3 · Frontend: diálogo de rechazo y sección «Motivo» en `/pedidos/:id`.
- T79-4 · QA: automatizar E2E-1…4 y los CA.

---

## (2) US-35 · Indicar cómo voy a pagar un pedido de venta

**Épica:** E06 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-32
**Cambios respecto al backlog original:** es el único método de pago (US-36 descartada). Marcar como cobrado pasa a US-80. Se elige en el formulario de US-32 y no se puede cambiar después.

**Historia**
Como responsable de un centro que compra material, quiero indicar al pedir si pagaré por transferencia o en efectivo en la recogida, para que los dos centros tengamos claras las condiciones.
1. En `/anuncios/:id/pedir` de un anuncio en venta, en «Forma de pago» elijo «Transferencia bancaria» o «Efectivo al recoger».
2. Envío el pedido y veo la forma de pago en `/pedidos/:id`.

**Pantallas para el boceto**
- `/anuncios/:id/pedir`, bloque 3 (solo venta): «Forma de pago» con dos opciones de radio, ninguna marcada al principio: «Transferencia bancaria» (ayuda: «Pediréis los datos bancarios al vendedor cuando acepte el pedido.») y «Efectivo al recoger» (ayuda: «Pagas en mano al recoger el material.»).
- `/pedidos/:id`, «Datos del pedido»: fila «Forma de pago: Transferencia bancaria» / «Efectivo al recoger»; en donación la fila no aparece.

**Criterios de aceptación**
- CA1. El bloque «Forma de pago» aparece solo si el anuncio es `venta`.
- CA2. En venta es obligatorio: sin elegir, «Elige una forma de pago.»
- CA3. `POST /api/pedidos` acepta `metodo_pago`: `transferencia` o `efectivo_recogida`. En venta, ausente o con otro valor → `400 DATOS_INVALIDOS` `details.metodo_pago` «Elige una forma de pago.»
- CA4. En donación, si llega `metodo_pago` → `400 DATOS_INVALIDOS` `details.metodo_pago` «Las donaciones no tienen forma de pago.»
- CA5. Migración: columna `metodo_pago` con el check de la base común (no nulo si venta, nulo si donación).
- CA6. `pedido.metodo_pago` se devuelve en el detalle y lo ven comprador y vendedor (en el diálogo de aceptar de US-33 se añade «Forma de pago: …»).
- CA7. No existe endpoint para cambiar el método; para cambiarlo se cancela y se pide de nuevo (US-39).
- CA8. «Efectivo al recoger» es compatible con cualquier entrega; si [US-40] el comprador elige `envio` con `efectivo_recogida`, la web muestra la advertencia (no bloqueante) «Con envío, acordad con el vendedor cómo pagar en efectivo.»
- CA9. La plataforma nunca muestra ni guarda datos bancarios en el pedido (se intercambian por Mensajes, E05).

**Flujos e2e**
- E2E-1. Gràcia pide 4 de A1 con «Transferencia bancaria» → BD `metodo_pago='transferencia'`; detalle muestra «Forma de pago: Transferencia bancaria» a ambos.
- E2E-2. Sin elegir → «Elige una forma de pago.», sin petición. `POST` directo sin `metodo_pago` → `400`.
- E2E-3. Pedido de A2 (donación): no aparece el bloque; `POST` con `metodo_pago='transferencia'` → `400`.

**Tareas**
- T35-1 · Base de datos: columna `metodo_pago` y check.
- T35-2 · Backend: validación en `POST /api/pedidos` y serializador.
- T35-3 · Frontend: bloque de radio en el formulario y fila en el detalle.
- T35-4 · QA: automatizar E2E-1…3 y los CA.

---

## (3) US-34 · Reservar las unidades de un pedido aceptado

**Épica:** E06 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 4 · **Depende de:** US-33, US-39, US-17
**Cambios respecto al backlog original:** se concreta la concurrencia (dos pedidos sobre las últimas unidades) y qué pasa con los pendientes que ya no caben.

**Historia**
Como responsable de un centro que vende o dona material, quiero que al aceptar un pedido sus unidades dejen de estar disponibles, para no prometer el mismo material a dos centros.
1. Acepto un pedido de 4 balones (US-33) en un anuncio con 12: el anuncio pasa a 8 disponibles.
2. Si acepto pedidos hasta dejarlo en 0, el anuncio se muestra como «No disponible» y los pedidos pendientes que quedaban se rechazan solos con el motivo «Se han agotado las unidades del anuncio».
3. Si un pedido aceptado se cancela, sus unidades vuelven al anuncio.

**Pantallas para el boceto**
- Diálogo de aceptar (US-33): se añade la línea «Quedarán <n> unidades disponibles en el anuncio.»
- `/pedidos/:id` (vendedor, pendiente) con unidades > disponibles: aviso amarillo «Este pedido pide <u> unidades y solo te quedan <n>.» y «Aceptar» deshabilitado.

**Criterios de aceptación**
- CA1. Aceptar resta `unidades` de `anuncios.unidades_disponibles` en la misma transacción que el cambio a `aceptado`.
- CA2. La transacción bloquea la fila del anuncio (`SELECT ... FOR UPDATE`) antes de comprobar las unidades; si `unidades` > disponibles → no cambia nada y responde `409 UNIDADES_INSUFICIENTES`, «Solo quedan N unidades disponibles.», `details.unidades_disponibles`.
- CA3. Si tras restar quedan 0, el anuncio pasa de `activo` a `reservado` (se ve «No disponible» en el catálogo, US-17) en la misma transacción. Si estaba `pausado`, sigue `pausado`.
- CA4. En la misma transacción, todos los pedidos `pendiente` del anuncio con `unidades` > nuevas disponibles pasan a `rechazado`, `motivo_codigo='anuncio_sin_stock'`, `cerrado_por='sistema'`, `respondido_en`=ahora. Los que caben siguen pendientes.
- CA5. El comprador de un pedido rechazado por sistema ve «Rechazado», motivo «Se han agotado las unidades del anuncio» y la frase «El pedido se ha rechazado automáticamente porque ya no quedan unidades suficientes.»
- CA6. Cancelar un pedido `aceptado` (US-39) suma sus unidades a `unidades_disponibles`; si el anuncio estaba `reservado` vuelve a `activo`. Cancelar o rechazar un `pendiente` no toca unidades.
- CA7. Nunca se superan las unidades originales: check `unidades_disponibles >= 0` en `anuncios`.
- CA8. Concurrencia: A1 con 5 disponibles, dos pedidos pendientes de 4 (Gràcia y Sabadell); el vendedor acepta ambos a la vez desde dos pestañas → uno responde `200` (quedan 1) y el otro `409 UNIDADES_INSUFICIENTES` o `409 TRANSICION_NO_PERMITIDA` si ya fue rechazado por CA4; la BD nunca queda con disponibles negativas.
- CA9. La web deshabilita «Aceptar» cuando `pedido.unidades` > `anuncio.unidades_disponibles` (dato nuevo en el objeto `pedido.anuncio`) y muestra el aviso amarillo; `acciones` no incluye `aceptar` en ese caso.
- CA10. El vendedor no puede editar `unidades_disponibles` del anuncio por debajo de 0; editar el anuncio (E03) modifica solo las disponibles, no las reservadas. [Depende de US-15]
- CA11. Pedir (US-32) valida contra las disponibles ya restadas.
- CA12. Cuando [US-42] el pedido pasa a `recibido` las unidades siguen restadas; marcar el anuncio como `entregado` lo decide E03/E07.

**Flujos e2e**
- E2E-1. A1 con 12; Les Corts acepta el pedido de 4 de Gràcia → A1 con 8, `activo`.
- E2E-2 (últimas unidades). A1 con 5; pendientes: Gràcia 4, Sabadell 4, Gràcia-bis no (un pendiente por centro). Les Corts acepta Gràcia → A1 con 1; el de Sabadell pasa a `rechazado` por sistema; Sabadell lo ve con el motivo automático.
- E2E-3 (agotar). A1 con 4; acepta pedido de 4 → A1 `reservado`, 0; en el catálogo aparece «No disponible» y «Pedir» deshabilitado.
- E2E-4 (devolver). Gràcia cancela ese pedido aceptado (US-39) → A1 vuelve a 4 y `activo`.
- E2E-5 (carrera). Dos peticiones paralelas de aceptar en E2E-2 → una `200`, otra `409`; disponibles = 1.

**Tareas**
- T34-1 · Base de datos: check `unidades_disponibles >= 0`; valor `anuncio_sin_stock` en el enum de motivos.
- T34-2 · Backend: transacción de aceptar con bloqueo, resta, cambio de estado del anuncio y rechazo automático.
- T34-3 · Backend: devolución de unidades al cancelar un aceptado (gancho en US-39).
- T34-4 · Frontend: línea en el diálogo, aviso amarillo y botón deshabilitado.
- T34-5 · QA: automatizar E2E-1…5, incluida la prueba de concurrencia.

**Decisiones pendientes**
- ¿Rechazar automáticamente los pendientes que ya no caben? Propuesta: sí (CA4); la alternativa es dejarlos pendientes con el botón deshabilitado.

---

## (2) US-80 · Marcar un pedido como cobrado

**Épica:** E06 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 4 · **Depende de:** US-33, US-35
**Cambios respecto al backlog original:** ninguno de fondo; se concreta que es una marca irreversible y que bloquea la cancelación.

**Historia**
Como responsable de un centro que vende material, quiero marcar un pedido como cobrado cuando el comprador me ha pagado, para que conste para los dos.
1. En `/pedidos/:id` de una venta aceptada pulso «Marcar como cobrado».
2. Confirmo en el diálogo.
3. El pedido muestra la etiqueta «Pagado» y la fecha.

**Pantallas para el boceto**
- `/pedidos/:id` (vendedor, venta, aceptado o recibido, sin pagar): botón «Marcar como cobrado» en la barra de acciones.
- Diálogo «¿Has cobrado este pedido?» / «Confirma que has recibido 34,00 € de <comprador> por <forma de pago>. No se puede deshacer.» / «Sí, lo he cobrado» / «Cancelar».

**Criterios de aceptación**
- CA1. El botón aparece solo si `acciones` incluye `marcar_pagado`: soy el vendedor, `modalidad='venta'`, estado `aceptado` o `recibido` y `pagado_en` nulo.
- CA2. Mientras envía, «Guardando…». Al ir bien: etiqueta «Pagado», aviso verde «Pedido marcado como cobrado.», historial «Marcado como pagado el dd/mm/aaaa hh:mm», el botón desaparece.
- CA3. El comprador ve la etiqueta «Pagado» y la línea del historial; no tiene ningún botón de pago.
- CA4. `POST /api/pedidos/:id/marcar-pagado` → `200 { pedido }` con `pagado_en`.
- CA5. Errores: `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO`, `403 SIN_PERMISO` (comprador), `409 PEDIDO_DONACION` «Las donaciones no se cobran.», `409 TRANSICION_NO_PERMITIDA` (pendiente, rechazado o cancelado), `409 YA_PAGADO` «Este pedido ya consta como cobrado.»
- CA6. La marca es irreversible: no existe endpoint para quitarla.
- CA7. Un pedido con `pagado_en` no se puede cancelar (US-39 CA8).
- CA8. Migración: columna `pagado_en`; check: solo puede ser no nula si `modalidad='venta'`.
- CA9. En `/pedidos` (US-109) la etiqueta «Pagado» aparece junto al estado.

**Flujos e2e**
- E2E-1. Pedido aceptado de 4 balones por transferencia → Les Corts «Marcar como cobrado» → «Sí, lo he cobrado» → «Pagado». Gràcia lo ve.
- E2E-2. Segundo `POST` → `409 YA_PAGADO`.
- E2E-3. Gràcia hace `POST` → `403 SIN_PERMISO`. Pedido pendiente → `409 TRANSICION_NO_PERMITIDA`. Donación aceptada → `409 PEDIDO_DONACION`.

**Tareas**
- T80-1 · Base de datos: columna `pagado_en` y check.
- T80-2 · Backend: endpoint y `marcar_pagado` en `acciones`.
- T80-3 · Frontend: botón, diálogo y etiqueta «Pagado» en detalle y lista.
- T80-4 · QA: automatizar E2E-1…3 y los CA.

**Decisiones pendientes**
- ¿Puede el comprador indicar «He pagado»? Propuesta: no en esta versión; se avisa por Mensajes (E05).
- ¿Deshacer la marca? Propuesta: no (irreversible, con diálogo de confirmación).

---

## (3) US-39 · Cancelar un pedido indicando el motivo

**Épica:** E06 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 4 · **Depende de:** US-108, US-33 (y US-34 para devolver unidades)
**Cambios respecto al backlog original:** «no entregado» se concreta como estados `pendiente` o `aceptado`, sin pago marcado ni incidencia abierta. Motivo con lista fija + texto.

**Historia**
Como responsable de un centro (comprador o vendedor de un pedido), quiero cancelar un pedido que aún no se ha completado indicando el motivo, para anularlo si cambian las circunstancias.
1. En `/pedidos/:id` pulso «Cancelar pedido».
2. En el diálogo elijo el motivo y, si quiero, escribo una explicación.
3. Pulso «Cancelar pedido» en el diálogo: el pedido pasa a «Cancelado» y la otra parte ve quién lo ha cancelado y por qué.

**Pantallas para el boceto**
- `/pedidos/:id`: botón secundario rojo «Cancelar pedido» al final de la barra de acciones.
- Diálogo «Cancelar el pedido»: texto «<otro centro> verá el motivo. No se puede deshacer.» (si `aceptado`, añade «Las unidades volverán a estar disponibles en el anuncio.»); desplegable «Motivo» (opciones de cancelación según mi papel, base común); área «Explicación» (contador «0/300»); botones «Cancelar pedido» (rojo) y «Volver».

**Criterios de aceptación**
- CA1. «Cancelar pedido» aparece si `acciones` incluye `cancelar`: soy comprador o vendedor, estado `pendiente` o `aceptado`, `pagado_en` nulo y sin incidencia abierta [US-43].
- CA2. El desplegable muestra solo los motivos de mi papel; «Motivo» obligatorio («Elige un motivo.»); explicación con las reglas de la base común (10-300 con «Otro motivo», 0-300 si no).
- CA3. Mientras envía, «Cancelando…». Al ir bien: «Cancelado», aviso verde «Pedido cancelado.», sección «Motivo», historial «Cancelado el … por <comprador|vendedor>».
- CA4. La otra parte ve «Cancelado», «Pedido cancelado por <centro>.», el motivo y la explicación. [Aviso en E09.]
- CA5. `POST /api/pedidos/:id/cancelar` `{ "motivo_codigo", "motivo_texto" }` → `200 { pedido }` con `estado='cancelado'`, `cancelado_en`, `cerrado_por` = mi papel.
- CA6. `400 DATOS_INVALIDOS` si el motivo no existe o no es de mi papel (p. ej. comprador con `material_no_disponible`) o el texto no cumple.
- CA7. `401`, `403 EMAIL_NO_CONFIRMADO`, `404 NO_ENCONTRADO` (tercero).
- CA8. Estado `rechazado`, `cancelado` o `recibido` → `409 TRANSICION_NO_PERMITIDA`. `pagado_en` no nulo → `409 PEDIDO_PAGADO`, «No se puede cancelar un pedido ya cobrado. Si hay un problema, abre una incidencia.» Incidencia abierta → `409 INCIDENCIA_ABIERTA` [US-43].
- CA9. Si el pedido estaba `aceptado`, las unidades se devuelven en la misma transacción (US-34 CA6); si estaba `pendiente`, el anuncio no cambia.
- CA10. Cancelar y aceptar a la vez sobre un pendiente: gana el primero en confirmar; el otro recibe `409 TRANSICION_NO_PERMITIDA`.
- CA11. Migración: columna `cancelado_en`; los valores de motivo de cancelación en el enum.
- CA12. Tras cancelar, el comprador puede volver a pedir el anuncio (US-32 CA28).

**Flujos e2e**
- E2E-1 (comprador, pendiente). Gràcia cancela el pedido de petos con «Hemos encontrado otra opción» → «Cancelado», `cerrado_por='comprador'`; Les Corts lo ve con el motivo.
- E2E-2 (vendedor, aceptado). Les Corts cancela el pedido aceptado de 4 balones con «No hemos podido acordar la entrega», explicación «No coincidimos en horarios.» → A1 recupera 4 unidades; Gràcia ve el motivo.
- E2E-3. Pedido pagado → no hay botón; `POST` → `409 PEDIDO_PAGADO`.
- E2E-4. Gràcia envía `motivo_codigo='material_no_disponible'` → `400 DATOS_INVALIDOS`. Pedido rechazado → `409 TRANSICION_NO_PERMITIDA`. Sabadell → `404`.

**Tareas**
- T39-1 · Base de datos: `cancelado_en` y valores del enum.
- T39-2 · Backend: endpoint con validación por papel, bloqueos (pagado, incidencia) y devolución de unidades.
- T39-3 · Frontend: botón, diálogo con motivos por papel y sección «Motivo».
- T39-4 · QA: automatizar E2E-1…4 y los CA.

**Decisiones pendientes**
- ¿Cancelar un pedido pagado? Propuesta: no; se resuelve con incidencia [US-43] y Mensajes.
- ¿Plazo para que el vendedor responda antes de cancelación automática? Propuesta: no hay caducidad automática en esta versión; el comprador puede cancelar con «La otra parte no responde».

---

## (2) US-38 · Ver el historial de mis compras, ventas y donaciones con filtros

**Épica:** E06 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 4 · **Depende de:** US-109
**Cambios respecto al backlog original:** la lista y el detalle ya existen (US-109 y US-108). Esta historia añade filtros por estado y tipo, y un resumen numérico. Baja de 3 a 2 puntos.

**Historia**
Como responsable de un centro, quiero filtrar mis pedidos por estado y por tipo de operación, para llevar el control de lo que compra, vende y dona mi centro.
1. En `/pedidos` elijo la pestaña («Recibidos» o «Realizados»).
2. En «Estado» elijo, por ejemplo, «Recibido», y en «Tipo» «Donación».
3. La lista se actualiza y la URL guarda los filtros; pulso una fila para ver el detalle.

**Pantallas para el boceto**
- `/pedidos`, entre pestañas y tabla: desplegable «Estado» (Todos · Pendiente · Aceptado · Recibido · Rechazado · Cancelado), desplegable «Tipo» (Todos · Venta · Donación), enlace «Quitar filtros» (solo si hay alguno activo) y línea de resumen «<n> pedidos · Total en ventas: 1.234,50 €» (el total suma `total_centimos` de los pedidos `aceptado` y `recibido` del filtro).

**Criterios de aceptación**
- CA1. Valores por defecto: «Todos» en ambos. Cambiar un filtro recarga la lista en la página 1 y actualiza la URL (`?pestana=recibidos&estado=recibido&tipo=donacion`).
- CA2. Abrir una URL con filtros los aplica; valores desconocidos en la URL se tratan como «Todos».
- CA3. Cambiar de pestaña conserva los filtros.
- CA4. «Quitar filtros» vuelve a «Todos» y página 1.
- CA5. Sin resultados con filtros: «No hay pedidos con estos filtros.» y el enlace «Quitar filtros».
- CA6. El resumen se calcula sobre todos los resultados del filtro, no solo la página; en donaciones muestra solo «<n> pedidos».
- CA7. `GET /api/pedidos` acepta `estado` (uno de los 5) y `modalidad` (`venta`|`donacion`); valores inválidos → `400 DATOS_INVALIDOS` con `details.estado` «Estado no válido.» o `details.modalidad` «Tipo no válido.». Respuesta añade `resumen: { total_pedidos, importe_centimos }`.
- CA8. El orden de US-109 se mantiene. El historial incluye todos los pedidos sin límite de antigüedad, paginados de 20 en 20.
- CA9. Filtros y resumen solo sobre pedidos del centro del token.

**Flujos e2e**
- E2E-1. Les Corts, «Recibidos», Estado «Aceptado», Tipo «Venta» → solo el pedido de 4 balones; resumen «1 pedidos · Total en ventas: 34,00 €».
- E2E-2. Gràcia, «Realizados», Estado «Cancelado» → el de petos; «Quitar filtros» → todos.
- E2E-3. URL `?estado=xyz` → lista sin filtrar; `GET /api/pedidos?rol=recibidos&estado=xyz` → `400`.
- E2E-4. Filtro sin resultados → «No hay pedidos con estos filtros.»

**Tareas**
- T38-1 · Backend: filtros y resumen en `GET /api/pedidos`.
- T38-2 · Frontend: desplegables, sincronización con la URL, resumen y vacío con filtros.
- T38-3 · QA: automatizar E2E-1…4 y los CA.

**Decisiones pendientes**
- ¿Exportar a CSV? Propuesta: no (US-37 de justificantes está descartada).
- Pluralización del resumen. Propuesta: «1 pedido» / «n pedidos».
