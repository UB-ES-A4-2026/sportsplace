# E04 Búsqueda y exploración

Historias: US-96 (nueva), US-21, US-22, US-73, US-74, US-23, US-75, US-24, US-25, US-26, US-76, US-27.

## Base común de la épica (la aplican todas las historias)

**Qué se construye primero.** US-96 crea la pantalla `/catalogo`, el endpoint `GET /api/catalogo` y la tarjeta de anuncio. El resto de historias de la épica añaden piezas a esa pantalla y a ese endpoint, sin cambiar lo anterior.

**Acceso.**
- Todas las pantallas de la épica son privadas: sin sesión, redirigen a `/entrar` (Sprint 0).
- Todos los endpoints usan `requireAuth` (`401 NO_AUTENTICADO`) y `requireEmailConfirmado` (`403 EMAIL_NO_CONFIRMADO`), porque usan el marketplace.

**Qué anuncios forman el catálogo** (estados del diccionario, E03):
| Estado | ¿Aparece en `/catalogo`? | Cómo se muestra |
|---|---|---|
| `activo` | Sí | Normal. |
| `reservado` | Sí | Con la etiqueta naranja «No disponible». |
| `pausado` | No | — |
| `entregado` | No | — |
| `retirado` | No | — |

- Además, **no aparecen los anuncios del propio centro** de la sesión (el catálogo sirve para encontrar material de otros centros; los propios están en `/mis-anuncios`). Ver decisión pendiente DP-E04-1.
- Tampoco aparecen anuncios con `unidades_disponibles = 0` (caso posible tras reservas de US-34): se tratan como no visibles.

**Valores de los filtros en la URL y en la API (slugs).** La web y la API usan siempre estos slugs; el texto es lo que se muestra.

| Campo | Slug → texto |
|---|---|
| `categoria` | `balones` Balones · `ropa_equipacion` Ropa y equipación · `calzado` Calzado · `protecciones` Protecciones · `material_entrenamiento` Material de entrenamiento · `porterias_redes` Porterías y redes · `maquinas_fitness` Máquinas y fitness · `otros` Otros |
| `deporte` | `futbol` Fútbol · `baloncesto` Baloncesto · `balonmano` Balonmano · `voleibol` Voleibol · `tenis` Tenis · `padel` Pádel · `natacion` Natación · `atletismo` Atletismo · `gimnasio_fitness` Gimnasio y fitness · `varios` Varios |
| `estado_material` | `nuevo` Nuevo · `como_nuevo` Como nuevo · `buen_estado` Buen estado · `usado` Usado · `para_reparar` Para reparar |
| `modalidad` | `venta` Venta · `donacion` Donación |
| `orden` | `recientes` Más recientes · `cercania` Más cercanos |
| `distancia_max` | `5`, `10`, `25`, `50`, `100` (km) |

Son los mismos valores que guarda E03 en la base de datos (`supabase/migrations/20261022210000_crear_anuncios.sql`, `backend/src/validation/anuncios.js` y `frontend/src/anuncios/valores.js`), así que no hay traducción: se reutilizan esas listas y no se crea otra.

**Parámetros de `/catalogo` y de `GET /api/catalogo`** (los mismos nombres en la URL de la web y en la API):

| Parámetro | Historia | Valores aceptados | Por defecto |
|---|---|---|---|
| `q` | US-21 | Texto de 2 a 100 caracteres tras quitar espacios. | Sin búsqueda. |
| `categoria` | US-22 | Un slug de categoría. | Todas. |
| `deporte` | US-22 | Un slug de deporte. | Todos. |
| `estado_material` | US-73 | Uno o varios slugs separados por comas, sin repetir. | Todos. |
| `precio_min`, `precio_max` | US-73 | Enteros en euros, de 0 a 99999. | Sin límite. |
| `modalidad` | US-74 | `venta` o `donacion`. | Las dos. |
| `orden` | US-96 / US-23 | `recientes` o `cercania`. | `recientes`. |
| `distancia_max` | US-75 | `5`, `10`, `25`, `50` o `100`. | Sin límite. |
| `vista` | US-27 | `lista` o `mapa` (solo web). | `lista`. |
| `pagina` | US-96 | Entero ≥ 1. | `1`. |

- **Combinación:** filtros distintos se combinan con Y; los valores de un mismo filtro múltiple (`estado_material`) se combinan con O.
- **API:** un parámetro con un valor no aceptado responde `400 DATOS_INVALIDOS` con `details.<parámetro>`. Los parámetros desconocidos se ignoran. Un parámetro vacío (`categoria=`) equivale a no enviarlo.
- **Web:** si la URL se ha escrito a mano con un valor no aceptado, la web lo quita de la URL (`replace`, sin nueva entrada en el historial) y carga sin él. Nunca muestra un error por la URL.
- **Cualquier cambio de búsqueda, filtro u orden vuelve a `pagina=1`.** La URL se actualiza con `push` para que «Atrás» del navegador recupere la búsqueda anterior. Los parámetros con su valor por defecto no se escriben en la URL.

**Ubicación del centro [Depende de US-68].** Esta épica asume que US-68 añade a `centros`:
- `latitud` y `longitud`: `numeric(9,6)`, opcionales (nulas si el centro no ha indicado su ubicación), en grados WGS84.
- Si US-68 decide guardar solo el código postal, debe proporcionar igualmente latitud y longitud (por ejemplo, del centroide del código postal) para que funcionen US-23, US-75, US-76 y US-27.
- Distancia: fórmula de Haversine (radio 6371 km) en línea recta, calculada en SQL, nunca en la web.

---

## (2) US-96 · Ver el catálogo de anuncios de otros centros

**Épica:** E04 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 2 · **Depende de:** US-12, US-13, US-14
**Cambios respecto al backlog original:** Historia nueva. Sale de dividir US-21: la pantalla del catálogo (lista, tarjeta, orden, paginación) es una pieza propia sobre la que se montan búsqueda y filtros. US-21 pasa de 3 a 2 puntos; esta tiene 2 (la épica sube 1 punto por la paginación y la tarjeta, que antes no estaban contadas).

**Historia**
Como responsable de un centro deportivo que necesita material, quiero ver en una lista todo el material que ofrecen los otros centros, para descubrir qué hay disponible sin saber qué buscar.
1. Inicio sesión en `/entrar` y llego a `/panel`; en la cabecera pulso «Catálogo» (o el logo «Sportsplace»).
2. Llego a `/catalogo` y veo las 20 primeras tarjetas de anuncios, de la más reciente a la más antigua.
3. Bajo hasta el final y pulso «Siguiente»: veo los 20 siguientes y la URL pasa a `/catalogo?pagina=2`.
4. Pulso en una tarjeta y llego al detalle del anuncio `/anuncios/:id` (US-24).

**Pantallas para el boceto**
- `/catalogo` · «Catálogo», de arriba abajo:
  1. Cabecera privada (esta historia activa «Catálogo» y el logo → `/catalogo`).
  2. Título «Catálogo».
  3. Zona de búsqueda (US-21) y barra de filtros (US-22, US-73, US-74, US-75); en esta historia, vacías.
  4. Línea de resultados: a la izquierda «N anuncios» (o «1 anuncio»); a la derecha el selector «Ordenar por» (en esta historia solo «Más recientes»; US-23 añade «Más cercanos»).
  5. Rejilla de tarjetas: 4 columnas ≥ 1200 px, 3 ≥ 900 px, 2 ≥ 600 px, 1 por debajo.
  6. Paginación: «Anterior» · «Página X de Y» · «Siguiente».
- **Tarjeta de anuncio**, de arriba abajo (todo el bloque es un enlace a `/anuncios/:id`):
  1. Foto principal, proporción 4:3, recortada (`object-fit: cover`). Si el anuncio no tiene foto, un recuadro gris con el texto «Sin foto». Encima, arriba a la izquierda, la etiqueta naranja «No disponible» si está `reservado`; arriba a la derecha, el corazón de favorito (US-25).
  2. Título, en negrita, máximo 2 líneas y «…» si no cabe.
  3. Precio: «12,50 € / unidad» si es venta; «Gratis · Donación» en verde si es donación.
  4. «Estado del material · N unidades» (por ejemplo «Buen estado · 12 unidades»; «1 unidad» en singular).
  5. «Nombre del centro · Localidad» en gris, 1 línea con «…».
  6. Distancia «a 12 km» (US-23; en esta historia no se muestra).
  7. «Publicado el dd/mm/aaaa».

**Criterios de aceptación**

*Navegación*
- CA1. «Catálogo» y el logo «Sportsplace» de la cabecera llevan a `/catalogo`. En `/catalogo` el enlace «Catálogo» se muestra marcado como activo.
- CA2. Sin sesión, `/catalogo` redirige a `/entrar`.
- CA3. Pulsar cualquier punto de una tarjeta lleva a `/anuncios/:id` del anuncio (excepto el corazón de US-25, que no navega).

