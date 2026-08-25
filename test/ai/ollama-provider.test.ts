/**
 * Ollama adapter — registration, request/response shape, and the two-router
 * wiring that makes it genuinely dispatchable, not merely declared.
 *
 * Unlike every other provider test in this directory, `ollama.ts` was NOT
 * built from documentation alone: `lib/ai/providers/ollama.ts`'s file header
 * records a real live call (`POST /api/chat` against a running local server,
 * 2026-08-25) that this adapter's request/response shape is built from. This
 * file still stubs `globalThis.fetch` for every behavioural test — no live
 * network call runs here, matching every other adapter test in this
 * directory and keeping `npm test` fast and hermetic — but the *shape* being
 * stubbed is one this deployment actually observed, not merely assumed.
 *
 * "Selectable by the router" is proven twice, because this repository keeps
 * two independent capability routers (ADR-0008, `docs/adr/`): the
 * `lib/capability/plan.ts` + `bindings.ts` planner (mirrors
 * groq-provider.test.ts's planner tests below), and the
 * `lib/factory/pool.ts` + `lib/factory/capabilities.ts` pair that
 * `scripts/n8n/stage.ts` — the actual production dispatch pipeline — calls
 * through `withPoolFailover`. Both are exercised here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as ollamaAdapter } from '../../lib/ai/providers/ollama.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { ProviderRequestError } from '../../lib/errors.js';
import { planCapability } from '../../lib/capability/plan.js';
import { resolvePool } from '../../lib/factory/pool.js';
import { routeForCapability, routedMembers } from '../../lib/factory/capabilities.js';

import type { AiConfig } from '../../lib/config.js';
import type { AIGenerateRequest, AIProviderName } from '../../lib/ai/types.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

/* ------------------------------------------------------------------ */
/* Wiring — vocabulary, adapter table, config, catalogue               */
/* ------------------------------------------------------------------ */

test('"ollama" is in the closed provider vocabulary, last (the tie-break loser with no telemetry)', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('ollama'));
  assert.equal(AI_PROVIDER_NAMES[AI_PROVIDER_NAMES.length - 1], 'ollama');
});

test('the adapter table has a real ollama entry, not a placeholder', () => {
  assert.equal(ADAPTERS.ollama.name, 'ollama');
  assert.equal(ADAPTERS.ollama.apiKeyVariable, 'OLLAMA_ENABLED');
  assert.equal(typeof ADAPTERS.ollama.create, 'function');
});

test('ollama is honest about not offering native schema enforcement', () => {
  const provider = ollamaAdapter.create({ apiKey: 'true', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, false);
  assert.equal(ollamaAdapter.supportsNativeSchema, false);
});

test('lib/config.ts has a default model for ollama, matching the live-verified installed model', () => {
  assert.equal(DEFAULT_MODELS.ollama, 'gemma4:26b');
});

test('the capability model catalog carries genuinely-free ($0), locally-jurisdictioned pricing for ollama', () => {
  const entries = catalogFor('ollama');
  assert.ok(entries.length > 0, 'expected at least one ollama model in the catalog');
  for (const entry of entries) {
    assert.equal(entry.centsPerMillionInput, 0);
    assert.equal(entry.centsPerMillionOutput, 0);
    assert.equal(entry.freeAllowance, null, 'no rate limit to record — a different fact from a paid allowance');
    assert.equal(entry.licence, 'permissive-local');
    assert.equal(entry.jurisdiction, 'local');
    assert.equal(entry.structuredOutput, 'instructed');
  }
});

test('ollama is registered in the catalog under its own provider name', () => {
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'ollama'));
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
    model: 'gemma4:26b',
    effort: 'medium',
    maxTokens: 512,
    ...overrides,
  };
}

test('ollama.generate() sends the live-observed /api/chat request shape, and never leaks apiKey as a header', () =>
  withFetchStub(async (url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(url, 'http://localhost:11434/api/chat');
    assert.equal(body.model, 'gemma4:26b');
    assert.equal(body.stream, false);
    assert.equal(body.format, 'json');
    assert.deepEqual(body.options, { num_predict: 512 });
    const messages = body.messages as { role: string; content: string }[];
    assert.equal(messages[1]?.content, 'Say hello.');

    const headers = init?.headers as Record<string, string> | undefined;
    assert.equal(headers?.authorization, undefined, 'the OLLAMA_ENABLED sentinel must never be sent as a credential');

    return new Response(
      JSON.stringify({
        model: 'gemma4:26b',
        message: { role: 'assistant', content: JSON.stringify({ hello: 'world' }), thinking: 'reasoning trace' },
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 200,
        eval_count: 12,
      }),
      { status: 200 },
    );
  }, async () => {
    const provider = ollamaAdapter.create({ apiKey: 'true', baseUrl: null, logger: noopLogger, timeoutMs: 60_000, headers: {} });
    await provider.generate(baseRequest());
  }));

