-- US-68 (T68-2): los centros que se registraron con codigo postal (US-01)
-- antes de esta historia se quedaban sin provincia ni coordenadas. Se copian
-- desde codigos_postales; los que no tienen codigo, o tienen uno que no esta
-- en la tabla, siguen a NULL y ven la banda de CA10.
UPDATE public.centros c
    SET provincia = cp.provincia, latitud = cp.latitud, longitud = cp.longitud
    FROM public.codigos_postales cp
    WHERE cp.codigo_postal = btrim(c.codigo_postal)
        AND c.latitud IS NULL;
