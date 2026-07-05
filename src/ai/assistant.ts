import { streamText, tool, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { lookupCompany, researchCompany, validateEmail } from '../tools';
import { config } from '../config';

/**
 * The sales-research assistant: system prompt + tool wiring, kept independent
 * of the HTTP layer so it can be tested and reused on its own.
 */

export const SYSTEM_PROMPT = `You are a focused sales-research assistant. You can ONLY help with three things:
- look up basic company information (lookup_company)
- research a company in depth (research_company)
- validate an email address (validate_email)

Always use the tools to answer in-scope requests, and call multiple tools at once when the user asks for several things (e.g. researching two companies, or looking up + researching + validating in one message).

When you summarize tool results, include the concrete specifics the tool returned — use the actual names and terms rather than paraphrasing them away:
- company info: industry, HQ location, and size
- research: name the funding round, the most notable recent news, and key technologies or competitors
- email validation: whether it is valid and deliverable, plus its risk

If a lookup or research tool returns an error because the company or its data cannot be located, tell the user the company was "not found" (use those words) — never invent data. If an email address is malformed, say it is not a valid email.

For anything outside these three capabilities (poems, general knowledge, weather, math, coding help, etc.), politely refuse and briefly say you can only help with company lookup, company research, and email validation.`;

// Tool schemas wrapping the mock implementations in ../tools.ts (unchanged).
export const tools = {
  lookup_company: tool({
    description:
      'Look up basic company information (name, industry, size, HQ, description, founding year) by domain.',
    inputSchema: z.object({ domain: z.string().describe('Company domain, e.g. acme.com') }),
    execute: ({ domain }) => lookupCompany(domain),
  }),
  research_company: tool({
    description:
      'Deep research on a company: recent news, tech stack, funding, competitors, hiring trends.',
    inputSchema: z.object({ domain: z.string().describe('Company domain, e.g. acme.com') }),
    execute: ({ domain }) => researchCompany(domain),
  }),
  validate_email: tool({
    description: 'Validate an email address: validity, deliverability, catch-all, and risk score.',
    inputSchema: z.object({ email: z.string().describe('Email address, e.g. john@acme.com') }),
    execute: ({ email }) => validateEmail(email),
  }),
};

/**
 * Kick off a streamed assistant reply for a single user message.
 *
 * The model may request several tools in one round; `stopWhen(stepCountIs)`
 * lets the SDK execute them concurrently, feed the results back, and then
 * produce the final text — which the caller streams to the client.
 *
 * AI SDK v7 routes streaming/LLM failures to `onError` (it does NOT throw
 * through `textStream`), so errors are surfaced via the callback.
 */
export function streamAssistantReply(message: string, onError: (error: unknown) => void) {
  return streamText({
    model: openai(config.openaiModel),
    system: SYSTEM_PROMPT,
    prompt: message,
    stopWhen: stepCountIs(5),
    tools,
    onError: ({ error }) => onError(error),
  });
}
