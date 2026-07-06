import type { EventMessage } from 'fastify-sse-v2';

const ERROR_MESSAGE = "Sorry — I couldn't complete that request due to an internal error.";

interface SseOptions {
  onError?: (error: unknown) => void;
  /** Optional event emitted after the text, before `[DONE]` (e.g. tool timing). */
  finalEvent?: () => EventMessage | null;
}

/**
 * Adapt the assistant's text stream into SSE events for `reply.sse()`, which
 * owns the wire framing. Each model token is forwarded as it arrives, so the
 * client sees a true token-by-token stream. Terminates with a `[DONE]`
 * sentinel; on error, emits a graceful message instead of tearing the stream.
 *
 * Each token rides in its own `data:` frame, spaces included — valid SSE that a
 * spec-compliant consumer (our browser client, and the corrected test) rebuilds
 * losslessly. A consumer must strip only the single framing space after the
 * colon, never `.trim()` the value, or it fuses "not" + " found" into
 * "notfound"; see the note in tests/chat.test.ts.
 */
export async function* sseEvents(
  text: AsyncIterable<string>,
  { onError, finalEvent }: SseOptions = {},
): AsyncGenerator<EventMessage> {
  try {
    for await (const delta of text) {
      if (delta) yield { data: delta };
    }
    const event = finalEvent?.();
    if (event) yield event;
  } catch (error) {
    onError?.(error);
    yield { data: ERROR_MESSAGE };
  } finally {
    yield { data: '[DONE]' };
  }
}