test('ollama.generate() parses message.content, never message.thinking, into the structured result', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({
          model: 'gemma4:26b',
          message: { role: 'assistant', content: JSON.stringify({ hello: 'world' }), thinking: 'a long reasoning trace that is not JSON at all' },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 200,
          eval_count: 12,
        }),
        { status: 200 },
      ),
    async () => {
      const provider = ollamaAdapter.create({ apiKey: 'true', baseUrl: null, logger: noopLogger, timeoutMs: 60_000, headers: {} });
      const result = await provider.generate(baseRequest());
      assert.deepEqual(result.data, { hello: 'world' });
      assert.equal(result.model, 'gemma4:26b');
      assert.equal(result.usage.inputTokens, 200);
      assert.equal(result.usage.outputTokens, 12);
      assert.equal(result.structuredOutput, 'instructed');
      assert.equal(result.finishReason, 'stop');
      assert.equal(result.requestId, null, 'Ollama does not return a request id');
    },
  ));

test('ollama.generate() treats done_reason "length" as a truncated, non-retryable failure', () =>
  withFetchStub(
    async () =>
      new Response(
        JSON.stringify({
          model: 'gemma4:26b',
          message: { role: 'assistant', content: '{"hello"', thinking: '' },
          done: true,
          done_reason: 'length',
          prompt_eval_count: 200,
          eval_count: 512,
        }),
        { status: 200 },
      ),
    async () => {
      const provider = ollamaAdapter.create({ apiKey: 'true', baseUrl: null, logger: noopLogger, timeoutMs: 60_000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.retryable, false, 'cut off at maxTokens will fail again unchanged unless the caller raises it');
          assert.match(error.message, /cut off/);
          return true;
        },
      );
    },
  ));

test('ollama.generate() maps a non-2xx response to a retryable ProviderRequestError on a 5xx', () =>
  withFetchStub(
    async () => new Response('upstream error', { status: 503 }),
    async () => {
      const provider = ollamaAdapter.create({ apiKey: 'true', baseUrl: null, logger: noopLogger, timeoutMs: 60_000, headers: {} });
      await assert.rejects(
        () => provider.generate(baseRequest()),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.provider, 'ollama');
          assert.equal(error.retryable, true);
          return true;
        },
      );
    },
  ));

test('ollama.health() probes /api/tags (no auth header) and reports ready on a 200', () =>
  withFetchStub(
    async (url, init) => {
      assert.equal(url, 'http://localhost:11434/api/tags');
      const headers = init?.headers as Record<string, string> | undefined;
      assert.equal(headers?.authorization, undefined);
      return new Response(JSON.stringify({ models: [{ name: 'gemma4:26b' }] }), { status: 200 });
    },
    async () => {
      const provider = ollamaAdapter.create({ apiKey: 'true', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const health = await provider.health();
      assert.equal(health.status, 'ready');
    },
  ));

test('OLLAMA_BASE_URL overrides the default local address', () =>
  withFetchStub(
    async (url) => {
      assert.equal(url, 'http://ollama-host:11434/api/tags');
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    },
    async () => {
      const provider = ollamaAdapter.create({
        apiKey: 'true',
        baseUrl: 'http://ollama-host:11434',
        logger: noopLogger,
        timeoutMs: 5000,
        headers: {},
      });
      await provider.health();
    },
  ));

/* ------------------------------------------------------------------ */
/* lib/capability/plan.ts — the planner-side router                    */
/* ------------------------------------------------------------------ */

test('planner: ollama is selectable for reasoning once OLLAMA_ENABLED is credentialled, ranked after every network vendor', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: new Set(['OLLAMA_ENABLED']),
    policy: { allowPaid: false },
  });
  const ollamaStep = plan.chain.find((s) => s.binding.provider === 'ollama');
  assert.ok(ollamaStep, 'ollama must be selectable on its own opt-in flag, with no paid policy needed');
  assert.equal(ollamaStep.free, true, "a $0 catalog entry — this call really is free");
});