*Comportamiento*
- CA4. El catálogo muestra solo anuncios en estado `activo` o `reservado`, de centros distintos al de la sesión y con `unidades_disponibles` > 0.
- CA5. Orden por defecto: `publicado_en` (fecha de la primera publicación; si E03 no la tiene, `creado_en`) de más reciente a más antiguo; a igual fecha, por `id` ascendente, para que el orden sea estable entre páginas.
- CA6. Los anuncios `reservado` no se separan ni van al final: ocupan su sitio según el orden, con la etiqueta «No disponible».
- CA7. Se muestran 20 tarjetas por página. Con 41 anuncios hay 3 páginas: 20, 20 y 1.
- CA8. «Anterior» está deshabilitado en la página 1 y «Siguiente» en la última. Con 20 anuncios o menos no se muestra la paginación.
- CA9. Al cambiar de página, la URL pasa a `?pagina=N` (la página 1 no se escribe) y la vista sube al principio de la rejilla.
- CA10. Si la URL pide una página mayor que la última (por ejemplo `?pagina=9` con 3 páginas), la web carga la última página y corrige la URL; con `pagina=0`, `-1` o `abc`, carga la página 1.
- CA11. La línea de resultados muestra el total de anuncios que cumplen la consulta (no solo los de la página): «41 anuncios», «1 anuncio».
- CA12. Precio con el formato de la guía: 1250 céntimos → «12,50 € / unidad»; 123450 → «1.234,50 € / unidad».

*Mensajes*
- CA13. Mientras carga: «Cargando…» en lugar de la rejilla.
- CA14. Si no hay ningún anuncio en el catálogo (sin búsqueda ni filtros): «Todavía no hay anuncios de otros centros. Vuelve más tarde o publica el tuyo.» con el botón «Publicar anuncio» → `/anuncios/nuevo`.
- CA15. Si la API falla (red, 500, 503): «No se ha podido cargar. » y el botón «Reintentar», que repite la misma petición.

*API*
- CA16. `GET /api/catalogo?pagina=N` responde `200`:
  ```json
  {
    "anuncios": [{
      "id": "uuid", "titulo": "Balones de fútbol talla 5",
      "modalidad": "venta", "precio_unitario_centimos": 1250,
      "estado": "activo", "estado_material": "buen_estado",
      "unidades_disponibles": 12, "foto_principal_url": "https://… o null",
      "publicado_en": "2026-10-20T09:15:00Z",
      "centro": { "id": "uuid", "nombre": "CE Montjuïc", "localidad": "Barcelona" },
      "distancia_km": null, "es_favorito": false
    }],
    "pagina": 1, "por_pagina": 20, "total": 41, "total_paginas": 3
  }
  ```
  `distancia_km` lo rellena US-23 y `es_favorito`, US-25; hasta entonces van a `null` y `false`.
- CA17. `pagina` acepta enteros de 1 a 10000. `pagina=0`, `pagina=10001` o `pagina=abc` → `400 DATOS_INVALIDOS` con `details.pagina` = «La página debe ser un número entero entre 1 y 10000.».
- CA18. Una página mayor que `total_paginas` responde `200` con `anuncios: []` y el `total` real.
- CA19. Con 0 anuncios: `total: 0`, `total_paginas: 0`.
- CA20. `foto_principal_url` es una URL firmada o pública de Supabase Storage de la foto con `es_principal = true`; `null` si no hay fotos.
- CA21. La respuesta nunca incluye la descripción completa, el email, el teléfono ni la dirección del centro.

*Datos*
- CA22. La consulta usa un índice sobre `anuncios(estado, publicado_en desc)`; con 1000 anuncios de prueba responde en menos de 500 ms en local.

*Permisos y seguridad*
- CA23. Sin token → `401 NO_AUTENTICADO`; con email sin confirmar → `403 EMAIL_NO_CONFIRMADO`.
- CA24. Un anuncio `pausado`, `entregado` o `retirado` de otro centro nunca aparece, ni siquiera cambiando la URL.

**Flujos e2e**
- E2E-1 (camino feliz). Datos: centro A «CE Montjuïc» (Barcelona) con 3 anuncios activos publicados el 18, 19 y 20/10/2026; centro B «Club Natació Sabadell» con sesión. 1) B pulsa «Catálogo». 2) Ve «3 anuncios» y las tarjetas en orden 20/10, 19/10, 18/10, cada una con «CE Montjuïc · Barcelona». 3) Pulsa la primera → llega a `/anuncios/<id del 20/10>`.
- E2E-2 (estados). A tiene además un anuncio `reservado`, uno `pausado`, uno `entregado` y uno `retirado`. B ve 4 tarjetas; la reservada lleva «No disponible». Los otros tres no aparecen.
- E2E-3 (propios). B publica un anuncio activo. En `/catalogo` de B no aparece; en `/catalogo` de A sí.
- E2E-4 (paginación). Con 41 anuncios de A: B ve 20, pulsa «Siguiente» (URL `?pagina=2`), ve 20, pulsa «Siguiente», ve 1 y «Siguiente» deshabilitado. Escribe `/catalogo?pagina=9` → ve la página 3 y la URL queda `?pagina=3`.
- E2E-5 (vacío y error). Sin anuncios de otros centros → texto de CA14. Con la API parada → «No se ha podido cargar. »; al arrancarla y pulsar «Reintentar», carga.

**Tareas**
- T96-1 · Base de datos: índice `anuncios(estado, publicado_en desc, id)`; añadir `publicado_en` si E03 no lo tiene (se rellena al pasar a `activo` por primera vez).
- T96-2 · Backend: `GET /api/catalogo` con paginación, validación con las listas de valores de E03 de parámetros y tests.
- T96-3 · Frontend: componente `TarjetaAnuncio`, pantalla `/catalogo`, rejilla responsive, paginación sincronizada con la URL, estados de carga, vacío y error.
- T96-4 · Contrato: documentar `GET /api/catalogo` en `docs/api-contrato.md`.
- T96-5 · QA: automatizar E2E-1 a E2E-5 y los CA.

**Decisiones pendientes**
- DP-E04-1. ¿Se muestran los anuncios propios en el catálogo? Propuesta: no (CA4); los propios se ven en `/mis-anuncios`.
- DP-E04-2. ¿El catálogo es visible sin sesión (visitantes)? Propuesta: no; es privado como el resto del marketplace. Se puede abrir más adelante con una historia nueva.

---

## (2) US-21 · Buscar anuncios escribiendo palabras

**Épica:** E04 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 2 · **Depende de:** US-96
**Cambios respecto al backlog original:** Se separa la pantalla del catálogo a US-96 (3 → 2 puntos). Se concreta en qué campos se busca, cómo se tratan mayúsculas, acentos y varias palabras, y las longitudes. «Solo veo anuncios disponibles» queda resuelto por la tabla de estados de la base común.

**Historia**
Como responsable de compras de un centro, quiero escribir lo que busco y ver solo los anuncios que lo contienen, para encontrar rápido el material que necesito.
1. En `/catalogo` pulso en el cuadro «Buscar material…».
2. Escribo «balon futbol» y pulso Intro o el botón «Buscar».
3. La URL pasa a `/catalogo?q=balon+futbol` y veo solo los anuncios cuyo título o descripción contienen «balón» y «fútbol».
4. Pulso la «×» del cuadro y vuelvo a ver todo el catálogo.

**Pantallas para el boceto**
- `/catalogo`, zona de búsqueda (debajo del título, a todo el ancho): cuadro de texto con el icono de lupa y el texto de ejemplo «Buscar material…»; a su derecha, dentro del cuadro, la «×» (solo si hay texto); después, el botón «Buscar». Debajo del cuadro, el mensaje de error de longitud cuando corresponda.
- Línea de resultados con búsqueda: «N anuncios para «texto»».

**Criterios de aceptación**

*Campos y validación*
- CA1. El cuadro admite como máximo 100 caracteres (atributo `maxlength=100`); no se puede escribir el carácter 101.
- CA2. Al buscar, se quitan los espacios al principio y al final y los espacios repetidos se reducen a uno.
- CA3. Texto de 0 caracteres tras quitar espacios: no es un error; equivale a quitar la búsqueda (se quita `q` de la URL).
- CA4. Texto de 1 carácter («a»): no se busca y aparece debajo del cuadro «Escribe al menos 2 caracteres.». Con 2 caracteres («pa») sí se busca.
- CA5. Como máximo se usan 5 palabras. Con 6 o más: no se busca y aparece «Usa como máximo 5 palabras.».

