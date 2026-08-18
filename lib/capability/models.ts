/**
 * The model catalogue.
 *
 * `lib/factory/pool.ts` already holds a four-line `DEFAULT_MODELS` map from
 * vendor to id. That is enough to make a call and not nearly enough to route
 * one: it says nothing about whether a model can see an image, how much a
 * thousand of them would cost, or how many requests today's free allowance has
 * left. Those are the three facts a cost-aware planner needs.
 *
 * ## Classes, resolved to ids at plan time
 *
 * Callers ask for a **class** — frontier, workhorse, enum, vision, embedding —
 * and the planner resolves it to whichever id this deployment configured for
 * that vendor. Ids churn monthly (`gemini-2.5-flash` was retired while a valid
 * key was being reported as an unreachable provider); classes do not.
 *
 * ## On the numbers
 *
 * Every price here is a **routing estimate in euro cents per million tokens**,
 * carried so the planner can order candidates by plausible cost. They are not
 * quotes, nothing bills from them, and they will drift. The cost *ledger*
 * records what actually happened from provider provenance; this table only
 * decides who to ask first. `BF_MODEL_<PROVIDER>` overrides an id, and
 * `priceOverrides` on the planner overrides a price, so a deployment with
 * better numbers never has to edit this file.
 *
 * The free allowances are the more important column and the more volatile one.
 * The Gemini free tier's per-day request cap is the binding constraint on this
 * deployment — not money — which is why `quota.ts` exists and why the planner
 * treats an exhausted allowance as a hard filter rather than a penalty.
 */

import { AI_PROVIDER_NAMES } from '../ai/types.js';

import type { AIProviderName } from '../ai/types.js';
import type { ModelClassName, ModelRecord, Modality } from './types.js';

const SOURCE = 'capability.models';

const TEXT: readonly Modality[] = ['text-in', 'text-out'];
const TEXT_VISION: readonly Modality[] = ['text-in', 'text-out', 'vision-in'];

/**
 * The catalogue.
 *
 * One entry per (provider, class) this build knows how to ask for. A provider
 * missing a class simply cannot serve capabilities that need it — the planner
 * reports `no-model-for-class` rather than substituting something inappropriate.
 */
export const MODEL_CATALOG: readonly ModelRecord[] = [
  /* ------------------------- Gemini ------------------------- */
  {
    id: 'gemini-3.6-pro',
    provider: 'gemini',
    modelClass: 'frontier',
    modalities: TEXT_VISION,
    structuredOutput: 'native',
    contextTokens: 1_000_000,
    centsPerMillionInput: 110,
    centsPerMillionOutput: 900,
    freeAllowance: { requestsPerDay: 20, requestsPerMinute: 2 },
    licence: 'free-tier-unverified',
    jurisdiction: 'us',
  },
  {
    id: 'gemini-3.6-flash',
    provider: 'gemini',
    modelClass: 'workhorse',
    modalities: TEXT_VISION,
    structuredOutput: 'native',
    contextTokens: 1_000_000,
    centsPerMillionInput: 28,
    centsPerMillionOutput: 230,
    freeAllowance: { requestsPerDay: 20, requestsPerMinute: 5 },
    licence: 'free-tier-unverified',
    jurisdiction: 'us',
  },
  {
    id: 'gemini-3.6-flash-lite',
    provider: 'gemini',
    modelClass: 'enum',
    modalities: TEXT,
    structuredOutput: 'native',
    contextTokens: 1_000_000,
    centsPerMillionInput: 9,
    centsPerMillionOutput: 36,
    freeAllowance: { requestsPerDay: 20, requestsPerMinute: 15 },
    licence: 'free-tier-unverified',
    jurisdiction: 'us',
  },
  {
    id: 'gemini-3.6-flash',
    provider: 'gemini',
    modelClass: 'vision',
    modalities: TEXT_VISION,
    structuredOutput: 'native',
    contextTokens: 1_000_000,
    centsPerMillionInput: 28,
    centsPerMillionOutput: 230,
    freeAllowance: { requestsPerDay: 20, requestsPerMinute: 5 },
    licence: 'free-tier-unverified',
    jurisdiction: 'us',
  },

  /* ------------------------- OpenAI ------------------------- */
  {
    id: 'gpt-5.2',
    provider: 'openai',
    modelClass: 'frontier',
    modalities: TEXT_VISION,
    structuredOutput: 'native',
    contextTokens: 400_000,
    centsPerMillionInput: 115,
    centsPerMillionOutput: 920,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },
  {
    id: 'gpt-5.2',
    provider: 'openai',
    modelClass: 'workhorse',
    modalities: TEXT_VISION,
    structuredOutput: 'native',
    contextTokens: 400_000,
    centsPerMillionInput: 115,
    centsPerMillionOutput: 920,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },
  {
    id: 'gpt-5.2-mini',
    provider: 'openai',
    modelClass: 'enum',
    modalities: TEXT,
    structuredOutput: 'native',
    contextTokens: 400_000,
    centsPerMillionInput: 19,
    centsPerMillionOutput: 110,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },
  {
    id: 'gpt-5.2',
    provider: 'openai',
    modelClass: 'vision',
    modalities: TEXT_VISION,
    structuredOutput: 'native',
    contextTokens: 400_000,
    centsPerMillionInput: 115,
    centsPerMillionOutput: 920,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },
  {
    id: 'text-embedding-3-small',
    provider: 'openai',
    modelClass: 'embedding',
    modalities: ['text-in', 'embedding-out'],
    structuredOutput: 'instructed',
    contextTokens: 8_192,
    centsPerMillionInput: 2,
    centsPerMillionOutput: 0,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },

  /* ------------------------ Anthropic ----------------------- */
  {
    id: 'claude-opus-5',
    provider: 'anthropic',
    modelClass: 'frontier',
    modalities: TEXT_VISION,
    structuredOutput: 'instructed',
    contextTokens: 200_000,
    centsPerMillionInput: 1_380,
    centsPerMillionOutput: 6_900,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    modelClass: 'workhorse',
    modalities: TEXT_VISION,
    structuredOutput: 'instructed',
    contextTokens: 200_000,
    centsPerMillionInput: 276,
    centsPerMillionOutput: 1_380,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    modelClass: 'vision',
    modalities: TEXT_VISION,
    structuredOutput: 'instructed',
    contextTokens: 200_000,
    centsPerMillionInput: 276,
    centsPerMillionOutput: 1_380,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
  },

  /* ------------------------ OpenRouter ---------------------- */
  {
    id: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    modelClass: 'workhorse',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 128_000,
    centsPerMillionInput: 25,
    centsPerMillionOutput: 100,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'other',
  },
  {
    id: 'deepseek/deepseek-chat:free',
    provider: 'openrouter',
    modelClass: 'enum',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 128_000,
    centsPerMillionInput: 0,
    centsPerMillionOutput: 0,
    // The published free-model allowance: 50 requests a day, raised to 1,000
    // after a one-time top-up. The lower figure is carried because it is the
    // one that holds without spending anything.
    freeAllowance: { requestsPerDay: 50, requestsPerMinute: 20 },
    licence: 'free-tier-unverified',
    jurisdiction: 'other',
  },
];

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/** A model's stable key for quota accounting and telemetry: `provider:id`. */
export function modelKey(record: Pick<ModelRecord, 'provider' | 'id'>): string {
  return `${record.provider}:${record.id}`;
}

