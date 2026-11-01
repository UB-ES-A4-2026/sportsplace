import { leerSesion } from './sesion.js';

// Error de la API con el formato común del contrato (docs/api-contrato.md):
// { error: { code, message, details } }. El frontend decide según `code`, nunca según `message`.
export class ErrorApi extends Error {
  constructor(status, { code = 'ERROR_INTERNO', message = 'Ha ocurrido un error inesperado.', details } = {}) {
    super(message);
    this.name = 'ErrorApi';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Llama a nuestra API. Ejemplo: api('/auth/login', { method: 'POST', body: { email, password } }).
// Si hay sesión guardada, añade la cabecera Authorization. Devuelve el JSON, o null si la respuesta es 204.
// Si `body` es un FormData (multipart, p. ej. las fotos de US-13), se envía tal cual y sin `Content-Type`: el
// navegador lo añade con el `boundary` correcto.
export async function api(ruta, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  const esFormulario = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !esFormulario) headers['Content-Type'] = 'application/json';

  const token = leerSesion()?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method,
      headers,
      body: body === undefined || esFormulario ? body : JSON.stringify(body),
      signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ErrorApi(0, { code: 'SIN_CONEXION', message: 'No se ha podido conectar con el servidor.' });
  }

  if (respuesta.status === 204) return null;

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    // Respuesta sin JSON: se trata según el estado HTTP.
  }

  if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos?.error);
  return datos;
}
