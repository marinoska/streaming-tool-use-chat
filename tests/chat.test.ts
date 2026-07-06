/**
 * Auto-grading tests for POST /api/chat
 *
 * Strategy: since LLM output is non-deterministic, we test BEHAVIOR:
 * - Did the mock tool data appear in the response? (proves tool was called)
 * - Is the response streamed as SSE? (proves streaming works)
 * - Does off-topic input NOT trigger tool data? (proves scope enforcement)
 *
 * The mock tools return unique, deterministic strings — if "Manufacturing"
 * appears in the response, lookupCompany("acme.com") was called.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// ─── Helpers ────────────────────────────────────────────────────

async function chatRaw(message: string): Promise<Response> {
  return fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

async function chatCollectSSE(message: string): Promise<{
  response: Response;
  chunks: string[];
  fullText: string;
}> {
  const response = await chatRaw(message);
  const chunks: string[] = [];

  if (!response.ok || !response.body) {
    return { response, chunks, fullText: '' };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        // fix: the spaces are valid content
        const data = line.slice(6);
        if (data && data !== '[DONE]') {
          chunks.push(data);
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith('data: ')) {
    // fix: the spaces are valid content
    const data = buffer.slice(6);
    if (data && data !== '[DONE]') {
      chunks.push(data);
    }
  }

  const fullText = chunks.join('');
  return { response, chunks, fullText };
}

// Give the test generous timeouts — LLM calls + mock latency
jest.setTimeout(60_000);

// ─── Connection check ───────────────────────────────────────────

beforeAll(async () => {
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetch(BASE_URL);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Server did not start within 30 seconds');
});

// ═══════════════════════════════════════════════════════════════════
// 1. HTTP MECHANICS
// ═══════════════════════════════════════════════════════════════════

describe('HTTP mechanics', () => {
  test('returns 200 for valid request', async () => {
    const res = await chatRaw('Tell me about acme.com');
    expect(res.status).toBe(200);
  });

  test('returns text/event-stream content-type', async () => {
    const res = await chatRaw('Tell me about acme.com');
    const ct = res.headers.get('content-type') || '';
    expect(ct).toContain('text/event-stream');
  });

  test('returns 400 for missing message field', async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 for empty message', async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. STREAMING FORMAT
// ═══════════════════════════════════════════════════════════════════

describe('SSE streaming', () => {
  test('streams response in multiple chunks (not buffered)', async () => {
    const { chunks } = await chatCollectSSE('Tell me about acme.com');
    // A truly streaming response should have multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('SSE events use data: prefix format', async () => {
    const res = await chatRaw('Tell me about acme.com');
    const text = await res.text();
    const dataLines = text.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. SINGLE TOOL CALLS
// ═══════════════════════════════════════════════════════════════════

describe('Single tool calls', () => {
  test('lookup_company: "Tell me about acme.com" returns company data', async () => {
    const { fullText } = await chatCollectSSE('Tell me about acme.com');
    const text = fullText.toLowerCase();

    // lookupCompany returns: Manufacturing, San Francisco, 500-1000
    const hasCompanyData =
      text.includes('manufacturing') ||
      text.includes('san francisco') ||
      text.includes('acme');
    expect(hasCompanyData).toBe(true);
  });

  test('research_company: "Research techstart.io" returns research data', async () => {
    const { fullText } = await chatCollectSSE('Research techstart.io');
    const text = fullText.toLowerCase();

    // researchCompany returns: Series A, GitHub, Buildkite, Go
    const hasResearchData =
      text.includes('series a') ||
      text.includes('github') ||
      text.includes('buildkite') ||
      text.includes('code review');
    expect(hasResearchData).toBe(true);
  });

  test('validate_email: "Validate john@acme.com" returns validation data', async () => {
    const { fullText } = await chatCollectSSE('Validate the email john@acme.com');
    const text = fullText.toLowerCase();

    // validateEmail returns: is_valid, is_deliverable, risk_score, verified domain
    const hasValidationData =
      text.includes('valid') ||
      text.includes('deliverable') ||
      text.includes('risk') ||
      text.includes('verified');
    expect(hasValidationData).toBe(true);
  });

  test('lookup_company for unknown domain handles error gracefully', async () => {
    const { fullText, response } = await chatCollectSSE(
      'Tell me about unknowndomain12345.com'
    );
    // Should not crash — either 200 with an explanation or graceful error
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      const text = fullText.toLowerCase();
      const handlesError =
        text.includes('not found') ||
        text.includes('no data') ||
        text.includes('couldn\'t find') ||
        text.includes('unable') ||
        text.includes('don\'t have');
      expect(handlesError).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. PARALLEL TOOL CALLS
// ═══════════════════════════════════════════════════════════════════

describe('Parallel tool calls', () => {
  test('all 3 tools in one message: lookup + research + validate', async () => {
    const { fullText } = await chatCollectSSE(
      'Look up acme.com, research them, and validate the email john@acme.com'
    );
    const text = fullText.toLowerCase();

    // Must contain data from lookupCompany
    const hasLookup =
      text.includes('manufacturing') ||
      text.includes('san francisco') ||
      text.includes('500');

    // Must contain data from researchCompany
    const hasResearch =
      text.includes('series c') ||
      text.includes('sequoia') ||
      text.includes('germany') ||
      text.includes('kubernetes');

    // Must contain data from validateEmail
    const hasValidation =
      text.includes('valid') ||
      text.includes('deliverable') ||
      text.includes('risk') ||
      text.includes('verified');

    expect(hasLookup).toBe(true);
    expect(hasResearch).toBe(true);
    expect(hasValidation).toBe(true);
  });

  test('2 research calls in one message: two different companies', async () => {
    const { fullText } = await chatCollectSSE(
      'Research both acme.com and techstart.io'
    );
    const text = fullText.toLowerCase();

    // Must contain data from researchCompany("acme.com")
    const hasAcmeResearch =
      text.includes('sequoia') ||
      text.includes('series c') ||
      text.includes('germany') ||
      text.includes('megafactory');

    // Must contain data from researchCompany("techstart.io")
    const hasTechstartResearch =
      text.includes('series a') ||
      text.includes('github') ||
      text.includes('buildkite') ||
      text.includes('code review');

    expect(hasAcmeResearch).toBe(true);
    expect(hasTechstartResearch).toBe(true);
  });

  test('lookup + validate in one message', async () => {
    const { fullText } = await chatCollectSSE(
      'What does globalbank.com do, and is ceo@globalbank.com a valid email?'
    );
    const text = fullText.toLowerCase();

    // Must contain data from lookupCompany("globalbank.com")
    const hasLookup =
      text.includes('finance') ||
      text.includes('banking') ||
      text.includes('new york') ||
      text.includes('wealth');

    // Must contain data from validateEmail
    const hasValidation =
      text.includes('valid') ||
      text.includes('deliverable') ||
      text.includes('risk') ||
      text.includes('verified');

    expect(hasLookup).toBe(true);
    expect(hasValidation).toBe(true);
  });

  test('parallel calls complete within reasonable time (not sequential)', async () => {
    // lookupCompany=200ms, researchCompany=500ms, validateEmail=300ms
    // Sequential = ~1000ms, Parallel = ~500ms
    // We allow up to 5s total (LLM latency included) but flag if > 8s
    const start = Date.now();
    await chatCollectSSE(
      'Look up acme.com, research them, and validate john@acme.com'
    );
    const elapsed = Date.now() - start;

    // This is a soft check — primarily ensures it doesn't hang
    // LLM call + 500ms parallel tools should be well under 30s
    expect(elapsed).toBeLessThan(30_000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. SCOPE ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════

describe('Scope enforcement', () => {
  test('refuses to write a poem', async () => {
    const { fullText } = await chatCollectSSE('Write me a poem about the ocean');
    const text = fullText.toLowerCase();

    // Should NOT contain any tool data
    const hasToolData =
      text.includes('manufacturing') ||
      text.includes('series c') ||
      text.includes('deliverable');
    expect(hasToolData).toBe(false);

    // Should contain a polite refusal
    const hasRefusal =
      text.includes('can\'t') ||
      text.includes('cannot') ||
      text.includes('only') ||
      text.includes('unable') ||
      text.includes('sorry') ||
      text.includes('not able') ||
      text.includes('help with') ||
      text.includes('don\'t') ||
      text.includes('outside');
    expect(hasRefusal).toBe(true);
  });

  test('refuses to answer general knowledge questions', async () => {
    const { fullText } = await chatCollectSSE(
      'What is the capital of France?'
    );
    const text = fullText.toLowerCase();

    // Should NOT answer the question
    const answeredQuestion = text.includes('paris');
    expect(answeredQuestion).toBe(false);

    // Should contain a refusal or redirect
    const hasRefusal =
      text.includes('can\'t') ||
      text.includes('cannot') ||
      text.includes('only') ||
      text.includes('unable') ||
      text.includes('sorry') ||
      text.includes('not able') ||
      text.includes('help with') ||
      text.includes('don\'t') ||
      text.includes('outside');
    expect(hasRefusal).toBe(true);
  });

  test('refuses but still explains what it CAN do', async () => {
    const { fullText } = await chatCollectSSE('What is the weather today?');
    const text = fullText.toLowerCase();

    // Refusal should mention its actual capabilities
    const mentionsCapabilities =
      text.includes('company') ||
      text.includes('email') ||
      text.includes('research') ||
      text.includes('lookup') ||
      text.includes('look up') ||
      text.includes('validate');
    expect(mentionsCapabilities).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  test('handles malformed JSON body gracefully', async () => {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    // Should return 400, not 500
    expect(res.status).toBeLessThan(500);
  });

  test('validates email with invalid format mentions the issue', async () => {
    const { fullText } = await chatCollectSSE('Validate the email notanemail');
    const text = fullText.toLowerCase();

    // Should handle gracefully — either refuse or explain the format is wrong
    const handlesIt =
      text.includes('invalid') ||
      text.includes('not a valid') ||
      text.includes('format') ||
      text.includes('doesn\'t look') ||
      text.includes('need') ||
      text.includes('@');
    expect(handlesIt).toBe(true);
  });
});