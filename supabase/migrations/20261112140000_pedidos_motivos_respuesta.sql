-- T33-2 (#242): respuesta del vendedor y motivo de cierre de pedidos.
-- El motivo anuncio_sin_stock lo escribe la reserva de US-34 (#254).
CREATE TYPE public.pedido_motivo_codigo AS ENUM (
    'sin_unidades',
    'comprometido_otro_centro',
    'entrega_inviable',
    'condiciones_pago',
    'anuncio_sin_stock',
    'ya_no_necesario',
    'otra_opcion',
    'material_no_disponible',
    'sin_acuerdo_entrega',
    'sin_respuesta',
    'error_pedido',
    'otro'
);

ALTER TABLE public.pedidos
    ADD COLUMN respondido_en TIMESTAMPTZ,
    ADD COLUMN motivo_codigo public.pedido_motivo_codigo,
    ADD COLUMN motivo_texto VARCHAR(300),
    ADD COLUMN cerrado_por TEXT,
    ADD CONSTRAINT pedidos_cerrado_por_valido
        CHECK (cerrado_por IN ('vendedor', 'comprador', 'sistema')),
    ADD CONSTRAINT pedidos_motivo_al_cerrar
        CHECK (estado NOT IN ('rechazado', 'cancelado') OR motivo_codigo IS NOT NULL),
    ADD CONSTRAINT pedidos_sin_stock_del_sistema CHECK (
        motivo_codigo <> 'anuncio_sin_stock' OR (
            estado = 'rechazado'
            AND cerrado_por IS NOT DISTINCT FROM 'sistema'
            AND respondido_en IS NOT NULL
        )
    );
