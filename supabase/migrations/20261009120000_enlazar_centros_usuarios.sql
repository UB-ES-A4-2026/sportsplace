-- US-01: cada centro se enlaza con su cuenta de Supabase Auth.
-- Las contrasenas las guarda Supabase Auth; centros no almacena ninguna.
-- Es opcional solo durante el alta: el servidor crea el centro y la cuenta
-- dentro de la misma transaccion y rellena usuario_id antes de confirmarla.
ALTER TABLE public.centros
    ADD COLUMN usuario_id UUID UNIQUE
        REFERENCES auth.users (id) ON DELETE CASCADE;
