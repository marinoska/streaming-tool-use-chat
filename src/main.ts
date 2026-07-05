import 'dotenv/config';
import Fastify from 'fastify';
import { lookupCompany, researchCompany, validateEmail } from './tools';

/**
 * Sales Research Assistant — Streaming Chat Endpoint
 *
 * Build a POST /api/chat endpoint that:
 * 1. Accepts { "message": string }     (reject with HTTP 400 if missing/empty)
 * 2. Calls the LLM with 3 tool definitions (lookup_company, research_company, validate_email)
 * 3. Handles single AND parallel tool calls
 * 4. Streams the final response as SSE (text/event-stream)
 * 5. Refuses off-topic requests via the system prompt — and when refusing,
 *    briefly states what it CAN do (company lookup, company research, email validation).
 *
 * Available tools (imported above from ./tools.ts — do not modify that file):
 *   - lookupCompany(domain: string)   → company info
 *   - researchCompany(domain: string) → deep research
 *   - validateEmail(email: string)    → email validation
 *
 * LLM SDK:
 *   Pick the one you prefer (none are pre-installed). Examples:
 *     npm install openai
 *     npm install ai @ai-sdk/openai
 *     npm install @langchain/core @langchain/openai @langchain/langgraph
 *
 * Environment variables:
 *   - OPENAI_API_KEY  (load from a .env file, see .env.example)
 */

const app = Fastify({ logger: false });
const PORT = Number(process.env.PORT) || 3000;

// Health check
app.get('/', async () => {
  return { status: 'ok', message: 'Sales Research Assistant is running' };
});

// TODO: implement POST /api/chat
// app.post('/api/chat', async (request, reply) => {
//   ...
// });

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on http://localhost:${PORT}`);
});