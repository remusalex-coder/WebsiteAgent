/**
 * Gemini adapter — registration, request/response shape, and the
 * vendor-specific behaviour that makes Gemini different from every other
 * provider: an OpenAPI-subset schema dialect, a token-budget spelling of
 * `Effort`, and two failure shapes no other adapter has to handle
 * (`promptFeedback.blockReason` before generation ever starts, and a
 * `finishReason` naming a content-safety refusal after it does).
 *
 * Filed against gap G-AI-01 (MASTER_CAPABILITY_TOOL_REGISTRY.md §7): Gemini
 * is the #1-ranked executor for `reasoning` and `structured_generation` —
 * two of the four core language capabilities — yet had zero dedicated
 * behavioural test coverage before this file. Follows the same
 * fetch-stubbed pattern `test/ai/groq-provider.test.ts` established: no live
 * network call anywhere here, `globalThis.fetch` is stubbed and restored
 * around every behavioural test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as geminiAdapter } from '../../lib/ai/providers/gemini.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { ProviderRequestError } from '../../lib/errors.js';
import { planCapability } from '../../lib/capability/plan.js';

import type { AIGenerateRequest } from '../../lib/ai/types.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

/* ------------------------------------------------------------------ */
/* Wiring — selection                                                  */
/* ------------------------------------------------------------------ */

test('"gemini" is in the closed provider vocabulary', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('gemini'));
});

test('the adapter table has a real gemini entry, not a placeholder', () => {
  assert.equal(ADAPTERS.gemini.name, 'gemini');
  assert.equal(ADAPTERS.gemini.apiKeyVariable, 'GEMINI_API_KEY');
  assert.equal(typeof ADAPTERS.gemini.create, 'function');
});

test('gemini declares native schema support', () => {
  const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, true);
});

test('lib/config.ts has a default model for gemini', () => {
  assert.equal(typeof DEFAULT_MODELS.gemini, 'string');
  assert.ok(DEFAULT_MODELS.gemini.length > 0);
});

test('the capability model catalog carries real, OBSERVED free allowances for gemini across every class it serves', () => {
  const entries = catalogFor('gemini');
  assert.ok(entries.length > 0, 'expected at least one gemini model in the catalog');
  for (const entry of entries) {
    assert.ok(entry.freeAllowance !== null, `${entry.id} should carry Gemini's free-tier allowance`);
    assert.equal(entry.licence, 'free-tier-unverified', "O-3: Gemini's free-tier commercial-use terms are not settled");
  }
});

test('gemini is registered in the catalog under its own provider name, not merged into another vendor', () => {
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'gemini'));
});

test('gemini is the first-ranked, free executor for both core language capabilities it leads', () => {
  for (const capability of ['reasoning', 'structured_generation'] as const) {
    const plan = planCapability({
      capability,
      credentials: new Set(['GEMINI_API_KEY']),
      policy: { allowPaid: false },
    });
    const first = plan.chain[0];
    assert.equal(first?.binding.provider, 'gemini', `${capability} should rank Gemini first when only its credential is set`);
    assert.equal(first?.free, true);
  }
});

/* ------------------------------------------------------------------ */
/* Request shape / response normalization                              */
/* ------------------------------------------------------------------ */

function withFetchStub<T>(stub: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

function baseRequest(overrides: Partial<AIGenerateRequest> = {}): AIGenerateRequest {
  return {
    system: 'You are a helpful assistant.',
    prompt: 'Say hello.',
    schema: { type: 'object', properties: { hello: { type: 'string' } }, required: ['hello'] },
    model: 'gemini-3.6-flash',
    effort: 'medium',
    maxTokens: 512,
    ...overrides,
  };
}

test('gemini.generate() sends the documented generateContent request shape, with the key in a header, never the query string', () =>
  withFetchStub(async (url, init) => {
    assert.equal(
      url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    );
    const headers = init?.headers as Record<string, string>;
    assert.equal(headers['x-goog-api-key'], 'fake');
    assert.equal(String(url).includes('key='), false, 'the API key must never travel in the query string');

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal((body.contents as { parts: { text: string }[] }[])[0]?.parts[0]?.text, 'Say hello.');
    const generationConfig = body.generationConfig as { maxOutputTokens: number; responseMimeType: string };
    assert.equal(generationConfig.maxOutputTokens, 512);
    assert.equal(generationConfig.responseMimeType, 'application/json');

    return new Response(
      JSON.stringify({
        modelVersion: 'gemini-3.6-flash',
        responseId: 'req_gem_123',
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ hello: 'world' }) }] } },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }),
      { status: 200 },
    );
  }, async () => {
    const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
    await provider.generate(baseRequest());
  }));

