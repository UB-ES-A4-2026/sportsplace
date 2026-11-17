-- T21-2: búsqueda por fragmentos sin distinguir mayúsculas ni tildes.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Las extensiones ya instaladas conservan su esquema. Se cualifican tanto
-- la función como el diccionario, sin depender del search_path del backend.
DO $migracion$
DECLARE
    esquema_unaccent text;
BEGIN
    SELECT n.nspname INTO STRICT esquema_unaccent
    FROM pg_catalog.pg_extension AS e
    JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
    WHERE e.extname = 'unaccent';

    EXECUTE pg_catalog.format($funcion$
        CREATE FUNCTION public.normalizar_busqueda_catalogo(valor text)
        RETURNS text
        LANGUAGE sql STABLE STRICT
        SET search_path = ''
        RETURN pg_catalog.lower(%I.unaccent(%L::pg_catalog.regdictionary, valor))
    $funcion$, esquema_unaccent, pg_catalog.format('%I.unaccent', esquema_unaccent));
END;
$migracion$;

REVOKE ALL ON FUNCTION public.normalizar_busqueda_catalogo(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalizar_busqueda_catalogo(text) TO service_role;

-- unaccent depende de su diccionario. Se guarda el texto normalizado para
-- poder indexarlo sin declarar inmutable la función. El salto de línea evita
-- que un término con espacios introducidos al normalizar cruce los dos campos.
ALTER TABLE public.anuncios ADD COLUMN busqueda_catalogo text;

UPDATE public.anuncios
SET busqueda_catalogo = public.normalizar_busqueda_catalogo(titulo || E'\n' || descripcion);

ALTER TABLE public.anuncios ALTER COLUMN busqueda_catalogo SET NOT NULL;

CREATE FUNCTION public.actualizar_busqueda_catalogo_anuncio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $funcion$
BEGIN
    NEW.busqueda_catalogo := public.normalizar_busqueda_catalogo(NEW.titulo || E'\n' || NEW.descripcion);
    RETURN NEW;
END;
$funcion$;

REVOKE ALL ON FUNCTION public.actualizar_busqueda_catalogo_anuncio() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER anuncios_actualizar_busqueda_catalogo
    BEFORE INSERT OR UPDATE OF titulo, descripcion ON public.anuncios
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_busqueda_catalogo_anuncio();

-- El índice contiene solo los anuncios que pueden salir en el catálogo.
DO $migracion$
DECLARE
    esquema_pg_trgm text;
BEGIN
    SELECT n.nspname INTO STRICT esquema_pg_trgm
    FROM pg_catalog.pg_extension AS e
    JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm';

    EXECUTE pg_catalog.format($indice$
        CREATE INDEX anuncios_catalogo_busqueda_gin
        ON public.anuncios USING gin (busqueda_catalogo %I.gin_trgm_ops)
        WHERE estado IN ('activo', 'reservado') AND unidades_disponibles > 0
    $indice$, esquema_pg_trgm);
END;
$migracion$;