/**
 * The model this deployment uses for a (provider, class) pair, or `null` when
 * the vendor has no entry for that class.
 *
 * `BF_MODEL_<PROVIDER>` overrides the id for *every* class on that vendor,
 * matching `lib/factory/pool.ts`; `BF_MODEL_<PROVIDER>_<CLASS>` overrides one
 * class, which is what a deployment actually wants when it is pinning a cheap
 * model for enum work and leaving the rest alone.
 */
export function resolveModel(
  provider: AIProviderName,
  modelClass: ModelClassName,
  env: NodeJS.ProcessEnv = process.env,
): ModelRecord | null {
  const base = MODEL_CATALOG.find(
    (entry) => entry.provider === provider && entry.modelClass === modelClass,
  );
  if (base === undefined) return null;

  const scoped = env[`BF_MODEL_${provider.toUpperCase()}_${modelClass.toUpperCase()}`]?.trim();
  const broad = env[`BF_MODEL_${provider.toUpperCase()}`]?.trim();
  const override = scoped !== undefined && scoped !== '' ? scoped : broad;
  if (override === undefined || override === '') return base;

  // An overridden id keeps the class's cost and allowance profile: the operator
  // said "use this id for this job", not "these numbers no longer apply". A
  // deployment that wants different numbers passes priceOverrides.
  return { ...base, id: override };
}

/** Every model this build knows, for the board. */
export function catalogFor(provider: AIProviderName): readonly ModelRecord[] {
  return MODEL_CATALOG.filter((entry) => entry.provider === provider);
}

/** Whether a model can take an image as input. */
export function supportsVision(record: ModelRecord): boolean {
  return record.modalities.includes('vision-in');
}

/* ------------------------------------------------------------------ */
/* Cost estimation                                                     */
/* ------------------------------------------------------------------ */

/**
 * A caller's expected token shape for one call.
 *
 * Defaults are the repository's own configured budgets, rounded: the analyst
 * reads about 15k tokens and writes about 6k. A stage that knows better says so.
 */
export interface TokenEstimate {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export const DEFAULT_TOKEN_ESTIMATE: TokenEstimate = { inputTokens: 15_000, outputTokens: 6_000 };

/** Per-model price overrides, in euro cents per million tokens. */
export type PriceOverrides = Readonly<
  Record<string, { readonly input: number; readonly output: number }>
>;

/**
 * What one call would plausibly cost, in euro cents.
 *
 * Returns `0` for a model whose free allowance is being used — which is the
 * whole point of routing on this number rather than on a list price. The caller
 * decides whether the allowance applies by passing `onFreeAllowance`; the quota
 * ledger is what actually knows.
 */
export function estimateCents(
  record: ModelRecord,
  tokens: TokenEstimate = DEFAULT_TOKEN_ESTIMATE,
  options: { readonly onFreeAllowance?: boolean; readonly priceOverrides?: PriceOverrides } = {},
): number {
  if (options.onFreeAllowance === true) return 0;

  const override = options.priceOverrides?.[modelKey(record)];
  const input = override?.input ?? record.centsPerMillionInput;
  const output = override?.output ?? record.centsPerMillionOutput;

  const cents =
    (tokens.inputTokens / 1_000_000) * input + (tokens.outputTokens / 1_000_000) * output;
  // Rounded up to a hundredth of a cent so a sub-cent call never sorts as free
  // and never disappears from the ledger.
  return Math.ceil(cents * 100) / 100;
}

/** Providers with at least one model in the catalogue, in declaration order. */
export const CATALOGUED_PROVIDERS: readonly AIProviderName[] = AI_PROVIDER_NAMES.filter((name) =>
  MODEL_CATALOG.some((entry) => entry.provider === name),
);

export const SOURCE_NAME = SOURCE;
