-- T33-1 (US-109): la bandeja de pedidos lista y cuenta por centro y estado,
-- del más nuevo al más antiguo. Un índice por cada papel del centro.
CREATE INDEX pedidos_vendedor_estado_creado
    ON public.pedidos (vendedor_centro_id, estado, creado_en DESC);

CREATE INDEX pedidos_comprador_estado_creado
    ON public.pedidos (comprador_centro_id, estado, creado_en DESC);
