/**
 * Groq adapter (T05) — registration, request/response shape, and the
 * planner-level behaviour that is the actual point of adding it: a second
 * genuinely-free worker beside Gemini.
 *
 * Follows the three-step extension `lib/ai/providers/index.ts` documents
 * (adapter file, `AI_PROVIDER_NAMES`, one line in the adapter table) and the
 * same wiring-proof pattern `test/ai/xai-provider.test.ts` established — plus
 * real fetch-stubbed behavioural tests (request shape, response
 * normalization, timeout, failure) and real planner tests (selection,
 * fallback, budget gating), since Groq's whole reason for existing is
 * runtime behaviour a wiring check alone cannot prove.
 *
 * No live network call anywhere in this file — `groq.ts` has not yet been
 * verified against a live key (see its own docstring); `globalThis.fetch` is
 * stubbed and restored around every behavioural test.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as groqAdapter } from '../../lib/ai/providers/groq.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { ProviderRequestError } from '../../lib/errors.js';
import { planCapability } from '../../lib/capability/plan.js';

import type { QuotaLedger } from '../../lib/capability/quota.js';
import type { AIGenerateRequest } from '../../lib/ai/types.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

/* ------------------------------------------------------------------ */
/* Wiring — selection                                                  */
/* ------------------------------------------------------------------ */

test('"groq" is in the closed provider vocabulary', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('groq'));
});

test('the adapter table has a real groq entry, not a placeholder', () => {
  assert.equal(ADAPTERS.groq.name, 'groq');
  assert.equal(ADAPTERS.groq.apiKeyVariable, 'GROQ_API_KEY');
  assert.equal(typeof ADAPTERS.groq.create, 'function');
});

test('groq reuses the OpenAI strict-schema normalizer, and reports native schema support', () => {
  const provider = groqAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, true);
});

test('lib/config.ts has a default model for groq, pinned to a strict-schema-capable id', () => {
  assert.equal(DEFAULT_MODELS.groq, 'openai/gpt-oss-120b');
});

test('the capability model catalog carries a real, OBSERVED free allowance for groq — the whole point of adding it', () => {
  const entries = catalogFor('groq');
  assert.ok(entries.length > 0, 'expected at least one groq model in the catalog');
  for (const entry of entries) {
    assert.ok(entry.freeAllowance !== null, `${entry.id} should carry Groq's real free-tier allowance`);
    assert.ok(entry.centsPerMillionInput > 0, 'a routing estimate is still carried for the paid path beyond the allowance');
  }
});

test('groq is registered in the catalog under its own provider name, not merged into another vendor', () => {
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'groq'));
});

/* ------------------------------------------------------------------ */
/* Request shape / response normalization / timeout / failure          */
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
    model: 'openai/gpt-oss-120b',
    effort: 'medium',
    maxTokens: 512,
    ...overrides,
  };
}

test('groq.generate() sends the documented OpenAI-compatible request shape', () =>
  withFetchStub(async (url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.equal(body.max_tokens, 512);
    const responseFormat = body.response_format as { type: string; json_schema: { strict: boolean } };
    assert.equal(responseFormat.type, 'json_schema');
    assert.equal(responseFormat.json_schema.strict, true, 'gpt-oss-120b is one of the two models Groq documents strict mode for');
    const messages = body.messages as { role: string; content: string }[];
    assert.equal(messages[1]?.content, 'Say hello.');

    return new Response(
      JSON.stringify({
        id: 'req_123',
        model: 'openai/gpt-oss-120b',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ hello: 'world' }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status: 200 },
    );
  }, async () => {
    const provider = groqAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
    await provider.generate(baseRequest());
  }));

test('groq.generate() normalizes a real response shape into AIGenerateResult', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({
          id: 'req_456',
          model: 'openai/gpt-oss-120b',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ hello: 'world' }) } }],
          usage: { prompt_tokens: 42, completion_tokens: 7 },
        }),
        { status: 200 },
      ),
    async () => {
      const provider = groqAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const result = await provider.generate(baseRequest());
      assert.deepEqual(result.data, { hello: 'world' });
      assert.equal(result.model, 'openai/gpt-oss-120b');
      assert.equal(result.usage.inputTokens, 42);
      assert.equal(result.usage.outputTokens, 7);
      assert.equal(result.structuredOutput, 'native');
      assert.equal(result.requestId, 'req_456');
    },
  ));