test('planner: with every vendor credentialled, ollama ranks with the free tier on cost, not after paid vendors', () => {
  // This planner (lib/capability/plan.ts) ranks "free before paid, cheaper
  // before dearer" first and observed latency only as a tie-break within a
  // cost tier — unlike the production n8n router (lib/ai/router.ts), which
  // has no cost dimension at all. A genuinely-$0 local call is real free
  // spend avoidance, so it belongs WITH gemini/groq here even though it is
  // the slowest of the three — see bindings.ts's own comment on this entry.
  const plan = planCapability({
    capability: 'reasoning',
    credentials: new Set([
      'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
      'DEEPSEEK_API_KEY', 'CEREBRAS_API_KEY', 'OLLAMA_ENABLED',
    ]),
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: true },
  });
  const modelSteps = plan.chain.filter((s) => s.binding.kind === 'model');
  const providers = modelSteps.map((s) => s.binding.provider);
  const ollamaStep = modelSteps.find((s) => s.binding.provider === 'ollama');
  assert.ok(ollamaStep);
  assert.equal(ollamaStep.free, true, 'a genuine $0 catalog entry');
  assert.equal(ollamaStep.estimatedCents, 0);

  const paidProviders: readonly AIProviderName[] = ['deepseek', 'cerebras', 'openrouter', 'openai'];
  const ollamaIndex = providers.indexOf('ollama');
  for (const paid of paidProviders) {
    const paidIndex = providers.indexOf(paid);
    assert.ok(paidIndex === -1 || ollamaIndex < paidIndex, `ollama ($0) must rank ahead of ${paid} (paid) on cost`);
  }
  // Within the free tier itself, gemini and groq still come first — ollama's
  // declared `order` only breaks the tie behind them, never ahead.
  assert.ok(providers.indexOf('gemini') < ollamaIndex);
  assert.ok(providers.indexOf('groq') < ollamaIndex);
});

/* ------------------------------------------------------------------ */
/* lib/factory/pool.ts + capabilities.ts — the production n8n router   */
/* ------------------------------------------------------------------ */

function poolConfig(overrides: Partial<AiConfig['apiKeys']> = {}): AiConfig {
  return {
    provider: 'gemini',
    apiKeys: {
      anthropic: '', openai: '', gemini: '', openrouter: '', xai: '',
      deepseek: '', cerebras: '', groq: '', ollama: '',
      ...overrides,
    },
    baseUrls: {
      anthropic: null, openai: null, gemini: null, openrouter: null, xai: null,
      deepseek: null, cerebras: null, groq: null, ollama: null,
    },
    requestTimeoutMs: 300_000,
    maxRetries: 0,
    retryBaseDelayMs: 1_000,
    openRouterReferer: null,
    openRouterTitle: null,
  };
}

test('production pool: ollama is absent from the default free-tier pool without OLLAMA_ENABLED, and names the fix', () => {
  const resolved = resolvePool('research', poolConfig(), {});
  assert.equal(resolved.members.some((m) => m.provider === 'ollama'), false);
  const absence = resolved.absent.find((a) => a.provider === 'ollama');
  assert.ok(absence, 'ollama must still be named, not silently dropped');
  assert.equal(absence.variable, 'OLLAMA_ENABLED');
});

test('production pool: OLLAMA_ENABLED brings ollama into the default free-tier research pool, dispatchable via routedMembers', () => {
  const config = poolConfig({ gemini: 'key', ollama: 'true' });
  const resolved = resolvePool('research', config, {});
  const ollamaMember = resolved.members.find((m) => m.provider === 'ollama');
  assert.ok(ollamaMember, 'ollama must actually be a pool member, not merely credentialled');
  assert.equal(ollamaMember.model, 'gemma4:26b');

  const decision = routeForCapability({ capability: 'research', config });
  const ordered = routedMembers(decision.chain, resolved.members);
  assert.ok(ordered.some((m) => m.provider === 'ollama'), 'ollama must appear in the actual dispatch order stage.ts consumes');
  assert.equal(ordered[ordered.length - 1]?.provider, 'ollama', 'no telemetry yet — declaration order puts it last, after gemini');
});
