-- Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar la migracion.
-- Requiere los roles anon y authenticated de Supabase y un usuario de pruebas
-- administrador (por ejemplo, postgres). Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    centro_id UUID;
    confirmado BOOLEAN;
    fecha_confirmacion TIMESTAMPTZ;
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad,
        politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES (
        'Centro de prueba TR-03', 'tr03-prueba@example.invalid', 'Barcelona',
        TRUE, now()
    ) RETURNING id, email_confirmado, email_confirmado_en
        INTO centro_id, confirmado, fecha_confirmacion;

    IF centro_id IS NULL OR confirmado IS DISTINCT FROM FALSE
        OR fecha_confirmacion IS NOT NULL THEN
        RAISE EXCEPTION 'Un centro nuevo debe tener id y email pendiente de confirmacion';
    END IF;

    BEGIN
        INSERT INTO public.centros (
            nombre, email, localidad,
            politica_privacidad_aceptada, politica_privacidad_aceptada_en
        ) VALUES (
            'Duplicado de prueba', '  TR03-PRUEBA@EXAMPLE.INVALID  ', 'Barcelona',
            TRUE, now()
        );
        RAISE EXCEPTION 'Se acepto un email duplicado con mayusculas y espacios';
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.centros (
            nombre, email, localidad,
            politica_privacidad_aceptada, politica_privacidad_aceptada_en
        ) VALUES (
            'Sin consentimiento', 'tr03-no-consentimiento@example.invalid', 'Barcelona',
            FALSE, now()
        );
        RAISE EXCEPTION 'Se acepto un centro sin aceptar la politica de privacidad';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.centros (
            nombre, email, localidad, politica_privacidad_aceptada_en
        ) VALUES (
            'Sin consentimiento explicito', 'tr03-sin-aceptacion@example.invalid',
            'Barcelona', now()
        );
        RAISE EXCEPTION 'Se acepto un centro sin consentimiento explicito';
    EXCEPTION WHEN not_null_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.centros (
            nombre, email, localidad, politica_privacidad_aceptada
        ) VALUES (
            'Sin fecha de consentimiento', 'tr03-sin-fecha@example.invalid',
            'Barcelona', TRUE
        );
        RAISE EXCEPTION 'Se acepto un centro sin fecha de consentimiento';
    EXCEPTION WHEN not_null_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE public.centros SET nombre = '   ' WHERE id = centro_id;
        RAISE EXCEPTION 'Se acepto un nombre vacio';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE public.centros SET localidad = '   ' WHERE id = centro_id;
        RAISE EXCEPTION 'Se acepto una localidad vacia';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE public.centros SET email = '   ' WHERE id = centro_id;
        RAISE EXCEPTION 'Se acepto un email vacio';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        UPDATE public.centros SET email_confirmado = TRUE WHERE id = centro_id;
        RAISE EXCEPTION 'Se pudo modificar email_confirmado sin su fecha';
    EXCEPTION WHEN SQLSTATE '428C9' THEN
        NULL;
    END;

    UPDATE public.centros SET email_confirmado_en = now() WHERE id = centro_id;
    SELECT email_confirmado INTO confirmado FROM public.centros WHERE id = centro_id;
    IF confirmado IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'La fecha de confirmacion debe activar email_confirmado';
    END IF;

    UPDATE public.centros SET email_confirmado_en = NULL WHERE id = centro_id;
    SELECT email_confirmado INTO confirmado FROM public.centros WHERE id = centro_id;
    IF confirmado IS DISTINCT FROM FALSE THEN
        RAISE EXCEPTION 'Sin fecha de confirmacion el email debe quedar pendiente';
    END IF;

    IF NOT (
        SELECT relrowsecurity FROM pg_class WHERE oid = 'public.centros'::regclass
    ) THEN
        RAISE EXCEPTION 'La tabla centros debe tener RLS activado';
    END IF;

    IF has_table_privilege('anon', 'public.centros', 'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('authenticated', 'public.centros', 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'Los roles del cliente no deben tener acceso a centros';
    END IF;
END;
$tests$;

SET LOCAL ROLE anon;
DO $tests$
BEGIN
    BEGIN
        PERFORM 1 FROM public.centros;
        RAISE EXCEPTION 'anon pudo leer centros';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    BEGIN
        UPDATE public.centros SET email_confirmado_en = now();
        RAISE EXCEPTION 'anon pudo confirmar emails';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$tests$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $tests$
BEGIN
    BEGIN
        PERFORM 1 FROM public.centros;
        RAISE EXCEPTION 'authenticated pudo leer centros';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
    BEGIN
        UPDATE public.centros SET email_confirmado_en = now();
        RAISE EXCEPTION 'authenticated pudo confirmar emails';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$tests$;
RESET ROLE;

ROLLBACK;
