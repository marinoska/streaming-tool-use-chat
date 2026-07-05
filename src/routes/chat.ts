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

      // Guard so an LLM error is reported to the client exactly once, whether
      // it arrives via onError or a thrown iteration.
      let notified = false;
      const notifyError = (error: unknown) => {
        fastify.log.error(error);
        if (notified) return;
        notified = true;
        sse.write(ERROR_MESSAGE);
      };

      const stream = streamAssistantReply(request.body.message, notifyError);

      try {
        for await (const delta of stream.textStream) sse.write(delta);
      } catch (error) {
        notifyError(error);
      } finally {
        sse.close();
      }
    },
  );
}
