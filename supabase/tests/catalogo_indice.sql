-- E04 US-96 (T21-1). Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las
-- migraciones. Requiere un usuario administrador (por ejemplo, postgres).
-- Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    definicion TEXT;
BEGIN
    SELECT indexdef INTO definicion
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'anuncios'
        AND indexname = 'anuncios_catalogo_estado_publicado';

    IF definicion IS NULL THEN
        RAISE EXCEPTION 'falta el indice anuncios_catalogo_estado_publicado (CA22)';
    END IF;
    IF definicion NOT LIKE '%(estado, publicado_en DESC, id)%' THEN
        RAISE EXCEPTION 'el indice del catalogo no tiene las columnas esperadas: %', definicion;
    END IF;
END
$tests$;

ROLLBACK;
