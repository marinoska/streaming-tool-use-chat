import Fastify, { type FastifyInstance } from 'fastify';
import { FastifySSEPlugin } from 'fastify-sse-v2';
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

  app.register(FastifySSEPlugin); // adds reply.sse() for Server-Sent Events
  app.register(healthRoutes);
  app.register(chatRoutes);

  return app;
}
