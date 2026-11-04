-- US-14 (T14-1): modalidad (venta o donacion) y precio por unidad en centimos,
-- segun la «Base comun» de docs/especificacion/E03-publicacion-de-material.md
-- («Modelo de datos») y el CA10 de US-14.
--
-- CA10: los anuncios que ya existen (creados por la rama de US-12) quedan como
-- donacion con precio nulo. El DEFAULT solo sirve para rellenarlos durante la
-- migracion; despues se quita y la API tiene que enviar siempre la modalidad.
ALTER TABLE public.anuncios
    ADD COLUMN modalidad TEXT NOT NULL DEFAULT 'donacion',
    ADD COLUMN precio_unitario_centimos INTEGER,
    ADD CONSTRAINT anuncios_modalidad_valida
        CHECK (modalidad IN ('venta', 'donacion')),
    -- CHECK combinado (CA11: siempre centimos enteros). El IS NOT NULL es
    -- necesario: con un precio nulo, «BETWEEN» da NULL y un CHECK que da NULL
    -- se considera cumplido, asi que sin el una venta sin precio entraria.
    ADD CONSTRAINT anuncios_precio_segun_modalidad
        CHECK (
            (modalidad = 'venta'
                AND precio_unitario_centimos IS NOT NULL
                AND precio_unitario_centimos BETWEEN 1 AND 9999999)
            OR (modalidad = 'donacion' AND precio_unitario_centimos IS NULL)
        );

ALTER TABLE public.anuncios ALTER COLUMN modalidad DROP DEFAULT;
