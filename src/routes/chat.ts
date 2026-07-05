import type { FastifyInstance } from 'fastify';
import { streamAssistantReply } from '../ai/assistant';
import { toolTimingEvent, type ToolTiming } from '../ai/tools';
import { sseEvents } from '../lib/sse';

interface ChatBody {
  message: string;
  /** Optional; defaults to true. When false, tools run one at a time (demo/comparison). */
  parallel?: boolean;
}

// Schema-based validation: Fastify replies 400 automatically when `message`
// is missing or empty — no manual guard in the handler.
const chatBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1 },
    parallel: { type: 'boolean' },
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
      const { message, parallel = true } = request.body;
      const timings: ToolTiming[] = [];
      reply.sse(
        sseEvents(streamAssistantReply(message, timings, parallel), {
          onError: (error) => fastify.log.error(error),
          finalEvent: () => toolTimingEvent(timings),
        }),
      );
    },
  );
}
