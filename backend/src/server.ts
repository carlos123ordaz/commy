import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { initializeSockets } from './sockets';

async function bootstrap() {
  const server = http.createServer(app);
  initializeSockets(server);

  server.listen(env.PORT, () => {
    console.log(`
🚀 Commy Backend running!
   Mode:    ${env.NODE_ENV}
   Port:    ${env.PORT}
   API:     http://localhost:${env.PORT}/api/v1
   Health:  http://localhost:${env.PORT}/health
    `);
  });

  await connectDatabase();

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });
}

bootstrap();
