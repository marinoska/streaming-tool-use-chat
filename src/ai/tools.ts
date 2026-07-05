import type { RunnableToolFunctionWithParse } from 'openai/lib/RunnableFunction';
import { lookupCompany, researchCompany, validateEmail } from '../tools';

/** When a tool call ran — captured per request so we can report tool-phase timing. */
export interface ToolTiming {
  name: string;
  start: number;
  end: number;
}

// Shared JSON-Schema for the two domain-based tools.
const domainParams = {
  type: 'object',
  properties: { domain: { type: 'string', description: 'Company domain, e.g. acme.com' } },
  required: ['domain'],
  additionalProperties: false,
};

/**
 * Build the assistant's tools as OpenAI "runnable" functions, wrapping each
 * call to record its start/end into `timings`. Built fresh per request so the
 * timings belong to that request. Handing these to `runTools()` lets the SDK
 * advertise, parse, invoke (in parallel), and feed back results. Each wraps a
 * mock from ../tools.ts, which stays untouched.
 */
export function createRunnableTools(timings: ToolTiming[]): RunnableToolFunctionWithParse<any>[] {
  const timed = (name: string, run: (args: any) => Promise<unknown>) => async (args: any) => {
    const start = Date.now();
    try {
      return await run(args);
    } finally {
      timings.push({ name, start, end: Date.now() });
    }
  };

  return [
    {
      type: 'function',
      function: {
        name: 'lookup_company',
        description:
          'Look up basic company information (name, industry, size, HQ, description, founding year) by domain.',
        parameters: domainParams,
        parse: JSON.parse,
        function: timed('lookup_company', (args) => lookupCompany(args.domain)),
      },
    },
    {
      type: 'function',
      function: {
        name: 'research_company',
        description:
          'Deep research on a company: recent news, tech stack, funding, competitors, hiring trends.',
        parameters: domainParams,
        parse: JSON.parse,
        function: timed('research_company', (args) => researchCompany(args.domain)),
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
        parse: JSON.parse,
        function: timed('validate_email', (args) => validateEmail(args.email)),
      },
    },
  ];
}

/**
 * Summarize the tool phase into an SSE event, or null if no tools ran. `spanMs`
 * (first start → last end) being ≈ the slowest tool rather than the sum of all
 * of them is what shows the calls executed concurrently.
 */
interface ToolPhaseSummary {
  tools: { name: string; ms: number }[];
  spanMs: number; // wall-clock of the whole tool phase (first start → last end)
}

export function toolTimingEvent(timings: ToolTiming[]): { event: string; data: string } | null {
  if (timings.length === 0) return null;

  const firstStart = Math.min(...timings.map((timing) => timing.start));
  const lastEnd = Math.max(...timings.map((timing) => timing.end));

  const summary: ToolPhaseSummary = {
    tools: timings.map((timing) => ({ name: timing.name, ms: timing.end - timing.start })),
    spanMs: lastEnd - firstStart,
  };

  return { event: 'tools', data: JSON.stringify(summary) };
}
