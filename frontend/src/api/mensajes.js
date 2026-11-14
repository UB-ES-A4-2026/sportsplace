import { api } from './cliente.js';

// Rutas de conversaciones y mensajes del contrato (docs/api-contrato.md, US-28 T28-2). `llamarApi` solo se cambia
// en los tests.

// CA3 y CA19: GET /api/anuncios/:id/conversacion. Devuelve { id } si el centro ya habló de ese anuncio, o null.
export async function conversacionDelAnuncio(anuncioId, { signal } = {}, llamarApi = api) {
  const { conversacion } = await llamarApi(`/anuncios/${encodeURIComponent(anuncioId)}/conversacion`, { signal });
  return conversacion;
}

// CA20: POST /api/conversaciones con el primer mensaje. Responde 201 { conversacion, mensaje }.
export async function crearConversacion({ anuncioId, texto }, llamarApi = api) {
  return llamarApi('/conversaciones', { method: 'POST', body: { anuncio_id: anuncioId, texto } });
}

// CA14 y CA22: GET /api/conversaciones/:id. Sin opciones, los 50 más recientes; `antes` trae los 50 anteriores a
// ese mensaje y `despues`, los posteriores (sondeo). Responde 200 { conversacion, mensajes, hay_anteriores }.
export async function obtenerConversacion(id, { antes, despues, signal } = {}, llamarApi = api) {
  const parametros = new URLSearchParams();
  if (antes) parametros.set('antes', antes);
  if (despues) parametros.set('despues', despues);
  const consulta = parametros.size > 0 ? `?${parametros}` : '';
  return llamarApi(`/conversaciones/${encodeURIComponent(id)}${consulta}`, { signal });
}

// CA12 y CA25: POST /api/conversaciones/:id/mensajes. Responde 201 { mensaje }.
export async function enviarMensaje(id, texto, llamarApi = api) {
  const { mensaje } = await llamarApi(`/conversaciones/${encodeURIComponent(id)}/mensajes`, {
    method: 'POST', body: { texto },
  });
  return mensaje;
}
