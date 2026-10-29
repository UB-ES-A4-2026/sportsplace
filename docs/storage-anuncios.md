# T13-1 · Metadatos y Storage de anuncios

La migración [20261023090000_crear_anuncio_fotos_storage.sql](../supabase/migrations/20261023090000_crear_anuncio_fotos_storage.sql)
añade `anuncio_fotos`, sus restricciones y el bucket `anuncios`. **Depende de la
tabla `public.anuncios` de T12-1.** La PR se mantiene en borrador hasta que US-12
entre en `dev` y US-13 se actualice desde ella. No se aplica al compartido antes
de revisión de Anass/Alex e integración coordinada.

El nombre ordena esta migración **después** de
`20261022210000_crear_anuncios.sql` (T12-1). La versión inicial tenía el timestamp
`20261022180000`, anterior al de su dependencia, y fallaría en una instalación
limpia. Se renombró antes de aplicarla al proyecto compartido, conservando el SQL
sin cambios. Las ramas que incorporaron aquella versión (#124 y #123) deben
incorporar también este renombrado; no deben conservar ambos archivos. Si alguien
aplicó el nombre anterior en su base local desechable, debe recrear esa base desde
el historial corregido. No se modifica el historial de migraciones compartido.

- 1 a 5.242.880 bytes por foto, orden 1 a 8, único por anuncio y orden.
- Como máximo una principal por anuncio (índice único parcial).
- FK con borrado en cascada; metadatos inaccesibles para `anon`/`authenticated`.
- Bucket de lectura pública **por URL**, sin listado para clientes. Una política
  restrictiva sobre `storage.objects` impide listar y escribir en `anuncios`,
  incluso si hay otra política genérica permisiva. `service_role` conserva acceso.
- Solo JPEG, PNG y WebP y límite de 5 MB en el bucket. T13-2 debe comprobar las
  cabeceras binarias: el MIME declarado en Storage no sustituye esa validación.

La ruta que construirá T13-2 es `<centro_id>/<anuncio_id>/<foto_id>.<jpg|png|webp>`.
Los UUID evitan publicar nombres originales. El requisito de al menos una foto,
de exactamente una principal, la subida multipart y la compensación de errores
entre SQL y Storage pertenecen a T13-2. Esta migración no implementa su API.

## Configuración del backend

En el `.env` privado, configurar `SUPABASE_SERVICE_ROLE_KEY` del mismo proyecto
que `SUPABASE_URL`. Compose la pasa exclusivamente al backend. Nunca usar prefijo
`VITE_`, ponerla en el cliente o adjuntarla a logs/capturas. La aplicación actual
puede arrancar sin ella; la subida de fotos la necesitará cuando entre T13-2.
En el entorno aislado de T12-8 se obtiene la clave local, nunca la del compartido.

## Validación

Después de aplicar las migraciones **reales** y sembrar un anuncio en la base de
pruebas, ejecutar [anuncio_fotos.sql](../supabase/tests/anuncio_fotos.sql) con
`psql -v ON_ERROR_STOP=1`. Comprueba límites, orden, principal, FK/cascada, permisos
SQL y protección de listado/escritura incluso ante una política permisiva. Usa
una transacción con `ROLLBACK`; no ejecutarlo en el Supabase compartido.

Prueba adicional de Storage real con datos desechables:

1. El servidor sube una imagen PNG al bucket con `service_role`: debe funcionar.
2. Descargar `/storage/v1/object/public/anuncios/<ruta>` sin sesión: 200 e imagen.
3. Listar el bucket como `anon` y `authenticated`: no devuelve el objeto.
4. Intentar subida como cliente: se rechaza. El servidor puede borrar su objeto.

Para comprobar la integración mientras US-12 aún no está en `dev`, se puede usar
en la base local desechable una copia exacta de la migración de T12-1 desde su
commit de historia. Esa copia pertenece solo al entorno de prueba: no se añade
una tabla ficticia ni se integra la otra historia en esta rama. Primero se aplica
T12-1, después T13-1 y finalmente se ejecutan estas comprobaciones.

## Evidencia del 22/10/2026

En Supabase local de T12-8 se ejecutó la migración con una tabla `anuncios` mínima
de prueba (solo su PK) y todas las comprobaciones SQL terminaron en `ROLLBACK`.
También se comprobó Storage por HTTP: subida con la clave local del servidor,
descarga pública 200 con el mismo PNG, listado vacío y subida rechazada tanto
para `anon` como para un usuario autenticado; borrado final por el servidor.
Compose valida sin errores. No se modificó el compartido.

## Evidencia del 23/10/2026

Repetida la validación en Supabase local después de aplicar la migración **real**
de T12-1 (`20261022210000_crear_anuncios.sql`, historia US-12 `706fabb`) y su semilla
de 23 anuncios de T12-8. La migración renombrada de T13-1 se aplica después de
T12-1. Las comprobaciones de `anuncio_fotos.sql` pasan y terminan en `ROLLBACK`.
También pasan de nuevo subida del servidor, descarga pública del PNG, listado
vacío y rechazo de escritura para `anon` y `authenticated`, con borrado final del
objeto de prueba. No se necesita una tabla `anuncios` ficticia para esta evidencia.

Pendiente la integración de US-12 en `dev`, actualización de la historia US-13,
revisión ajena y aplicación coordinada al Supabase compartido.
