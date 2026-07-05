import { EventSourceParserStream } from 'eventsource-parser/stream';

/**
 * Logic layer — the chat client.
 *
 * Sends a message to `POST /api/chat` and yields the assistant's reply as text
 * tokens. The response is piped through `eventsource-parser`'s stream, which
 * handles the SSE wire format; we yield each token and surface the trailing
 * `tools` event (tool-phase timing) via a callback. Knows nothing about the
 * DOM. (We use fetch rather than `EventSource` because it's a POST.)
 */

const ENDPOINT = '/api/chat';
const DONE = '[DONE]';

/** Per-request tool-phase timing reported by the server after the answer. */
export interface ToolSummary {
  tools: { name: string; ms: number }[];
  spanMs: number;
}

interface StreamOptions {
  signal?: AbortSignal;
  /** false runs the tools sequentially server-side (for the timing comparison). */
  parallel?: boolean;
  onTools?: (summary: ToolSummary) => void;
}

/** Stream the assistant's reply to a message, yielding text tokens as they arrive. */
export async function* streamChat(
  message: string,
  { signal, parallel, onTools }: StreamOptions = {},
): AsyncGenerator<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, parallel }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Request failed (${response.status})`);
  }

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.event === 'tools') {
      onTools?.(JSON.parse(value.data));
      continue;
    }
    if (value.data === DONE) return;
    if (value.data) yield value.data;
  }
}
