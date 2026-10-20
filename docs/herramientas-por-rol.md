# Sprint 0: equipo, herramientas y capacidades

Propuesta breve para revisar por el equipo, preparada el 13/10/2026. Describe el reparto y las herramientas del proyecto; cada persona debe confirmar su experiencia. Falta la rúbrica original para validar el formato del entregable de una página.

**Objetivo compartido:** una base reproducible para desarrollar Sportsplace, con cambios revisados y un recorrido de registro y acceso verificable. Fecha límite de tareas: **14/10/2026 a las 15:00, Europe/Madrid**, confirmada por Carlos.

| Persona | Rol técnico | Herramientas de su área | Capacidades que debe confirmar |
|---|---|---|---|
| Carlos | DevOps | Git/GitHub, Projects, Docker Compose, configuración de Supabase y protección de ramas | Por confirmar: experiencia y apoyo necesario en Git, Docker, CI y configuración. |
| Asier | QA | GitHub Actions, ESLint, tests de Node.js y validación manual | Por confirmar: experiencia y apoyo necesario en automatización y pruebas. |
| Anass | Backend | Node.js 24, Express 5, Supabase Auth, PostgreSQL/SQL | Por confirmar: experiencia y apoyo necesario en API, autenticación y datos. |
| Alex | Backend | Node.js 24, Express 5, Supabase Auth, PostgreSQL/SQL | Por confirmar: experiencia y apoyo necesario en API, autenticación y datos. |
| Lucía | Frontend | React, Vite, React Router y cliente de la API | Por confirmar: experiencia y apoyo necesario en formularios, rutas e integración. |
| Marta | Frontend | React, Vite, React Router y cliente de la API | Por confirmar: experiencia y apoyo necesario en formularios, sesión e integración. |

Express y Supabase Auth están en las PR de backend de Alex; falta registrar el acuerdo conjunto de Anass y Alex. La tabla no afirma que todas estas tecnologías estén ya integradas en `main` ni que las domine cada integrante.

**Coordinación y revisión.** El README recoge categorías de ramas y procedimiento de PR. Cada cambio necesita aprobación de otra persona y las comprobaciones exigidas de CI. La web consume `/api/...` y los cambios de contrato se coordinan entre las dos áreas. Carlos mantiene entorno y configuración; Asier coordina pruebas y seguimiento. Las tareas parciales no completan una historia hasta validar el conjunto.

**Datos y configuración.** `.env.example` documenta variables sin secretos. Cada persona conserva su `.env` y certificado locales. Las migraciones SQL se revisan antes de aplicarlas al Supabase compartido; las validaciones reales se distinguen de los tests con dobles y del build.

**Herramientas de IA.** Uso concreto por persona: por confirmar. Si se utilizan, el autor revisa los cambios, comprueba su comportamiento y registra la evidencia en la PR. Las respuestas de una herramienta no sustituyen la aprobación del equipo ni una prueba ejecutada.

**Por completar:** experiencia declarada de las seis personas, necesidades de apoyo, uso real de herramientas de IA y formato solicitado por la asignatura. La tabla de capacidades responde al documento de Clase 3; el entregable de una página y las reglas sobre agentes se contrastarán con los PDFs aún no disponibles.
