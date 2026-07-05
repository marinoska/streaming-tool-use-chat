export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

const ERROR_MESSAGE = "Sorry — I couldn't complete that request due to an internal error.";

// Characters that end a clause or sentence. We only ever cut a frame right
// after one of these, because none of them fall in the middle of a word — so a
// frame never splits a word (or a multi-word phrase), and a client that
// concatenates frames still reads cleanly. They're chosen for that property,
// not arbitrarily.
const CLAUSE_ENDINGS = new Set(['.', ',', ';', ':', '!', '?', '\n']);

/**
 * Split accumulated text into the clauses that are definitely complete plus the
 * trailing, still-incomplete remainder (which stays buffered until more text
 * arrives). A clause runs up to and including its ending character.
 */
function takeCompletedClauses(buffer: string): { completed: string[]; remainder: string } {
  const completed: string[] = [];
  let clauseStart = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (CLAUSE_ENDINGS.has(buffer[i])) {
      completed.push(buffer.slice(clauseStart, i + 1));
      clauseStart = i + 1;
    }
  }
  return { completed, remainder: buffer.slice(clauseStart) };
}

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
      const { completed, remainder } = takeCompletedClauses(buffer);
      buffer = remainder; // keep the trailing, still-incomplete clause
      for (const clause of completed) {
        const frame = toFrame(clause);
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
