import type { FastifyReply } from 'fastify';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const;

// Flush the streamed text at clause/line boundaries. These delimiters never
// occur *inside* an individual word, so every frame carries whole words with
// their internal spaces intact — a client that concatenates `data:` frames
// always reconstructs readable text, and streaming stays incremental
// (multi-clause replies produce many frames rather than one buffered blob).
const CLAUSE_BOUNDARY = /(?<=[.,!?:;\n])/;

/**
 * A small Server-Sent-Events writer over Fastify's raw socket.
 *
 * We hijack the reply so Fastify won't serialize/send its own response, then
 * own the framing here. Text is buffered and emitted clause-by-clause.
 */
export class SseStream {
  private readonly raw: FastifyReply['raw'];
  private buffer = '';

  constructor(reply: FastifyReply) {
    reply.hijack();
    this.raw = reply.raw;
    this.raw.writeHead(200, SSE_HEADERS);
  }

  /** Buffer streamed text and flush any completed clauses as SSE frames. */
  write(text: string): void {
    this.buffer += text;
    const parts = this.buffer.split(CLAUSE_BOUNDARY);
    this.buffer = parts.pop() ?? ''; // keep the trailing, still-incomplete clause
    for (const part of parts) this.emit(part);
  }

  /** Flush any remaining text, signal completion, and end the response. */
  close(): void {
    if (this.buffer) {
      this.emit(this.buffer);
      this.buffer = '';
    }
    this.raw.write('data: [DONE]\n\n');
    this.raw.end();
  }

  private emit(chunk: string): void {
    const text = chunk.replace(/\n/g, ' '); // keep each event on a single line
    if (text.trim()) this.raw.write(`data: ${text}\n\n`);
  }
}
