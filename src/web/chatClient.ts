import { EventSourceParserStream } from 'eventsource-parser/stream';

/**
 * Logic layer — the chat client.
 *
 * Sends a message to `POST /api/chat` and yields the assistant's reply as text
 * tokens. The response is piped through `eventsource-parser`'s stream, which
 * handles the SSE wire format; we just yield each event's data. Knows nothing
 * about the DOM. (We use fetch rather than `EventSource` because it's a POST.)
 */

const ENDPOINT = '/api/chat';
const DONE = '[DONE]';

/** Stream the assistant's reply to a message, yielding text tokens as they arrive. */
export async function* streamChat(
  message: string,
  { signal }: { signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
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
    if (value.data === DONE) return;
    if (value.data) yield value.data;
  }
}
