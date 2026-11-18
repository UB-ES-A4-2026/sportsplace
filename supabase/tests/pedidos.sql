-- T32-1 (#235): restricciones de pedidos, pago y entrega.
-- Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las migraciones,
-- con un usuario administrador. Los datos de prueba se revierten al terminar.
BEGIN;

DO $tests$
DECLARE
    vendedor UUID;
    comprador UUID;
    otro_comprador UUID;
    venta UUID;
    donacion UUID;
    venta_maxima UUID;
    pedido UUID;
    pedido_donacion UUID;
    pedido_maximo UUID;
    pedido_renovado UUID;
    precio_invalido INTEGER;
    estado_final TEXT;
    rol TEXT;
    permiso TEXT;
    descripcion CONSTANT TEXT := 'Doce balones usados una temporada, en buen estado.';
    titulo CONSTANT TEXT := 'Balones de baloncesto talla 7';
    direccion CONSTANT JSONB := '{"destinatario":"Centro comprador","calle_numero":"Carrer de Verdi 12","codigo_postal":"08012","localidad":"Barcelona","provincia":"Barcelona","telefono_contacto":"612345678"}';
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Vendedor T32-1', 't32-vendedor@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO vendedor;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Comprador T32-1', 't32-comprador@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO comprador;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Otro comprador T32-1', 't32-otro@example.invalid', 'Sabadell', TRUE, now())
    RETURNING id INTO otro_comprador;

    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, titulo, descripcion, 'balones', 'baloncesto', 12,
        'buen_estado', 'venta', 850, now()
    ) RETURNING id INTO venta;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, publicado_en
    ) VALUES (
        vendedor, 'Petos de entrenamiento reversibles', descripcion,
        'ropa_equipacion', 'baloncesto', 30, 'buen_estado', 'donacion', now()
    ) RETURNING id INTO donacion;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, 'Material al precio maximo', descripcion, 'otros', 'varios',
        9999, 'nuevo', 'venta', 9999999, now()
    ) RETURNING id INTO venta_maxima;

    -- Venta y donacion validas, con mensaje nulo y estado inicial por defecto.
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, precio_unitario_centimos, total_centimos,
        metodo_pago, metodo_entrega
    ) VALUES (
        venta, comprador, vendedor, titulo, 4, 'venta', 850, 3400,
        'transferencia', 'recogida'
    ) RETURNING id INTO pedido;
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, total_centimos, metodo_entrega
    ) VALUES (
        donacion, comprador, vendedor, 'Petos de entrenamiento reversibles',
        10, 'donacion', 0, 'recogida'
    ) RETURNING id INTO pedido_donacion;
    IF NOT EXISTS (
        SELECT 1 FROM public.pedidos WHERE id = pedido
            AND estado = 'pendiente' AND mensaje IS NULL
            AND creado_en IS NOT NULL AND actualizado_en IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'El pedido no conserva los valores iniciales esperados';
    END IF;

    -- El importe maximo admitido por un anuncio y sus unidades supera INTEGER.
    -- Efectivo y envio tambien son compatibles (US-35 CA8).
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, precio_unitario_centimos, total_centimos,
        metodo_pago, metodo_entrega, direccion_envio
    ) VALUES (
        venta_maxima, comprador, vendedor, 'Material al precio maximo',
        9999, 'venta', 9999999, 99989990001,
        'efectivo_recogida', 'envio', direccion
    ) RETURNING id INTO pedido_maximo;
    IF (SELECT total_centimos FROM public.pedidos WHERE id = pedido_maximo) <> 99989990001 THEN
        RAISE EXCEPTION 'El total grande se desborda o cambia de valor';
    END IF;

    -- Limites de titulo y mensaje en caracteres, incluidos caracteres Unicode.
    UPDATE public.pedidos SET titulo_anuncio = repeat('a', 5) WHERE id = pedido;
    UPDATE public.pedidos SET titulo_anuncio = repeat('a', 80) WHERE id = pedido;
    UPDATE public.pedidos SET titulo_anuncio = titulo, mensaje = repeat('ñ', 500)
        WHERE id = pedido;
    UPDATE public.pedidos SET mensaje = NULL WHERE id = pedido;
    BEGIN
        UPDATE public.pedidos SET titulo_anuncio = repeat('a', 4) WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un titulo de cuatro caracteres';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET titulo_anuncio = repeat('a', 81) WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un titulo de 81 caracteres';
    EXCEPTION WHEN string_data_right_truncation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET mensaje = repeat('ñ', 501) WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un mensaje de 501 caracteres';
    EXCEPTION WHEN string_data_right_truncation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET mensaje = '' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto el mensaje vacio en lugar de NULL';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET mensaje = '   ' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un mensaje compuesto solo por espacios';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    UPDATE public.pedidos SET unidades = 1, total_centimos = 850 WHERE id = pedido;
    UPDATE public.pedidos SET unidades = 4, total_centimos = 3400 WHERE id = pedido;
    BEGIN
        UPDATE public.pedidos SET unidades = 0, total_centimos = 0 WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptaron cero unidades';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET unidades = -1, total_centimos = -850 WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptaron unidades negativas';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET unidades = NULL WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptaron unidades nulas';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET modalidad = 'regalo' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto una modalidad desconocida';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Las comparaciones con NULL no deben permitir ventas sin precio o pago.
    BEGIN
        UPDATE public.pedidos SET precio_unitario_centimos = NULL WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto una venta sin precio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    FOREACH precio_invalido IN ARRAY ARRAY[-1, 0, 10000000] LOOP
        BEGIN
            UPDATE public.pedidos SET precio_unitario_centimos = precio_invalido,
                total_centimos = unidades::BIGINT * precio_invalido WHERE id = pedido;
            RAISE EXCEPTION 'Se acepto un precio fuera de rango: %', precio_invalido;
        EXCEPTION WHEN check_violation THEN NULL;
        END;
    END LOOP;
    BEGIN
        UPDATE public.pedidos SET total_centimos = 3399 WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un total distinto del producto';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET total_centimos = NULL WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un total nulo';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET precio_unitario_centimos = 850 WHERE id = pedido_donacion;
        RAISE EXCEPTION 'Se acepto una donacion con precio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET total_centimos = 1 WHERE id = pedido_donacion;
        RAISE EXCEPTION 'Se acepto una donacion con total distinto de cero';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET metodo_pago = NULL WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto una venta sin forma de pago';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET metodo_pago = 'tarjeta' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto una forma de pago desconocida';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET metodo_pago = 'transferencia' WHERE id = pedido_donacion;
        RAISE EXCEPTION 'Se acepto una donacion con forma de pago';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.pedidos SET metodo_entrega = 'correo' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un metodo de entrega desconocido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET metodo_entrega = NULL WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un metodo de entrega nulo';
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET metodo_entrega = 'envio' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto envio sin direccion';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET direccion_envio = direccion WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto recogida con direccion de envio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET direccion_envio = NULL WHERE id = pedido_maximo;
        RAISE EXCEPTION 'Se acepto borrar la direccion de un envio';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.pedidos SET comprador_centro_id = vendedor WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un pedido al propio centro';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET anuncio_id = gen_random_uuid() WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un anuncio inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET comprador_centro_id = gen_random_uuid() WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un comprador inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET vendedor_centro_id = gen_random_uuid() WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un vendedor inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.pedidos SET estado = 'desconocido' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un estado desconocido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO public.pedidos (
            anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
            unidades, modalidad, precio_unitario_centimos, total_centimos,
            metodo_pago, metodo_entrega
        ) VALUES (venta, comprador, vendedor, titulo, 1, 'venta', 850, 850,
            'transferencia', 'recogida');
        RAISE EXCEPTION 'Se aceptaron dos pendientes del mismo comprador y anuncio';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    -- Otros compradores pueden pedir aunque la suma supere el stock actual.
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, precio_unitario_centimos, total_centimos,
        metodo_pago, metodo_entrega
    ) VALUES (venta, otro_comprador, vendedor, titulo, 12, 'venta', 850, 10200,
        'transferencia', 'recogida');

    pedido_renovado := pedido;
    FOREACH estado_final IN ARRAY ARRAY['rechazado', 'cancelado'] LOOP
        IF to_regtype('public.pedido_motivo_codigo') IS NULL THEN
            UPDATE public.pedidos SET estado = estado_final WHERE id = pedido_renovado;
        ELSE
            UPDATE public.pedidos SET estado = estado_final,
                motivo_codigo = CASE WHEN estado_final = 'rechazado'
                    THEN 'sin_unidades'::public.pedido_motivo_codigo
                    ELSE 'ya_no_necesario'::public.pedido_motivo_codigo END,
                cerrado_por = CASE WHEN estado_final = 'rechazado' THEN 'vendedor' ELSE 'comprador' END,
                respondido_en = CASE WHEN estado_final = 'rechazado' THEN now() ELSE NULL END
            WHERE id = pedido_renovado;
        END IF;
        INSERT INTO public.pedidos (
            anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
            unidades, modalidad, precio_unitario_centimos, total_centimos,
            metodo_pago, metodo_entrega
        ) VALUES (venta, comprador, vendedor, titulo, 4, 'venta', 850, 3400,
            'transferencia', 'recogida') RETURNING id INTO pedido_renovado;
    END LOOP;
    IF (SELECT count(*) FROM public.pedidos
        WHERE anuncio_id = venta AND estado = 'pendiente') <> 2 THEN
        RAISE EXCEPTION 'El indice parcial impide pedidos validos de compradores distintos';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.anuncios
        WHERE id = venta AND unidades_disponibles = 12 AND estado = 'activo') THEN
        RAISE EXCEPTION 'Crear pedidos ha modificado el stock o el estado del anuncio';
    END IF;

    -- El pedido conserva el titulo, el precio y la direccion que se copiaron.
    UPDATE public.anuncios SET titulo = 'Titulo actualizado del anuncio',
        precio_unitario_centimos = 1200 WHERE id = venta;
    UPDATE public.centros SET direccion = 'Otra calle 99' WHERE id = comprador;
    IF NOT EXISTS (SELECT 1 FROM public.pedidos WHERE id = pedido
        AND titulo_anuncio = titulo AND precio_unitario_centimos = 850
        AND total_centimos = 3400 AND mensaje IS NULL) THEN
        RAISE EXCEPTION 'Editar el anuncio ha alterado el snapshot del pedido';
    END IF;
    IF (SELECT direccion_envio FROM public.pedidos WHERE id = pedido_maximo) <> direccion THEN
        RAISE EXCEPTION 'Editar el centro ha alterado la direccion copiada en el pedido';
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pedidos'::regclass) THEN
        RAISE EXCEPTION 'pedidos debe tener RLS activado';
    END IF;
    FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        FOREACH permiso IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
            IF has_table_privilege(rol, 'public.pedidos', permiso) THEN
                RAISE EXCEPTION 'El rol % conserva el permiso directo % sobre pedidos', rol, permiso;
            END IF;
        END LOOP;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM pg_class c,
            LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE c.oid = 'public.pedidos'::regclass AND a.grantee = 0
    ) THEN
        RAISE EXCEPTION 'PUBLIC conserva permisos directos sobre pedidos';
    END IF;
END;
$tests$;

ROLLBACK;
