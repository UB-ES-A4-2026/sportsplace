-- US-12 (T12-1). Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las
-- migraciones. Requiere los roles anon y authenticated de Supabase y un usuario
-- administrador (por ejemplo, postgres). Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    centro UUID;
    anuncio UUID;
    fila public.anuncios%ROWTYPE;
    base CONSTANT TEXT := 'Doce balones Mikasa usados una temporada.';
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad,
        politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES (
        'Centro de prueba T12-1', 't12-1-prueba@example.invalid', 'Barcelona',
        TRUE, now()
    ) RETURNING id INTO centro;

    -- Anuncio valido: valores por defecto y fechas.
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte,
        unidades_disponibles, estado_material, publicado_en
    ) VALUES (
        centro, 'Balones de futbol talla 5', base, 'balones', 'futbol',
        12, 'buen_estado', now()
    ) RETURNING * INTO fila;
    anuncio := fila.id;

    IF fila.estado <> 'activo' THEN
        RAISE EXCEPTION 'Un anuncio nuevo debe quedar activo';
    END IF;
    IF fila.creado_en IS NULL OR fila.actualizado_en IS NULL
        OR fila.publicado_en <> fila.creado_en OR fila.actualizado_en <> fila.creado_en THEN
        RAISE EXCEPTION 'publicado_en, creado_en y actualizado_en deben coincidir al publicar (CA13)';
    END IF;
    IF fila.retirado_en IS NOT NULL OR fila.entregado_en IS NOT NULL THEN
        RAISE EXCEPTION 'retirado_en y entregado_en deben empezar nulos';
    END IF;

    -- Limites aceptados: titulo 5 y 80, descripcion 20 y 1000, unidades 0 y 9999.
    UPDATE public.anuncios SET titulo = 'Balón' WHERE id = anuncio;
    UPDATE public.anuncios SET titulo = repeat('t', 80) WHERE id = anuncio;
    UPDATE public.anuncios SET titulo = repeat('⚽', 80) WHERE id = anuncio;
    UPDATE public.anuncios SET descripcion = repeat('d', 20) WHERE id = anuncio;
    UPDATE public.anuncios SET descripcion = repeat('😀', 1000) WHERE id = anuncio;
    UPDATE public.anuncios SET unidades_disponibles = 9999 WHERE id = anuncio;
    UPDATE public.anuncios SET unidades_disponibles = 0 WHERE id = anuncio;

    -- CA23: los CHECK rechazan valores fuera de rango aunque se salte la API.
    BEGIN
        UPDATE public.anuncios SET titulo = 'Bola' WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto un titulo de 4 caracteres';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET titulo = repeat('t', 81) WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto un titulo de 81 caracteres';
    EXCEPTION WHEN check_violation OR string_data_right_truncation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET descripcion = repeat('d', 19) WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto una descripcion de 19 caracteres';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET descripcion = repeat('d', 1001) WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto una descripcion de 1001 caracteres';
    EXCEPTION WHEN check_violation OR string_data_right_truncation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET unidades_disponibles = 10000 WHERE id = anuncio;
        RAISE EXCEPTION 'Se aceptaron 10000 unidades';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET unidades_disponibles = -1 WHERE id = anuncio;
        RAISE EXCEPTION 'Se aceptaron unidades negativas';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET categoria = 'Balones' WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto una categoria con mayuscula';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET deporte = 'golf' WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto un deporte inexistente';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET estado_material = 'roto' WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto un estado del material inexistente';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET estado = 'borrador' WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto el estado borrador antes de US-20';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET publicado_en = NULL WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto un anuncio publicado sin publicado_en';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET estado = 'retirado' WHERE id = anuncio;
        RAISE EXCEPTION 'Se retiro un anuncio sin retirado_en';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET entregado_en = now() WHERE id = anuncio;
        RAISE EXCEPTION 'Se acepto entregado_en en un anuncio activo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.anuncios (
            centro_id, titulo, descripcion, categoria, deporte,
            unidades_disponibles, estado_material, publicado_en
        ) VALUES (
            gen_random_uuid(), 'Balones de futbol', base, 'balones', 'futbol',
            1, 'nuevo', now()
        );
        RAISE EXCEPTION 'Se acepto un anuncio de un centro inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    -- Estados finales con su fecha.
    UPDATE public.anuncios
        SET estado = 'entregado', entregado_en = now() WHERE id = anuncio;
    UPDATE public.anuncios
        SET estado = 'retirado', entregado_en = NULL, retirado_en = now() WHERE id = anuncio;

    -- Borrar el centro borra sus anuncios.
    DELETE FROM public.centros WHERE id = centro;
    IF EXISTS (SELECT 1 FROM public.anuncios WHERE id = anuncio) THEN
        RAISE EXCEPTION 'Al borrar el centro deben borrarse sus anuncios';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'anuncios_centro_estado_actualizado'
    ) THEN
        RAISE EXCEPTION 'Falta el indice (centro_id, estado, actualizado_en DESC)';
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.anuncios'::regclass) THEN
        RAISE EXCEPTION 'La tabla anuncios debe tener RLS activado';
    END IF;
    IF has_table_privilege('anon', 'public.anuncios', 'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('authenticated', 'public.anuncios', 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'Los roles del cliente no deben tener acceso a anuncios';
    END IF;
END;
$tests$;

SET LOCAL ROLE anon;
DO $tests$
BEGIN
    BEGIN
        PERFORM 1 FROM public.anuncios;
        RAISE EXCEPTION 'anon pudo leer anuncios';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$tests$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $tests$
BEGIN
    BEGIN
        PERFORM 1 FROM public.anuncios;
        RAISE EXCEPTION 'authenticated pudo leer anuncios';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$tests$;
RESET ROLE;

ROLLBACK;
