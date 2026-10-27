-- T13-1 / US-13. Requiere public.anuncios de T12-1 (US-12).
-- Aplicar solo tras revisar con backend y actualizar US-13 desde dev.
CREATE TABLE public.anuncio_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id UUID NOT NULL REFERENCES public.anuncios (id) ON DELETE CASCADE,
    ruta TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    orden SMALLINT NOT NULL,
    es_principal BOOLEAN NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT anuncio_fotos_tipo_mime_valido
        CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT anuncio_fotos_bytes_validos CHECK (bytes BETWEEN 1 AND 5242880),
    CONSTRAINT anuncio_fotos_orden_valido CHECK (orden BETWEEN 1 AND 8),
    CONSTRAINT anuncio_fotos_orden_unico UNIQUE (anuncio_id, orden)
);

CREATE UNIQUE INDEX anuncio_fotos_principal_unica
    ON public.anuncio_fotos (anuncio_id) WHERE es_principal;

-- El backend accede a los metadatos mediante su conexion privada.
-- La eleccion de una principal y el conjunto de 1-8 fotos son atomicos en T13-2.
ALTER TABLE public.anuncio_fotos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anuncio_fotos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.anuncio_fotos TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('anuncios', 'anuncios', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Las URLs /object/public/anuncios/... funcionan por ser un bucket publico.
-- NO se concede SELECT a clientes: eso permitiria listar los objetos.
-- La restriccion prevalece incluso ante politicas permisivas genericas previas.
-- service_role (solo servidor) conserva su bypass de RLS para subir y borrar.
CREATE POLICY anuncios_solo_servidor ON storage.objects
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (bucket_id <> 'anuncios')
    WITH CHECK (bucket_id <> 'anuncios');
