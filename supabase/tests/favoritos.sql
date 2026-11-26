-- T25-1 (#405): favoritos de US-25 (CA7, CA17 y CA18).
-- Ejecutar con psql -v ON_ERROR_STOP=1 en una base de pruebas aislada,
-- despues de aplicar las migraciones y con un administrador de PostgreSQL.
-- Requiere los roles anon/authenticated de Supabase. Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    comprador UUID;
    vendedor UUID;
    anuncio UUID;
    otro_anuncio UUID;
    inexistente UUID := gen_random_uuid();
    fila public.favoritos%ROWTYPE;
    cuantos INTEGER;
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Comprador T25', 't25-comprador@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO comprador;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Vendedor T25', 't25-vendedor@example.invalid', 'Sabadell', TRUE, now())
    RETURNING id INTO vendedor;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, 'Balones de futbol talla 5', 'Doce balones de una temporada.',
        'balones', 'futbol', 12, 'buen_estado', 'venta', 1250, now()
    ) RETURNING id INTO anuncio;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, 'Conos de entrenamiento', 'Cuarenta conos en buen estado.',
        'material_entrenamiento', 'futbol', 40, 'buen_estado', 'donacion', NULL, now()
    ) RETURNING id INTO otro_anuncio;

    -- CA17: creado_en por defecto y clave primaria (centro_id, anuncio_id).
    INSERT INTO public.favoritos (centro_id, anuncio_id) VALUES (comprador, anuncio)
    RETURNING * INTO fila;
    IF fila.creado_en IS NULL THEN
        RAISE EXCEPTION 'El favorito debe guardar creado_en (CA17)';
    END IF;
    BEGIN
        INSERT INTO public.favoritos (centro_id, anuncio_id) VALUES (comprador, anuncio);
        RAISE EXCEPTION 'Se acepto el mismo favorito dos veces (CA17)';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.favoritos (centro_id, anuncio_id) VALUES (comprador, inexistente);
        RAISE EXCEPTION 'Se acepto un anuncio inexistente (CA17)';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.favoritos (centro_id, anuncio_id) VALUES (inexistente, anuncio);
        RAISE EXCEPTION 'Se acepto un centro inexistente (CA17)';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.favoritos (centro_id, anuncio_id) VALUES (NULL, anuncio);
        RAISE EXCEPTION 'Se acepto un favorito sin centro (CA17)';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;

    -- CA7 y CA9: pausar no borra el favorito; retirar si.
    INSERT INTO public.favoritos (centro_id, anuncio_id) VALUES (comprador, otro_anuncio);
    UPDATE public.anuncios SET estado = 'pausado' WHERE id = anuncio;
    UPDATE public.anuncios SET estado = 'activo' WHERE id = anuncio;
    SELECT count(*) INTO cuantos FROM public.favoritos WHERE anuncio_id = anuncio;
    IF cuantos <> 1 THEN
        RAISE EXCEPTION 'Pausar un anuncio no debe borrar sus favoritos (CA9)';
    END IF;
    UPDATE public.anuncios SET estado = 'retirado', retirado_en = now() WHERE id = anuncio;
    SELECT count(*) INTO cuantos FROM public.favoritos WHERE anuncio_id = anuncio;
    IF cuantos <> 0 THEN
        RAISE EXCEPTION 'Retirar un anuncio debe borrar sus favoritos (CA7)';
    END IF;
    SELECT count(*) INTO cuantos FROM public.favoritos WHERE anuncio_id = otro_anuncio;
    IF cuantos <> 1 THEN
        RAISE EXCEPTION 'Retirar un anuncio no debe borrar favoritos de otros anuncios';
    END IF;

    -- CA17: borrar el centro borra sus favoritos (on delete cascade).
    DELETE FROM public.centros WHERE id = comprador;
    SELECT count(*) INTO cuantos FROM public.favoritos WHERE centro_id = comprador;
    IF cuantos <> 0 THEN
        RAISE EXCEPTION 'Borrar el centro debe borrar sus favoritos (CA17)';
    END IF;
END;
$tests$;

-- CA18: el cliente no lee ni cambia la tabla directamente; solo la API.
SET LOCAL ROLE anon;
DO $tests$
BEGIN
    BEGIN
        PERFORM anuncio_id FROM public.favoritos LIMIT 1;
        RAISE EXCEPTION 'anon pudo leer favoritos';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$tests$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $tests$
BEGIN
    BEGIN
        PERFORM anuncio_id FROM public.favoritos LIMIT 1;
        RAISE EXCEPTION 'authenticated pudo leer favoritos';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$tests$;
RESET ROLE;

ROLLBACK;
