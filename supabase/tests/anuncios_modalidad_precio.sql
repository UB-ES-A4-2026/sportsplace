-- US-14 (T14-1). Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las
-- migraciones. Requiere un usuario administrador (por ejemplo, postgres).
-- Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    centro UUID;
    venta UUID;
    donacion UUID;
    base CONSTANT TEXT := 'Doce balones Mikasa usados una temporada.';
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad,
        politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES (
        'Centro de prueba T14-1', 't14-1-prueba@example.invalid', 'Barcelona',
        TRUE, now()
    ) RETURNING id INTO centro;

    -- CA10: despues de la migracion, modalidad no tiene valor por defecto.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'anuncios'
            AND column_name = 'modalidad' AND column_default IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'modalidad no debe tener DEFAULT despues de la migracion (CA10)';
    END IF;

    -- Venta con precio y donacion sin precio se aceptan.
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        centro, 'Balones en venta', base, 'balones', 'futbol', 12,
        'buen_estado', 'venta', 850, now()
    ) RETURNING id INTO venta;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, publicado_en
    ) VALUES (
        centro, 'Balones donados', base, 'balones', 'futbol', 12,
        'buen_estado', 'donacion', now()
    ) RETURNING id INTO donacion;

    -- Limites aceptados del precio: 1 y 9999999 centimos.
    UPDATE public.anuncios SET precio_unitario_centimos = 1 WHERE id = venta;
    UPDATE public.anuncios SET precio_unitario_centimos = 9999999 WHERE id = venta;

    -- Sin modalidad no se puede crear un anuncio (ya no hay DEFAULT).
    BEGIN
        INSERT INTO public.anuncios (
            centro_id, titulo, descripcion, categoria, deporte,
            unidades_disponibles, estado_material, publicado_en
        ) VALUES (
            centro, 'Balones sin modalidad', base, 'balones', 'futbol',
            1, 'nuevo', now()
        );
        RAISE EXCEPTION 'Se acepto un anuncio sin modalidad';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;

    -- Los CHECK rechazan lo que la API rechaza (CA9), aunque se salte la API.
    BEGIN
        UPDATE public.anuncios SET modalidad = 'regalo' WHERE id = donacion;
        RAISE EXCEPTION 'Se acepto la modalidad regalo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET modalidad = 'Venta', precio_unitario_centimos = 850
            WHERE id = donacion;
        RAISE EXCEPTION 'Se acepto una modalidad con mayuscula';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET precio_unitario_centimos = NULL WHERE id = venta;
        RAISE EXCEPTION 'Se acepto una venta sin precio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET precio_unitario_centimos = 0 WHERE id = venta;
        RAISE EXCEPTION 'Se acepto una venta de 0 centimos';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET precio_unitario_centimos = 10000000 WHERE id = venta;
        RAISE EXCEPTION 'Se acepto una venta de 10000000 centimos';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET precio_unitario_centimos = -5 WHERE id = venta;
        RAISE EXCEPTION 'Se acepto un precio negativo';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET precio_unitario_centimos = 500 WHERE id = donacion;
        RAISE EXCEPTION 'Se acepto una donacion con precio (E2E-5)';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.anuncios SET modalidad = 'venta' WHERE id = donacion;
        RAISE EXCEPTION 'Se acepto pasar a venta sin precio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- CA11: el precio es entero; un decimal no se guarda como decimal.
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'anuncios'
            AND column_name = 'precio_unitario_centimos') <> 'integer' THEN
        RAISE EXCEPTION 'precio_unitario_centimos debe ser integer (CA11)';
    END IF;

    -- Cambio de modalidad coherente en los dos sentidos.
    UPDATE public.anuncios SET modalidad = 'donacion', precio_unitario_centimos = NULL
        WHERE id = venta;
    UPDATE public.anuncios SET modalidad = 'venta', precio_unitario_centimos = 850
        WHERE id = donacion;
END;
$tests$;

ROLLBACK;
