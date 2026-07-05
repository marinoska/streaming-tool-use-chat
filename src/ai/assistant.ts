import OpenAI from 'openai';
import { config } from '../config';
import { runnableTools } from './tools';

const openai = new OpenAI(); // reads OPENAI_API_KEY from the environment

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

/**
 * Stream the assistant's reply to a single user message.
 *
 * `runTools()` drives the whole exchange: it streams the model's turns, runs
 * any requested tools concurrently (via their `function` callbacks), feeds the
 * results back, and loops until the model answers with plain text — we just
 * forward that text as it arrives. OpenAI errors propagate to the caller.
 */
export async function* streamAssistantReply(message: string): AsyncGenerator<string> {
  const runner = openai.chat.completions.runTools({
    model: config.openaiModel,
    stream: true,
    parallel_tool_calls: true, // let the model batch calls; the SDK then runs them concurrently
    tools: runnableTools,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
  });

  for await (const chunk of runner) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
