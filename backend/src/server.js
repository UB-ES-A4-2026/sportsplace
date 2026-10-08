import { createAppServer } from './app.js';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const server = createAppServer();

server.on('error', (error) => {
  console.error(`Unable to start Sportsplace API: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Sportsplace API listening on http://${host}:${port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; stopping Sportsplace API.`);

  const timeout = setTimeout(() => {
    console.error('API shutdown timed out.');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error(`Unable to close Sportsplace API: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
