/**
 * The planner is where the safety properties live: F-08 removing every model
 * from a capability that may not have model-authored output, an exhausted
 * allowance being a hard filter rather than a penalty, and a paid service
 * never being selected on a zero-budget run without an explicit override.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { planCapability } from '../../lib/capability/plan.js';
import { unmeteredQuotaLedger } from '../../lib/capability/quota.js';
import { resolveBudgetTier } from '../../lib/capability/budget.js';
import { ALL_BINDINGS } from '../../lib/capability/bindings.js';

import type { QuotaLedger } from '../../lib/capability/quota.js';

const ALL_CREDENTIALS = new Set([
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
]);

const EVERY_CREDENTIAL = new Set([
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'DEEPSEEK_API_KEY',
  'CEREBRAS_API_KEY',
  'XAI_API_KEY',
]);

test('a rejected capability is refused before any candidate is examined', () => {
  const plan = planCapability({ capability: 'audio_speech', credentials: ALL_CREDENTIALS });
  assert.equal(plan.plannable, false);
  assert.equal(plan.chain.length, 0);
  assert.equal(plan.excluded[0]?.reason, 'capability-rejected');
});

test('a human-gated capability is refused on an autonomous run', () => {
  const plan = planCapability({
    capability: 'hosting',
    credentials: ALL_CREDENTIALS,
    policy: { autonomous: true },
  });
  assert.equal(plan.plannable, false);
  assert.equal(plan.excluded[0]?.reason, 'requires-human');
});

test('a human-gated capability is plannable once a person is attending', () => {
  const plan = planCapability({
    capability: 'hosting',
    credentials: ALL_CREDENTIALS,
    policy: { autonomous: false },
  });
  assert.equal(plan.plannable, true);
});

test('F-08: no model binding survives for a capability that may not have model-authored output', () => {
  const plan = planCapability({ capability: 'evidence_collection', credentials: ALL_CREDENTIALS });
  for (const step of plan.chain) {
    assert.notEqual(step.binding.kind, 'model');
  }
  // evidence_collection has no terminal by design — it must fail loudly.
  assert.equal(plan.hasTerminal, false);
});

test('a capability with a terminal always ends its chain there when nothing is credentialled', () => {
  const plan = planCapability({ capability: 'reasoning', credentials: new Set() });
  assert.equal(plan.plannable, true);
  assert.equal(plan.hasTerminal, true);
  const last = plan.chain[plan.chain.length - 1];
  assert.equal(last?.binding.kind, 'deterministic');
});

test('missing credentials exclude a service with a legible reason', () => {
  const plan = planCapability({ capability: 'reasoning', credentials: new Set() });
  const geminiExclusion = plan.excluded.find((e) => e.service === 'gemini.frontier');
  assert.equal(geminiExclusion?.reason, 'no-credential');
});

test('a zero-budget run never selects a paid model, even when credentialled', () => {
  const plan = planCapability({
    capability: 'prose_writing',
    credentials: ALL_CREDENTIALS,
    policy: { allowPaid: false, budgetCentsRemaining: 0 },
  });
  for (const step of plan.chain) {
    if (step.model !== null) assert.equal(step.free, true);
  }
  const anthropicExclusion = plan.excluded.find((e) => e.provider === 'anthropic');
  assert.equal(anthropicExclusion?.reason, 'paid-disabled');
});

test('allowing paid within a budget makes a paid model selectable', () => {
  const plan = planCapability({
    capability: 'prose_writing',
    credentials: ALL_CREDENTIALS,
    policy: { allowPaid: true, budgetCentsRemaining: 1_000 },
  });
  const anthropicStep = plan.chain.find((s) => s.binding.provider === 'anthropic');
  assert.ok(anthropicStep, 'expected anthropic to be selectable once paid services are allowed');
});

test('a cost that exceeds the remaining budget is excluded even when paid is allowed', () => {
  const plan = planCapability({
    capability: 'creative_direction',
    credentials: ALL_CREDENTIALS,
    policy: { allowPaid: true, budgetCentsRemaining: 0.001 },
  });
  const anthropicExclusion = plan.excluded.find((e) => e.provider === 'anthropic');
  assert.equal(anthropicExclusion?.reason, 'over-budget');
});

test('an exhausted free allowance removes a model from the chain entirely, not just its ranking', async () => {
  const spentLedger: QuotaLedger = {
    used: () => 20,
    hasRoom: () => false,
    remaining: () => 0,
    record: async () => {},
    snapshot: () => ({ day: '2026-08-18', used: {} }),
  };

  const plan = planCapability({
    capability: 'reasoning',
    credentials: ALL_CREDENTIALS,
    quota: spentLedger,
    policy: { allowPaid: false },
  });

  const geminiStep = plan.chain.find((s) => s.binding.provider === 'gemini');
  assert.equal(geminiStep, undefined, 'an exhausted allowance must remove the model, not rank it lower');
  const geminiExclusion = plan.excluded.find((e) => e.provider === 'gemini');
  assert.equal(geminiExclusion?.reason, 'quota-exhausted');
});

test('an excluded vendor (the cross-vendor constraint) is removed from the chain', () => {
  const plan = planCapability({
    capability: 'craft_judging',
    credentials: ALL_CREDENTIALS,
    excludeProviders: ['gemini'],
  });
  for (const step of plan.chain) {
    assert.notEqual(step.binding.provider, 'gemini');
  }
});

test('a service marked unimplemented is excluded, not silently skipped as if it never existed', () => {
  const plan = planCapability({
    capability: 'evidence_research',
    credentials: ALL_CREDENTIALS,
    unimplemented: new Set(['web-search']),
  });
  const excluded = plan.excluded.find((e) => e.service === 'web-search');
  assert.equal(excluded?.reason, 'not-implemented');
});

test('free-before-paid ordering puts an on-allowance model ahead of a paid one', () => {
  const plan = planCapability({
    capability: 'prose_writing',
    credentials: ALL_CREDENTIALS,
    policy: { allowPaid: true, budgetCentsRemaining: 1_000, preferFree: true },
  });
  const geminiIndex = plan.chain.findIndex((s) => s.binding.provider === 'gemini');
  const anthropicIndex = plan.chain.findIndex((s) => s.binding.provider === 'anthropic');
  assert.ok(geminiIndex !== -1 && anthropicIndex !== -1);
  assert.ok(geminiIndex < anthropicIndex, 'the free model should be tried before the paid one');
});

test('plannable is false and the chain is empty when every candidate is filtered', () => {
  const plan = planCapability({
    capability: 'pii_detection',
    credentials: new Set(),
    policy: { allowedJurisdictions: [] },
  });
  assert.equal(plan.plannable, false);
  assert.equal(plan.chain.length, 0);
});

test('planCapability contacts nothing and is pure given the same inputs', () => {
  const a = planCapability({ capability: 'reasoning', credentials: ALL_CREDENTIALS });
  const b = planCapability({ capability: 'reasoning', credentials: ALL_CREDENTIALS });
  assert.deepEqual(
    a.chain.map((s) => s.binding.id),
    b.chain.map((s) => s.binding.id),
  );
});

test('an unmetered quota ledger never excludes a model for quota reasons', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: ALL_CREDENTIALS,
    quota: unmeteredQuotaLedger(),
  });
  assert.equal(plan.excluded.some((e) => e.reason === 'quota-exhausted'), false);
});

/* ------------------------------------------------------------------ */
/* Budget tiers and unverified pricing                                 */
/* ------------------------------------------------------------------ */

