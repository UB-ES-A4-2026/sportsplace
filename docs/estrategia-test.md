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

## Prioridad por riesgo

Más pruebas donde un fallo hace más daño. Versión inicial; se completa con el
informe de QA y la matriz de riesgo de Lucía.

| Área | Impacto si falla | Probabilidad | Cómo se cubre |
|---|---|---|---|
| Pedidos: reserva de unidades, aceptar/rechazar (US-32, US-33, US-34, US-79) | Alto: material reservado dos veces o perdido | Media: concurrencia y estados | Unitarios de transiciones, SQL de `pedidos`, E2E de cada CA |
| Datos personales en pedidos y perfil (US-40, US-108) | Alto: privacidad | Media | Unitarios de lo que devuelve la API a cada centro, E2E; #331 |
| Registro, sesión y recuperación (US-01–US-04) | Alto: nadie entra | Baja: estable desde el S1 | Unitarios de auth, E2E, smoke |
| Publicar y editar anuncios (US-12–US-18) | Medio | Baja | Validación en backend y frontend, E2E |
| Búsqueda y filtros (US-21, US-22, US-73, US-74) | Medio: rendimiento | Media con muchos anuncios | SQL de índices, unitarios de filtros, E2E |
| Mensajes (US-28) | Medio | Baja | Unitarios de conversaciones, E2E |

## Objetivos medibles del Sprint 3

| Objetivo | Medida | Responsable del seguimiento |
|---|---|---|
| Mantener la cobertura | Backend y frontend por encima del umbral en cada PR (el CI lo garantiza) | Todo el equipo |
| E2E sin omitidos | 0 omitidos en el job E2E de `dev` | QA |
| CI rápido | Mediana ≤ 7 min en `dev` | DevOps |
| Cada CA nuevo con su test | 100 % de los CA de las historias del S3 con un test que los nombre (`US-XX CAn`) | Autor de cada historia, lo comprueba quien revisa |
| CA sin test, a la vista | % de CA con test por historia y lista de los que ningún test nombra, revisada en cada QA | QA |
| Tests inestables | 0 casos que solo pasen al reintentar; cada uno se abre como issue y se arregla en el sprint | DevOps |
| Rendimiento de la búsqueda (US-21) | Respuesta del catálogo medida con la semilla ampliada | Backend |
| Smoke tras cada despliegue | 100 % de los despliegues de `staging` y `main` con smoke en verde | DevOps |
