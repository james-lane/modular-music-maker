import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid TCP port.');
const server = createApp().listen(port, '127.0.0.1', () => {
  console.log(`Patchwork Node server: http://127.0.0.1:${port}`);
});

// Give file writes and HTTP requests a chance to finish when the dev runner stops.
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => server.close(() => process.exit(0)));
