import type { FastifyInstance } from 'fastify';
import { Readable } from 'node:stream';
import { streamAssistantReply } from '../ai/assistant';
import { sseFrames, SSE_HEADERS } from '../lib/sse';

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
 * The assistant text stream is adapted into SSE frames and handed to Fastify,
 * which pipes it to the client; errors surface via the sseFrames callback.
 */
export default async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatBody }>(
    '/api/chat',
    { schema: { body: chatBodySchema } },
    (request, reply) => {
      const frames = sseFrames(streamAssistantReply(request.body.message), (error) =>
        fastify.log.error(error),
      );
      return reply.headers(SSE_HEADERS).send(Readable.from(frames));
    },
  );
}
