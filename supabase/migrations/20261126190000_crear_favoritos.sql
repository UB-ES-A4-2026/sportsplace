-- T25-1 (#405): favoritos de US-25 (CA17, CA18 y CA7).
-- Los favoritos son del centro (CA10): cualquier usuario del centro ve los mismos.
-- La API limita a 500 por centro (CA11) y comprueba la visibilidad del anuncio.
CREATE TABLE public.favoritos (
    centro_id UUID NOT NULL REFERENCES public.centros (id) ON DELETE CASCADE,
    anuncio_id UUID NOT NULL REFERENCES public.anuncios (id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT favoritos_pkey PRIMARY KEY (centro_id, anuncio_id)
);

-- CA6: favoritos del centro, del guardado mas reciente al mas antiguo.
CREATE INDEX favoritos_centro_creado
    ON public.favoritos (centro_id, creado_en DESC, anuncio_id);

-- CA7: la retirada es logica (el anuncio no se borra), asi que sus favoritos
-- se borran al pasar a `retirado`.
CREATE FUNCTION public.borrar_favoritos_anuncio_retirado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.favoritos WHERE anuncio_id = NEW.id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER anuncios_borrar_favoritos_al_retirar
    AFTER UPDATE OF estado ON public.anuncios
    FOR EACH ROW
    WHEN (NEW.estado = 'retirado' AND OLD.estado IS DISTINCT FROM 'retirado')
    EXECUTE FUNCTION public.borrar_favoritos_anuncio_retirado();

-- CA18: el cliente consume la API, que solo lee y cambia los favoritos del
-- centro de la sesion.
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.favoritos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.borrar_favoritos_anuncio_retirado() FROM PUBLIC, anon, authenticated;
