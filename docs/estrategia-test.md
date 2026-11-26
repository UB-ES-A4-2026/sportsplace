# Estrategia de verificación y test

Tarea #350. Qué probamos, en qué nivel, por qué y cómo lo medimos. Todas las cifras
salen de `dev` en 9a8bd04 (18/11/2026, fin del Sprint 2) y se pueden repetir con el
comando que acompaña a cada una.

## Principios

1. **Cada CA tiene al menos un test que lo nombra** (`US-XX CAn`), en el nivel más
   bajo que lo pueda comprobar. El E2E (`e2e/tests/us-XX-*.spec.js`, un archivo por
   historia y casos titulados `US-XX · CAn`) queda para lo que solo se ve de punta a
   punta. Desde #285, lo que se comprueba sin navegador va a unitarios: un E2E por CA
   chocaría con el objetivo de CI ≤ 7 min (Playwright va a ≈1 s por caso con 1 worker).
2. **La regla de negocio se prueba donde vive.** Validaciones, transiciones de estado
   de anuncios y pedidos, y permisos se prueban con unitarios en el backend; el
   esquema y los índices, con SQL contra PostgreSQL real.
3. **Nada entra en `dev` sin CI 5/5 y revisión.** La protección de ramas exige los
   cinco jobs y la aprobación de otra persona en `story/*`, `dev`, `staging` y `main`.
4. **Lo desplegado se comprueba.** Tras cada despliegue de `staging` en Render, el
   smoke confirma que se sirve el commit esperado.

## Niveles

| Nivel | Qué verifica | Dónde | Herramienta | Cuándo |
|---|---|---|---|---|
| Unitarios backend | Validación, servicios, transiciones de estado, rutas con dobles de la base | `backend/test` (49 archivos) | `node --test` | Cada push y PR (job Backend) |
| Integración API | Rutas Express completas: autenticación, códigos HTTP, contrato de `docs/api-contrato.md` | `backend/test/*-api.test.js` | `node --test` con la API arrancada (`startApi` de `helpers.js`) | Cada push y PR |
| Unitarios frontend | Lógica de cliente: llamadas a la API, formularios, formato de precios y fechas | `frontend/src/**/*.test.*` (38 archivos) | `node --test` | Cada push y PR (job Frontend) |
| Migraciones | Orden, idempotencia y errores de las migraciones | `tools/test` | `node --test` | Cada push y PR (job Herramientas) |
| SQL | Restricciones, RLS, índices del catálogo (US-21 CA21) | `supabase/tests/*.sql` (10 archivos) | `psql` en Supabase local | Job E2E |
| E2E de los CA | Cada CA de cada historia en el navegador, con API y base reales aisladas | `e2e/tests` (28 historias + infraestructura) | Playwright (Chromium) | Job E2E |
| Imagen de despliegue | La imagen de Render arranca y sirve web, rutas SPA y API por el mismo origen | `Dockerfile`, `tools/scripts/check-deployment.js` | Docker | Job Imagen |
| Smoke | `/api/health` de Render devuelve el commit de `staging` | `.github/workflows/smoke-render.yml` | GitHub Actions | Tras cada push a `staging` |
| QA manual | Recorrido de los CA por la persona de QA antes de `story → dev`, con evidencia en la issue | Issue de la historia | Checklist de CA | Antes de cada PR a `dev` |

Lint con ESLint en backend, frontend, herramientas y e2e (`npm run lint` en cada job; un error para el CI).

## Métricas (fin del Sprint 2)

