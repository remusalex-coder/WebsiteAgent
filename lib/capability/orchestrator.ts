/**
 * The orchestrator — the object Hermes holds.
 *
 * Everything else in this directory is a pure function over data. This is the
 * one stateful piece: it knows which credentials this process actually has,
 * holds the daily quota ledger and the rate governor, accumulates cost lines
 * across a run, and hands out plans that reflect all of it.
 *
 * ## What Hermes can now ask
 *
 * The brief for this layer listed what the control plane must be able to
 * decide: which provider, which model, which tool, which skill, which agent,
 * which combination, in what order, with what fallback. All of those are one
 * call:
 *
 *     const plan = orchestrator.plan('craft_judging', { excludeProviders: ['gemini'] });
 *
 * and the answer is a chain of concrete steps with a resolved model on each,
 * a cost in euro cents, and an exclusion ledger for everything that did not
 * make it. Executing it is a second call, and the run's spend is accumulated
 * as a side effect of doing so.
 *
 * ## The board
 *
 * `board()` plans **every** capability at once and returns the result. It costs
 * nothing — no provider is constructed, no network is touched — and it is the
 * honest answer to "what can this deployment actually do right now". A run that
 * writes its board alongside its artifacts can be audited months later without
 * re-deriving which vendor was configured that afternoon.
 */

import { createRateGovernor } from '../ai/governor.js';
import { AI_PROVIDER_NAMES } from '../ai/types.js';
import { summarizeCost } from '../cost/ledgerEntry.js';
import { ALL_BINDINGS } from './bindings.js';
import { executeCapability } from './execute.js';
import { CATALOGUED_PROVIDERS, resolveModel } from './models.js';
import { DEFAULT_POLICY, planCapability } from './plan.js';
import { openQuotaLedger, unmeteredQuotaLedger } from './quota.js';
import { CAPABILITY_DESCRIPTORS } from './registry.js';
import { CAPABILITY_IDS } from './types.js';

