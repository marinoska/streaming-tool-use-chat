# Streaming Chat Agent with Tool Use

Build a streaming chat endpoint that acts as a **focused sales research assistant**.  
It can ONLY do 3 things — anything else should be politely refused.

You can use **any SDK or framework** you prefer: OpenAI SDK, Vercel AI SDK, LangChain, LangGraph, or raw HTTP calls. No LLM SDK is pre-installed — pick the one you like and `npm install` it yourself.

Requires **Node 20+**. You need to use your own `OPENAI_API_KEY`.

---

## Setup

```bash
npm install
cp .env.example .env   # then fill in OPENAI_API_KEY
npm run dev            # starts the server on http://localhost:3000
npm test               # runs the Jest suite in ./tests
```

Mock tool implementations are in `src/tools.ts` — **do not modify this file.**
Tests live in `tests/chat.test.ts` — **do not modify them either.**
Your code goes in `src/main.ts` (or any files you create).

---

## The 3 Tools

Mock implementations are provided in `src/tools.ts`. Each simulates realistic latency.

### 1. `lookup_company(domain: string)`

Returns company info: name, industry, employee count, HQ location, description, founded year.

> "Tell me about acme.com" · "What does acme.com do?"

### 2. `research_company(domain: string)`

Returns deeper research: recent news, tech stack, funding, competitors, hiring trends.

> "Research acme.com" · "What's the latest on techstart.io?"

### 3. `validate_email(email: string)`

Returns email validation result: is_valid, is_deliverable, is_catch_all, risk_score.

> "Is john@acme.com a valid email?" · "Check this email"

---

## Requirements

### 1. Endpoint

`POST /api/chat`

- Accepts: `{ "message": string }`
- Reject with **HTTP 400** if `message` is missing or empty
- Streams the response as **SSE** (`text/event-stream`)
- Each SSE event should contain a chunk of the assistant's text response

### 2. Tool Definitions

- Define all 3 tools with **proper JSON schemas** (names, descriptions, parameters)
- The LLM should decide which tool(s) to call based on the user message

### 3. Parallel Tool Calls ⚠️

This is critical. When the user asks for multiple things in one message, the LLM may request **multiple tool calls simultaneously**.

**Example:**

> "Look up acme.com, research them, and validate john@acme.com"

→ The LLM should call all 3 tools in a **single round**.

Your code must:

1. Detect **all** tool calls in the response
2. Execute them (ideally **concurrently** with `Promise.all` or similar)
3. Feed **all** results back to the LLM
4. Stream the final text response

### 4. Scope Enforcement

- The assistant should **only** use these 3 tools
- If the user asks something unrelated (e.g., "Write me a poem", "What's the weather?"), the assistant should **politely refuse** and, in the same response, briefly state what it **can** do — i.e. mention **company lookup**, **company research**, and **email validation**
- This should be handled via the **system prompt**, not hardcoded if/else logic

### 5. Streaming

- The final text response (after tool execution) must stream **chunk by chunk** via SSE
- Tool execution itself doesn't need to stream, but the assistant's summary/analysis of the tool results should stream

### 6. Error Handling

- Handle tool execution failures gracefully (e.g., company not found)
- Handle LLM API errors
- Return appropriate HTTP status codes

---

## What We're Testing

- Can you wire up tool definitions in your chosen SDK?
- Can you handle the **parallel tool call pattern** (multiple tool_use blocks in a single response)?
- Can you properly feed tool results back and continue the conversation?
- Does your streaming **actually work** (not buffer-then-flush)?
- Does your system prompt correctly scope the assistant's behavior?

---

## Evaluation

Your submission will be evaluated on:

1. ✅ **Correctness** — tools are called, results are used, streaming works
2. ⚡ **Parallel calls** — multi-tool requests execute concurrently, not sequentially
3. 🔒 **Scope** — off-topic requests are refused via system prompt
4. 🧹 **Code quality** — clean structure, proper error handling

---

## Submission

When you're done, submit **both** of the following:

1. **GitHub repository link** — push your code to a public (or shared private) GitHub repo and share the link.
2. **Loom video walkthrough** — record a Loom (or equivalent screen recording) that:
   - Explains your code and the key implementation decisions you made
   - Demonstrates running **each task one by one from the UI**, showing:
     - A single tool call (e.g. "Tell me about acme.com")
     - A parallel tool call (e.g. "Look up acme.com, research them, and validate john@acme.com")
     - A scope refusal (e.g. "Write me a poem")
     - The SSE streaming behaviour visible in the UI

Share the GitHub link and the Loom link together in your reply.
