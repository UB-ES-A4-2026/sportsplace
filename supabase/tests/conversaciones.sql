-- T28-1 (#268): conversaciones, mensajes y marcas de lectura de US-77.
-- Ejecutar con psql -v ON_ERROR_STOP=1 en una base de pruebas aislada,
-- despues de aplicar las migraciones y con un administrador de PostgreSQL.
-- Requiere los roles anon/authenticated y auth.users de Supabase.
BEGIN;

DO $tests$
DECLARE
    comprador UUID;
    vendedor UUID;
    tercero UUID;
    autor UUID := gen_random_uuid();
    inexistente UUID := gen_random_uuid();
    anuncio UUID;
    conversacion UUID;
    mensaje UUID;
    fila public.conversaciones%ROWTYPE;
    mensaje_fila public.mensajes%ROWTYPE;
    fecha_nueva CONSTANT TIMESTAMPTZ := '2026-11-11 10:00:00+00';
    fecha_anterior CONSTANT TIMESTAMPTZ := '2026-11-11 09:00:00+00';
    tabla TEXT;
    cliente TEXT;
    tipo_invalido TEXT;
BEGIN
    -- El usuario de trazabilidad no necesita ser el titular del centro.
    -- US-08 permitira varias personas del mismo centro.
    INSERT INTO auth.users (id) VALUES (autor);
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Comprador T28', 't28-comprador@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO comprador;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Vendedor T28', 't28-vendedor@example.invalid', 'Sabadell', TRUE, now())
    RETURNING id INTO vendedor;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Tercer centro T28', 't28-tercero@example.invalid', 'Terrassa', TRUE, now())
    RETURNING id INTO tercero;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, 'Balones de baloncesto Molten', 'Veinte balones usados en una temporada.',
        'balones', 'baloncesto', 20, 'buen_estado', 'venta', 1200, now()
    ) RETURNING id INTO anuncio;

    INSERT INTO public.conversaciones (anuncio_id, centro_comprador_id, centro_vendedor_id)
    VALUES (anuncio, comprador, vendedor) RETURNING * INTO fila;
    conversacion := fila.id;
    IF fila.id IS NULL OR fila.creada_en IS NULL THEN
        RAISE EXCEPTION 'La conversacion debe generar UUID y fecha de creacion';
    END IF;
    IF fila.leida_hasta_comprador IS NOT NULL OR fila.leida_hasta_vendedor IS NOT NULL THEN
        RAISE EXCEPTION 'Las marcas de lectura deben comenzar nulas (US-77 CA7)';
    END IF;

    -- Solo una conversacion por anuncio y centro interesado, aun bajo carreras.
    BEGIN
        INSERT INTO public.conversaciones (anuncio_id, centro_comprador_id, centro_vendedor_id)
        VALUES (anuncio, comprador, vendedor);
        RAISE EXCEPTION 'Se acepto una segunda conversacion del mismo anuncio y comprador';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO public.conversaciones (anuncio_id, centro_comprador_id, centro_vendedor_id)
    VALUES (anuncio, tercero, vendedor);

    BEGIN
        UPDATE public.conversaciones SET centro_comprador_id = vendedor WHERE id = conversacion;
        RAISE EXCEPTION 'Se acepto una conversacion con el mismo comprador y vendedor';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.conversaciones SET anuncio_id = inexistente WHERE id = conversacion;
        RAISE EXCEPTION 'Se acepto un anuncio inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.conversaciones SET centro_comprador_id = inexistente WHERE id = conversacion;
        RAISE EXCEPTION 'Se acepto un comprador inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.conversaciones SET centro_vendedor_id = inexistente WHERE id = conversacion;
        RAISE EXCEPTION 'Se acepto un vendedor inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.conversaciones SET centro_comprador_id = NULL WHERE id = conversacion;
        RAISE EXCEPTION 'Se acepto una conversacion sin comprador';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;

    -- El texto admite saltos de linea, una letra o 2000 caracteres Unicode.
    INSERT INTO public.mensajes (conversacion_id, centro_autor_id, autor_usuario_id, texto)
    VALUES (conversacion, comprador, autor, 'ñ') RETURNING * INTO mensaje_fila;
    mensaje := mensaje_fila.id;
    IF mensaje IS NULL OR mensaje_fila.tipo <> 'texto' OR mensaje_fila.creado_en IS NULL THEN
        RAISE EXCEPTION 'Un mensaje nuevo debe generar UUID, tipo texto y fecha';
    END IF;
    UPDATE public.mensajes SET texto = repeat('😀', 2000) WHERE id = mensaje;
    UPDATE public.mensajes SET texto = E'Hola\n¿Podemos recogerlos el sabado?' WHERE id = mensaje;

    BEGIN
        UPDATE public.mensajes SET texto = repeat('😀', 2001) WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto un mensaje de 2001 caracteres';
    EXCEPTION WHEN check_violation OR string_data_right_truncation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET texto = '' WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto un mensaje vacio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET texto = E' \t\r\n ' WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto un mensaje que solo contiene espacios';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET texto = NULL WHERE id = mensaje;
        RAISE EXCEPTION 'Un mensaje de texto pudo omitir el texto';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET oferta_id = gen_random_uuid() WHERE id = mensaje;
        RAISE EXCEPTION 'Un mensaje de texto pudo incluir una oferta';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    FOREACH tipo_invalido IN ARRAY ARRAY['imagen', 'Texto', ''] LOOP
        BEGIN
            UPDATE public.mensajes SET tipo = tipo_invalido WHERE id = mensaje;
            RAISE EXCEPTION 'Se acepto un tipo de mensaje desconocido';
        EXCEPTION WHEN check_violation THEN NULL;
        END;
    END LOOP;
    BEGIN
        UPDATE public.mensajes SET tipo = NULL WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto tipo NULL por un hueco de CHECK';
    EXCEPTION WHEN not_null_violation OR check_violation THEN NULL;
    END;

    -- US-30 anadira la tabla de ofertas y su FK. El tipo ya es disjunto.
    INSERT INTO public.mensajes (
        conversacion_id, centro_autor_id, autor_usuario_id, tipo, texto, oferta_id
    ) VALUES (conversacion, vendedor, autor, 'oferta', NULL, gen_random_uuid());
    BEGIN
        INSERT INTO public.mensajes (
            conversacion_id, centro_autor_id, autor_usuario_id, tipo, texto, oferta_id
        ) VALUES (conversacion, vendedor, autor, 'oferta', NULL, NULL);
        RAISE EXCEPTION 'Se acepto una oferta sin identificador';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO public.mensajes (
            conversacion_id, centro_autor_id, autor_usuario_id, tipo, texto, oferta_id
        ) VALUES (conversacion, vendedor, autor, 'oferta', 'texto incompatible', gen_random_uuid());
        RAISE EXCEPTION 'Una oferta pudo incluir texto';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.mensajes SET conversacion_id = inexistente WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto una conversacion inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET centro_autor_id = inexistente WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto un centro autor inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET autor_usuario_id = inexistente WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto un usuario autor inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.mensajes SET autor_usuario_id = NULL WHERE id = mensaje;
        RAISE EXCEPTION 'Se acepto un mensaje sin usuario de trazabilidad';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;

    -- La fecha del hilo se actualiza al insertar, sin retroceder si entra
    -- un mensaje anterior despues del mas reciente.
    UPDATE public.conversaciones SET ultimo_mensaje_en = NULL WHERE id = conversacion;
    INSERT INTO public.mensajes (conversacion_id, centro_autor_id, autor_usuario_id, texto, creado_en)
    VALUES (conversacion, vendedor, autor, 'Mensaje nuevo', fecha_nueva);
    INSERT INTO public.mensajes (conversacion_id, centro_autor_id, autor_usuario_id, texto, creado_en)
    VALUES (conversacion, comprador, autor, 'Mensaje anterior insertado despues', fecha_anterior);
    SELECT * INTO fila FROM public.conversaciones WHERE id = conversacion;
    IF fila.ultimo_mensaje_en IS DISTINCT FROM fecha_nueva THEN
        RAISE EXCEPTION 'ultimo_mensaje_en debe conservar la fecha del mensaje mas reciente';
    END IF;
    IF fila.leida_hasta_comprador IS NOT NULL OR fila.leida_hasta_vendedor IS NOT NULL THEN
        RAISE EXCEPTION 'Insertar un mensaje no debe marcarlo como leido';
    END IF;
    UPDATE public.conversaciones SET leida_hasta_comprador = fecha_nueva WHERE id = conversacion;
    SELECT * INTO fila FROM public.conversaciones WHERE id = conversacion;
    IF fila.leida_hasta_comprador IS DISTINCT FROM fecha_nueva OR fila.leida_hasta_vendedor IS NOT NULL THEN
        RAISE EXCEPTION 'Las dos marcas de lectura deben ser independientes';
    END IF;

    -- Las referencias conservan el historial ante borrados fisicos.
    BEGIN
        DELETE FROM public.conversaciones WHERE id = conversacion;
        RAISE EXCEPTION 'Se pudo borrar una conversacion con mensajes';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM public.anuncios WHERE id = anuncio;
        RAISE EXCEPTION 'Se pudo borrar un anuncio con conversaciones';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM auth.users WHERE id = autor;
        RAISE EXCEPTION 'Se pudo borrar el usuario de trazabilidad de los mensajes';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    FOREACH tabla IN ARRAY ARRAY['conversaciones', 'mensajes'] LOOP
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%I', tabla)::regclass) THEN
            RAISE EXCEPTION 'La tabla % debe tener RLS activo', tabla;
        END IF;
        FOREACH cliente IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF has_table_privilege(cliente, format('public.%I', tabla), 'SELECT,INSERT,UPDATE,DELETE') THEN
                RAISE EXCEPTION 'El rol % tiene acceso directo a %', cliente, tabla;
            END IF;
        END LOOP;
        IF EXISTS (
            SELECT 1 FROM pg_class c, LATERAL aclexplode(c.relacl) AS permiso
            WHERE c.oid = format('public.%I', tabla)::regclass AND permiso.grantee = 0
        ) THEN
            RAISE EXCEPTION 'PUBLIC conserva permisos sobre %', tabla;
        END IF;
    END LOOP;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'mensajes'
            AND indexdef LIKE '%(conversacion_id, creado_en%'
    ) THEN
        RAISE EXCEPTION 'Falta el indice de mensajes por conversacion y fecha';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'mensajes'
            AND indexdef LIKE '%(centro_autor_id, creado_en%'
    ) THEN
        RAISE EXCEPTION 'Falta el indice del limite de mensajes por centro y fecha';
    END IF;
END;
$tests$;

-- Probar los roles confirma la denegacion incluso si existe una politica RLS
-- permisiva en otro entorno. Estas consultas nunca exponen datos al cliente.
SET LOCAL ROLE anon;
DO $tests$
BEGIN
    BEGIN
        PERFORM id FROM public.conversaciones LIMIT 1;
        RAISE EXCEPTION 'anon pudo leer conversaciones';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM id FROM public.mensajes LIMIT 1;
        RAISE EXCEPTION 'anon pudo leer mensajes';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$tests$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $tests$
BEGIN
    BEGIN
        PERFORM id FROM public.conversaciones LIMIT 1;
        RAISE EXCEPTION 'authenticated pudo leer conversaciones';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM id FROM public.mensajes LIMIT 1;
        RAISE EXCEPTION 'authenticated pudo leer mensajes';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$tests$;
RESET ROLE;

ROLLBACK;
