import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { FastifySSEPlugin } from 'fastify-sse-v2';
import chatRoutes from './routes/chat';

// The web UI is a static, framework-free frontend under /public.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

/**
 * Build and configure the Fastify instance without starting it.
 *
 * Keeping this separate from the entry point (main.ts) means the app can be
 * constructed and exercised in isolation — e.g. via `app.inject()` in tests —
 * without binding a port.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(fastifyStatic, { root: publicDir }); // serves the UI (index.html) at /
  app.register(FastifySSEPlugin); // adds reply.sse() for Server-Sent Events
  app.register(chatRoutes);

  return app;
}