test('groq.generate() maps a non-2xx response to a retryable ProviderRequestError on a 5xx', () =>
  withFetchStub(
    async () => new Response('upstream error', { status: 503 }),
    async () => {
      const provider = groqAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.provider, 'groq');
          assert.equal(error.retryable, true, 'a 503 is retryable — the same vendor may answer on a retry');
          return true;
        },
      );
    },
  ));

test('groq.generate() maps a 4xx (non-429) response to a non-retryable ProviderRequestError', () =>
  withFetchStub(
    async () => new Response('bad request', { status: 400 }),
    async () => {
      const provider = groqAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
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

test('groq.generate() times out rather than hanging when the endpoint never answers', () =>
  withFetchStub(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        // `withDeadline`'s own timer is deliberately unref'd (a pending
        // request must never hold a real process open on its own) — which
        // means nothing else refs the event loop in this isolated test, and
        // Node's test runner can decide the loop has "resolved" before that
        // unref'd timer actually fires. A ref'd backstop, cleared the moment
        // the real abort arrives, keeps the loop alive long enough without
        // slowing the test down in practice.
        const keepAlive = setTimeout(() => {}, 5_000);
        const onAbort = (): void => {
          clearTimeout(keepAlive);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        };
        if (signal?.aborted === true) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });
      }),
    async () => {
      const provider = groqAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 25, headers: {} });
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

/* ------------------------------------------------------------------ */
/* Planner: fallback (Gemini -> Groq) and budget gating                */
/* ------------------------------------------------------------------ */

/** A quota ledger that reports zero room for exactly one model key prefix. */
function exhaustFor(exhaustedPrefix: string): QuotaLedger {
  return {
    used: (key) => (key.startsWith(exhaustedPrefix) ? 20 : 0),
    hasRoom: (key) => !key.startsWith(exhaustedPrefix),
    remaining: (key, allowance) => (key.startsWith(exhaustedPrefix) ? 0 : allowance),
    record: async () => {},
    snapshot: () => ({ day: '2026-08-24', used: {} }),
  };
}

test('T05: an exhausted Gemini allowance fails over to Groq, not straight to a paid vendor — addressing the single-point-of-failure flag', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: new Set(['GEMINI_API_KEY', 'GROQ_API_KEY']),
    quota: exhaustFor('gemini:'),
    policy: { allowPaid: false },
  });

  const geminiStep = plan.chain.find((s) => s.binding.provider === 'gemini');
  assert.equal(geminiStep, undefined, 'the exhausted vendor is removed from the chain');

  const groqStep = plan.chain.find((s) => s.binding.provider === 'groq');
  assert.ok(groqStep, 'Groq must be selectable once Gemini is exhausted, with no paid policy needed');
  assert.equal(groqStep.free, true, "Groq's own allowance is untouched — this call is still free");
});

test('T05: Groq is ranked immediately after Gemini in the reasoning chain, ahead of every paid vendor', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: new Set(['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY', 'CEREBRAS_API_KEY']),
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: true },
  });
  const order = plan.chain.filter((s) => s.binding.kind === 'model').map((s) => s.binding.provider);
  const geminiIndex = order.indexOf('gemini');
  const groqIndex = order.indexOf('groq');
  const openaiIndex = order.indexOf('openai');
  assert.ok(geminiIndex !== -1 && groqIndex !== -1 && openaiIndex !== -1);
  assert.ok(geminiIndex < groqIndex, 'Gemini still ranks first — Groq is the second free option, not a replacement');
  assert.ok(groqIndex < openaiIndex, 'the free Groq allowance ranks ahead of any paid vendor');
});

test('T05: once Groq\'s own allowance is spent, its unverified price blocks it exactly like Cerebras\'s, unless explicitly allowed', () => {
  const blocked = planCapability({
    capability: 'structured_generation',
    credentials: new Set(['GROQ_API_KEY']),
    quota: exhaustFor('groq:'),
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: false },
  });
  const groqExclusion = blocked.excluded.find((e) => e.provider === 'groq');
  assert.equal(groqExclusion?.reason, 'unpriced-blocked');
  assert.equal(blocked.chain.some((s) => s.binding.provider === 'groq'), false);

  const allowed = planCapability({
    capability: 'structured_generation',
    credentials: new Set(['GROQ_API_KEY']),
    quota: exhaustFor('groq:'),
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricingFor: ['groq'] },
  });
  assert.equal(allowed.chain.some((s) => s.binding.provider === 'groq'), true);
});
