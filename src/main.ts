import 'dotenv/config';
import Fastify from 'fastify';
import { streamText, tool, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { lookupCompany, researchCompany, validateEmail } from './tools';

/**
 * Sales Research Assistant — streaming chat endpoint (Vercel AI SDK).
 *
 * POST /api/chat  { message: string }  ->  text/event-stream
 *   - 400 if message is missing/empty
 *   - the model may request several tools in one round; the SDK runs them
 *     concurrently and feeds the results back (stopWhen keeps looping until
 *     it produces the final text), which we stream chunk-by-chunk as SSE
 *   - scope is enforced by the system prompt only (no if/else routing)
 */

const app = Fastify({ logger: false });
const MODEL = 'gpt-4o-mini';
const PORT = Number(process.env.PORT) || 3000;

const SYSTEM = `You are a focused sales-research assistant. You can ONLY help with three things:
- look up basic company information (lookup_company)
- research a company in depth (research_company)
- validate an email address (validate_email)

Use the tools to answer in-scope requests, and call multiple tools at once when the user asks for several things. Summarize the tool results clearly. If a tool returns an error, explain it plainly instead of inventing data. For anything else (poems, general knowledge, weather, math, coding help, etc.), politely refuse and briefly say you can only help with company lookup, company research, and email validation.`;

// Tool schemas + wrappers around the mock impls in ./tools.ts (unchanged).
const tools = {
  lookup_company: tool({
    description: 'Look up basic company information (name, industry, size, HQ, description, founding year) by domain.',
    inputSchema: z.object({ domain: z.string().describe('Company domain, e.g. acme.com') }),
    execute: ({ domain }) => lookupCompany(domain),
  }),
  research_company: tool({
    description: 'Deep research on a company: recent news, tech stack, funding, competitors, hiring trends.',
    inputSchema: z.object({ domain: z.string().describe('Company domain, e.g. acme.com') }),
    execute: ({ domain }) => researchCompany(domain),
  }),
  validate_email: tool({
    description: 'Validate an email address: validity, deliverability, catch-all, and risk score.',
    inputSchema: z.object({ email: z.string().describe('Email address, e.g. john@acme.com') }),
    execute: ({ email }) => validateEmail(email),
  }),
};

app.get('/', async () => ({ status: 'ok', message: 'Sales Research Assistant is running' }));

app.post('/api/chat', async (request, reply) => {
  const { message } = (request.body ?? {}) as { message?: unknown };
  if (typeof message !== 'string' || message.trim() === '') {
    return reply.code(400).send({ error: 'Body must include a non-empty "message" string.' });
  }

  // Take over the raw socket so we own the SSE framing.
  reply.hijack();
  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    const result = streamText({
      model: openai(MODEL),
      system: SYSTEM,
      prompt: message,
      stopWhen: stepCountIs(5), // tool round(s) -> feed results back -> final text
      tools,
      // AI SDK routes streaming/LLM errors here (it does NOT throw through
      // textStream), so emit a graceful message to the client from here.
      onError: ({ error }) => {
        app.log.error(error);
        raw.write(`data: ${JSON.stringify("Sorry — I couldn't complete that request due to an internal error.")}\n\n`);
      },
    });

    for await (const delta of result.textStream) {
      raw.write(`data: ${JSON.stringify(delta)}\n\n`);
    }
    raw.write('data: [DONE]\n\n');
  } catch (err) {
    app.log.error(err);
    raw.write(`data: ${JSON.stringify("Sorry — something went wrong handling that request.")}\n\n`);
    raw.write('data: [DONE]\n\n');
  } finally {
    raw.end();
  }
});

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on http://localhost:${PORT}`);
});
