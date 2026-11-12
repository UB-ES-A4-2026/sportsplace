-- T42-1 (#247): marca de cobro de US-80 y recepcion de US-42.
-- Especificacion E06 (US-80 CA8) y E07 (US-42 CA13), incluida en la issue #221.
ALTER TABLE public.pedidos
    ADD COLUMN pagado_en TIMESTAMPTZ,
    ADD COLUMN recibido_en TIMESTAMPTZ;

-- US-80 CA8: las donaciones no se cobran.
ALTER TABLE public.pedidos
    ADD CONSTRAINT pedidos_pagado_solo_venta
        CHECK (pagado_en IS NULL OR modalidad = 'venta');

-- US-42 CA13: un pedido recibido siempre guarda cuando se confirmo.
ALTER TABLE public.pedidos
    ADD CONSTRAINT pedidos_recibido_con_fecha
        CHECK (estado <> 'recibido' OR recibido_en IS NOT NULL);
