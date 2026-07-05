import type { FastifyInstance } from 'fastify';
import { streamAssistantReply } from '../ai/assistant';
import { SseStream } from '../lib/sse';

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

const ERROR_MESSAGE = "Sorry — I couldn't complete that request due to an internal error.";

/**
 * POST /api/chat — streams the assistant's reply as SSE.
 */
export default async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatBody }>(
    '/api/chat',
    { schema: { body: chatBodySchema } },
    async (request, reply) => {
      const sse = new SseStream(reply);

      try {
        for await (const delta of streamAssistantReply(request.body.message)) {
          sse.write(delta);
        }
      } catch (error) {
        // OpenAI/API errors propagate here; report gracefully over the stream.
        fastify.log.error(error);
        sse.write(ERROR_MESSAGE);
      } finally {
        sse.close();
      }
    },
  );
}
