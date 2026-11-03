import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../errors.js';

// US-13 CA18 y CA21: fotos de los anuncios en Supabase Storage, bucket
// `anuncios` (lectura pública por URL, sin listado). Solo el servidor escribe,
// con la clave de servicio SUPABASE_SERVICE_ROLE_KEY, que nunca llega a la web.
export const BUCKET_FOTOS = 'anuncios';

export function storageUnavailable() {
  return new ApiError(503, 'ALMACENAMIENTO_NO_DISPONIBLE', 'No se han podido guardar las fotos. Inténtalo más tarde.');
}

// URL pública de un objeto del bucket. Solo depende de SUPABASE_URL, así que
// las fichas muestran sus fotos aunque el servidor no tenga la clave de servicio.
export function urlPublicaFoto(supabaseUrl, ruta) {
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${BUCKET_FOTOS}/${ruta}`;
}

export function createFotosStorage({
  environment = process.env,
  clientFactory = createClient,
} = {}) {
  const url = environment.SUPABASE_URL?.trim();
  const key = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const bucket = clientFactory(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).storage.from(BUCKET_FOTOS);

  return {
    // CA18: se guarda el archivo tal cual, sin redimensionar. upsert: false
    // garantiza que nunca se sobrescribe otra foto.
    async subir(ruta, contenido, tipoMime) {
      let error;
      try {
        ({ error } = await bucket.upload(ruta, contenido, { contentType: tipoMime, upsert: false }));
      } catch (excepcion) {
        error = excepcion;
      }
      if (error) {
        console.error(`No se pudo subir una foto a Storage: ${error?.statusCode ?? error?.name ?? 'error desconocido'}`);
        throw storageUnavailable();
      }
    },

    // CA20: borrado compensatorio. Nunca lanza: si falla, queda registrado.
    async borrar(rutas) {
      if (rutas.length === 0) return;
      try {
        const { error } = await bucket.remove(rutas);
        if (error) throw error;
      } catch (error) {
        console.error(`No se pudieron borrar ${rutas.length} fotos de Storage: ${error?.statusCode ?? error?.name ?? 'error desconocido'}`);
      }
    },
  };
}
