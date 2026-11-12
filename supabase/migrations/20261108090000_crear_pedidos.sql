-- T32-1 (#235): pedidos de US-32, pago de US-35 y entrega de US-40.
-- Especificacion E06 (base comun) y US-40 CA21, incluida en la issue #219.
CREATE TABLE public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id UUID NOT NULL REFERENCES public.anuncios (id),
    comprador_centro_id UUID NOT NULL REFERENCES public.centros (id),
    vendedor_centro_id UUID NOT NULL REFERENCES public.centros (id),
    titulo_anuncio VARCHAR(80) NOT NULL,
    unidades INTEGER NOT NULL,
    modalidad TEXT NOT NULL,
    precio_unitario_centimos INTEGER,
    -- El producto de 9999 unidades por 9999999 centimos supera INTEGER.
    total_centimos BIGINT NOT NULL,
    mensaje VARCHAR(500),
    estado TEXT NOT NULL DEFAULT 'pendiente',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    metodo_pago TEXT,
    metodo_entrega TEXT NOT NULL,
    direccion_envio JSONB,

    CONSTRAINT pedidos_centros_distintos
        CHECK (comprador_centro_id <> vendedor_centro_id),
    CONSTRAINT pedidos_titulo_longitud
        CHECK (char_length(titulo_anuncio) BETWEEN 5 AND 80),
    CONSTRAINT pedidos_unidades_positivas CHECK (unidades >= 1),
    CONSTRAINT pedidos_modalidad_valida
        CHECK (modalidad IN ('venta', 'donacion')),
    CONSTRAINT pedidos_precio_segun_modalidad CHECK (
        (modalidad = 'venta' AND precio_unitario_centimos IS NOT NULL
            AND precio_unitario_centimos BETWEEN 1 AND 9999999)
        OR (modalidad = 'donacion' AND precio_unitario_centimos IS NULL)
    ),
    CONSTRAINT pedidos_total_coherente CHECK (
        (modalidad = 'venta'
            AND total_centimos = unidades::BIGINT * precio_unitario_centimos)
        OR (modalidad = 'donacion' AND total_centimos = 0)
    ),
    -- La API convierte el mensaje vacio a NULL antes de insertar.
    CONSTRAINT pedidos_mensaje_no_vacio
        CHECK (mensaje IS NULL OR char_length(btrim(mensaje)) > 0),
    CONSTRAINT pedidos_estado_valido CHECK (
        estado IN ('pendiente', 'aceptado', 'rechazado', 'cancelado', 'recibido')
    ),
    CONSTRAINT pedidos_pago_segun_modalidad CHECK (
        (modalidad = 'venta' AND metodo_pago IS NOT NULL
            AND metodo_pago IN ('transferencia', 'efectivo_recogida'))
        OR (modalidad = 'donacion' AND metodo_pago IS NULL)
    ),
    CONSTRAINT pedidos_entrega_valida
        CHECK (metodo_entrega IN ('recogida', 'envio')),
    CONSTRAINT pedidos_direccion_segun_entrega
        CHECK ((metodo_entrega = 'envio') = (direccion_envio IS NOT NULL))
);

-- US-32 CA13/CA22/CA24/CA28: distintos compradores pueden pedir el mismo
-- anuncio; solo se impide duplicar un pendiente del mismo comprador.
CREATE UNIQUE INDEX pedidos_anuncio_comprador_pendiente_unico
    ON public.pedidos (anuncio_id, comprador_centro_id)
    WHERE estado = 'pendiente';

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pedidos FROM PUBLIC, anon, authenticated;
