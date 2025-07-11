import { getPort, isDevelopment } from '@airbolt/config';

import { buildApp } from './app.js';

const isDev: boolean = isDevelopment();

const start = async (): Promise<void> => {
  try {
    const port: number = getPort();

    // Build the app with appropriate logger configuration
    const server = await buildApp({
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

    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Server listening on http://0.0.0.0:${String(port)}`);

    // Graceful shutdown handling
    const gracefulShutdown = async (): Promise<void> => {
      server.log.info('Received shutdown signal, closing server gracefully...');

      // Close server
      await server.close();
      server.log.info('Server closed successfully');
      process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => {
      void gracefulShutdown();
    });
    process.on('SIGINT', () => {
      void gracefulShutdown();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    throw new Error('Failed to start server');
  }
};

start().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