test('gemini.generate() normalizes a real response shape into AIGenerateResult', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({
          modelVersion: 'gemini-3.6-flash',
          responseId: 'req_gem_456',
          candidates: [
            { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ hello: 'world' }) }] } },
          ],
          usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 7 },
        }),
        { status: 200 },
      ),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const result = await provider.generate(baseRequest());
      assert.deepEqual(result.data, { hello: 'world' });
      assert.equal(result.model, 'gemini-3.6-flash');
      assert.equal(result.usage.inputTokens, 42);
      assert.equal(result.usage.outputTokens, 7);
      assert.equal(result.structuredOutput, 'native');
      assert.equal(result.requestId, 'req_gem_456');
    },
  ));

test('gemini.generate() concatenates multi-part text — a long answer split across parts is not truncated to the first part', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [{ text: '{"hello":' }, { text: '"world"}' }],
              },
            },
          ],
          usageMetadata: {},
        }),
        { status: 200 },
      ),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const result = await provider.generate(baseRequest());
      assert.deepEqual(result.data, { hello: 'world' });
    },
  ));

/* ------------------------------------------------------------------ */
/* Gemini-specific failure shapes                                      */
/* ------------------------------------------------------------------ */

test('gemini.generate() rejects, non-retryably, when the prompt is blocked before generation starts', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({ promptFeedback: { blockReason: 'OTHER' }, candidates: [] }),
        { status: 200 },
      ),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.provider, 'gemini');
          assert.equal(error.retryable, false, 'a blocked prompt will be blocked again unchanged');
          assert.match(error.message, /blocked/);
          return true;
        },
      );
    },
  ));

test('gemini.generate() rejects, non-retryably, on a content-safety finish reason (SAFETY / PROHIBITED_CONTENT / etc.)', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }),
        { status: 200 },
      ),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.retryable, false, 'the model declining on safety grounds will decline again unchanged');
          assert.match(error.message, /declined/);
          return true;
        },
      );
    },
  ));

test('gemini.generate() rejects, retryably, when the response carries no candidates at all', () =>
  withFetchStub(
    async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.retryable, true, 'no candidates on an otherwise-200 response looks transient');
          return true;
        },
      );
    },
  ));

test('gemini.generate() maps a non-2xx response to a retryable ProviderRequestError on a 5xx', () =>
  withFetchStub(
    async () => new Response('upstream error', { status: 503 }),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.provider, 'gemini');
          assert.equal(error.retryable, true, 'a 503 is retryable — the same vendor may answer on a retry');
          return true;
        },
      );
    },
  ));

test('gemini.generate() maps a 4xx (non-429) response to a non-retryable ProviderRequestError', () =>
  withFetchStub(
    async () => new Response('bad request', { status: 400 }),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.retryable, false, 'a 400 will fail again unchanged — retrying it is pointless');
          return true;
        },
      );
    },
  ));

test('gemini.generate() times out rather than hanging when the endpoint never answers', () =>
  withFetchStub(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        // Same pattern as test/ai/groq-provider.test.ts: `withDeadline`'s own
        // timer is deliberately unref'd, so an isolated test needs a ref'd
        // backstop to keep the event loop alive until the real abort fires.
        const keepAlive = setTimeout(() => {}, 5_000);
        const onAbort = (): void => {
          clearTimeout(keepAlive);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        };
        if (signal?.aborted === true) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });
      }),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 25, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.match(error.message, /no response within 25ms/);
          assert.equal(error.retryable, true);
          return true;
        },
      );
    },
  ));

test('gemini.health() probes the models endpoint without throwing on a healthy response', () =>
  withFetchStub(
    async () => new Response(JSON.stringify({ models: [] }), { status: 200 }),
    async () => {
      const provider = geminiAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const report = await provider.health();
      assert.equal(typeof report.status, 'string');
      assert.equal(typeof report.detail, 'string');
    },
  ));
