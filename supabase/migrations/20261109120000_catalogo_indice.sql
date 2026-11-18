-- E04 US-96 (T21-1 / T96-1): indice del catalogo, segun la «Base comun» de
-- docs/especificacion/E04-busqueda-y-exploracion.md y el CA22 de US-96.
--
-- GET /api/catalogo filtra por estado (activo y reservado) y ordena por
-- publicado_en descendente y, a igual fecha, por id ascendente (CA5). El indice
-- sigue ese orden para que la pagina se sirva sin ordenar toda la tabla.
-- publicado_en ya existe desde 20261022210000_crear_anuncios.sql (US-12): se
-- rellena al publicar, asi que no hace falta añadirla.
CREATE INDEX anuncios_catalogo_estado_publicado
    ON public.anuncios (estado, publicado_en DESC, id);
