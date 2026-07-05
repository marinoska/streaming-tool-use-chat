import OpenAI from 'openai';
import { lookupCompany, researchCompany, validateEmail } from '../tools';
import { config } from '../config';

/**
 * The sales-research assistant: system prompt, tool wiring, and the tool-call
 * loop — kept independent of the HTTP layer so it can be tested and reused.
 */

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;
type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
type ToolMessage = OpenAI.Chat.Completions.ChatCompletionToolMessageParam;

const openai = new OpenAI(); // reads OPENAI_API_KEY from the environment

const MAX_STEPS = 5; // safety bound on (tool round -> feed results back -> respond) cycles

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

// Tool schemas (JSON Schema) advertised to the model.
export const tools: ChatTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_company',
      description:
        'Look up basic company information (name, industry, size, HQ, description, founding year) by domain.',
      parameters: {
        type: 'object',
        properties: { domain: { type: 'string', description: 'Company domain, e.g. acme.com' } },
        required: ['domain'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'research_company',
      description:
        'Deep research on a company: recent news, tech stack, funding, competitors, hiring trends.',
      parameters: {
        type: 'object',
        properties: { domain: { type: 'string', description: 'Company domain, e.g. acme.com' } },
        required: ['domain'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'validate_email',
      description: 'Validate an email address: validity, deliverability, catch-all, and risk score.',
      parameters: {
        type: 'object',
        properties: { email: { type: 'string', description: 'Email address, e.g. john@acme.com' } },
        required: ['email'],
        additionalProperties: false,
      },
    },
  },
];

// Tool name -> implementation, wrapping the untouched mocks in ../tools.ts.
const toolImplementations: Record<string, (args: any) => Promise<unknown>> = {
  lookup_company: ({ domain }) => lookupCompany(domain),
  research_company: ({ domain }) => researchCompany(domain),
  validate_email: ({ email }) => validateEmail(email),
};

// Execute a single tool call and shape its result as a `tool` message.
// Failures are returned to the model as data (not thrown) so it can explain them.
async function executeToolCall(call: ToolCall): Promise<ToolMessage> {
  let content: string;
  try {
    const impl = toolImplementations[call.function.name];
    const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    const result = impl ? await impl(args) : { error: `Unknown tool: ${call.function.name}` };
    content = JSON.stringify(result);
  } catch {
    content = JSON.stringify({ error: `Tool ${call.function.name} failed to execute.` });
  }
  return { role: 'tool', tool_call_id: call.id, content };
}

/**
 * Stream the assistant's reply for a single user message.
 *
 * Each turn is streamed. If the model requests tools, we execute **all** of
 * them concurrently with `Promise.all`, feed every result back, and continue;
 * once the model answers without requesting tools, its text has already been
 * streamed out. OpenAI API errors propagate to the caller to handle.
 */
export async function* streamAssistantReply(message: string): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = await openai.chat.completions.create({
      model: config.openaiModel,
      messages,
      tools,
      stream: true,
    });

    const toolCalls: ToolCall[] = [];
    let assistantText = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        assistantText += delta.content;
        yield delta.content; // forward the final-answer text as it arrives
      }

      // Tool calls stream in fragments; accumulate them by index.
      for (const part of delta.tool_calls ?? []) {
        const call = (toolCalls[part.index] ??= {
          id: '',
          type: 'function',
          function: { name: '', arguments: '' },
        });
        if (part.id) call.id = part.id;
        if (part.function?.name) call.function.name += part.function.name;
        if (part.function?.arguments) call.function.arguments += part.function.arguments;
      }
    }

    messages.push({
      role: 'assistant',
      content: assistantText || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    if (toolCalls.length === 0) return; // model answered directly — we're done

    // ─── Parallel tool execution: every call this round runs concurrently ───
    const toolResults = await Promise.all(toolCalls.map(executeToolCall));
    messages.push(...toolResults);
  }
}
