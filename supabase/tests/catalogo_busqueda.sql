-- US-21 (T21-2). Ejecutar con psql -v ON_ERROR_STOP=1 después de aplicar
-- las migraciones, con un usuario administrador. Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    centro UUID;
    anuncio UUID;
    busqueda TEXT;
BEGIN
    IF public.normalizar_busqueda_catalogo('BALÓN FÚTBOL NIÑO BARÇA')
        IS DISTINCT FROM 'balon futbol nino barca' THEN
        RAISE EXCEPTION 'La búsqueda debe ignorar mayúsculas y diacríticos';
    END IF;

    IF public.normalizar_busqueda_catalogo($texto$Á%_\!$texto$)
        IS DISTINCT FROM $texto$a%_\!$texto$ THEN
        RAISE EXCEPTION 'La normalización debe conservar los signos de la búsqueda';
    END IF;

    INSERT INTO public.centros (
        nombre, email, localidad,
        politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES (
        'Centro de prueba T21-2', 't21-2-prueba@example.invalid', 'Barcelona',
        TRUE, now()
    ) RETURNING id INTO centro;

    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, publicado_en
    ) VALUES (
        centro, 'BALÓN DE FÚTBOL', 'Material del Barça para niños.', 'balones',
        'futbol', 2, 'buen_estado', 'donacion', now()
    ) RETURNING id, busqueda_catalogo INTO anuncio, busqueda;

    IF busqueda IS DISTINCT FROM E'balon de futbol\nmaterial del barca para ninos.' THEN
        RAISE EXCEPTION 'Al crear el anuncio debe guardarse el título y la descripción normalizados';
    END IF;

    UPDATE public.anuncios SET titulo = 'Balón de PÁDEL' WHERE id = anuncio
        RETURNING busqueda_catalogo INTO busqueda;
    IF busqueda IS DISTINCT FROM E'balon de padel\nmaterial del barca para ninos.' THEN
        RAISE EXCEPTION 'Cambiar el título debe actualizar la búsqueda';
    END IF;

    UPDATE public.anuncios SET descripcion = 'Está en muy buen estado.' WHERE id = anuncio
        RETURNING busqueda_catalogo INTO busqueda;
    IF busqueda IS DISTINCT FROM E'balon de padel\nesta en muy buen estado.' THEN
        RAISE EXCEPTION 'Cambiar la descripción debe actualizar la búsqueda';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_index AS i
        JOIN pg_class AS indice ON indice.oid = i.indexrelid
        JOIN pg_am AS metodo ON metodo.oid = indice.relam
        JOIN pg_opclass AS clase ON clase.oid = i.indclass[0]
        JOIN pg_attribute AS columna ON columna.attrelid = i.indrelid
            AND columna.attnum = i.indkey[0]
        WHERE i.indrelid = 'public.anuncios'::regclass
            AND columna.attname = 'busqueda_catalogo'
            AND metodo.amname = 'gin' AND clase.opcname = 'gin_trgm_ops'
            AND i.indisready AND i.indisvalid AND i.indpred IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Falta el índice GIN parcial de trigramas sobre busqueda_catalogo';
    END IF;
END;
$tests$;

ROLLBACK;
