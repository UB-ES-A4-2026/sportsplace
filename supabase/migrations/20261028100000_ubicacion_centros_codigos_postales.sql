-- US-68 (T68-1): ubicacion del centro a partir de su codigo postal.
-- Tabla local de codigos postales de Espana (sin servicios externos); la
-- semilla esta en la migracion siguiente. Se reutilizan las columnas
-- direccion, codigo_postal y localidad de centros.
CREATE TABLE public.codigos_postales (
    codigo_postal CHAR(5) PRIMARY KEY,
    provincia VARCHAR(60) NOT NULL,
    latitud NUMERIC(8, 5) NOT NULL,
    longitud NUMERIC(8, 5) NOT NULL,

    CONSTRAINT codigos_postales_formato
        CHECK (codigo_postal ~ '^[0-9]{5}$'
            AND codigo_postal BETWEEN '01000' AND '52999'),
    CONSTRAINT codigos_postales_provincia_no_vacia
        CHECK (length(btrim(provincia)) > 0),
    CONSTRAINT codigos_postales_latitud CHECK (latitud BETWEEN -90 AND 90),
    CONSTRAINT codigos_postales_longitud CHECK (longitud BETWEEN -180 AND 180)
);

-- Como el resto del esquema, solo el servidor accede con su credencial.
ALTER TABLE public.codigos_postales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.codigos_postales FROM PUBLIC, anon, authenticated;

-- El servidor copia provincia y coordenadas desde codigos_postales al guardar
-- la ubicacion (CA7). Son nulas en los centros sin codigo postal (Sprint 0).
ALTER TABLE public.centros
    ADD COLUMN provincia VARCHAR(60),
    ADD COLUMN latitud NUMERIC(8, 5),
    ADD COLUMN longitud NUMERIC(8, 5);
