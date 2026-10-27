-- US-12 (T12-1): tabla de anuncios de la epica E03, segun la «Base comun»
-- (docs/especificacion/E03-publicacion-de-material.md, «Modelo de datos»).
-- No incluye modalidad ni precio_unitario_centimos (los anade US-14, T14-1)
-- ni el estado 'borrador' (lo anade US-20).
CREATE TABLE public.anuncios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centro_id UUID NOT NULL REFERENCES public.centros (id) ON DELETE CASCADE,
    titulo VARCHAR(80) NOT NULL,
    descripcion VARCHAR(1000) NOT NULL,
    categoria TEXT NOT NULL,
    deporte TEXT NOT NULL,
    unidades_disponibles INTEGER NOT NULL,
    estado_material TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activo',
    publicado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    retirado_en TIMESTAMPTZ,
    entregado_en TIMESTAMPTZ,

    -- Longitudes en caracteres Unicode: un emoji o una «ñ» cuentan 1.
    CONSTRAINT anuncios_titulo_longitud
        CHECK (char_length(titulo) BETWEEN 5 AND 80),
    CONSTRAINT anuncios_descripcion_longitud
        CHECK (char_length(descripcion) BETWEEN 20 AND 1000),
    CONSTRAINT anuncios_categoria_valida CHECK (categoria IN (
        'balones', 'ropa_equipacion', 'calzado', 'protecciones',
        'material_entrenamiento', 'porterias_redes', 'maquinas_fitness', 'otros'
    )),
    CONSTRAINT anuncios_deporte_valido CHECK (deporte IN (
        'futbol', 'baloncesto', 'balonmano', 'voleibol', 'tenis',
        'padel', 'natacion', 'atletismo', 'gimnasio_fitness', 'varios'
    )),
    -- 0 queda reservado para US-34; la API solo acepta de 1 a 9999.
    CONSTRAINT anuncios_unidades_rango
        CHECK (unidades_disponibles BETWEEN 0 AND 9999),
    CONSTRAINT anuncios_estado_material_valido CHECK (estado_material IN (
        'nuevo', 'como_nuevo', 'buen_estado', 'usado', 'para_reparar'
    )),
    CONSTRAINT anuncios_estado_valido CHECK (estado IN (
        'activo', 'pausado', 'reservado', 'entregado', 'retirado'
    )),
    -- publicado_en solo puede ser nulo en un borrador (US-20).
    CONSTRAINT anuncios_publicado_en_fuera_de_borrador
        CHECK (estado = 'borrador' OR publicado_en IS NOT NULL),
    -- retirado_en y entregado_en son nulos salvo en ese estado.
    CONSTRAINT anuncios_retirado_en_coherente
        CHECK ((estado = 'retirado') = (retirado_en IS NOT NULL)),
    CONSTRAINT anuncios_entregado_en_coherente
        CHECK ((estado = 'entregado') = (entregado_en IS NOT NULL))
);

-- Listado «Mis anuncios» (US-18): anuncios de un centro por estado y fecha.
CREATE INDEX anuncios_centro_estado_actualizado
    ON public.anuncios (centro_id, estado, actualizado_en DESC);

-- Igual que centros: el cliente nunca accede directamente a la tabla; solo
-- nuestra API, con su conexion privada. Sin esto, la clave publica de Supabase
-- permitiria leer y escribir anuncios saltandose la API.
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.anuncios FROM PUBLIC, anon, authenticated;
