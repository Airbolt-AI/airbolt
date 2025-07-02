import { getPort, isDevelopment } from '@airbolt/config';
import Fastify from 'fastify';

import app from './app.js';

const isDev: boolean = isDevelopment();
const server = Fastify({
  logger: isDev
    ? {
        level: 'info',
        transport: {
          target: 'pino-pretty',
        },
      }
    : {
        level: 'info',
      },
});

server.register(app);

const start = async (): Promise<void> => {
  try {
    const port: number = getPort();

    await server.listen({ port });
    server.log.info(`Server listening on port ${String(port)}`);
  } catch (err) {
    server.log.error(err);
    throw new Error('Failed to start server');
  }
};

start().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
