-- T42-1 (#247): restricciones de pagado_en (US-80 CA8) y recibido_en (US-42 CA13).
-- Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las migraciones,
-- con un usuario administrador. Los datos de prueba se revierten al terminar.
BEGIN;

DO $tests$
DECLARE
    vendedor UUID;
    comprador UUID;
    venta UUID;
    donacion UUID;
    pedido UUID;
    pedido_donacion UUID;
    descripcion CONSTANT TEXT := 'Doce balones usados una temporada, en buen estado.';
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Vendedor T42-1', 't42-vendedor@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO vendedor;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Comprador T42-1', 't42-comprador@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO comprador;

    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, 'Balones de baloncesto talla 7', descripcion, 'balones', 'baloncesto', 12,
        'buen_estado', 'venta', 850, now()
    ) RETURNING id INTO venta;
    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, publicado_en
    ) VALUES (
        vendedor, 'Petos de entrenamiento reversibles', descripcion,
        'ropa_equipacion', 'baloncesto', 30, 'buen_estado', 'donacion', now()
    ) RETURNING id INTO donacion;

    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, precio_unitario_centimos, total_centimos,
        metodo_pago, metodo_entrega, estado
    ) VALUES (
        venta, comprador, vendedor, 'Balones de baloncesto talla 7', 4, 'venta', 850, 3400,
        'transferencia', 'recogida', 'aceptado'
    ) RETURNING id INTO pedido;
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, total_centimos, metodo_entrega, estado
    ) VALUES (
        donacion, comprador, vendedor, 'Petos de entrenamiento reversibles',
        10, 'donacion', 0, 'recogida', 'aceptado'
    ) RETURNING id INTO pedido_donacion;

    -- Las columnas nuevas empiezan nulas.
    IF EXISTS (
        SELECT 1 FROM public.pedidos
        WHERE id IN (pedido, pedido_donacion)
            AND (pagado_en IS NOT NULL OR recibido_en IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'pagado_en y recibido_en tienen que empezar nulos';
    END IF;

    -- US-80 CA8: una venta se puede marcar como pagada; una donacion, no.
    UPDATE public.pedidos SET pagado_en = now() WHERE id = pedido;
    BEGIN
        UPDATE public.pedidos SET pagado_en = now() WHERE id = pedido_donacion;
        RAISE EXCEPTION 'Se marco como pagada una donacion';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- US-42 CA13: recibido exige recibido_en.
    BEGIN
        UPDATE public.pedidos SET estado = 'recibido' WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un pedido recibido sin recibido_en';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    UPDATE public.pedidos SET estado = 'recibido', recibido_en = now() WHERE id = pedido;
    UPDATE public.pedidos SET estado = 'recibido', recibido_en = now() WHERE id = pedido_donacion;
END
$tests$;

ROLLBACK;
