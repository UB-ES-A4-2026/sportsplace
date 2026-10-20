# Sprint 0: comprobación DevOps de Carlos

Fecha: **20/10/2026**. Ejecución técnica por el agente en el ordenador Windows de Carlos. Alcance: integraciones autorizadas, protección, entorno, configuración y evidencia de infraestructura. No sustituye las confirmaciones personales del equipo ni la validación QA de Asier.

Versión de aplicación probada: `story/US-01-registro` @ `e75568797a1aaa27394971946ac651adb48eb114`. La documentación se prepara desde `docs/TR-02-validacion-sprint0`, creada desde la historia; no se programa directamente en `main`, `dev` ni `story/*`.

## Integraciones verificadas

| PR | Revisión y CI antes de fusionar | Resultado |
|---|---|---|
| [#28: API de registro](https://github.com/UB-ES-A4-2026/sportsplace/pull/28) | Aprobación vigente de Asier en `d21d733`; tres jobs correctos en [CI 39427156558](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/39427156558); sin conflictos ni conversaciones pendientes. #12 ya estaba integrada. | **Create a merge commit**, por la instrucción específica para #28: `6919708`, con padres `bc64a43` y `d21d733`. Se conserva el historial. |
| [#30: estructura web](https://github.com/UB-ES-A4-2026/sportsplace/pull/30) | Actualizada mediante **Update branch**, sin reescribir el historial: `fd8ac5d`, con padres `c739fa7` y `6919708`. GitHub mantuvo la aprobación vigente de Alex en la versión actualizada. Tres jobs correctos en [CI 39438025827](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/39438025827); sin conflictos ni conversaciones pendientes. | **Squash and merge**, según el flujo general de tareas: `e755687`, padre `6919708`. |

Ambas PR se fusionaron hacia `story/US-01-registro`, en ese orden. No se borraron ramas ni se usó bypass. La excepción de merge commit de #28 no cambia la regla general de squash para las demás tareas.

## Protección de ramas

Verificada y ajustada mediante la API de GitHub con el acceso administrativo existente de Carlos. No había rulesets adicionales. La regla de historias coincide exactamente con **`story/*`**, no con `story`.

| Protección | `main` | `dev` | `story/*` |
|---|---|---|---|
| PR y una aprobación ajena obligatorias | Sí | Sí | Sí |
| Invalidar aprobaciones si cambia el contenido revisado | Sí | Sí | Sí |
| Tres checks obligatorios, vinculados a GitHub Actions | Sí | Sí | Sí |
| Exigir rama actualizada antes de fusionar | Conservado: sí | Conservado: sí | Desactivado |
| Aplicar a administradores | Sí | Sí | Sí |
| Force push / eliminación | No permitidos | No permitidos | No permitidos |
| Conversaciones resueltas obligatorias en la regla | Conservado: sí | Conservado: sí | Conservado: no; se comprobaron manualmente antes de ambas fusiones |

Los checks no estaban configurados como obligatorios; se añadieron usando los nombres y la aplicación de los checks reales, sin desactivar ninguno:

- `Backend (lint y tests)`.
- `Frontend (lint y build)`.
- `Herramientas de migración (lint y tests)`.

El ajuste de actualización no garantiza conservar una aprobación. Si GitHub la invalida tras un cambio, se necesita revisión nueva; no se descarta ni se sustituye por una aprobación del agente.

## Pruebas automatizadas locales

Docker Engine **29.5.2**, Compose **5.1.4**, contenedores Linux con Node.js **24.21.0**. Docker Desktop se arrancó antes de validar. Se conservaron `.env`, certificados y volúmenes existentes.

| Operación | Resultado |
|---|---|
| `docker compose config --quiet` | Correcto; no se imprimió la configuración privada. |
| `docker compose up --build --detach --wait` | Construcción y arranque correctos. |
| `docker compose ps` | Backend y frontend `healthy`, puertos 3000/5173 solo en `127.0.0.1`. |
| `docker compose exec -T backend npm run lint` | Correcto. |
| `docker compose exec -T backend npm test` | **40/40**; Auth usa dobles, no prueba entrega de correo. |
| `docker compose exec -T frontend npm run lint` | Correcto. |
| `docker compose exec -T frontend npm run build` | Correcto, Vite 8.3.3. |
| Tools en contenedor temporal, copia de solo lectura del código: `npm ci`, `npm run lint`, `npm test` | Correcto, **6/6**; sin ejecutar migraciones ni montar `.env`. Comando reproducible en el README. |

No existe `package.json` en la raíz ni se ha supuesto un `npm test` global. El CI de la PR de documentación se consulta aparte: las pruebas locales no lo sustituyen.

## Comprobaciones funcionales y de configuración

| Comprobación real | Resultado y límite |
|---|---|
| `GET /api/health`, directo y a través de Vite | Ambos HTTP 200, cuerpo `{"status":"ok","service":"sportsplace-api"}` y `Cache-Control: no-store`. |
| Rutas `/`, `/registro`, `/confirmar-email`, `/entrar`, `/panel` | Sirven la SPA por HTTP. No es comprobación visual, de sesión ni de formularios. |
| Comprobación visual posterior de Carlos, comunicada en esta conversación | Abre `localhost:5173`, ve el frontend y accede a los apartados de login y registro. Todavía no hay formularios; confirma la estructura, no las funcionalidades ni el QA de la historia. |
| Registro con email existente y variante con espacios/mayúsculas | Ambos HTTP 409 `EMAIL_YA_REGISTRADO`; no se crea cuenta ni se envía otro correo. |
| Registro sin aceptar privacidad / con email mal formado | HTTP 400 `DATOS_INVALIDOS`, con detalle del campo correspondiente. |
| Efectos de esas cuatro comprobaciones iniciales | Recuento de usuarios Auth y centros sin cambios. No hubo alta nueva ni reintentos de envío en esos casos. La prueba SMTP posterior realizó una única alta, descrita abajo. |
| `docker compose exec -T backend npm run db:check` | Conexión correcta y `public.centros` encontrada, con TLS verificado. |
| Consulta SQL en transacción de solo lectura | Migraciones `20261008090000` y `20261009120000` registradas; columnas de enlace y confirmación presentes; RLS activo; `anon`/`authenticated` sin lectura de `centros`. |
| Proyecto configurado y API pública de ajustes Auth | Coincide con `tmzxoosguozwrndqnkwn`; HTTP 200; email habilitado, altas permitidas y confirmación obligatoria (`mailer_autoconfirm: false`). |
| Confirmación, login y logout en la versión integrada | HTTP 404 `NO_ENCONTRADO`: los endpoints pertenecen a PR de otras historias, no se han trasladado a US-01. |

`.env.example` conserva vacíos los valores privados. `.env` y certificados están excluidos de Git y de los contextos Docker; no se han sobrescrito ni publicado. No se aplicaron migraciones ni se eliminaron datos o volúmenes.

## Correo de Supabase: lo acreditado y lo pendiente

- [Anass, #8, 14/10](https://github.com/UB-ES-A4-2026/sportsplace/issues/8#issuecomment-6175158124): registro real, recepción de correo, confirmación y persistencia. Su advertencia sobre Site URL y plantilla describe aquella fecha; no se presupone que siga vigente después de los ajustes de Carlos.
- [Alex, #4, 20/10](https://github.com/UB-ES-A4-2026/sportsplace/issues/4#issuecomment-6291838966): once comprobaciones reales de sesión, incluida la denegación sin email confirmado y la invalidación tras logout. Se realizaron en una rama de backend que contiene varias historias, no en la web integrada.
- Una prueba SMTP directa desde Windows no acredita que Supabase entregue correo. La prueba nueva del 20/10 sí pasa por nuestra API y Supabase Auth: alta HTTP 201 y recepción del correo confirmada por Carlos, según el registro siguiente. La configuración del panel se acredita mediante la revisión manual de Carlos, no mediante la API de gestión, a la que el agente sigue sin acceso.

Referencia versionada, sin copiar código entre historias: [plantilla Confirm signup de US-02 en `f97b667`](https://github.com/UB-ES-A4-2026/sportsplace/blob/f97b667f270eb18696440fce166402d439448dfd/supabase/templates/confirmar-email.html). El contrato y la implementación de #17 son compatibles: ruta `/confirmar-email`, parámetro `token_hash` a partir de `{{ .TokenHash }}` y `type=email`; la API espera esos campos en JSON y llama a `verifyOtp` con tipo `email`. También admite `signup` como entrada. La página integrada de TR-05 todavía no envía esa petición.

### Resultado de la revisión manual comunicada por Carlos

Se registran únicamente los valores no secretos de la configuración que Carlos confirma en esta conversación el 20/10/2026:

| Configuración revisada en el panel | Resultado aportado |
|---|---|
| Site URL | `http://localhost:5173`, correcto. |
| Proveedor Email y Confirm email | Ambos activados, correcto. |
| Mínimo de contraseña | 8 caracteres, coincide con el contrato. |
| Confirm signup | Plantilla personalizada con `/confirmar-email`, `token_hash` derivado de `.TokenHash` y `type=email`, compatible con el contrato y #17. |
| Custom SMTP | Activado; Carlos confirma el puerto `465` y que se mantiene al recargar. La prueba posterior de registro devuelve 201 y Carlos acredita la recepción real. No se ha leído la configuración mediante la API de gestión. |

Para Gmail los puertos habituales son `465` (TLS implícito) o `587` (STARTTLS), no `463`. Carlos comunicó inicialmente que el panel volvía a mostrar `463`, pero después confirmó `465` y su persistencia al recargar; no se atribuye una causa al comportamiento anterior. Se conserva la contraseña de aplicación existente, sin mostrarla ni cambiarla. La revisión del panel y la prueba real de recepción son evidencias distintas; ninguna completa por sí sola US-02.

### Prueba real de registro y entrega: 20/10/2026

Aplicación `e755687`, ejecutada desde la rama documental en `5f14c5d`, contra el proyecto compartido. Carlos proporciona y autoriza un buzón de pruebas bajo su control; no se publica la dirección ni ninguna contraseña o token en esta evidencia.

| Paso | Resultado y tipo de evidencia |
|---|---|
| Precondiciones, consulta de solo lectura | El buzón no existía ni en `auth.users` ni en `centros`. Email habilitado, altas permitidas y confirmación obligatoria. |
| Único `POST /api/auth/registro`, entre 16:20:47 y 16:20:49 UTC | HTTP **201**, usuario devuelto con email coincidente y `email_confirmado: false`, sin sesión. Contraseña aleatoria de prueba, distinta de la de Gmail y no divulgada. |
| Persistencia tras la petición | Una cuenta y un centro para el buzón probado, enlazados por `usuario_id`; privacidad aceptada; ambos sin confirmar. Supabase registra `confirmation_sent_at`. Comprobación técnica, sin borrar datos. |
| Recepción real | Carlos confirma en esta conversación que ha recibido el correo de confirmación. Acredita entrega desde Supabase, no solo conectividad SMTP desde Windows. |
| Destino del enlace recibido | Carlos abre la página local `/confirmar-email` en el puerto 5173 con los parámetros `token_hash` y `type=email`. Se omiten todos los valores del token y el enlace real. |
| Estado posterior a la navegación | Consulta de solo lectura: Auth sigue sin confirmar, `centros.email_confirmado` sigue en `false` y su fecha de confirmación sigue vacía. Cuenta y centro permanecen correctamente enlazados. |
| Disponibilidad de la confirmación | Sonda con cuerpo vacío, sin usar el token real: `POST /api/auth/confirmar` devuelve **404 NO_ENCONTRADO**. La API de US-02 todavía no está integrada y la página actual es un marcador. |

**Resultado DevOps:** registro real y envío/recepción de correo comprobados. **No se declara activada la cuenta ni superado el flujo de confirmación.** Se hizo una sola alta, sin reintentos, reenvíos, verificación directa del token, eliminación de usuarios o traslado de código entre historias. La cuenta de pruebas se conserva; no repetir su registro.

### Comprobación manual de Carlos, sin revelar secretos

1. Abrir el proyecto `tmzxoosguozwrndqnkwn` en Supabase. En **Authentication → URL Configuration**, comprobar que **Site URL** sea `http://localhost:5173`. Conservarlo si ya es correcto.
2. En **Authentication → Sign In / Providers → Email**, comprobar **Confirm email** activado y mínimo de contraseña de **8** caracteres. No se ha leído ese mínimo por el acceso público.
3. En **Authentication → Emails → Confirm signup**, comparar la plantilla con la referencia versionada: destino `/confirmar-email`, `token_hash` derivado de `.TokenHash` y `type=email`. Cambiarla solo si difiere. No compartir el enlace real.
4. En **Authentication → Email / SMTP Settings**, verificar que el SMTP personalizado de Gmail está habilitado y conservar la contraseña de aplicación existente. No pegarla en GitHub, chat o capturas. Sin credencial de gestión no se ha podido leer ni modificar esta configuración.
5. La prueba de envío descrita arriba ya está realizada y el buzón de pruebas ya tiene cuenta. Para cualquier prueba nueva, usar un buzón autorizado y comprobar primero **Authentication → Users** y `centros`. No repetir el registro ni eliminar la cuenta para forzarlo. Si hay timeout, comprobar el usuario antes de cualquier nuevo intento.
6. El recorrido web completo debe esperar las implementaciones de Lucía y la API de US-02 (#17): actualmente la página es un marcador y el endpoint de confirmación devuelve 404. No consumir un enlace esperando una confirmación que esta versión todavía no implementa. La validación final corresponde a Asier.

## Bloqueos y entrega

Estado comprobado de las ramas permanentes, sin modificarlas:

- `main` @ `7199408`: tres checks correctos en [CI 38610829790](https://github.com/UB-ES-A4-2026/sportsplace/actions/runs/38610829790).
- `dev` @ `29f6945`: no hay check runs asociados a ese commit; no se declara CI verde en su HEAD. El ajuste de ejecución en push a `dev` de #26 está en la historia y llegará mediante la integración completa de US-01.
- `dev` está un commit por delante de `main`, pero ambos tienen el **mismo árbol de archivos** (cero archivos diferentes). No hay una entrega nueva de código para abrir `dev` → `main`; no se fabrica una PR vacía ni se adelantan historias parciales.

La issue US-01 #1 figura cerrada por Asier el 20/10 a las 15:22 UTC, pero su [última evidencia QA](https://github.com/UB-ES-A4-2026/sportsplace/issues/1#issuecomment-6294232496) deja CP-01-01 bloqueado por 503/504 al registrar y no declara validada la historia. La prueba DevOps posterior sí consigue 201 y recepción del correo; no sustituye la repetición de CP-01-01 por QA sobre el formulario y la versión final. El formulario sigue fuera de la historia y US-01 no está integrada en `dev`. Se registra esta discrepancia sin modificar el cierre de Asier ni marcar criterios en su nombre.

| Elemento | Pendiente real | Responsable / dependencia |
|---|---|---|
| TR-02, [#7](https://github.com/UB-ES-A4-2026/sportsplace/issues/7) | Asier acredita su arranque y Carlos confirma la comprobación visual del entorno arrancado y probado por el agente. No se atribuye a Carlos la ejecución personal de los comandos. Issue abierta; criterios sin rebajar. | Anass, Alex, Lucía y Marta: registrar su confirmación personal con SO, fecha, commit y resultado. |
| US-01 | API y estructura web integradas; formulario fuera de la historia y sin PR abierta en la consulta actual. #1 figura cerrada, pero la última evidencia QA deja el alta válida bloqueada; la prueba DevOps posterior no sustituye su repetición ni la integración en `dev`. | Lucía: formulario y PR. Asier: repetir CP-01-01, validar la historia completa y revisar la coherencia del cierre. Revisión ajena y CI de la versión final. |
| US-02 | #15 y #17 en borrador por dependencias; página de confirmación no integrada. | Alex/Anass: backend y actualización de dependencias; Lucía: confirmación web; Asier: QA. |
| US-03 / US-67 | #13 y #14 en borrador, pendientes de las historias previas y de interfaz. | Alex: dependencias backend; Marta: login/logout; Asier: QA. No asumidas por Carlos. |
| Supabase: configuración y correo | Completado para la comprobación DevOps: configuración revisada por Carlos, un registro real 201 y recepción confirmada. La navegación llega al marcador; no activa la cuenta porque falta integrar US-02. | Carlos: evidencia técnica/manual registrada. Lucía y Alex/Anass: implementaciones de US-02; Asier: QA del recorrido completo. |
| Kanban Projects | La credencial existente tiene acceso al repositorio, pero no el scope `read:project`; no permite consultar Projects v2. | Carlos: acceso de Projects si desea comprobarlo o actualizarlo. No se cambió ningún estado sin evidencia. |
| `story/US-01-registro` → `dev` | No se abre ni se fusiona una historia incompleta ni se toma la aprobación de #28 como QA de toda US-01. | Lucía y Asier primero; después revisión vigente y CI. |
| `dev` → `main` | La entrega completa espera las historias y el visto bueno del equipo. Método obligatorio: **Create a merge commit**. | Equipo: visto bueno; Carlos: preparación y fusión cuando se cumplan todas las protecciones. |

**Sprint 0 no está declarado terminado.** No se enviaron mensajes a compañeros ni se emitieron aprobaciones en su nombre.
