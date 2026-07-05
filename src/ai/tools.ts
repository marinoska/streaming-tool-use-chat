import type { RunnableToolFunctionWithParse } from 'openai/lib/RunnableFunction';
import { lookupCompany, researchCompany, validateEmail } from '../tools';

// Shared JSON-Schema for the two domain-based tools.
const domainParams = {
  type: 'object',
  properties: { domain: { type: 'string', description: 'Company domain, e.g. acme.com' } },
  required: ['domain'],
  additionalProperties: false,
};

/**
 * The tools the assistant can call, expressed as OpenAI "runnable" functions:
 * JSON-Schema parameters, an argument parser, and the implementation. Handing
 * these to `runTools()` lets the SDK advertise them, parse arguments, invoke
 * them (in parallel), and feed results back for us. Each wraps a mock from
 * ../tools.ts, which stays untouched.
 */
export const runnableTools: RunnableToolFunctionWithParse<any>[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_company',
      description:
        'Look up basic company information (name, industry, size, HQ, description, founding year) by domain.',
      parameters: domainParams,
      parse: JSON.parse,
      function: (args) => lookupCompany(args.domain),
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
      function: (args) => researchCompany(args.domain),
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
      function: (args) => validateEmail(args.email),
    },
  },
];