| Métrica | Valor | Cómo se obtiene |
|---|---|---|
| Tests unitarios + integración backend | 545, 0 fallos, 19 s | `npm --prefix backend test` |
| Cobertura backend (líneas / ramas / funciones) | 99,3 % / 95,5 % / 97,3 % | `npm --prefix backend run test:cobertura` |
| Tests frontend | 470, 0 fallos, 4 s | `npm --prefix frontend test` |
| Cobertura frontend de la lógica (44 de 112 archivos, sin los de test) | 97,3 % / 95,2 % / 96,9 % | `npm --prefix frontend run test:cobertura` |
| Tests de migraciones | 23, 0 fallos (cobertura 49,8 % de líneas) | `npm --prefix tools test` |
| Pruebas SQL | 10 archivos, todas con `ROLLBACK` | `npm --prefix tools run test-env:sql` |
| E2E de los CA | 297 en verde, 6 omitidos, 0 fallos (≈5 min) | Job E2E del CI |
| Historias con E2E | 28 archivos de historia | `ls e2e/tests/us-*.spec.js` |
| CA con algún test que los nombra | S2: 81,4 % de 274 CA de las historias cerradas (S1: 74,6 %) | Títulos de los tests de `dev` con `US-XX CAn` frente a `docs/especificacion/`; medido por Asier en la revisión de #351 |
| CA con E2E | S2: 53,3 % (S1: 34,4 %) | Igual, solo en `e2e/tests` |
| Tests inestables | 5 casos E2E que solo pasaron al reintentar; «US-13 CA16» (backend) falló dos veces sin cambios de código (push a `staging` del 04/11 y a `dev` del 16/11, el único de los 16 rojos fuera de una PR) | Registros del CI; medido por Asier |
| Duración del CI completo | 5,8 min de mediana en el S2 (las colas largas de GitHub no cuentan como tiempo de prueba) | `gh run list --workflow CI` |
| Ejecuciones del CI en el S2 | 159; 143 en verde, 16 en rojo que pararon la PR | `gh run list --workflow CI --created ">=2026-11-04"` |
| PRs fusionadas en el S2 | 83; 82 con revisión aprobada (la otra integraba una rama de tarea) y 0 con CI en rojo | `gh pr list --state merged --search "merged:>=2026-11-04"` |
| Defectos abiertos como issue `bug` | 5 en total, 1 en el S2 (#331, privacidad, detectado en la QA de US-32 y US-33); 0 abiertos | `gh issue list --label bug --state all` |

### Lo que la cobertura no dice

- El informe de Node solo cuenta los archivos que cargan los tests. En el frontend
  son los módulos de lógica; los componentes `.jsx` no se cargan con
  `node --test` y se verifican con los E2E de sus CA. Los propios archivos de test
  (`*.test.js` y `*.test.jsx`) se excluyen con `--test-coverage-exclude` para no
  inflar la cifra.
- La cobertura de `tools` es baja porque `e2e-environment.js` maneja Docker y se
  ejecuta de verdad en el job E2E en cada CI, no con unitarios.
- Los 6 E2E omitidos no son todos de funciones que faltan:
  - US-28 CA35 depende de US-11 (la baja de centros), que aún no existe.
  - US-04 CA10 es un `test.fixme`.
  - US-32 CA16, US-33 CA7, US-108 CA11 y US-109 CA14 se saltan con «El centro sin
    confirmar no obtiene token en este entorno»: el 403 `EMAIL_NO_CONFIRMADO` nunca
    se comprueba de punta a punta en el CI. Es deuda del entorno de pruebas, no de
    funcionalidad, y la lleva DevOps en el S3.

## Umbral de cobertura en el CI

Desde esta tarea, los jobs Backend y Frontend ejecutan los tests con
`npm run test:cobertura`, que añade a `node` las opciones
`--experimental-test-coverage --test-coverage-lines=95 --test-coverage-branches=90
--test-coverage-functions=95` antes de `--test`. No sirve `npm test -- <opciones>`:
en el frontend npm las pone detrás de los archivos y Node no las aplica (los tests
pasan, pero no se mide la cobertura ni se comprueba el umbral).

Si una PR baja la cobertura de esos umbrales, el job falla y no se puede fusionar.
Los umbrales quedan unos puntos por debajo del valor actual para no bloquear
refactorizaciones; se suben cuando la cifra real se mantenga por encima.

## Prioridad por riesgo: informe de QA y matriz de riesgo del Sprint 2

Más pruebas donde un fallo hace más daño. Informe de QA de Lucía; las cifras de
tests y cobertura son las de las métricas de arriba (`dev` 9a8bd04, 18/11).
### 1. Qué ha hecho QA en el S2

| Tipo | Trabajo |
|---|---|
| QA de historia (E2E y API) | US-24 (#283, 13 casos) · US-10 (#291, 9 casos) · US-42 y US-80 (T42-3, 19 casos, en curso; ver #249) |
| Validación para entrar en `dev` | US-10 (#294) · US-32 (#329); revisión de las integraciones #288, #290, #305, #307 y #308 |
| Revisión de los tests de otros | #277 y #300 (US-28) · #322 (US-21) · #326 (US-32) · #327 y #328 (US-33) |
| Eficiencia del CI | #285: `vite preview` en lugar de `vite dev` y unos 75 casos duplicados fuera sin perder ningún CA. Paso de E2E de 173 s a 102 s (−41 %) |
| Robustez | #316 y #321: US-21 y US-28 dejan de omitir E2E por detección de pieza |

Regla de QA para quitar un caso E2E: solo si su CA queda cubierto en otro test (#285).

### 2. Hallazgos de QA

| # | Hallazgo | Estado |
|---|---|---|
| 1 | US-10 CA1 sin implementar (el nombre del centro no enlazaba al perfil) | Resuelto (#293) |
| 2 | Las omisiones por detección de pieza (`test.skip`) esconden fallos: con una pieza rota el caso se omite y el CI queda en verde | Quitadas en US-21 y US-28. **Siguen en el código** de US-32, 33, 34, 35, 40, 79, 108 y 109: hoy se ejecutan porque las piezas ya están en `dev`, pero no fallarían si la pieza se rompe |
| 3 | E2E-4 «limpiar» de US-21 intermitente | Test arreglado (#322). Queda una condición de carrera en la app (`corregirPagina`), para el S3 |
| 4 | Privacidad: en un pedido aceptado o recibido se mostraba el **email de acceso** si el centro no tenía email de contacto | Resuelto (#331) |
| 5 | Teléfono con +34: el perfil lo admite y el pedido lo rechazaba | Resuelto (#346) |
| 6 | US-42 CA9: «Recibido» en gris (E07) frente a azul (E06 y código) | Abierto, decide la PO |
| 7 | US-79: el 409 de la rama defensiva de `rechazar` devuelve un `estado_actual` desactualizado | Abierto, no bloquea |
| 8 | US-24 CA5: «Volver a mis anuncios» en la pantalla «no disponible» | Pendiente de decisión |
| 9 | El 403 `EMAIL_NO_CONFIRMADO` no se prueba de punta a punta (el centro sin confirmar no obtiene token en el entorno E2E) | Deuda del entorno, DevOps en el S3 |

### 3. Matriz de riesgo

**Impacto:** A = dinero, privacidad o seguridad · M = flujo principal · B = cosmético o validación.
**Probabilidad de regresión en el S3:** cuánto código del siguiente sprint toca esa zona.

| Zona | Impacto | Prob. | Riesgo | Cómo se cubre y qué falta |
|---|---|---|---|---|
| Pedidos: US-32, 33, 34, 35, 40, 42, 79, 80, 108, 109 | A | A | 🔴 Crítico | Todo se mantiene: unitarios de transiciones, SQL, E2E de cada CA. Falta quitar las omisiones por detección (hallazgo 2) y cobrar/recibir con concurrencia forzada en E2E (T42-3) |
| Datos personales en pedidos y perfil | A | M | 🔴 Crítico | Unitarios de lo que devuelve la API a cada centro y E2E (hallazgo 4 resuelto). Falta la comprobación del 403 sin confirmar de punta a punta |
| Conversaciones: US-28 y US-77 (privacidad) | A | A | 🔴 Crítico | Mantener todo; E2E de concurrencia con choque forzado (#328) |
| Estados del anuncio: US-16, 17, 70 | M-A | A | 🔴 Crítico | Mantener los E2E (transiciones, 409 y concurrencia) |
| Catálogo y detalle: US-21, 24, 10 | M | A | 🟠 Alto | E2E y API de visibilidad y privacidad; arreglar `corregirPagina` |
| Infraestructura y `api-fotos-storage` | A | B | 🟠 Alto (barato) | Smoke y E2E |
| Publicar, editar y mis anuncios: US-12, 13, 15, 18 | M | M | 🟡 Medio | E2E-1 y casos de otro centro; validaciones 400 en backend |
| Recuperar contraseña: US-04 | A | B | 🟡 Medio | Estable desde el S1; mantener E2E-1, E2E-3, E2E-5, CA14 y CA23. US-04 CA10 es un `test.fixme` |
| Perfil, ubicación y modalidad: US-07, 14, 68 | B-M | B | 🟢 Bajo | Validaciones en backend; E2E solo del flujo principal y de la privacidad (US-68 CA14) |

### 4. Qué se ha hecho del plan de CI del 12/11 y qué queda

| Medida | Estado |
|---|---|
| Servir el build (`vite preview`) en Playwright | Hecho (#285) |
| Quitar los E2E duplicados de validaciones (400) | Hecho en los casos con CA cubierto en backend (#285) |
| E2E selectivo en las PR de tarea (solo la spec de la US) | Por confirmar con DevOps |
| Login por API con `storageState` | Pendiente |
| `workers: 2` con datos aislados | Descartado hasta el S3 (límite de 30 mensajes/min y semilla compartida: riesgo de intermitentes) |

### 5. Para el S3 (QA)

1. 0 omitidos en el job E2E de `dev` (quitar los `test.skip` por detección y cerrar la deuda del 403 sin confirmar).
2. Cada CA nuevo con un test que lo nombre; lista de CA sin test revisada en cada validación de QA.
3. Los CA que dependen de otras historias (US-39, 41, 43, 83, 115) se marcan al entrar esas historias; `Closes #n` no debe cerrar una historia con CA sin marcar.
4. Casos que solo pasan al reintentar: cada uno, una issue. El job E2E los lista en su resumen, junto con los omitidos y su motivo (`e2e/resumen-ci.js`, #389).

## Objetivos medibles del Sprint 3

| Objetivo | Medida | Responsable del seguimiento |
|---|---|---|
| Mantener la cobertura | Backend y frontend por encima del umbral en cada PR (el CI lo garantiza) | Todo el equipo |
| E2E sin omitidos | 0 omitidos en el job E2E de `dev` | QA |
| CI rápido | Mediana ≤ 7 min en `dev` | DevOps |
| Cada CA nuevo con su test | 100 % de los CA de las historias del S3 con un test que los nombre (`US-XX CAn`) | Autor de cada historia, lo comprueba quien revisa |
| CA sin test, a la vista | % de CA con test por historia y lista de los que ningún test nombra, revisada en cada QA (la publica el job «Herramientas» en el resumen de cada PR: `npm --prefix tools run ca:matriz`, #390) | QA |
| Tests inestables | 0 casos que solo pasen al reintentar; cada uno se abre como issue y se arregla en el sprint | DevOps |
| Rendimiento de la búsqueda (US-21) | Respuesta del catálogo medida con la semilla ampliada | Backend |
| Smoke tras cada despliegue | 100 % de los despliegues de `staging` y `main` con smoke en verde | DevOps |
