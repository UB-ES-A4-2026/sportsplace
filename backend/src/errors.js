// Formato común de errores de la API (TR-06):
// { "error": { "code": "CODIGO_EN_MAYUSCULAS", "message": "Texto para mostrar" } }
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(response, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  response.status(status).json({ error });
}

export function notFoundHandler(request, response) {
  sendError(response, 404, 'NO_ENCONTRADO', 'Recurso no encontrado.');
}

export function methodNotAllowed(allowed) {
  return (request, response) => {
    response.set('Allow', allowed.join(', '));
    sendError(response, 405, 'METODO_NO_PERMITIDO', 'Método no permitido.');
  };
}

// Express reconoce el manejador de errores por sus cuatro parámetros.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, request, response, next) {
  if (error instanceof ApiError) {
    sendError(response, error.status, error.code, error.message, error.details);
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    sendError(response, 400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido.');
    return;
  }
  if (error?.type === 'entity.too.large') {
    sendError(response, 413, 'PETICION_DEMASIADO_GRANDE', 'La petición es demasiado grande.');
    return;
  }
  console.error(error);
  sendError(response, 500, 'ERROR_INTERNO', 'Se ha producido un error inesperado.');
}
