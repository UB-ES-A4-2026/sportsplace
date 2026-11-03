-- US-68 (T68-1). Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las
-- migraciones. Requiere los roles anon y authenticated de Supabase y un usuario
-- administrador (por ejemplo, postgres). Todo se revierte al terminar.
BEGIN;

DO $tests$
DECLARE
    centro UUID;
    fila public.codigos_postales%ROWTYPE;
    ubicacion RECORD;
BEGIN
    IF (SELECT count(*) FROM public.codigos_postales) < 10000 THEN
        RAISE EXCEPTION 'La semilla de codigos_postales debe estar cargada';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.codigos_postales
        WHERE codigo_postal !~ '^[0-9]{5}$'
            OR codigo_postal NOT BETWEEN '01000' AND '52999'
    ) THEN
        RAISE EXCEPTION 'La semilla tiene codigos postales fuera de Espana';
    END IF;

    SELECT * INTO fila FROM public.codigos_postales WHERE codigo_postal = '08025';
    IF fila.provincia IS DISTINCT FROM 'Barcelona'
        OR fila.latitud NOT BETWEEN 41.3 AND 41.5
        OR fila.longitud NOT BETWEEN 2.1 AND 2.3 THEN
        RAISE EXCEPTION '08025 debe ser Barcelona con sus coordenadas';
    END IF;

    SELECT * INTO fila FROM public.codigos_postales WHERE codigo_postal = '17001';
    IF fila.provincia IS DISTINCT FROM 'Girona' OR fila.latitud IS NULL
        OR fila.longitud IS NULL THEN
        RAISE EXCEPTION '17001 debe ser Girona con sus coordenadas';
    END IF;

    -- E2E-3 usa 52998 como codigo con formato valido y sin fila.
    IF EXISTS (SELECT 1 FROM public.codigos_postales WHERE codigo_postal = '52998') THEN
        RAISE EXCEPTION '52998 no debe estar en la semilla';
    END IF;

    BEGIN
        INSERT INTO public.codigos_postales VALUES ('00999', 'Madrid', 40, -3);
        RAISE EXCEPTION 'Se acepto un codigo postal por debajo de 01000';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.codigos_postales VALUES ('53000', 'Madrid', 40, -3);
        RAISE EXCEPTION 'Se acepto un codigo postal por encima de 52999';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.codigos_postales VALUES ('08O25', 'Barcelona', 41, 2);
        RAISE EXCEPTION 'Se acepto un codigo postal con letras';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.codigos_postales VALUES ('52998', '   ', 35, -3);
        RAISE EXCEPTION 'Se acepto una provincia vacia';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;

    BEGIN
        INSERT INTO public.codigos_postales VALUES ('52998', 'Melilla', NULL, -3);
        RAISE EXCEPTION 'Se acepto un codigo postal sin latitud';
    EXCEPTION WHEN not_null_violation THEN
        NULL;
    END;

    -- Centro de Sprint 0: sin codigo postal, provincia ni coordenadas.
    INSERT INTO public.centros (
        nombre, email, localidad,
        politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES (
        'Centro de prueba T68-1', 't68-1-prueba@example.invalid', 'Barcelona',
        TRUE, now()
    ) RETURNING id INTO centro;

    SELECT provincia, latitud, longitud INTO ubicacion
        FROM public.centros WHERE id = centro;
    IF ubicacion.provincia IS NOT NULL OR ubicacion.latitud IS NOT NULL
        OR ubicacion.longitud IS NOT NULL THEN
        RAISE EXCEPTION 'Un centro sin codigo postal no tiene provincia ni coordenadas';
    END IF;

    -- CA7 y CA18: el servidor copia provincia y coordenadas del codigo postal.
    UPDATE public.centros c
        SET codigo_postal = cp.codigo_postal, provincia = cp.provincia,
            latitud = cp.latitud, longitud = cp.longitud
        FROM public.codigos_postales cp
        WHERE c.id = centro AND cp.codigo_postal = '17001';
    SELECT c.provincia, c.latitud, c.longitud INTO ubicacion
        FROM public.centros c WHERE c.id = centro;
    IF ubicacion.provincia IS DISTINCT FROM 'Girona'
        OR ubicacion.latitud IS DISTINCT FROM (SELECT latitud FROM public.codigos_postales WHERE codigo_postal = '17001')
        OR ubicacion.longitud IS DISTINCT FROM (SELECT longitud FROM public.codigos_postales WHERE codigo_postal = '17001') THEN
        RAISE EXCEPTION 'centros debe guardar la provincia y las coordenadas de 17001';
    END IF;

    IF NOT (
        SELECT relrowsecurity FROM pg_class WHERE oid = 'public.codigos_postales'::regclass
    ) THEN
        RAISE EXCEPTION 'La tabla codigos_postales debe tener RLS activado';
    END IF;

    IF has_table_privilege('anon', 'public.codigos_postales', 'SELECT,INSERT,UPDATE,DELETE')
        OR has_table_privilege('authenticated', 'public.codigos_postales', 'SELECT,INSERT,UPDATE,DELETE') THEN
        RAISE EXCEPTION 'Los roles del cliente no deben tener acceso a codigos_postales';
    END IF;
END;
$tests$;

SET LOCAL ROLE anon;
DO $tests$
BEGIN
    BEGIN
        PERFORM 1 FROM public.codigos_postales;
        RAISE EXCEPTION 'anon pudo leer codigos_postales';
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
        PERFORM 1 FROM public.codigos_postales;
        RAISE EXCEPTION 'authenticated pudo leer codigos_postales';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL;
    END;
END;
$tests$;
RESET ROLE;

ROLLBACK;
