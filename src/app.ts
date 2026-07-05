import Fastify, { type FastifyInstance } from 'fastify';
import healthRoutes from './routes/health';
import chatRoutes from './routes/chat';

/**
 * Build and configure the Fastify instance without starting it.
 *
 * Keeping this separate from the entry point (main.ts) means the app can be
 * constructed and exercised in isolation — e.g. via `app.inject()` in tests —
 * without binding a port.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(healthRoutes);
  app.register(chatRoutes);

  return app;
}
