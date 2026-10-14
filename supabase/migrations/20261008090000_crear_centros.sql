-- Base de datos de TR-03. La autenticacion se decide por separado.
-- No almacena contrasenas ni vincula los centros a auth.users.
CREATE TABLE public.centros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    localidad VARCHAR(120) NOT NULL,
    direccion VARCHAR(255),
    codigo_postal VARCHAR(20),
    telefono VARCHAR(30),
    politica_privacidad_aceptada BOOLEAN NOT NULL,
    politica_privacidad_aceptada_en TIMESTAMPTZ NOT NULL,
    email_confirmado_en TIMESTAMPTZ,
    email_confirmado BOOLEAN
        GENERATED ALWAYS AS (email_confirmado_en IS NOT NULL) STORED,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT centros_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
    CONSTRAINT centros_email_no_vacio CHECK (length(btrim(email)) > 0),
    CONSTRAINT centros_localidad_no_vacia CHECK (length(btrim(localidad)) > 0),
    CONSTRAINT centros_privacidad_aceptada CHECK (politica_privacidad_aceptada)
);

-- El email es unico incluso si cambia el uso de mayusculas o los espacios
-- al principio o al final. El servidor podra normalizarlo antes de guardarlo.
CREATE UNIQUE INDEX centros_email_unico
    ON public.centros (lower(btrim(email)));

-- Hasta acordar la autenticacion y sus permisos no hay acceso desde el cliente.
-- La conexion del servidor se hara con una credencial privada de PostgreSQL.
ALTER TABLE public.centros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.centros FROM PUBLIC, anon, authenticated;
