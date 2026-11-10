-- T28-1 (#268): US-28 CA27-CA29 y marcas de lectura de US-77 CA7.
-- La API crea la conversacion y el primer mensaje en una sola transaccion.
-- Las referencias conservan el historial; los centros se eliminan logicamente.
CREATE TABLE public.conversaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id UUID NOT NULL REFERENCES public.anuncios (id),
    centro_comprador_id UUID NOT NULL REFERENCES public.centros (id),
    centro_vendedor_id UUID NOT NULL REFERENCES public.centros (id),
    ultimo_mensaje_en TIMESTAMPTZ,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    leida_hasta_comprador TIMESTAMPTZ,
    leida_hasta_vendedor TIMESTAMPTZ,

    CONSTRAINT conversaciones_centros_distintos
        CHECK (centro_comprador_id <> centro_vendedor_id),
    CONSTRAINT conversaciones_anuncio_comprador_unico
        UNIQUE (anuncio_id, centro_comprador_id)
);

CREATE TABLE public.mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES public.conversaciones (id),
    centro_autor_id UUID NOT NULL REFERENCES public.centros (id),
    autor_usuario_id UUID NOT NULL REFERENCES auth.users (id),
    tipo TEXT NOT NULL DEFAULT 'texto',
    texto VARCHAR(2000),
    -- US-30 creara ofertas y anadira su FK. Su tabla aun no existe en US-28.
    oferta_id UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT mensajes_tipo_valido CHECK (tipo IN ('texto', 'oferta')),
    CONSTRAINT mensajes_contenido_segun_tipo CHECK (
        (tipo = 'texto' AND texto IS NOT NULL
            AND char_length(texto) BETWEEN 1 AND 2000
            AND texto !~ '^[[:space:]]*$'
            AND oferta_id IS NULL)
        OR (tipo = 'oferta' AND texto IS NULL AND oferta_id IS NOT NULL)
    )
);

-- El id desempata mensajes con el mismo instante para los cursores antes/despues.
CREATE INDEX mensajes_conversacion_fecha
    ON public.mensajes (conversacion_id, creado_en, id);

-- US-28 CA26: recuento de mensajes recientes enviados por un centro.
CREATE INDEX mensajes_autor_fecha
    ON public.mensajes (centro_autor_id, creado_en);

-- US-77: conversaciones de un anuncio por su ultimo mensaje.
CREATE INDEX conversaciones_anuncio_ultimo_mensaje
    ON public.conversaciones (anuncio_id, ultimo_mensaje_en DESC, id);

CREATE FUNCTION public.actualizar_ultimo_mensaje_conversacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- GREATEST evita retroceder si una transaccion anterior confirma mas tarde.
    UPDATE public.conversaciones
    SET ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NEW.creado_en)
    WHERE id = NEW.conversacion_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER mensajes_actualizar_ultimo_mensaje
    AFTER INSERT ON public.mensajes
    FOR EACH ROW EXECUTE FUNCTION public.actualizar_ultimo_mensaje_conversacion();

-- El cliente consume la API. La API valida pertenencia del centro a la
-- conversacion y obtiene la identidad del autor de la sesion.
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversaciones, public.mensajes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.actualizar_ultimo_mensaje_conversacion() FROM PUBLIC, anon, authenticated;
