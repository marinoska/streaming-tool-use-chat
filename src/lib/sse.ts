export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

// Flush the streamed text at clause/line boundaries. These delimiters never
// occur inside a word, so every frame carries whole words with their internal
// spaces intact — a client that concatenates `data:` frames always
// reconstructs readable text, and streaming stays incremental (a multi-clause
// reply produces many frames rather than one buffered blob).
const CLAUSE_BOUNDARY = /(?<=[.,!?:;\n])/;

const ERROR_MESSAGE = "Sorry — I couldn't complete that request due to an internal error.";

const toFrame = (chunk: string): string => {
  const line = chunk.replace(/\n/g, ' '); // keep each event on a single line
  return line.trim() ? `data: ${line}\n\n` : '';
};

/**
 * Adapt a stream of assistant text into Server-Sent-Events frame strings that
 * Fastify can pipe straight to the client. Buffers text and flushes completed
 * clauses; always terminates with a `[DONE]` sentinel; on error, emits a
 * graceful message instead of tearing the connection mid-stream.
 */
export async function* sseFrames(
  text: AsyncIterable<string>,
  onError?: (error: unknown) => void,
): AsyncGenerator<string> {
  let buffer = '';
  try {
    for await (const delta of text) {
      buffer += delta;
      const parts = buffer.split(CLAUSE_BOUNDARY);
      buffer = parts.pop() ?? ''; // keep the trailing, still-incomplete clause
      for (const part of parts) {
        const frame = toFrame(part);
        if (frame) yield frame;
      }
    }
    const tail = toFrame(buffer);
    if (tail) yield tail;
  } catch (error) {
    onError?.(error);
    const frame = toFrame(ERROR_MESSAGE);
    if (frame) yield frame;
  } finally {
    yield 'data: [DONE]\n\n';
  }
}
