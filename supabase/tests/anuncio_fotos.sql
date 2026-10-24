-- T13-1: ejecutar con psql -v ON_ERROR_STOP=1 en base aislada, tras las
-- migraciones reales y una semilla con al menos un anuncio. Todo hace ROLLBACK.
BEGIN;

DO $tests$
DECLARE
    anuncio UUID;
    foto UUID;
BEGIN
    SELECT id INTO anuncio FROM public.anuncios LIMIT 1;
    IF anuncio IS NULL THEN RAISE EXCEPTION 'Hace falta un anuncio de prueba de T12-1/T12-8'; END IF;
    -- Solo dentro de esta transaccion para no colisionar con fotos de la semilla.
    DELETE FROM public.anuncio_fotos WHERE anuncio_id = anuncio;
    INSERT INTO public.anuncio_fotos (anuncio_id, ruta, tipo_mime, bytes, orden, es_principal)
      VALUES (anuncio, 'centro/anuncio/prueba.png', 'image/png', 1, 1, true) RETURNING id INTO foto;
    IF foto IS NULL THEN RAISE EXCEPTION 'Falta el UUID generado'; END IF;
    UPDATE public.anuncio_fotos SET bytes=5242880, orden=8 WHERE id=foto;
    BEGIN
      UPDATE public.anuncio_fotos SET bytes=5242881 WHERE id=foto;
      RAISE EXCEPTION 'Se acepto una foto de mas de 5 MB';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.anuncio_fotos SET bytes=0 WHERE id=foto;
      RAISE EXCEPTION 'Se acepto una foto vacia';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.anuncio_fotos SET orden=9 WHERE id=foto;
      RAISE EXCEPTION 'Se acepto orden 9';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.anuncio_fotos SET orden=0 WHERE id=foto;
      RAISE EXCEPTION 'Se acepto orden 0';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.anuncio_fotos (anuncio_id, ruta, tipo_mime, bytes, orden, es_principal)
        VALUES (anuncio, 'otra.png', 'image/png', 1, 8, false);
      RAISE EXCEPTION 'Se acepto orden duplicado';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.anuncio_fotos (anuncio_id, ruta, tipo_mime, bytes, orden, es_principal)
        VALUES (anuncio, 'otra.png', 'image/png', 1, 2, true);
      RAISE EXCEPTION 'Se aceptaron dos principales';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    BEGIN
      UPDATE public.anuncio_fotos SET anuncio_id=gen_random_uuid() WHERE id=foto;
      RAISE EXCEPTION 'Se acepto referencia a anuncio inexistente';
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    IF has_table_privilege('anon', 'public.anuncio_fotos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.anuncio_fotos', 'INSERT') THEN
      RAISE EXCEPTION 'Los clientes no deben acceder a metadatos directamente';
    END IF;
    IF NOT EXISTS (SELECT FROM storage.buckets WHERE id='anuncios' AND public
      AND file_size_limit=5242880 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']) THEN
      RAISE EXCEPTION 'Bucket mal configurado';
    END IF;
    DELETE FROM public.anuncios WHERE id=anuncio;
    IF EXISTS (SELECT FROM public.anuncio_fotos WHERE id=foto) THEN
      RAISE EXCEPTION 'No se aplico ON DELETE CASCADE';
    END IF;
END $tests$;

-- Incluso con una politica permisiva ajena, un cliente no lista este bucket.
CREATE POLICY t13_test_permisiva ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO storage.objects (bucket_id, name) VALUES ('anuncios', 't13-prueba-permisos.png');
SET LOCAL ROLE anon;
DO $anon$
BEGIN
  IF EXISTS (SELECT FROM storage.objects WHERE bucket_id='anuncios') THEN
    RAISE EXCEPTION 'anon puede listar anuncios';
  END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('anuncios', 'anon.png');
    RAISE EXCEPTION 'anon puede escribir';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anon$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $authenticated$
BEGIN
  IF EXISTS (SELECT FROM storage.objects WHERE bucket_id='anuncios') THEN
    RAISE EXCEPTION 'authenticated puede listar anuncios';
  END IF;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('anuncios', 'authenticated.png');
    RAISE EXCEPTION 'authenticated puede escribir';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $authenticated$;
RESET ROLE;
ROLLBACK;
