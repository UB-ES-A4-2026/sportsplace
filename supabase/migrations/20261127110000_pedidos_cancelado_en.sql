-- T39-1 (#408): cancelar un pedido (US-39 CA11, E06).
-- Los motivos de cancelacion (ya_no_necesario, otra_opcion, material_no_disponible,
-- sin_acuerdo_entrega, sin_respuesta, error_pedido y otro) ya estan en el enum
-- pedido_motivo_codigo desde 20261112140000; aqui solo falta la fecha.
ALTER TABLE public.pedidos
    ADD COLUMN cancelado_en TIMESTAMPTZ;

-- Por si algun pedido se marco como cancelado a mano antes de esta migracion.
UPDATE public.pedidos
SET cancelado_en = actualizado_en
WHERE estado = 'cancelado' AND cancelado_en IS NULL;

-- Igual que recibido_en (US-42 CA13): un pedido cancelado guarda cuando se cancelo.
ALTER TABLE public.pedidos
    ADD CONSTRAINT pedidos_cancelado_con_fecha
        CHECK (estado <> 'cancelado' OR cancelado_en IS NOT NULL);
