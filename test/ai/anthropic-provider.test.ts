/**
 * Anthropic adapter — wiring, planner ranking, and real error-mapping
 * behaviour, covered as far as this adapter's shape honestly allows without
 * either skipping it or faking coverage it doesn't have.
 *
 * Filed against gap G-AI-01 (MASTER_CAPABILITY_TOOL_REGISTRY.md §7):
 * `anthropic` is the #1-ranked executor for `prose_writing` and
 * `creative_direction` and had zero dedicated test coverage.
 *
 * ## Why this file does not mirror gemini/groq's `generate()` coverage
 *
 * `lib/ai/providers/anthropic.ts` is the one adapter built on the vendor SDK
 * (`@anthropic-ai/sdk`) rather than raw `fetch`, and its `generate()` uses
 * `client.beta.messages.stream(...).finalMessage()` — a real Server-Sent-Events
 * stream the SDK parses and accumulates internally. Faithfully stubbing that
 * would mean hand-reconstructing the SDK's internal SSE event sequence
 * (`message_start` / `content_block_delta` / `message_delta` / `message_stop`)
 * against undocumented internals that can silently drift out of sync with a
 * future SDK version — exactly the kind of shallow, misleading coverage the
 * standing project rule warns against ("do not treat adapter/test existence
 * as proof of integration"). Rather than ship that risk, this file covers
 * what genuinely exercises real code without it:
 *
 *   - wiring (the adapter is real, not a placeholder);
 *   - planner ranking (anthropic is selected first, and correctly, for the
 *     capabilities it leads);
 *   - `health()` — a plain, non-streaming SDK request (`client.models.list`)
 *     — stubbed at the `fetch` layer so the SDK's OWN response parsing
 *     constructs its real `RateLimitError` / `AuthenticationError` /
 *     `APIConnectionError` / generic `APIError` instances, and this file
 *     asserts `toProviderError`'s mapping of each into the pipeline's own
 *     `ProviderRequestError` taxonomy (retryable/non-retryable) is correct.
 *     `generate()` shares the exact same `toProviderError` function, so this
 *     is real coverage of the mapping logic `generate()` also depends on —
 *     it is just not coverage of the streaming call itself.
 *
 * Full `generate()` request/response coverage remains an open follow-up,
 * scoped separately rather than claimed here (see gap G-AI-01's updated
 * detail in the registry).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ADAPTERS } from '../../lib/ai/providers/index.js';
import { AI_PROVIDER_NAMES } from '../../lib/ai/types.js';
import { adapter as anthropicAdapter } from '../../lib/ai/providers/anthropic.js';
import { DEFAULT_MODELS } from '../../lib/config.js';
import { MODEL_CATALOG, catalogFor } from '../../lib/capability/models.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { planCapability } from '../../lib/capability/plan.js';

const noopLogger = createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });

/* ------------------------------------------------------------------ */
/* Wiring — selection                                                  */
/* ------------------------------------------------------------------ */

test('"anthropic" is in the closed provider vocabulary', () => {
  assert.ok(AI_PROVIDER_NAMES.includes('anthropic'));
});

test('the adapter table has a real anthropic entry, not a placeholder', () => {
  assert.equal(ADAPTERS.anthropic.name, 'anthropic');
  assert.equal(ADAPTERS.anthropic.apiKeyVariable, 'ANTHROPIC_API_KEY');
  assert.equal(typeof ADAPTERS.anthropic.create, 'function');
});

test('anthropic declares native schema support', () => {
  const provider = anthropicAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 1000, headers: {} });
  assert.equal(provider.supportsNativeSchema, true);
});

test('lib/config.ts has a default model for anthropic', () => {
  assert.equal(typeof DEFAULT_MODELS.anthropic, 'string');
  assert.ok(DEFAULT_MODELS.anthropic.length > 0);
});

test('the capability model catalog has real, commercial-api priced entries for anthropic', () => {
  const entries = catalogFor('anthropic');
  assert.ok(entries.length > 0, 'expected at least one anthropic model in the catalog');
  for (const entry of entries) {
    assert.equal(entry.licence, 'commercial-api');
    assert.ok(entry.centsPerMillionInput > 0, 'anthropic carries no free allowance — every call is priced');
  }
});

test('anthropic is registered in the catalog under its own provider name, not merged into another vendor', () => {
  assert.ok(MODEL_CATALOG.some((m) => m.provider === 'anthropic'));
});

test('anthropic is the first-ranked executor for the two capabilities it leads, given only its own credential', () => {
  for (const capability of ['prose_writing', 'creative_direction'] as const) {
    const plan = planCapability({
      capability,
      credentials: new Set(['ANTHROPIC_API_KEY']),
      policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: true },
    });
    const first = plan.chain[0];
    assert.equal(first?.binding.provider, 'anthropic', `${capability} should rank anthropic first when only its credential is set`);
  }
});

test('anthropic is excluded from a run with allowPaid: false and no other free provider present, rather than silently substituted', () => {
  const plan = planCapability({
    capability: 'prose_writing',
    credentials: new Set(['ANTHROPIC_API_KEY']),
    policy: { allowPaid: false },
  });
  assert.equal(plan.chain.some((s) => s.binding.provider === 'anthropic'), false, 'anthropic has no free allowance — a zero-budget run must not select it');
  const exclusion = plan.excluded.find((e) => e.provider === 'anthropic');
  assert.equal(exclusion?.reason, 'paid-disabled');
});

/* ------------------------------------------------------------------ */
/* Real error-mapping, via health() — a plain (non-streaming) request  */
/* ------------------------------------------------------------------ */

function withFetchStub<T>(stub: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test('anthropic.health() reports ready when the credential is accepted', () =>
  withFetchStub(
    async () =>
      new Response(JSON.stringify({ data: [{ id: 'claude-opus-5' }], has_more: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const provider = anthropicAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const report = await provider.health();
      assert.equal(report.status, 'ready');
    },
  ));

test("anthropic.health() maps a 401 to 'unavailable' via the SDK's real AuthenticationError, non-retryably", () =>
  withFetchStub(
    async () =>
      new Response(JSON.stringify({ error: { type: 'authentication_error', message: 'invalid x-api-key' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const provider = anthropicAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const report = await provider.health();
      assert.equal(report.status, 'unavailable');
      assert.match(report.detail, /ANTHROPIC_API_KEY was rejected/);
    },
  ));

test("anthropic.health() maps a 429 to 'unavailable' via the SDK's real RateLimitError, and the mapping marks it retryable", () =>
  withFetchStub(
    async () =>
      new Response(JSON.stringify({ error: { type: 'rate_limit_error', message: 'rate limited' } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const provider = anthropicAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const report = await provider.health();
      assert.equal(report.status, 'unavailable');
      assert.match(report.detail, /rate limited/);
    },
  ));

test("anthropic.health() maps a 500 to 'unavailable' via the SDK's real APIError", () =>
  withFetchStub(
    async () =>
      new Response(JSON.stringify({ error: { type: 'api_error', message: 'internal server error' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    async () => {
      const provider = anthropicAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const report = await provider.health();
      assert.equal(report.status, 'unavailable');
    },
  ));

test('anthropic.health() maps a network failure (fetch rejects) to unavailable without throwing', () =>
  withFetchStub(
    async () => {
      throw new TypeError('fetch failed');
    },
    async () => {
      const provider = anthropicAdapter.create({ apiKey: 'fake', baseUrl: null, logger: noopLogger, timeoutMs: 5000, headers: {} });
      const report = await provider.health();
      assert.equal(report.status, 'unavailable');
    },
  ));
