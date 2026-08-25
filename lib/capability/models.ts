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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
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
    priceConfidence: 'observed',
  },
  {
    // Verified live, 2026-08-19: `deepseek/deepseek-chat:free` 404s with
    // "unavailable for free" regardless of account privacy settings — that
    // specific endpoint requires "publish prompts" consent, which this
    // deployment deliberately leaves off. `google/gemma-4-26b-a4b-it:free`
    // requires only "train on request data" (already enabled) and was
    // confirmed reachable twice via a real call.
    //
    // Per Registry v1 red-team finding M3: OpenRouter's free-tier roster is
    // a pool, not a stable provider — model ids are added and retired on a
    // promotional cadence, and each one carries its own upstream data-policy
    // requirement independent of the others. This id *will* go stale again;
    // `BF_MODEL_OPENROUTER_ENUM` overrides it without a code change when it
    // does, and `npx tsx --env-file=.env scripts/probe-providers.ts
    // --only=openrouter` is the fast way to find which current free id
    // matches this account's privacy settings.
    id: 'google/gemma-4-26b-a4b-it:free',
    provider: 'openrouter',
    modelClass: 'enum',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 128_000,
    centsPerMillionInput: 0,
    centsPerMillionOutput: 0,
    // OpenRouter does not publish a per-model free-tier request cap the way
    // Gemini does; 20/day mirrors this repository's other free allowances
    // as a conservative default until this one is observed empirically.
    freeAllowance: { requestsPerDay: 20, requestsPerMinute: 20 },
    licence: 'free-tier-unverified',
    jurisdiction: 'other',
    priceConfidence: 'observed',
  },

  /* --------------------------- xAI (Grok) --------------------------- */
  // Pricing from bf_research/05_provider_matrix.md (OBSERVED, 2026-08-19):
  // grok-4.6 $2/$6 per million tokens in/out; no free tier of any kind.
  // text-only here (TEXT, not TEXT_VISION) — the adapter's vision path is
  // explicitly unimplemented (lib/capability/visionInvoker.ts) rather than
  // guessed at, so this catalog does not advertise a capability the
  // deployment cannot actually serve.
  {
    id: 'grok-4.6',
    provider: 'xai',
    modelClass: 'workhorse',
    modalities: TEXT,
    structuredOutput: 'native',
    contextTokens: 256_000,
    centsPerMillionInput: 200,
    centsPerMillionOutput: 600,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
    priceConfidence: 'observed',
  },

  /* --------------------------- DeepSeek --------------------------- */
  // Pricing fetched live from api-docs.deepseek.com/quick_start/pricing (OBSERVED, 2026-08-19):
  // off-peak, cache-miss rates. deepseek-v4-flash $0.22/$0.66 per million in/out (~22/66
  // euro-cents at rough parity); no free tier. `structuredOutput: 'instructed'` — the docs
  // list a JSON-output feature but do not document OpenAI's json_schema+strict contract, so
  // the adapter validates locally rather than claim a guarantee it cannot back up.
  {
    id: 'deepseek-v4-flash',
    provider: 'deepseek',
    modelClass: 'workhorse',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 128_000,
    centsPerMillionInput: 22,
    centsPerMillionOutput: 66,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'other',
    priceConfidence: 'observed',
  },
  // deepseek-v4-pro: the frontier tier, same source. $0.66/$1.98 per million in/out (off-peak).
  {
    id: 'deepseek-v4-pro',
    provider: 'deepseek',
    modelClass: 'frontier',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 128_000,
    centsPerMillionInput: 66,
    centsPerMillionOutput: 198,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'other',
    priceConfidence: 'observed',
  },

  /* --------------------------- Cerebras --------------------------- */
  // Catalog fetched live from inference-docs.cerebras.ai/models/overview (OBSERVED,
  // 2026-08-19): gpt-oss-120b, 65k/131k context (free/paid tier). Pricing UNKNOWN — neither
  // cerebras.ai/pricing nor the inference docs publish a per-model rate on a static page, and
  // bf_research's own catalog flags Cerebras as "not deep-dived" for the same reason. The cost
  // figures below are a rough, explicitly-unverified placeholder for ranking only — re-check
  // before ever raising `allowPaid` for this vendor, hence `priceConfidence: 'estimated'`, the
  // one entry in this catalogue that isn't. `freeAllowance: null` because the
  // observed "$5 free trial credit" is a wallet balance, not a `{requestsPerDay,
  // requestsPerMinute}` allowance — it doesn't fit this field's shape and isn't claimed as one.
  {
    id: 'gpt-oss-120b',
    provider: 'cerebras',
    modelClass: 'workhorse',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 131_000,
    centsPerMillionInput: 25,
    centsPerMillionOutput: 69,
    freeAllowance: null,
    licence: 'commercial-api',
    jurisdiction: 'us',
    priceConfidence: 'estimated',
  },

  /* ----------------------------- Groq ------------------------------ */
  // Free tier OBSERVED live from console.groq.com/docs/rate-limits
  // (2026-08-24): GPT-OSS models get 30 requests/minute, 1,000 requests/day,
  // 8,000 tokens/minute, 200,000 tokens/day on the no-cost Developer plan —
  // the second genuinely-free worker this catalogue carries besides Gemini,
  // addressing the Provider Pool review's "Gemini is the only vendor
  // confirmed live" single-point-of-failure flag. `structuredOutput:
  // 'native'` because console.groq.com/docs/structured-outputs (fetched
  // live, 2026-08-24) confirms strict json_schema support specifically for
  // this model id. Pricing is NOT from a primary source — groq.com/pricing
  // is a client-rendered page that returned no rate table on a live fetch,
  // the same shape of gap this catalogue already documents for Cerebras —
  // so these are a third-party-aggregated (aipricing.guru, 2026-08-24)
  // routing estimate only, hence `priceConfidence: 'estimated'`, not
  // 'observed'. Re-verify against Groq's own docs before this figure is
  // ever load-bearing for a real spend decision.
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    modelClass: 'workhorse',
    modalities: TEXT,
    structuredOutput: 'native',
    contextTokens: 131_000,
    centsPerMillionInput: 15,
    centsPerMillionOutput: 60,
    freeAllowance: { requestsPerDay: 1_000, requestsPerMinute: 30 },
    licence: 'free-tier-unverified',
    jurisdiction: 'us',
    priceConfidence: 'estimated',
  },

  /* ----------------------------- Ollama ----------------------------- */
  // Live-verified against the actual host this deployment's runtime executes
  // on (2026-08-25): `curl http://localhost:11434/api/tags` confirmed
  // `gemma4:26b` installed (25.8B params, Q4_K_M quant), and a real
  // `POST /api/chat` with `format: "json"` round-tripped successfully — see
  // `lib/ai/providers/ollama.ts`'s file header for the full response. Local
  // and self-hosted, so `licence: 'permissive-local'` / `jurisdiction:
  // 'local'` (never leaves the machine) rather than any vendor-terms class,
  // and cost is genuinely $0 — `priceConfidence: 'observed'`, not estimated,
  // because "a local process costs nothing to call" needs no rate card to
  // verify. `freeAllowance: null`: there is no rate *limit* to record, which
  // is a different fact from a paid vendor's allowance and doesn't fit that
  // field's shape. The measured latency (~40s for a trivial call) is not a
  // field this record carries — it lives in the router's own telemetry
  // (`lib/ai/router.ts`), which is what actually keeps this entry ranked
  // last once a run has called it at least once.
  //
  // `contextTokens` is from a live `POST /api/show` (2026-08-25):
  // `gemma4.context_length: 262144`. That same probe also surfaced
  // `gemma4.vision.*` fields, meaning the underlying architecture is
  // multimodal — noted here rather than acted on, since no image-bearing
  // `/api/chat` request has actually been exercised against it; `modalities`
  // stays `TEXT` and `visionInvoker.ts` still declines ollama vision until a
  // real call verifies the request shape.
  {
    id: 'gemma4:26b',
    provider: 'ollama',
    modelClass: 'workhorse',
    modalities: TEXT,
    structuredOutput: 'instructed',
    contextTokens: 262_144,
    centsPerMillionInput: 0,
    centsPerMillionOutput: 0,
    freeAllowance: null,
    licence: 'permissive-local',
    jurisdiction: 'local',
    priceConfidence: 'observed',
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