import type { AiConfig, AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { RateGovernor } from '../ai/governor.js';
import type { CostBreakdown, CostLine } from '../cost/ledgerEntry.js';
import type { Telemetry } from '../platform/telemetry.js';
import type { CapabilityMetrics } from '../platform/types.js';
import type { CapabilityInvoker, ExecuteResult } from './execute.js';
import type { PriceOverrides, TokenEstimate } from './models.js';
import type { CapabilityPlan, CapabilityPolicy } from './plan.js';
import type { QuotaLedger } from './quota.js';
import type { AIProviderName } from '../ai/types.js';
import type { CapabilityId } from './types.js';

const SOURCE = 'capability.orchestrator';

/* ------------------------------------------------------------------ */
/* Rate limits                                                         */
/* ------------------------------------------------------------------ */

/**
 * Bucket settings per vendor, derived from the catalogue's free allowances.
 *
 * A vendor with a free allowance is governed at *that* rate whether or not the
 * run is paying, because the run may be on the allowance and the bucket cannot
 * know which. Being conservative here costs latency; being wrong costs a 429
 * in the middle of a batch.
 */
function registerBuckets(governor: RateGovernor, env: NodeJS.ProcessEnv): void {
  for (const provider of AI_PROVIDER_NAMES) {
    const workhorse = resolveModel(provider, 'workhorse', env);
    const rpm = workhorse?.freeAllowance?.requestsPerMinute ?? 60;
    governor.register(provider, {
      capacity: Math.max(1, rpm),
      refillPerMs: rpm / 60_000,
      // Two requests in the same instant are rejected by more than one vendor
      // regardless of the published RPM, so a hard floor sits under the bucket.
      minIntervalMs: rpm <= 5 ? 1_000 : 100,
    });
  }
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

export interface BoardRow {
  readonly capability: CapabilityId;
  readonly tier: string;
  readonly summary: string;
  /** Whether anything can serve it on this run. */
  readonly available: boolean;
  /** The service that would be tried first. */
  readonly primary: string | null;
  /** The vendor and model behind the primary, when it is a model. */
  readonly primaryModel: string | null;
  readonly estimatedCents: number;
  /** How many services are in the chain, including the terminal. */
  readonly chainLength: number;
  /** Whether the chain ends somewhere this repository owns. */
  readonly hasTerminal: boolean;
  /** Why candidates were dropped, summarised. */
  readonly exclusions: readonly string[];
}

export interface CapabilityBoard {
  readonly rows: readonly BoardRow[];
  readonly available: number;
  readonly total: number;
  /** What one pass over every available capability would cost, in euro cents. */
  readonly estimatedCents: number;
  readonly credentialsPresent: readonly string[];
  readonly quota: ReturnType<QuotaLedger['snapshot']>;
}

/* ------------------------------------------------------------------ */
/* The orchestrator                                                    */
/* ------------------------------------------------------------------ */

export interface CapabilityOrchestrator {
  /** Plans one capability against this run's credentials, quota and budget. */
  plan(capability: CapabilityId, options?: PlanOverrides): CapabilityPlan;
  /** Plans and runs one capability, accumulating its cost into the run. */
  run<T>(
    capability: CapabilityId,
    invoke: CapabilityInvoker<T>,
    options?: PlanOverrides,
  ): Promise<ExecuteResult<T>>;
  /** Every capability, planned. Free — nothing is contacted. */
  board(): CapabilityBoard;
  /** What this run has spent so far, from the executor's cost lines. */
  spend(): CostBreakdown;
  /** Euro cents still available under the run's budget. */
  remainingCents(): number;
  readonly quota: QuotaLedger;
  readonly governor: RateGovernor;
  readonly policy: CapabilityPolicy;
}

/** Per-call adjustments to the run's standing policy. */
export interface PlanOverrides {
  readonly policy?: Partial<CapabilityPolicy>;
  readonly tokens?: TokenEstimate;
  readonly excludeProviders?: readonly AIProviderName[];
  readonly priceOverrides?: PriceOverrides;
  /** Service ids known to have nothing bound behind them. */
  readonly unimplemented?: ReadonlySet<string>;
}

export interface OrchestratorOptions {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly telemetry?: Telemetry;
  /** Overrides the standing policy. Defaults to zero-budget, autonomous. */
  readonly policy?: Partial<CapabilityPolicy>;
  /** Injected by tests; production opens the on-disk ledger. */
  readonly quota?: QuotaLedger;
  readonly governor?: RateGovernor;
  readonly jobId?: string;
  readonly signal?: AbortSignal;
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Builds the orchestrator.
 *
 * Asynchronous only because the quota ledger reads a file. Nothing else here
 * touches the disk or the network, and no provider is constructed — a run with
 * no connectivity still gets a board, which is exactly when an operator most
 * wants one.
 */
export async function createCapabilityOrchestrator(
  options: OrchestratorOptions,
): Promise<CapabilityOrchestrator> {
  const { config, logger } = options;
  const env = options.env ?? process.env;
  const scoped = logger.child('capability');
  const jobId = options.jobId ?? 'unattributed';

  const policy: CapabilityPolicy = { ...DEFAULT_POLICY, ...options.policy };
  const quota = options.quota ?? (await openQuotaLedger({ dir: config.outputDir }));
  const governor = options.governor ?? createRateGovernor();
  registerBuckets(governor, env);

  const credentials = credentialSet(config, env);
  const spent: CostLine[] = [];

  /** Telemetry keyed by service id, which is what the planner ranks on. */
  const observedMetrics = (): Readonly<Record<string, CapabilityMetrics>> => {
    const telemetry = options.telemetry;
    if (telemetry === undefined) return {};
    const out: Record<string, CapabilityMetrics> = {};
    for (const binding of ALL_BINDINGS) {
      const metrics = telemetry.metricsFor(
        binding.kind === 'model'
          ? { kind: 'provider', id: binding.provider ?? binding.id }
          : { kind: binding.kind === 'mcp' ? 'mcp' : 'skill', id: `${binding.kind}:${binding.id}` },
      );
      if (metrics.calls > 0) out[binding.id] = metrics;
    }
    return out;
  };

  const remainingCents = (): number =>
    Math.max(0, policy.budgetCentsRemaining - summarizeCost(spent).totalCents);

  const plan = (capability: CapabilityId, overrides: PlanOverrides = {}): CapabilityPlan =>
    planCapability({
      capability,
      credentials,
      quota,
      telemetry: observedMetrics(),
      env,
      policy: {
        ...policy,
        // The standing budget shrinks as the run spends: a plan made late in a
        // run must see the money that is actually left, not the money it began
        // with. This is the seam that makes the budget a ceiling rather than a
        // suggestion.
        budgetCentsRemaining: remainingCents(),
        ...overrides.policy,
      },
      ...(overrides.tokens === undefined ? {} : { tokens: overrides.tokens }),
      ...(overrides.excludeProviders === undefined
        ? {}
        : { excludeProviders: overrides.excludeProviders }),
      ...(overrides.priceOverrides === undefined
        ? {}
        : { priceOverrides: overrides.priceOverrides }),
      ...(overrides.unimplemented === undefined ? {} : { unimplemented: overrides.unimplemented }),
    });

  return {
    quota,
    governor,
    policy,
    plan,

    async run<T>(
      capability: CapabilityId,
      invoke: CapabilityInvoker<T>,
      overrides: PlanOverrides = {},
    ): Promise<ExecuteResult<T>> {
      const resolved = plan(capability, overrides);
      const result = await executeCapability<T>({
        plan: resolved,
        invoke,
        logger: scoped,
        jobId,
        governor,
        quota,
        ...(options.telemetry === undefined ? {} : { telemetry: options.telemetry }),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      spent.push(...result.record.costLines);
      return result;
    },

    board(): CapabilityBoard {
      const rows = CAPABILITY_IDS.map((capability): BoardRow => {
        const resolved = plan(capability);
        const first = resolved.chain[0];
        const descriptor = resolved.descriptor;
        return {
          capability,
          tier: descriptor.tier,
          summary: descriptor.summary,
          available: resolved.plannable,
          primary: first?.binding.id ?? null,
          primaryModel:
            first?.model === undefined || first.model === null
              ? null
              : `${first.model.provider}:${first.model.id}`,
          estimatedCents: resolved.estimatedCents,
          chainLength: resolved.chain.length,
          hasTerminal: resolved.hasTerminal,
          exclusions: resolved.excluded.map((entry) => `${entry.service}: ${entry.reason}`),
        };
      });

      return {
        rows,
        available: rows.filter((row) => row.available).length,
        total: rows.length,
        estimatedCents: rows.reduce((sum, row) => sum + row.estimatedCents, 0),
        credentialsPresent: [...credentials].sort(),
        quota: quota.snapshot(),
      };
    },

    spend: () => summarizeCost(spent),
    remainingCents,
  };
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

/**
 * The credential variable names this process actually has values for.
 *
 * Names only, never values — the same discipline `platform.describe()` follows,
 * for the same reason: a plan is persisted alongside a run's artifacts, and a
 * plan that carried secrets would make every artifact directory sensitive.
 *
 * Provider keys come from the validated `AiConfig` rather than the environment,
 * so `lib/config.ts` stays the only reader of `process.env` for them (F-14).
 * Everything else — a deploy token, a search key — is a name the bindings ask
 * for that config does not model, so it is looked up by name and only its
 * presence recorded.
 */
function credentialSet(config: AppConfig, env: NodeJS.ProcessEnv): ReadonlySet<string> {
  const present = new Set<string>();

  const providerKeys: Readonly<Record<AIProviderName, string>> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    xai: 'XAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
  };
  for (const provider of CATALOGUED_PROVIDERS) {
    if (config.ai.apiKeys[provider] !== '') present.add(providerKeys[provider]);
  }

  for (const [name, value] of Object.entries(config.credentials)) {
    if (value !== '') present.add(name);
  }

  // Bindings may name a credential `lib/config.ts` does not model. Presence
  // only; the value is never read here and never leaves the environment.
  for (const binding of ALL_BINDINGS) {
    for (const name of binding.requiredCredentials) {
      const value = env[name];
      if (value !== undefined && value.trim() !== '') present.add(name);
    }
  }

  return present;
}

/** Capability count by tier, for a one-line summary. */
export function tierCounts(): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const descriptor of CAPABILITY_DESCRIPTORS) {
    counts[descriptor.tier] = (counts[descriptor.tier] ?? 0) + 1;
  }
  return counts;
}

/** Kept so a caller can widen the pool without importing the AI layer directly. */
export type { AiConfig };

export const SOURCE_NAME = SOURCE;
