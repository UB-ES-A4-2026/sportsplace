import { createServer } from 'node:http';

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

export function createAppServer() {
  return createServer((request, response) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      return;
    }

    const pathname = request.url?.split('?', 1)[0];

    // /api/health is the public API endpoint; /health is an alias for probes.
    if (pathname === '/api/health' || pathname === '/health') {
      sendJson(response, 200, { status: 'ok', service: 'sportsplace-api' });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });
}
