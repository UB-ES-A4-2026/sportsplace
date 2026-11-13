-- T33-2: ejecutar después de aplicar las migraciones, con psql -v ON_ERROR_STOP=1.
BEGIN;

DO $pruebas$
DECLARE
    comprador UUID;
    vendedor UUID;
    anuncio UUID;
    pedido UUID;
    nuevo_pedido UUID;
    estado_final TEXT;
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES ('Comprador T33-2', 'comprador-t33-2@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO comprador;

    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada, politica_privacidad_aceptada_en
    ) VALUES ('Vendedor T33-2', 'vendedor-t33-2@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO vendedor;

    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, publicado_en
    ) VALUES (
        vendedor, 'Balones de prueba', 'Descripción del material deportivo.', 'balones',
        'futbol', 3, 'buen_estado', 'donacion', now()
    ) RETURNING id INTO anuncio;

    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, total_centimos, metodo_entrega
    ) VALUES (anuncio, comprador, vendedor, 'Balones de prueba', 2, 'donacion', 0, 'recogida')
    RETURNING id INTO pedido;

    FOREACH estado_final IN ARRAY ARRAY['rechazado', 'cancelado'] LOOP
        BEGIN
            UPDATE public.pedidos SET estado = estado_final WHERE id = pedido;
            RAISE EXCEPTION 'Se aceptó el estado % sin motivo', estado_final;
        EXCEPTION WHEN check_violation THEN NULL;
        END;
    END LOOP;

    BEGIN
        UPDATE public.pedidos SET motivo_codigo = 'desconocido' WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptó un motivo que no pertenece al enum';
    EXCEPTION WHEN invalid_text_representation THEN NULL;
    END;

    BEGIN
        UPDATE public.pedidos SET motivo_texto = repeat('ñ', 301) WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptó un motivo de más de 300 caracteres';
    EXCEPTION WHEN string_data_right_truncation THEN NULL;
    END;

    BEGIN
        UPDATE public.pedidos SET cerrado_por = 'tercero' WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptó un autor de cierre desconocido';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.pedidos SET estado = 'rechazado', motivo_codigo = 'anuncio_sin_stock',
            respondido_en = now() WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptó un rechazo automático sin autor';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE public.pedidos SET estado = 'rechazado', motivo_codigo = 'anuncio_sin_stock',
            cerrado_por = 'vendedor', respondido_en = now() WHERE id = pedido;
        RAISE EXCEPTION 'Se aceptó el motivo del sistema en un rechazo manual';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    UPDATE public.pedidos SET estado = 'rechazado', motivo_codigo = 'entrega_inviable',
        motivo_texto = repeat('ñ', 300), cerrado_por = 'vendedor', respondido_en = now()
    WHERE id = pedido;

    -- US-79 CA12: el índice parcial permite volver a pedir tras un rechazo.
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, total_centimos, metodo_entrega
    ) VALUES (anuncio, comprador, vendedor, 'Balones de prueba', 2, 'donacion', 0, 'recogida')
    RETURNING id INTO nuevo_pedido;

    UPDATE public.pedidos SET estado = 'rechazado', motivo_codigo = 'anuncio_sin_stock',
        cerrado_por = 'sistema', respondido_en = now()
    WHERE id = nuevo_pedido;

    IF NOT EXISTS (
        SELECT 1 FROM public.pedidos WHERE id = nuevo_pedido AND estado = 'rechazado'
            AND motivo_codigo = 'anuncio_sin_stock' AND cerrado_por = 'sistema' AND respondido_en = now()
    ) THEN
        RAISE EXCEPTION 'No se registró el rechazo automático';
    END IF;
END;
$pruebas$;

ROLLBACK;
