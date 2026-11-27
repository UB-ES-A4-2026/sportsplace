-- T39-1 (#408): columna cancelado_en y su restriccion (US-39 CA11).
-- Ejecutar con psql -v ON_ERROR_STOP=1 despues de aplicar las migraciones,
-- con un usuario administrador. Los datos de prueba se revierten al terminar.
BEGIN;

DO $tests$
DECLARE
    vendedor UUID;
    comprador UUID;
    anuncio UUID;
    pedido UUID;
    descripcion CONSTANT TEXT := 'Doce balones usados una temporada, en buen estado.';
BEGIN
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Vendedor T39-1', 't39-vendedor@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO vendedor;
    INSERT INTO public.centros (
        nombre, email, localidad, politica_privacidad_aceptada,
        politica_privacidad_aceptada_en
    ) VALUES ('Comprador T39-1', 't39-comprador@example.invalid', 'Barcelona', TRUE, now())
    RETURNING id INTO comprador;

    INSERT INTO public.anuncios (
        centro_id, titulo, descripcion, categoria, deporte, unidades_disponibles,
        estado_material, modalidad, precio_unitario_centimos, publicado_en
    ) VALUES (
        vendedor, 'Balones de baloncesto talla 7', descripcion, 'balones', 'baloncesto', 12,
        'buen_estado', 'venta', 850, now()
    ) RETURNING id INTO anuncio;

    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, precio_unitario_centimos, total_centimos,
        metodo_pago, metodo_entrega, estado
    ) VALUES (
        anuncio, comprador, vendedor, 'Balones de baloncesto talla 7', 4, 'venta', 850, 3400,
        'transferencia', 'recogida', 'pendiente'
    ) RETURNING id INTO pedido;

    -- La columna nueva empieza nula.
    IF (SELECT cancelado_en FROM public.pedidos WHERE id = pedido) IS NOT NULL THEN
        RAISE EXCEPTION 'cancelado_en tiene que empezar nulo';
    END IF;

    -- US-39 CA11: cancelado exige cancelado_en (y, como cualquier cierre, motivo).
    BEGIN
        UPDATE public.pedidos
        SET estado = 'cancelado', motivo_codigo = 'ya_no_necesario', cerrado_por = 'comprador'
        WHERE id = pedido;
        RAISE EXCEPTION 'Se acepto un pedido cancelado sin cancelado_en';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    -- Los motivos de cancelacion de los dos papeles estan en el enum.
    PERFORM 'material_no_disponible'::public.pedido_motivo_codigo;
    PERFORM 'sin_acuerdo_entrega'::public.pedido_motivo_codigo;
    PERFORM 'sin_respuesta'::public.pedido_motivo_codigo;
    PERFORM 'error_pedido'::public.pedido_motivo_codigo;
    PERFORM 'otra_opcion'::public.pedido_motivo_codigo;

    UPDATE public.pedidos
    SET estado = 'cancelado', motivo_codigo = 'ya_no_necesario', cerrado_por = 'comprador',
        cancelado_en = now()
    WHERE id = pedido;

    -- Tras cancelar, el mismo comprador puede volver a pedir el anuncio (US-39 CA12, US-32 CA28):
    -- el indice de un solo pendiente por comprador y anuncio ya no lo cuenta.
    INSERT INTO public.pedidos (
        anuncio_id, comprador_centro_id, vendedor_centro_id, titulo_anuncio,
        unidades, modalidad, precio_unitario_centimos, total_centimos,
        metodo_pago, metodo_entrega, estado
    ) VALUES (
        anuncio, comprador, vendedor, 'Balones de baloncesto talla 7', 2, 'venta', 850, 1700,
        'transferencia', 'recogida', 'pendiente'
    );
END
$tests$;

ROLLBACK;
