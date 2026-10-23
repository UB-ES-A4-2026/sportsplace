# T13-1 · Metadatos y Storage de anuncios

La migración [20261022180000_crear_anuncio_fotos_storage.sql](../supabase/migrations/20261022180000_crear_anuncio_fotos_storage.sql)
añade `anuncio_fotos`, sus restricciones y el bucket `anuncios`. **Depende de la
tabla `public.anuncios` de T12-1.** La PR se mantiene en borrador hasta que US-12
entre en `dev` y US-13 se actualice desde ella. No se aplica al compartido antes
de revisión de Anass/Alex e integración coordinada.

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

Hasta disponer de T12-1, se puede validar el SQL de forma aislada con una tabla
`anuncios` mínima **solo como fixture temporal de prueba**, nunca como migración
de la historia. Esa comprobación no acredita integración con el esquema de Anass.

## Evidencia del 22/10/2026

En Supabase local de T12-8 se ejecutó la migración con una tabla `anuncios` mínima
de prueba (solo su PK) y todas las comprobaciones SQL terminaron en `ROLLBACK`.
También se comprobó Storage por HTTP: subida con la clave local del servidor,
descarga pública 200 con el mismo PNG, listado vacío y subida rechazada tanto
para `anon` como para un usuario autenticado; borrado final por el servidor.
Compose valida sin errores. Pendiente repetir la integración con la migración
real de T12-1 y aplicar al compartido tras revisión. No se modificó el compartido.