test('tier0 never selects a paid candidate, even fully credentialled (test #1)', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: EVERY_CREDENTIAL,
    quota: unmeteredQuotaLedger(),
    policy: resolveBudgetTier('tier0'),
  });
  for (const step of plan.chain) {
    assert.equal(step.estimatedCents, 0, `${step.binding.id} should not be selectable at tier0`);
  }
});

test('tier1 selects the cheapest capable paid provider once the free option is exhausted (test #2)', () => {
  const exhausted: QuotaLedger = {
    used: () => 20,
    hasRoom: () => false,
    remaining: () => 0,
    record: async () => {},
    snapshot: () => ({ day: '2026-08-19', used: {} }),
  };

  const plan = planCapability({
    capability: 'reasoning',
    credentials: EVERY_CREDENTIAL,
    quota: exhausted,
    policy: resolveBudgetTier('tier1'),
  });

  assert.ok(plan.chain.length > 0);
  const first = plan.chain[0];
  // With allowPaid true, an exhausted allowance does not remove Gemini — it
  // just stops being free (7.05c at the default token estimate). DeepSeek's
  // workhorse (0.726c) is still the cheapest candidate in the survivor set,
  // so cost ordering puts it first regardless.
  assert.equal(first?.binding.provider, 'deepseek');
});

test('premium (tier2) cannot exceed its own hard cap (test #3)', () => {
  const plan = planCapability({
    capability: 'creative_direction',
    credentials: EVERY_CREDENTIAL,
    policy: resolveBudgetTier('tier2'),
    // A single call priced above the entire tier2 ceiling.
    tokens: { inputTokens: 50_000_000, outputTokens: 50_000_000 },
  });
  for (const step of plan.chain) {
    assert.ok(
      step.estimatedCents <= 2_000,
      `${step.binding.id} estimated at ${step.estimatedCents} cents, above the tier2 cap`,
    );
  }
});

