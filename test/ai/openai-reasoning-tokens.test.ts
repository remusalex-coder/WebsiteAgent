/**
 * `toOpenAIReasoningReserve` / `maxCompletionTokensFor` — the fix for a real
 * live failure: a reasoning-effort OpenAI request sized for Gemini's
 * `maxTokens` alone was truncated at 16,000 tokens with zero visible
 * output, because OpenAI's `max_completion_tokens` is one shared pool for
 * both reasoning and output tokens (Gemini keeps them in two independent
 * pools — see `toGeminiThinkingBudget`).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { toOpenAIReasoningReserve, toGeminiThinkingBudget } from '../../lib/ai/protocol.js';
import { maxCompletionTokensFor } from '../../lib/ai/providers/openai.js';

test('the reserve ladder is monotonically non-decreasing with effort', () => {
  const levels: readonly ('low' | 'medium' | 'high' | 'xhigh' | 'max')[] = ['low', 'medium', 'high', 'xhigh', 'max'];
  const reserves = levels.map(toOpenAIReasoningReserve);
  for (let i = 1; i < reserves.length; i++) {
    assert.ok(reserves[i]! >= reserves[i - 1]!, `expected ${levels[i]} (${reserves[i]}) >= ${levels[i - 1]} (${reserves[i - 1]})`);
  }
});

test('mirrors the Gemini thinking-budget ladder for low/medium/high/xhigh, where Gemini gives a concrete number', () => {
  for (const effort of ['low', 'medium', 'high', 'xhigh'] as const) {
    assert.equal(toOpenAIReasoningReserve(effort), toGeminiThinkingBudget(effort));
  }
});

test('"max" is a large finite reserve, unlike Gemini\'s unbounded -1 — OpenAI needs a concrete ceiling', () => {
  assert.equal(toGeminiThinkingBudget('max'), -1);
  assert.ok(toOpenAIReasoningReserve('max') > 0);
  assert.ok(Number.isFinite(toOpenAIReasoningReserve('max')));
});

test('maxCompletionTokensFor adds the reserve on top of the caller\'s requested visible-output tokens, never replaces it', () => {
  const result = maxCompletionTokensFor({ maxTokens: 16_000, effort: 'high' });
  assert.equal(result, 16_000 + 12_288);
});

test('THE REGRESSION: a 16,000-token grounding-style request at high effort now has real headroom instead of being fully consumable by reasoning alone', () => {
  const ceiling = maxCompletionTokensFor({ maxTokens: 16_000, effort: 'high' });
  // Before the fix, max_completion_tokens was exactly 16,000 — a reasoning
  // burst could (and did, live) consume the entire ceiling before any
  // visible JSON was written. The ceiling must now exceed the caller's
  // requested output by a real margin.
  assert.ok(ceiling > 16_000);
  assert.equal(ceiling - 16_000, toOpenAIReasoningReserve('high'));
});
