import type { FastifyInstance } from 'fastify';

/**
 * Liveness endpoint. Registered as an encapsulated plugin.
 */
export default async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async () => ({
    status: 'ok',
    message: 'Sales Research Assistant is running',
  }));
}