test('an unverified-price candidate is dropped under a hard budget unless explicitly allowed (test #4, #18)', () => {
  const blocked = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: false },
  });
  const cerebrasExclusion = blocked.excluded.find((e) => e.provider === 'cerebras');
  assert.equal(cerebrasExclusion?.reason, 'unpriced-blocked');
  assert.equal(blocked.chain.some((s) => s.binding.provider === 'cerebras'), false);

  const allowed = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: true },
  });
  assert.equal(allowed.chain.some((s) => s.binding.provider === 'cerebras'), true);
});

test('xAI is deliberately wired into structured_generation, not left orphaned (WQ-005 / gap G-XAI-01, test #7)', () => {
  const xaiBindings = ALL_BINDINGS.filter((binding) => binding.provider === 'xai');
  assert.equal(xaiBindings.length, 1, 'exactly one deliberate binding, not a blanket wire-in across every capability');
  assert.equal(xaiBindings[0]?.capability, 'structured_generation');
  assert.equal(xaiBindings[0]?.modelClass, 'workhorse');
  assert.equal(xaiBindings[0]?.requiredCredentials.includes('XAI_API_KEY'), true);

  // Paid, no free tier (lib/capability/models.ts) — must sit behind the same
  // paid-service gate every other commercial vendor sits behind, never
  // selectable on a zero-budget run.
  const noBudget = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: false, budgetCentsRemaining: 0, allowUnverifiedPricing: false },
  });
  assert.equal(noBudget.chain.some((s) => s.binding.provider === 'xai'), false);

  const paidAllowed = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: false },
  });
  assert.equal(paidAllowed.chain.some((s) => s.binding.provider === 'xai'), true);

  // Only reachable with its own credential — no other vendor's key selects it.
  const withoutXaiKey = planCapability({
    capability: 'structured_generation',
    credentials: new Set([...EVERY_CREDENTIAL].filter((c) => c !== 'XAI_API_KEY')),
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: false },
  });
  assert.equal(withoutXaiKey.chain.some((s) => s.binding.provider === 'xai'), false);
});

test('the free OpenRouter enum model is selectable at tier0 (test #8)', () => {
  const plan = planCapability({
    capability: 'enum_direction',
    credentials: EVERY_CREDENTIAL,
    quota: unmeteredQuotaLedger(),
    policy: resolveBudgetTier('tier0'),
  });
  const openrouterStep = plan.chain.find((s) => s.binding.provider === 'openrouter');
  assert.ok(openrouterStep, 'expected the free OpenRouter enum model to be selectable at tier0');
  assert.equal(openrouterStep.free, true);
});

test('DeepSeek is selectable once paid policy and budget allow it (test #9)', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: EVERY_CREDENTIAL,
    policy: resolveBudgetTier('tier1'),
  });
  const deepseekStep = plan.chain.find((s) => s.binding.provider === 'deepseek');
  assert.ok(deepseekStep, 'expected DeepSeek to be selectable under tier1');
});

test('Cerebras is selectable once paid policy, budget and unverified-pricing consent all allow it (test #10)', () => {
  const plan = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricing: true },
  });
  const cerebrasStep = plan.chain.find((s) => s.binding.provider === 'cerebras');
  assert.ok(cerebrasStep, 'expected Cerebras to be selectable once unverified pricing is explicitly allowed');
});

test('allowUnverifiedPricingFor scopes the exception to the named provider only', () => {
  const plan = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricingFor: ['cerebras'] },
  });
  assert.equal(plan.chain.some((s) => s.binding.provider === 'cerebras'), true);
});

test('allowUnverifiedPricingFor naming a different provider does not unlock Cerebras', () => {
  const plan = planCapability({
    capability: 'structured_generation',
    credentials: EVERY_CREDENTIAL,
    policy: { allowPaid: true, budgetCentsRemaining: 10_000, allowUnverifiedPricingFor: ['gemini'] },
  });
  const cerebrasExclusion = plan.excluded.find((e) => e.provider === 'cerebras');
  assert.equal(cerebrasExclusion?.reason, 'unpriced-blocked');
  assert.equal(plan.chain.some((s) => s.binding.provider === 'cerebras'), false);
});

test('OpenAI is chosen only at its declared position, never ahead of a free option (test #11)', () => {
  const plan = planCapability({
    capability: 'reasoning',
    credentials: EVERY_CREDENTIAL,
    quota: unmeteredQuotaLedger(),
    policy: resolveBudgetTier('tier2'),
  });
  const geminiIndex = plan.chain.findIndex((s) => s.binding.provider === 'gemini');
  const openaiIndex = plan.chain.findIndex((s) => s.binding.provider === 'openai');
  assert.ok(geminiIndex !== -1 && openaiIndex !== -1);
  assert.ok(geminiIndex < openaiIndex, 'the free Gemini allowance should still rank ahead of paid OpenAI');
});
