import type { FastifyInstance } from 'fastify';
import { streamAssistantReply } from '../ai/assistant';
import { sseEvents } from '../lib/sse';

interface ChatBody {
  message: string;
}

// Schema-based validation: Fastify replies 400 automatically when `message`
// is missing or empty — no manual guard in the handler.
const chatBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1 },
  },
};

/**
 * POST /api/chat — streams the assistant's reply as SSE.
 *
 * `reply.sse()` (fastify-sse-v2) owns the wire framing and response lifecycle;
 * we just feed it clause-by-clause events. Errors surface via the callback.
 */
export default async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatBody }>(
    '/api/chat',
    { schema: { body: chatBodySchema } },
    (request, reply) => {
      reply.sse(sseEvents(streamAssistantReply(request.body.message), (error) => fastify.log.error(error)));
    },
  );
}
