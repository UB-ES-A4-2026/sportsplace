-- US-07 (T07-1): descripcion y datos de contacto publicos del perfil del centro.
-- El telefono de contacto reutiliza la columna existente centros.telefono.
-- El email de acceso (centros.email) no cambia; email_contacto es aparte.
ALTER TABLE public.centros
    ADD COLUMN descripcion TEXT,
    ADD COLUMN email_contacto VARCHAR(254),
    ADD COLUMN web VARCHAR(255),
    ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD CONSTRAINT centros_descripcion_longitud
        CHECK (char_length(descripcion) <= 1000);