*Comportamiento*
- CA6. La búsqueda se lanza al pulsar Intro o «Buscar», no a cada tecla.
- CA7. Se busca en `titulo` y `descripcion` del anuncio. No se busca en el nombre del centro, la categoría ni el deporte (para eso están los filtros de US-22).
- CA8. Sin distinguir mayúsculas ni acentos: «BALON», «balón» y «Balon» dan los mismos resultados; «nino» encuentra «niño» (la ñ se trata como n); «ç» como c.
- CA9. Coincidencia por fragmento: «balon» encuentra «balones»; «red» encuentra «redes» y también «paredes».
- CA10. Varias palabras: un anuncio aparece si contiene **todas** las palabras, cada una en el título o en la descripción (no hace falta que estén juntas ni en el mismo campo). «balon futbol» encuentra «Balón talla 5» con descripción «para fútbol 7».
- CA11. Los caracteres `%`, `_` y `\` se buscan literalmente (no actúan como comodines).
- CA12. El orden de los resultados es el mismo que sin búsqueda (más recientes primero; US-23 añade cercanía). No hay ordenación por relevancia (DP-E04-3).
- CA13. La búsqueda se combina con Y con todos los filtros activos y vuelve a `pagina=1`.
- CA14. La «×» vacía el cuadro, quita `q` de la URL y recarga el catálogo con los filtros que hubiera.
- CA15. Al abrir `/catalogo?q=balon`, el cuadro aparece ya rellenado con «balon» y los resultados filtrados.
- CA16. Las coincidencias no se resaltan en las tarjetas.

*Mensajes*
- CA17. Con resultados: «N anuncios para «balon futbol»» (singular «1 anuncio para …»).
- CA18. Sin resultados: «No hay anuncios para «balon futbol».» y debajo «Prueba con otras palabras o quita algún filtro.» y el botón «Quitar búsqueda y filtros», que lleva a `/catalogo` sin parámetros.

*API*
- CA19. `GET /api/catalogo?q=balon%20futbol` aplica la búsqueda con las mismas reglas (CA2 a CA11).
- CA20. `q` de 1 carácter tras quitar espacios → `400 DATOS_INVALIDOS`, `details.q` = «Escribe al menos 2 caracteres.»; de 101 o más → «La búsqueda puede tener como máximo 100 caracteres.»; con más de 5 palabras → «Usa como máximo 5 palabras.».

*Datos*
- CA21. Implementación: extensión `unaccent` de PostgreSQL; columna generada o índice sobre `unaccent(lower(titulo || ' ' || descripcion))` con índice trigram (`pg_trgm`, GIN) para que `ILIKE '%palabra%'` use índice.

*Casos límite*
- CA22. Un anuncio `pausado` que contiene la palabra no aparece.
- CA23. Texto solo con símbolos («%%») de 2 caracteres: se busca literalmente y normalmente da 0 resultados, sin error.

**Flujos e2e**
- E2E-1 (camino feliz). Anuncios de A: «Balones de fútbol talla 5» (activo), «Red de portería de fútbol 7» (activo), «Raquetas de pádel» (activo). B escribe «BALON» y pulsa Intro → URL `?q=BALON`, «1 anuncio para «BALON»», tarjeta «Balones de fútbol talla 5».
- E2E-2 (varias palabras). B busca «futbol red» → solo «Red de portería de fútbol 7». Busca «futbol padel» → «No hay anuncios para «futbol padel».».
- E2E-3 (longitudes). B escribe « a » → «Escribe al menos 2 caracteres.» y no hay petición a la API. Escribe «uno dos tres cuatro cinco seis» → «Usa como máximo 5 palabras.».
- E2E-4 (limpiar). Con `?q=balon&categoria=balones`, B pulsa «×» → URL `?categoria=balones` y se ven todos los balones.
- E2E-5 (sin resultados). B busca «trampolin» → mensaje de CA18; pulsa «Quitar búsqueda y filtros» → `/catalogo` completo.

**Tareas**
- T21-1 · Base de datos: migración con `unaccent`, `pg_trgm` e índice GIN de búsqueda.
- T21-2 · Backend: parámetro `q` en `GET /api/catalogo` (normalización, escapado, validación) y tests.
- T21-3 · Frontend: cuadro de búsqueda, validación en la web, sincronización con la URL y mensajes.
- T21-4 · QA: automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- DP-E04-3. ¿Ordenar por relevancia al buscar? Propuesta: no en este sprint; se mantiene «Más recientes».

---

## (2) US-22 · Filtrar los anuncios por categoría y deporte

**Épica:** E04 · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** 2 · **Depende de:** US-96
**Cambios respecto al backlog original:** Depende de US-96 en lugar de US-21 (los filtros funcionan con o sin búsqueda). Se crea aquí la barra de filtros, las etiquetas de filtros activos y «Limpiar filtros», que reutilizan US-73, US-74 y US-75.

**Historia**
Como responsable de material de un club de baloncesto, quiero ver solo los anuncios de una categoría y de un deporte, para no perder tiempo con material que no me sirve.
1. En `/catalogo` abro el desplegable «Categoría» y elijo «Balones».
2. Abro «Deporte» y elijo «Baloncesto».
3. La URL pasa a `/catalogo?categoria=balones&deporte=baloncesto` y veo solo balones de baloncesto.
4. Pulso la «×» de la etiqueta «Deporte: Baloncesto» y veo todos los balones; pulso «Limpiar filtros» y vuelvo a ver todo.

**Pantallas para el boceto**
- `/catalogo`, barra de filtros (debajo de la búsqueda), de izquierda a derecha: desplegable «Categoría» (primera opción «Todas las categorías» y después las 8 de la lista en su orden); desplegable «Deporte» («Todos los deportes» y los 10 deportes); [US-73, US-74, US-75 añaden los suyos aquí]; enlace «Limpiar filtros».
- Debajo, fila de etiquetas de filtros activos, cada una «Nombre: Valor ×» (por ejemplo «Categoría: Balones ×»).
- En pantallas < 600 px, la barra se pliega tras el botón «Filtros (N)», donde N es el número de filtros activos; al pulsarlo se despliega en vertical.

**Criterios de aceptación**

*Campos*
- CA1. «Categoría» es un desplegable de selección única con «Todas las categorías» seleccionada por defecto y las 8 categorías del diccionario en este orden: Balones, Ropa y equipación, Calzado, Protecciones, Material de entrenamiento, Porterías y redes, Máquinas y fitness, Otros.
- CA2. «Deporte» es un desplegable de selección única con «Todos los deportes» por defecto y los 10 deportes: Fútbol, Baloncesto, Balonmano, Voleibol, Tenis, Pádel, Natación, Atletismo, Gimnasio y fitness, Varios.

*Comportamiento*
- CA3. Al elegir una opción el filtro se aplica en el acto (sin botón), la URL añade `categoria=<slug>` o `deporte=<slug>` y vuelve a `pagina=1`.
- CA4. Con los dos elegidos, solo aparecen anuncios que cumplen los dos (Y). «Varios» y «Otros» son valores normales: «Varios» no incluye todos los deportes.
- CA5. Elegir «Todas las categorías» / «Todos los deportes» quita el parámetro de la URL.
- CA6. Cada filtro activo aparece como etiqueta; su «×» quita solo ese filtro y deja el desplegable en «Todas…/Todos…».
- CA7. «Limpiar filtros» solo se ve si hay al menos un filtro activo; quita todos los filtros de la barra (de esta historia y de US-73, US-74, US-75) pero **conserva** la búsqueda `q` y el `orden`.
- CA8. Al abrir `/catalogo?categoria=calzado`, el desplegable muestra «Calzado» y la etiqueta «Categoría: Calzado ×».
- CA9. Los filtros se combinan con la búsqueda de US-21 (Y).

*Mensajes*
- CA10. Sin resultados con filtros: «No hay anuncios con estos filtros.» y el botón «Limpiar filtros». Si además hay búsqueda, se usa el mensaje de US-21 CA18.

*API*
- CA11. `GET /api/catalogo?categoria=balones&deporte=baloncesto` filtra por los dos.
- CA12. `categoria=pelotas` → `400 DATOS_INVALIDOS`, `details.categoria` = «Categoría no válida.»; `deporte=golf` → `details.deporte` = «Deporte no válido.». Los slugs distinguen mayúsculas: `Balones` es inválido.
- CA13. Enviar el parámetro dos veces (`categoria=balones&categoria=calzado`) → `400`, «Categoría no válida.».

*Casos límite*
- CA14. En la web, `/catalogo?categoria=pelotas` se carga sin filtro de categoría y la URL queda `/catalogo`.

**Flujos e2e**
- E2E-1 (camino feliz). Anuncios: «Balones baloncesto Molten» (Balones/Baloncesto), «Balones fútbol» (Balones/Fútbol), «Zapatillas baloncesto» (Calzado/Baloncesto). B elige Categoría «Balones» → 2 anuncios; Deporte «Baloncesto» → 1 («Balones baloncesto Molten»); URL `?categoria=balones&deporte=baloncesto`.
- E2E-2 (quitar uno). B pulsa «×» en «Categoría: Balones» → ve «Balones baloncesto Molten» y «Zapatillas baloncesto».
- E2E-3 (limpiar con búsqueda). Con `?q=molten&categoria=balones`, B pulsa «Limpiar filtros» → URL `?q=molten`.
- E2E-4 (sin resultados). B elige «Natación» + «Porterías y redes» → «No hay anuncios con estos filtros.»; pulsa «Limpiar filtros» → todo el catálogo.
- E2E-5 (URL manipulada). B abre `/catalogo?deporte=golf` → catálogo sin filtro, URL `/catalogo`.

**Tareas**
- T22-1 · Backend: parámetros `categoria` y `deporte`, validación y tests.
- T22-2 · Frontend: barra de filtros, etiquetas activas, «Limpiar filtros», versión móvil «Filtros (N)».
- T22-3 · QA: automatizar E2E-1 a E2E-5.

---

## (2) US-73 · Filtrar los anuncios por estado del material y por precio

**Épica:** E04 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-22
**Cambios respecto al backlog original:** Se concreta que el estado admite varios valores y que el precio se indica en euros enteros; se define cómo se tratan las donaciones con el filtro de precio.

**Historia**
Como responsable de un centro con poco presupuesto, quiero ver solo material en buen estado y por debajo de un precio, para ajustar la búsqueda a lo que puedo pagar.
1. En `/catalogo` abro «Estado del material» y marco «Nuevo» y «Como nuevo».
2. En «Precio (€)» escribo «Hasta» 20 y pulso «Aplicar».
3. La URL pasa a `/catalogo?estado_material=nuevo,como_nuevo&precio_max=20` y veo solo anuncios en esos estados que cuestan 20 € o menos por unidad (y las donaciones).

**Pantallas para el boceto**
- Barra de filtros, después de «Deporte»:
  - Desplegable «Estado del material» con 5 casillas (Nuevo, Como nuevo, Buen estado, Usado, Para reparar). El botón del desplegable muestra «Estado del material» sin selección, el nombre si hay uno («Nuevo») o «Estado (2)» si hay varios.
  - Grupo «Precio (€)»: campo «Desde», campo «Hasta» (numéricos) y botón «Aplicar». Mensaje de error debajo del grupo.
- Etiquetas: «Estado: Nuevo, Como nuevo ×», «Precio: 5 € – 20 €», «Precio: desde 5 €», «Precio: hasta 20 €».

**Criterios de aceptación**

*Campos y validación*
- CA1. Las casillas de estado se aplican al marcar o desmarcar (sin botón). Varios estados se combinan con O.
- CA2. Marcar los 5 estados equivale a no filtrar: se quita `estado_material` de la URL.
- CA3. «Desde» y «Hasta» son opcionales, enteros de 0 a 99999 (euros por unidad). Aceptado: 0 y 99999; rechazado: -1, 100000, «12,5», «abc». Mensaje: «Indica un precio entero entre 0 y 99.999 €.».
- CA4. Si «Desde» > «Hasta»: «El precio mínimo no puede ser mayor que el máximo.» y no se aplica. «Desde» = «Hasta» (por ejemplo 10 y 10) es válido.
- CA5. El precio se aplica al pulsar «Aplicar» o Intro dentro de uno de los dos campos. Dejar los dos vacíos y pulsar «Aplicar» quita el filtro de precio.

*Comportamiento*
- CA6. El precio compara `precio_unitario_centimos` con euros × 100, incluyendo los extremos: `precio_max=20` incluye un anuncio de 20,00 € y excluye uno de 20,01 €.
- CA7. Donaciones: cuentan como precio 0 €. Por tanto aparecen si `precio_min` no está o vale 0, y no aparecen con `precio_min` ≥ 1.
- CA8. Se combinan con Y con categoría, deporte, modalidad, distancia y búsqueda; cada cambio vuelve a `pagina=1`.
- CA9. «Limpiar filtros» (US-22) también quita estado y precio; cada etiqueta quita su filtro.
- CA10. Al abrir una URL con estos parámetros, las casillas y los campos aparecen rellenados.

*API*
- CA11. `estado_material`: lista separada por comas de slugs válidos, sin repetidos. `estado_material=nuevo,roto` o `nuevo,nuevo` → `400 DATOS_INVALIDOS`, `details.estado_material` = «Estado del material no válido.».
- CA12. `precio_min`/`precio_max` fuera de 0-99999 o no enteros → `400`, `details.precio_min` (o `precio_max`) = «Indica un precio entero entre 0 y 99.999 €.». `precio_min` > `precio_max` → `400`, `details.precio_min` = «El precio mínimo no puede ser mayor que el máximo.».

**Flujos e2e**
- E2E-1 (camino feliz). Anuncios: A1 venta 15,00 € Nuevo; A2 venta 25,00 € Nuevo; A3 donación Como nuevo; A4 venta 10,00 € Usado. B marca Nuevo y Como nuevo, Hasta 20, «Aplicar» → A1 y A3.
- E2E-2 (límites). Hasta 25 → A1, A2, A3. Desde 1 → A1, A2, A4 (sin donación). Desde 15 Hasta 15 → A1.
- E2E-3 (validación). Desde 30, Hasta 20 → «El precio mínimo no puede ser mayor que el máximo.», URL sin cambios. Hasta «12,5» → «Indica un precio entero entre 0 y 99.999 €.».
- E2E-4 (combinado). Con `?categoria=balones&precio_max=20`, «Limpiar filtros» → `/catalogo`.

**Tareas**
- T73-1 · Backend: parámetros, validación, regla de donaciones y tests.
- T73-2 · Frontend: desplegable con casillas, grupo de precio, etiquetas.
- T73-3 · QA: automatizar E2E-1 a E2E-4.

**Decisiones pendientes**
- DP-E04-4. ¿Incluir donaciones cuando se fija un precio máximo? Propuesta: sí (cuentan como 0 €, CA7).

---

## (1) US-74 · Ver solo los anuncios en venta o solo los de donación

**Épica:** E04 · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** 3 · **Depende de:** US-22
**Cambios respecto al backlog original:** Depende de US-22 (usa su barra de filtros) en lugar de US-21.

**Historia**
Como responsable de una escuela sin presupuesto, quiero ver solo el material que se cede gratis, para encontrar lo que puedo conseguir sin pagar.
1. En `/catalogo`, en el selector «Modalidad», pulso «Donación».
2. La URL pasa a `/catalogo?modalidad=donacion` y todas las tarjetas muestran «Gratis · Donación».
3. Pulso «Todos» y vuelvo a ver ventas y donaciones.

**Pantallas para el boceto**
- Barra de filtros, después de «Precio»: selector de tres botones unidos «Todos» · «Venta» · «Donación»; «Todos» marcado por defecto. Etiqueta activa «Modalidad: Venta ×» o «Modalidad: Donación ×».

**Criterios de aceptación**
- CA1. Al pulsar una opción se aplica en el acto; «Venta» añade `modalidad=venta`, «Donación» `modalidad=donacion`, «Todos» quita el parámetro. Vuelve a `pagina=1`.
- CA2. Con `venta` solo aparecen anuncios con `modalidad = venta`; con `donacion`, solo `donacion`.
- CA3. Se combina con Y con el resto. `modalidad=donacion` con `precio_min=1` da siempre 0 resultados y muestra «No hay anuncios con estos filtros.».
- CA4. Con `modalidad=donacion`, el grupo «Precio (€)» se deshabilita (gris) y se muestra en él «No aplica a donaciones»; los valores de precio que hubiera se quitan de la URL.
- CA5. «Limpiar filtros» y la «×» de la etiqueta vuelven a «Todos».
- CA6. API: `modalidad` distinto de `venta`/`donacion` → `400 DATOS_INVALIDOS`, `details.modalidad` = «Modalidad no válida.».

**Flujos e2e**
- E2E-1. Anuncios: 3 ventas y 2 donaciones. B pulsa «Donación» → 2 tarjetas «Gratis · Donación». Pulsa «Venta» → 3. Pulsa «Todos» → 5.
- E2E-2. Con `?precio_max=20`, B pulsa «Donación» → URL `?modalidad=donacion`, precio deshabilitado con «No aplica a donaciones».
- E2E-3. `/catalogo?modalidad=gratis` → se carga sin filtro y la URL queda `/catalogo`.

**Tareas**
- T74-1 · Backend: parámetro `modalidad`, validación y tests.
- T74-2 · Frontend: selector, etiqueta, deshabilitar precio.
- T74-3 · QA: automatizar E2E-1 a E2E-3.

---

## (3) US-23 · Ordenar los anuncios por cercanía a mi centro

**Épica:** E04 · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** 5 · **Depende de:** US-96, US-68
**Cambios respecto al backlog original:** Depende de US-96 (el selector de orden está en el catálogo). Se concreta el cálculo y el formato de la distancia y qué pasa si falta la ubicación.

**Historia**
Como responsable de un centro que recoge el material con su propia furgoneta, quiero ver primero los anuncios de los centros más cercanos, para reducir el tiempo de recogida.
1. En `/catalogo` abro «Ordenar por» y elijo «Más cercanos».
2. La URL pasa a `/catalogo?orden=cercania` y las tarjetas se ordenan de menor a mayor distancia, cada una con «a 3 km», «a 12 km»…

**Pantallas para el boceto**
- Línea de resultados: selector «Ordenar por» con «Más recientes» (por defecto) y «Más cercanos».
- Si mi centro no tiene ubicación: la opción «Más cercanos» aparece deshabilitada y, debajo del selector, «Indica la ubicación de tu centro para ordenar por cercanía.» con el enlace «Indicar ubicación» → pantalla de ubicación de US-68.
- Tarjeta: línea 6, icono de chincheta + «a 12 km».

**Criterios de aceptación**

*Comportamiento*
- CA1. La distancia entre mi centro y el centro del anuncio se calcula en línea recta con Haversine (radio 6371 km) a partir de `latitud`/`longitud` de US-68.
- CA2. Formato: < 1 km → «a menos de 1 km»; de 1 a 999 km → entero redondeado al más cercano («a 12 km»; 12,5 → «a 13 km»); ≥ 1000 → «a 1.000 km».
- CA3. La distancia se muestra en todas las tarjetas (con cualquier orden) cuando mi centro y el del anuncio tienen ubicación; si falta alguna, la línea no aparece.
- CA4. `orden=cercania`: de menor a mayor distancia; empates, por `publicado_en` desc y `id`. Los anuncios de centros sin ubicación van al final, en orden de recientes.
- CA5. Cambiar el orden vuelve a `pagina=1` y conserva búsqueda y filtros.
- CA6. Si mi centro no tiene ubicación, «Más cercanos» está deshabilitado (CA de pantallas); si la URL trae `orden=cercania`, la web la quita y ordena por recientes.

*API*
- CA7. `GET /api/catalogo?orden=cercania` ordena como CA4. `distancia_km` en cada anuncio: número con 1 decimal (`12.4`) o `null` si falta alguna ubicación.
- CA8. `orden` distinto de `recientes`/`cercania` → `400 DATOS_INVALIDOS`, `details.orden` = «Orden no válido.».
- CA9. `orden=cercania` con mi centro sin ubicación → `409 UBICACION_CENTRO_REQUERIDA`, «Indica la ubicación de tu centro para usar la distancia.».
- CA10. La API nunca devuelve `latitud`/`longitud` de otros centros en el catálogo, solo `distancia_km`.

*Datos*
- CA11. El cálculo se hace en SQL (función `distancia_km(lat1, lon1, lat2, lon2)` en una migración); con 1000 anuncios responde en < 500 ms.

**Flujos e2e**
- E2E-1. B en Barcelona (41.3874, 2.1686). Anuncios: A de Sabadell (41.5463, 2.1086, ~18 km), C de Badalona (41.4500, 2.2474, ~10 km), D de Girona (41.9794, 2.8214, ~85 km), E de un centro sin ubicación. B elige «Más cercanos» → orden C (a 10 km), A (a 18 km), D (a 85 km), E (sin distancia).
- E2E-2. Mismo centro que B (mismo punto) → «a menos de 1 km».
- E2E-3. B sin ubicación → «Más cercanos» deshabilitado, aviso con enlace; abre `/catalogo?orden=cercania` → URL queda `/catalogo`. Por API → `409 UBICACION_CENTRO_REQUERIDA`.
- E2E-4. Con `?q=balon&orden=cercania` y 25 resultados, página 2 muestra los 5 más lejanos.

**Tareas**
- T23-1 · Base de datos: función SQL `distancia_km` y tests.
- T23-2 · Backend: `orden=cercania`, `distancia_km` en la respuesta, error 409 y tests.
- T23-3 · Frontend: selector de orden, línea de distancia en la tarjeta, aviso sin ubicación.
- T23-4 · QA: automatizar E2E-1 a E2E-4.

---

## (2) US-75 · Limitar los resultados a una distancia máxima de mi centro

**Épica:** E04 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 5 · **Depende de:** US-23
**Cambios respecto al backlog original:** Se fijan valores cerrados de distancia en lugar de un número libre.

**Historia**
Como responsable de un centro que solo puede recoger material en su comarca, quiero ver solo los anuncios a menos de cierta distancia, para no perder tiempo con material demasiado lejos.
1. En `/catalogo` abro «Distancia» y elijo «Hasta 25 km».
2. La URL pasa a `/catalogo?distancia_max=25` y solo veo anuncios a 25 km o menos.
3. Elijo «Sin límite» y vuelvo a verlos todos.

**Pantallas para el boceto**
- Barra de filtros, al final: desplegable «Distancia» con «Sin límite» (por defecto), «Hasta 5 km», «Hasta 10 km», «Hasta 25 km», «Hasta 50 km», «Hasta 100 km». Etiqueta «Distancia: hasta 25 km ×».
- Sin ubicación propia: desplegable deshabilitado con el texto «Indica la ubicación de tu centro para usar este filtro.» y el enlace «Indicar ubicación» (US-68).

**Criterios de aceptación**
- CA1. Al elegir una opción se aplica en el acto, añade `distancia_max=<n>` (o lo quita con «Sin límite») y vuelve a `pagina=1`.
- CA2. Se incluyen los anuncios con distancia ≤ al límite, con la distancia sin redondear: con 25, un anuncio a 25,0 km aparece y uno a 25,1 km no.
- CA3. Con el filtro activo se excluyen los anuncios de centros sin ubicación.
- CA4. Se combina con Y con el resto y con cualquier orden.
- CA5. «Limpiar filtros» y la «×» de la etiqueta lo quitan.
- CA6. Sin ubicación propia, el desplegable está deshabilitado y un `distancia_max` en la URL se quita.
- CA7. Sin resultados: «No hay anuncios a menos de 25 km con estos filtros.» con los botones «Ampliar a 50 km» (solo si existe un valor mayor; cambia al siguiente valor) y «Limpiar filtros».
- CA8. API: `distancia_max` fuera de {5, 10, 25, 50, 100} (por ejemplo `7` o `abc`) → `400 DATOS_INVALIDOS`, `details.distancia_max` = «Distancia no válida.». Con mi centro sin ubicación → `409 UBICACION_CENTRO_REQUERIDA`.

**Flujos e2e**
- E2E-1. Datos de US-23 E2E-1. B elige «Hasta 25 km» → C y A; «Hasta 10 km» → «No hay anuncios a menos de 10 km…» si C está a 10,3 km; pulsa «Ampliar a 25 km» → C y A.
- E2E-2. «Hasta 100 km» → C, A, D; E (sin ubicación) no aparece. «Sin límite» → los 4.
- E2E-3. B sin ubicación → desplegable deshabilitado; `/catalogo?distancia_max=25` → URL `/catalogo`. API → 409.
- E2E-4. `GET /api/catalogo?distancia_max=7` → `400`, «Distancia no válida.».

**Tareas**
- T75-1 · Backend: parámetro `distancia_max`, validación, 409 y tests.
- T75-2 · Frontend: desplegable, etiqueta, mensaje vacío con «Ampliar».
- T75-3 · QA: automatizar E2E-1 a E2E-4.

---

## (3) US-24 · Ver el detalle completo de un anuncio de otro centro

**Épica:** E04 · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** 2 · **Depende de:** US-96, US-12, US-13, US-14
**Cambios respecto al backlog original:** Se reutiliza la ruta `/anuncios/:id` de E03, que hasta ahora solo veía el propietario: esta historia añade la vista para los demás centros. Los botones «Escribir al centro» y «Pedir material» solo se muestran; su acción es de US-28 y US-32.

**Historia**
Como responsable de compras de un centro, quiero ver toda la información de un anuncio, para decidir si el material me interesa antes de escribir o pedirlo.
1. En `/catalogo` pulso la tarjeta «Balones de fútbol talla 5».
2. Llego a `/anuncios/<id>` y veo las fotos, el precio, el estado del material, las unidades, la descripción y el centro que lo ofrece.
3. Paso las fotos con las flechas.
4. Pulso «Volver al catálogo» y regreso al catálogo con la misma búsqueda, filtros y página.

**Pantallas para el boceto**
- `/anuncios/:id` (vista de otro centro). En escritorio, dos columnas; en < 900 px, una.
  - Arriba: enlace «← Volver al catálogo».
  - Columna izquierda: galería. Foto grande (la principal primero, luego en el orden de `orden`), flechas «‹» «›» a los lados y debajo las miniaturas (la activa con borde). Sin fotos: recuadro «Sin foto».
  - Columna derecha, en este orden:
    1. Etiqueta naranja «No disponible: este material está reservado.» (solo si `reservado`).
    2. Título (h1).
    3. Precio grande: «12,50 € / unidad» o «Gratis · Donación».
    4. Lista «Detalles»: Categoría · Deporte · Estado del material · Unidades disponibles · Publicado el dd/mm/aaaa.
    5. Botón principal «Pedir material» [Depende de US-32] y botón secundario «Escribir al centro» [Depende de US-28].
    6. Corazón «Guardar en favoritos» (US-25).
    7. Bloque «Ofrecido por»: nombre del centro (enlace a `/centros/:id` [Depende de US-10]; sin US-10, texto sin enlace), localidad, distancia (US-23) y valoración media [Depende de US-45].
  - Debajo, a todo el ancho: «Descripción» con el texto completo, respetando los saltos de línea.

**Criterios de aceptación**

*Navegación*
- CA1. Al pulsar una tarjeta del catálogo se abre `/anuncios/:id`. «← Volver al catálogo» vuelve a la URL del catálogo de la que se vino (con `q`, filtros y `pagina`); si se entró directamente por el enlace, a `/catalogo`.
- CA2. Si el anuncio es del propio centro, `/anuncios/:id` muestra la ficha de propietario de E03 (US-12), no esta.

*Comportamiento*
- CA3. Un anuncio `activo` de otro centro se ve completo con los botones habilitados.
- CA4. Un anuncio `reservado` se ve con la etiqueta de la pantalla y «Pedir material» deshabilitado; «Escribir al centro» sigue habilitado.
- CA5. Un anuncio `pausado`, `entregado`, `retirado`, con 0 unidades o inexistente muestra «Este anuncio no existe o ya no está disponible.» y el botón «Ir al catálogo».
- CA6. Galería: la primera foto es la principal; las flechas avanzan y retroceden en bucle (de la última a la primera); al pulsar una miniatura se muestra esa foto; con 1 foto no hay flechas ni miniaturas. Las flechas del teclado ← → cambian de foto.
- CA7. Cada foto tiene `alt` «Foto N de M: <título>».
- CA8. La descripción se muestra como texto plano (sin interpretar HTML); los saltos de línea se respetan.
- CA9. Formatos: precio y fecha según la guía; «1 unidad» / «N unidades».
- CA10. Hasta que existan US-32 y US-28, los botones se muestran deshabilitados con el texto de ayuda «Disponible próximamente».

*Mensajes*
- CA11. Mientras carga: «Cargando…». Error de red o 500/503: «No se ha podido cargar. » y «Reintentar».

*API*
- CA12. `GET /api/catalogo/:id` → `200`:
  ```json
  {
    "id": "uuid", "titulo": "…", "descripcion": "…", "categoria": "balones", "deporte": "futbol",
    "estado_material": "buen_estado", "unidades_disponibles": 12, "modalidad": "venta",
    "precio_unitario_centimos": 1250, "estado": "activo", "publicado_en": "…",
    "fotos": [{ "url": "…", "orden": 1, "es_principal": true }],
    "centro": { "id": "uuid", "nombre": "CE Montjuïc", "localidad": "Barcelona" },
    "distancia_km": 12.4, "es_favorito": false, "es_propio": false
  }
  ```
  `fotos` ordenadas con la principal primero y después por `orden`.
- CA13. `404 NO_ENCONTRADO` si el anuncio no existe, no tiene un uuid válido, o está `pausado`, `entregado`, `retirado` o con 0 unidades (no se distingue el motivo).
- CA14. Si el anuncio es propio, responde `200` con `es_propio: true` (la web redirige a la vista de propietario).
- CA15. La respuesta no incluye email, teléfono, dirección ni coordenadas del centro.
- CA16. `401 NO_AUTENTICADO` / `403 EMAIL_NO_CONFIRMADO` como en la base común.

**Flujos e2e**
- E2E-1 (camino feliz). Anuncio de A «Balones de fútbol talla 5», venta 12,50 €, 12 unidades, Buen estado, 3 fotos. B, desde `/catalogo?categoria=balones&pagina=2`, pulsa la tarjeta → ve todo en el orden descrito; pulsa «›» dos veces → foto 3; «›» → foto 1; pulsa «← Volver al catálogo» → `/catalogo?categoria=balones&pagina=2`.
- E2E-2 (reservado). A marca el anuncio como reservado → B ve «No disponible: este material está reservado.» y «Pedir material» deshabilitado.
- E2E-3 (no disponible). A lo pausa → B recarga y ve «Este anuncio no existe o ya no está disponible.»; API 404. Igual con `/anuncios/1234` (id no válido).
- E2E-4 (propio). A abre `/anuncios/<su id>` → ve la ficha de propietario de E03.
- E2E-5 (seguridad). Descripción con `<script>alert(1)</script>` → se ve como texto, no se ejecuta.

**Tareas**
- T24-1 · Backend: `GET /api/catalogo/:id` con reglas de visibilidad y tests.
- T24-2 · Frontend: vista de otro centro en `/anuncios/:id`, galería, bloque del centro, botones dependientes.
- T24-3 · Frontend: conservar la URL del catálogo para «Volver al catálogo».
- T24-4 · Contrato y QA: documentar el endpoint y automatizar E2E-1 a E2E-5.

**Decisiones pendientes**
- DP-E04-5. ¿Se muestra el teléfono o el email del centro en el detalle? Propuesta: no; el contacto va por mensajes (US-28).

---

## (2) US-25 · Guardar anuncios en favoritos

**Épica:** E04 · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** 3 · **Depende de:** US-24
**Cambios respecto al backlog original:** Se añade la entrada «Favoritos» al menú del centro y la pantalla `/favoritos`. Se concreta qué significa «deja de estar disponible».

**Historia**
Como responsable de compras de un centro, quiero guardar anuncios que me interesan, para volver a ellos más tarde sin buscarlos otra vez.
1. En una tarjeta de `/catalogo` (o en el detalle) pulso el corazón vacío; se rellena y aparece «Guardado en favoritos.».
2. En el menú del centro pulso «Favoritos» y llego a `/favoritos`, donde está el anuncio.
3. Pulso el corazón lleno y el anuncio sale de mis favoritos.

**Pantallas para el boceto**
- Corazón en la tarjeta (arriba a la derecha de la foto) y en el detalle (junto a los botones). Vacío: «Guardar en favoritos» (tooltip/aria-label); lleno, rojo: «Quitar de favoritos».
- Menú del centro (nombre ▾): «Mi perfil», **«Favoritos»** (nuevo, → `/favoritos`), «Equipo», «Ajustes», «Cerrar sesión».
- `/favoritos` · «Mis favoritos»: título, «N anuncios guardados», rejilla de tarjetas (la misma de US-96), paginación de 20. Los no disponibles con la foto en gris y la etiqueta «Ya no está disponible».

**Criterios de aceptación**

*Comportamiento*
- CA1. Al pulsar el corazón vacío se guarda el favorito; el icono cambia al momento (actualización optimista) y aparece el aviso verde «Guardado en favoritos.». Al pulsar el lleno se quita: «Quitado de favoritos.».
- CA2. Si la API falla, el icono vuelve a su estado anterior y aparece el aviso rojo «No se ha podido completar la acción. Inténtalo de nuevo.».
- CA3. Pulsar el corazón no abre el detalle.
- CA4. El estado del corazón es el mismo en catálogo, detalle y `/favoritos` (`es_favorito` de la API).
- CA5. Los anuncios propios no muestran corazón.
- CA6. `/favoritos` lista los favoritos del centro, del guardado más reciente al más antiguo, 20 por página.
- CA7. Disponibilidad en `/favoritos`: `activo` → tarjeta normal; `reservado` → etiqueta «No disponible»; `pausado`, `entregado` o con 0 unidades → foto en gris, etiqueta «Ya no está disponible» y la tarjeta **no** es un enlace; `retirado` → no se muestra (y se borra el favorito, por la retirada lógica).
- CA8. Un favorito no disponible conserva el corazón lleno para poder quitarlo.
- CA9. Si un anuncio pausado vuelve a `activo`, vuelve a verse normal en `/favoritos`.
- CA10. Los favoritos son del centro: cualquier usuario de ese centro [US-08] ve los mismos.
- CA11. Máximo 500 favoritos por centro. El 501 → aviso rojo «Has llegado al máximo de 500 favoritos. Quita alguno para guardar otro.».

*Mensajes*
- CA12. Vacío: «Todavía no has guardado ningún anuncio. Pulsa el corazón de un anuncio del catálogo para guardarlo aquí.» y botón «Ir al catálogo».

*API*
- CA13. `PUT /api/favoritos/:anuncio_id` → `204` (idempotente: guardar dos veces no da error). `DELETE /api/favoritos/:anuncio_id` → `204` (también si no estaba).
- CA14. `PUT` sobre un anuncio inexistente, no visible en el catálogo (pausado, entregado, retirado) → `404 NO_ENCONTRADO`; sobre uno propio → `400 ANUNCIO_PROPIO`, «No puedes guardar tus propios anuncios.»; al pasar de 500 → `409 LIMITE_FAVORITOS`.
- CA15. `GET /api/favoritos?pagina=N` → `200 { anuncios: [tarjeta + "disponible": true|false], pagina, por_pagina, total, total_paginas }`.
- CA16. `es_favorito` se rellena en `GET /api/catalogo` y `GET /api/catalogo/:id`.

*Datos*
- CA17. Tabla `favoritos`: `centro_id` (FK `centros`, on delete cascade), `anuncio_id` (FK `anuncios`, on delete cascade), `creado_en`; clave primaria (`centro_id`, `anuncio_id`).

*Permisos*
- CA18. Un centro solo ve y modifica sus favoritos; no hay forma de consultar los de otro.

**Flujos e2e**
- E2E-1. B pulsa el corazón de «Balones de fútbol talla 5» → corazón lleno, «Guardado en favoritos.», fila en `favoritos`. Menú → «Favoritos» → ve 1 tarjeta.
- E2E-2. A pausa el anuncio → en `/favoritos` de B aparece gris con «Ya no está disponible» y no navega. A lo reactiva → normal.
- E2E-3. B quita el favorito desde `/favoritos` → desaparece y queda «Todavía no has guardado ningún anuncio…».
- E2E-4. `PUT /api/favoritos/<anuncio propio>` → `400 ANUNCIO_PROPIO`; anuncio retirado → `404`.
- E2E-5. Con la API caída, B pulsa el corazón → vuelve a vacío y aviso rojo.

**Tareas**
- T25-1 · Base de datos: migración de `favoritos`.
- T25-2 · Backend: `PUT`/`DELETE`/`GET /api/favoritos`, `es_favorito` en el catálogo y tests.
- T25-3 · Frontend: corazón en tarjeta y detalle, menú «Favoritos», pantalla `/favoritos`.
- T25-4 · QA: automatizar E2E-1 a E2E-5.

---

## (3) US-26 · Guardar una búsqueda con sus filtros

**Épica:** E04 · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** 6 · **Depende de:** US-21, US-22
**Cambios respecto al backlog original:** Depende también de US-21 (se guarda el texto de búsqueda). Se define la pantalla `/busquedas` y los límites.

**Historia**
Como responsable de compras de un centro, quiero guardar una búsqueda con sus filtros, para repetirla con un clic sin volver a configurarla.
1. En `/catalogo?q=balon&deporte=baloncesto` pulso «Guardar búsqueda».
2. En el diálogo escribo «Balones de basket» y pulso «Guardar»; aparece «Búsqueda guardada.».
3. Otro día, en el menú del centro pulso «Búsquedas guardadas», llego a `/busquedas` y pulso «Abrir» en «Balones de basket».
4. Llego a `/catalogo?q=balon&deporte=baloncesto` con los resultados actuales.

**Pantallas para el boceto**
- `/catalogo`: botón secundario «Guardar búsqueda» en la línea de resultados, a la izquierda del selector de orden.
- Diálogo «Guardar búsqueda»: campo «Nombre» (precargado con el texto de búsqueda, o vacío), resumen de los criterios («Texto: balon · Deporte: Baloncesto»), botones «Guardar» y «Cancelar».
- Menú del centro: añade «Búsquedas guardadas» (→ `/busquedas`) después de «Favoritos».
- `/busquedas` · «Búsquedas guardadas»: lista con una fila por búsqueda: nombre (negrita), resumen de criterios, «Guardada el dd/mm/aaaa», interruptor «Avisos» (US-76), botones «Abrir» y «Borrar».

**Criterios de aceptación**

*Campos y validación*
- CA1. «Nombre»: obligatorio, 1-60 caracteres tras quitar espacios. Vacío → «Escribe un nombre para la búsqueda.»; 61 → «El nombre puede tener como máximo 60 caracteres.».
- CA2. Nombre único por centro sin distinguir mayúsculas ni acentos: repetido → «Ya tienes una búsqueda con este nombre.».

*Comportamiento*
- CA3. «Guardar búsqueda» está deshabilitado si no hay texto ni ningún filtro (tooltip «Busca o filtra algo para poder guardarlo.»).
- CA4. Se guardan `q`, `categoria`, `deporte`, `estado_material`, `precio_min`, `precio_max`, `modalidad`, `distancia_max` y `orden`. No se guardan `pagina` ni `vista`.
- CA5. Si ya existe una búsqueda con exactamente los mismos criterios, el diálogo lo indica: «Ya tienes guardada esta búsqueda como «X».» y no deja guardar.
- CA6. Máximo 20 búsquedas por centro. Con 20, el botón muestra al pulsarlo el aviso rojo «Has llegado al máximo de 20 búsquedas guardadas. Borra alguna para guardar otra.».
- CA7. Mientras se guarda: «Guardando…». Al terminar, se cierra el diálogo y aviso verde «Búsqueda guardada.».
- CA8. `/busquedas` lista las búsquedas de la más reciente a la más antigua, sin paginación (máximo 20).
- CA9. «Abrir» lleva a `/catalogo` con los parámetros guardados (resultados actuales, no los del día en que se guardó).
- CA10. «Borrar» abre el diálogo «¿Borrar la búsqueda «X»?», texto «Dejarás de recibir sus avisos. Esta acción no se puede deshacer.», botones «Borrar» y «Cancelar». Al confirmar: aviso verde «Búsqueda borrada.» y desaparece la fila.
- CA11. Si un criterio guardado ya no es válido (por ejemplo, el centro quitó su ubicación y hay `distancia_max`), «Abrir» carga sin ese criterio (regla de la web de la base común).

*Mensajes*
- CA12. `/busquedas` vacía: «No tienes búsquedas guardadas. En el catálogo, busca o filtra y pulsa «Guardar búsqueda».» y botón «Ir al catálogo».

*API*
- CA13. `POST /api/busquedas` `{ "nombre": "…", "filtros": { "q": "balon", "deporte": "baloncesto" } }` → `201` con la búsqueda. `filtros` se valida con las mismas reglas que `GET /api/catalogo` (`400 DATOS_INVALIDOS`, `details["filtros.deporte"]`…); `filtros` vacío → `400`, `details.filtros` = «Busca o filtra algo para poder guardarlo.».
- CA14. Nombre repetido → `409 NOMBRE_REPETIDO`; criterios repetidos → `409 BUSQUEDA_REPETIDA`; más de 20 → `409 LIMITE_BUSQUEDAS`.
- CA15. `GET /api/busquedas` → `200 { busquedas: [{ id, nombre, filtros, avisos_activos, creado_en }] }`.
- CA16. `DELETE /api/busquedas/:id` → `204`; de otro centro o inexistente → `404 NO_ENCONTRADO`.

*Datos*
- CA17. Tabla `busquedas_guardadas`: `id` uuid, `centro_id` FK (cascade), `nombre` (1-60), `filtros` jsonb normalizado (claves ordenadas, sin valores por defecto, `estado_material` ordenado), `avisos_activos` boolean (US-76), `creado_en`. Índices únicos (`centro_id`, `lower(unaccent(nombre))`) y (`centro_id`, `filtros`).

**Flujos e2e**
- E2E-1. B en `/catalogo?q=balon&deporte=baloncesto` → «Guardar búsqueda» → nombre «Balones de basket» → «Guardar» → «Búsqueda guardada.». En `/busquedas` ve la fila con «Texto: balon · Deporte: Baloncesto». «Abrir» → `/catalogo?q=balon&deporte=baloncesto`.
- E2E-2. B intenta guardar otra vez lo mismo → «Ya tienes guardada esta búsqueda como «Balones de basket».».
- E2E-3. Nombre «balones DE básket» con otros filtros → «Ya tienes una búsqueda con este nombre.».
- E2E-4. Con 20 guardadas → aviso del máximo; API `409 LIMITE_BUSQUEDAS`.
- E2E-5. B borra «Balones de basket» → diálogo → «Borrar» → «Búsqueda borrada.»; A llama a `DELETE /api/busquedas/<id de B>` → `404`.

**Tareas**
- T26-1 · Base de datos: migración de `busquedas_guardadas`.
- T26-2 · Backend: `POST`/`GET`/`DELETE /api/busquedas`, normalización de filtros (reutiliza el validador del catálogo) y tests.
- T26-3 · Frontend: botón y diálogo en `/catalogo`, menú, pantalla `/busquedas`, diálogo de borrado.
- T26-4 · QA: automatizar E2E-1 a E2E-5.

---

## (3) US-76 · Recibir un aviso cuando se publique un anuncio que cumple una búsqueda guardada

**Épica:** E04 · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** 6 · **Depende de:** US-26, US-47
**Cambios respecto al backlog original:** Se concreta cuándo se dispara el aviso, su texto y cómo se evita repetirlo. El aviso por email queda en US-48.

**Historia**
Como responsable de compras de un centro, quiero que se me avise cuando alguien publique algo que encaja con una búsqueda guardada, para enterarme sin volver a mirar el catálogo.
1. En `/busquedas` dejo activado el interruptor «Avisos» de «Balones de basket».
2. Otro centro publica «Balón de baloncesto Molten talla 7».
3. En la cabecera, la campana muestra un aviso nuevo: «Nuevo anuncio para tu búsqueda «Balones de basket»: Balón de baloncesto Molten talla 7».
4. Lo pulso y llego a `/anuncios/<id>`.

**Pantallas para el boceto**
- `/busquedas`: en cada fila, interruptor «Avisos» (activado/desactivado).
- Lista de avisos de la campana (US-47): el aviso con su texto y fecha.

**Criterios de aceptación**

*Comportamiento*
- CA1. Al guardar una búsqueda nueva, `avisos_activos` es `true`.
- CA2. El interruptor cambia el valor al momento; aviso verde «Avisos activados.» / «Avisos desactivados.»; si falla, vuelve a su posición y aviso rojo de la guía.
- CA3. Se comprueba un anuncio cuando pasa a `activo` por primera vez (publicación, US-12). No al reactivarlo tras una pausa ni al editarlo (DP-E04-6).
- CA4. Un anuncio cumple una búsqueda si cumple todos sus filtros con las mismas reglas del catálogo (US-21, US-22, US-73, US-74 y, con `distancia_max`, US-75 usando la ubicación del centro que guardó la búsqueda; si ese centro no tiene ubicación, la búsqueda no se cumple). `orden` no influye.
- CA5. No se avisa a la búsqueda del propio centro que publica.
- CA6. Como mucho un aviso por (búsqueda, anuncio). Si un anuncio cumple dos búsquedas del mismo centro, se crean dos avisos (uno por búsqueda).
- CA7. Texto exacto: «Nuevo anuncio para tu búsqueda «<nombre>»: <título del anuncio>». Enlace: `/anuncios/<id>`. Tipo: `busqueda_guardada`.
- CA8. Si cuando se abre el aviso el anuncio ya no está visible, se ve el mensaje de US-24 CA5.
- CA9. La comprobación no retrasa la publicación: se hace después de responder al `POST /api/anuncios` (tarea en segundo plano o tras el commit); si falla, se registra el error y la publicación no se ve afectada.
- CA10. El email de este aviso se envía solo si el centro lo activa en sus preferencias [Depende de US-48].

*API*
- CA11. `PATCH /api/busquedas/:id` `{ "avisos_activos": true|false }` → `200` con la búsqueda. Otro tipo o falta → `400 DATOS_INVALIDOS`, `details.avisos_activos` = «Indica true o false.». De otro centro → `404 NO_ENCONTRADO`.

*Datos*
- CA12. Tabla `avisos_busqueda_enviados` (`busqueda_id`, `anuncio_id`, `creado_en`, clave primaria compuesta) para garantizar CA6. El aviso se crea en la tabla de avisos de US-47.

**Flujos e2e**
- E2E-1. B tiene «Balones de basket» (`q=balon`, `deporte=baloncesto`) con avisos. A publica «Balón de baloncesto Molten talla 7» (Balones/Baloncesto) → B tiene 1 aviso con el texto de CA7; lo pulsa → detalle.
- E2E-2. A publica «Balón de fútbol» (Fútbol) → B no recibe nada.
- E2E-3. B desactiva los avisos → A publica otro balón de baloncesto → nada. Los reactiva → el siguiente sí avisa.
- E2E-4. A pausa y reactiva el anuncio de E2E-1 → no hay aviso nuevo.
- E2E-5. B publica un balón de baloncesto propio → no recibe aviso.
- E2E-6. B con `distancia_max=25` en Barcelona; A en Girona (85 km) publica algo que cumple el resto → sin aviso.

**Tareas**
- T76-1 · Base de datos: `avisos_busqueda_enviados`.
- T76-2 · Backend: `PATCH /api/busquedas/:id`, comprobador de búsquedas tras publicar (reutiliza el constructor de consultas del catálogo) y tests.
- T76-3 · Frontend: interruptor «Avisos» en `/busquedas`.
- T76-4 · QA: automatizar E2E-1 a E2E-6.

**Decisiones pendientes**
- DP-E04-6. ¿Avisar también cuando un anuncio se reactiva o se edita y pasa a cumplir? Propuesta: no; solo en la primera publicación.
- DP-E04-7. ¿Limitar avisos por búsqueda y día? Propuesta: sin límite en este sprint; si hay más de 10 en un día, se revisa.

---

## (5) US-27 · Ver los anuncios en un mapa

**Épica:** E04 · **Prioridad:** Could · **Puntos:** 5 · **Sprint:** 6 · **Depende de:** US-96, US-68
**Cambios respecto al backlog original:** El mapa es otra vista del mismo catálogo (con la misma búsqueda y filtros), no una pantalla aparte. Se agrupan los anuncios por centro.

**Historia**
Como responsable de un centro, quiero ver en un mapa dónde está el material que me interesa, para localizar de un vistazo lo que tengo cerca.
1. En `/catalogo` pulso «Mapa» en el selector «Lista | Mapa».
2. La URL pasa a `/catalogo?vista=mapa` y veo un mapa con un marcador por cada centro que tiene anuncios que cumplen mi búsqueda, con el número de anuncios.
3. Pulso un marcador y se abre una ventana con el nombre del centro y sus anuncios.
4. Pulso un título y llego a `/anuncios/<id>`.

**Pantallas para el boceto**
- `/catalogo`, línea de resultados: selector «Lista» · «Mapa» a la derecha del orden.
- Vista mapa: búsqueda y filtros arriba (iguales); debajo, mapa de 600 px de alto (70 % de la altura de la pantalla en móvil). Marcador azul con un número (anuncios del centro) por centro; mi centro, marcador verde con el texto «Tu centro» y sin número.
- Ventana del marcador: nombre del centro, localidad, distancia (US-23), y lista de sus anuncios (miniatura, título con enlace y precio o «Gratis · Donación»; «No disponible» si reservado), con scroll si hay más de 5.
- Bajo el mapa, si procede: «N anuncios no aparecen en el mapa porque su centro no ha indicado la ubicación.» con el enlace «Ver en la lista».

**Criterios de aceptación**

*Comportamiento*
- CA1. El mapa usa Leaflet 1.9.4 (cdnjs o npm) con teselas de OpenStreetMap y la atribución «© OpenStreetMap contributors».
- CA2. El mapa muestra los anuncios que cumplen la búsqueda y los filtros activos, sin paginación, hasta 500 anuncios. Si hay más, aviso encima del mapa: «Se muestran los 500 anuncios más recientes. Usa los filtros para afinar.».
- CA3. Un marcador por centro en sus `latitud`/`longitud` (US-68), con el número de anuncios de ese centro que cumplen.
- CA4. Encuadre inicial: todos los marcadores visibles (`fitBounds` con margen); con un solo marcador, zoom 13 centrado en él; sin marcadores, España peninsular (centro 40.4, -3.7, zoom 6) y el mensaje vacío de la búsqueda/filtros.
- CA5. Si mi centro tiene ubicación, se muestra su marcador verde «Tu centro» (sin ventana de anuncios).
- CA6. Cambiar búsqueda o filtros en la vista mapa actualiza los marcadores; `pagina` no se usa y `orden` no influye.
- CA7. Volver a «Lista» quita `vista` de la URL y conserva búsqueda y filtros.
- CA8. Los anuncios de centros sin ubicación no se dibujan y se cuentan en el texto bajo el mapa.
- CA9. El mapa se puede mover y ampliar con ratón, dedos y los botones «+»/«−».

*Mensajes*
- CA10. Mientras carga: «Cargando…» sobre el mapa. Error: «No se ha podido cargar. » y «Reintentar». Si fallan las teselas, se ve el mapa gris sin bloquear el resto.

*API*
- CA12. `GET /api/catalogo/mapa` con los mismos parámetros que `GET /api/catalogo` (excepto `pagina`; `orden` se ignora) → `200`:
  ```json
  {
    "centros": [{
      "id": "uuid", "nombre": "CE Montjuïc", "localidad": "Barcelona",
      "latitud": 41.3634, "longitud": 2.1589, "distancia_km": 3.1,
      "anuncios": [{ "id": "uuid", "titulo": "…", "modalidad": "venta",
                     "precio_unitario_centimos": 1250, "estado": "activo",
                     "foto_principal_url": "…" }]
    }],
    "mi_centro": { "latitud": 41.38, "longitud": 2.17 },
    "sin_ubicacion": 3, "total": 42, "truncado": false
  }
  ```
  `mi_centro` es `null` si no hay ubicación. Errores de parámetros iguales que el catálogo.
- CA13. En esta respuesta sí se devuelven las coordenadas de los centros con anuncios visibles (son centros deportivos y la ubicación ya es pública por US-68 «los demás ven en qué zona está mi centro»), redondeadas a 3 decimales (~100 m). Ver DP-E04-8.

**Flujos e2e**
- E2E-1. Datos de US-23 E2E-1, con 2 anuncios de C y 1 de A. B pulsa «Mapa» → marcadores C «2», A «1», D «1», su marcador verde, y «1 anuncio no aparece en el mapa…» (E). (Singular: «1 anuncio no aparece en el mapa porque su centro no ha indicado la ubicación.»)
- E2E-2. B pulsa el marcador C → ventana con 2 anuncios; pulsa uno → `/anuncios/<id>`; «Atrás» → vuelve a `?vista=mapa`.
- E2E-3. B elige Deporte «Natación» sin anuncios → mapa de España y «No hay anuncios con estos filtros.».
- E2E-4. B pulsa «Lista» → `/catalogo` con los mismos filtros y paginación.

**Tareas**
- T27-1 · Backend: `GET /api/catalogo/mapa` (agrupado por centro, límite 500) y tests.
- T27-2 · Frontend: selector Lista/Mapa, integración de Leaflet, marcadores con número, ventana, texto de sin ubicación.
- T27-3 · QA: automatizar E2E-1 a E2E-4 (el mapa se comprueba por los datos de los marcadores, no por imagen).

**Decisiones pendientes**
- DP-E04-8. ¿Precisión de la ubicación en el mapa? Propuesta: coordenadas redondeadas a 3 decimales (~100 m); si US-68 solo guarda código postal, el centroide del código postal.
