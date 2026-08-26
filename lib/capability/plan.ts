/**
 * The planner: capability in, ordered chain out.
 *
 * `lib/ai/router.ts` does this for providers — filter, rank, select, failover —
 * and this module keeps that pipeline exactly, widening it in the two
 * directions the provider router could not reach:
 *
 *   - **across kinds.** A chain can mix a model, a local tool and the
 *     deterministic floor, because the question "who should do this" does not
 *     respect the boundary between a vendor and a function in this repository.
 *   - **on cost.** The provider router ranks on availability and latency. That
 *     is the right ordering when every candidate is free and the wrong one the
 *     moment a paid vendor is in the set, because the fastest reliable model is
 *     reliably the most expensive.
 *
 * ## Filters are hard, ranking is soft
 *
 * A filtered candidate is *gone* — not last. This matters for the two
 * exclusions that are safety properties rather than preferences: F-08 removes
 * every model when a capability may not have model-authored output, and an
 * exhausted daily allowance removes a model that would only return 429. Neither
 * can be outranked by a good latency number.
 *
 * ## The ranking, in order
 *
 *   1. **free before paid** — a call on an allowance costs nothing and the
 *      allowance expires unused at midnight. Spending money while a free
 *      request is sitting on the table is never right.
 *   2. **cheaper before dearer** — estimated euro cents for this call.
 *   3. **more available before less** — observed, from telemetry.
 *   4. **faster before slower** — observed.
 *   5. **declared order** — the repository's stated preference, last.
 *
 * Steps 3 and 4 use the same doctrine as the provider router: a service that
 * has never been called scores as untested, because an untested fallback is not
 * a fallback. Unlike the provider router, *untested* sorts after *tested and
 * good* but before *tested and failing* — a chain whose second member has never
 * run is the normal state of a healthy system, and burying it below a vendor
 * that fails every call would make failover worse.
 */

import { describeCapability } from './registry.js';
import { bindingsFor } from './bindings.js';
import { DEFAULT_TOKEN_ESTIMATE, estimateCents, modelKey, resolveModel } from './models.js';
import { unmeteredQuotaLedger } from './quota.js';

import type { AIProviderName } from '../ai/types.js';
import type { CapabilityMetrics } from '../platform/types.js';
import type { PriceOverrides, TokenEstimate } from './models.js';
import type { QuotaLedger } from './quota.js';
import type {
  CapabilityDescriptor,
  CapabilityId,
  Jurisdiction,
  LicenceClass,
  ModelRecord,
  ServiceBinding,
} from './types.js';

const SOURCE = 'capability.plan';

/* ------------------------------------------------------------------ */
/* Exclusions                                                          */
/* ------------------------------------------------------------------ */

/**
 * Why a candidate is not in the chain. A closed set, because the board renders
 * these and an operator has to be able to act on each one.
 */
export type ExclusionReason =
  /** The capability is declared and deliberately not built. */
  | 'capability-rejected'
  /** The capability needs a person, and this is an autonomous run. */
  | 'requires-human'
  /** F-08: no model may author this capability's output. */
  | 'model-may-not-write-output'
  /** No credential configured for this service. */
  | 'no-credential'
  /** The vendor has no model in this class. */
  | 'no-model-for-class'
  /** Today's free allowance for this model is spent. */
  | 'quota-exhausted'
  /** The estimated cost exceeds what the caller has left. */
  | 'over-budget'
  /** Paid services are disabled for this run. */
  | 'paid-disabled'
  /** The price is an unverified placeholder and the policy does not allow spending against it. */
  | 'unpriced-blocked'
  /** The licence class is not permitted by policy. */
  | 'licence-blocked'
  /** The jurisdiction is not permitted by policy. */
  | 'jurisdiction-blocked'
  /** The caller excluded this vendor — typically a cross-vendor constraint. */
  | 'vendor-excluded'
  /** Declared but with nothing bound behind it yet. */
  | 'not-implemented';

export interface Exclusion {
  readonly service: string;
  readonly kind: ServiceBinding['kind'];
  readonly provider: AIProviderName | null;
  readonly reason: ExclusionReason;
  /** One line a human can act on. */
  readonly detail: string;
}

/* ------------------------------------------------------------------ */
/* Steps and plans                                                     */
/* ------------------------------------------------------------------ */

/** One member of a chain: a service the executor may call, in order. */
export interface PlanStep {
  readonly binding: ServiceBinding;
  /** Zero-based position in the chain. */
  readonly order: number;
  /** The resolved model, for `kind === 'model'`. `null` otherwise. */
  readonly model: ModelRecord | null;
  /** What this step would plausibly cost, in euro cents. */
  readonly estimatedCents: number;
  /** True when the step runs inside a free allowance rather than on a card. */
  readonly free: boolean;
  /** Requests left on today's allowance, or `null` when unmetered. */
  readonly quotaRemaining: number | null;
}

export interface CapabilityPlan {
  readonly capability: CapabilityId;
  readonly descriptor: CapabilityDescriptor;
  /** Services to try, in order. May be empty — see `plannable`. */
  readonly chain: readonly PlanStep[];
  /** Every candidate that was dropped, and why. */
  readonly excluded: readonly Exclusion[];
  /** Whether the capability can be served at all on this run. */
  readonly plannable: boolean;
  /** Cost of the first step — what the run expects to pay if nothing fails. */
  readonly estimatedCents: number;
  /** Whether the chain ends somewhere this repository owns. */
  readonly hasTerminal: boolean;
}

/* ------------------------------------------------------------------ */
/* Policy                                                              */
/* ------------------------------------------------------------------ */

/**
 * The run's spending and data posture.
 *
 * Defaults are the platform's baseline: zero euro, no paid vendor, every
 * jurisdiction and licence class allowed. Widening any of them is an explicit
 * act that shows up in the plan.
 */
export interface CapabilityPolicy {
  /** Whether a service that costs money may be selected at all. */
  readonly allowPaid: boolean;
  /** Euro cents this run may still spend. Ignored when `allowPaid` is false. */
  readonly budgetCentsRemaining: number;
  /** Jurisdictions the run's evidence may reach. */
  readonly allowedJurisdictions: readonly Jurisdiction[];
  /** Licence classes whose output may reach a customer. */
  readonly allowedLicences: readonly LicenceClass[];
  /** True when no person is present to answer a gate. */
  readonly autonomous: boolean;
  /** Free-before-paid ordering. Off only for a deliberate quality-first run. */
  readonly preferFree: boolean;
  /**
   * Whether a candidate whose price is an unverified placeholder
   * (`priceConfidence: 'estimated'`) may be selected once it would cost
   * something. `false` everywhere by default, including at every budget
   * tier — a rough number can rank candidates, but it cannot spend real
   * money without someone explicitly saying so.
   */
  readonly allowUnverifiedPricing: boolean;
  /**
   * Providers whose `'estimated'` price may spend anyway — a named, scoped
   * exception to `allowUnverifiedPricing`. Empty by default: naming a vendor
   * here is the only way in, so authorizing one vendor's placeholder price
   * never widens the blanket flag or any other vendor's.
   */
  readonly allowUnverifiedPricingFor: readonly AIProviderName[];
}

export const DEFAULT_POLICY: CapabilityPolicy = {
  allowPaid: false,
  budgetCentsRemaining: 0,
  allowedJurisdictions: ['local', 'us', 'eu', 'other'],
  allowedLicences: [
    'permissive-local',
    'copyleft-local',
    'commercial-api',
    'free-tier-unverified',
  ],
  autonomous: true,
  preferFree: true,
  allowUnverifiedPricing: false,
  allowUnverifiedPricingFor: [],
};

export interface PlanOptions {
  readonly capability: CapabilityId;
  /** Credential variable names that are actually set. */
  readonly credentials: ReadonlySet<string>;
  readonly policy?: Partial<CapabilityPolicy>;
  /** The daily request ledger. Defaults to unmetered, which tests want and runs do not. */
  readonly quota?: QuotaLedger;
  /** Observed behaviour, keyed by service id. */
  readonly telemetry?: Readonly<Record<string, CapabilityMetrics>>;
  /** Expected token shape, for cost estimation. */
  readonly tokens?: TokenEstimate;
  readonly priceOverrides?: PriceOverrides;
  /** Vendors this call may not use — the cross-vendor constraint. */
  readonly excludeProviders?: readonly AIProviderName[];
  /** Service ids known to have nothing bound behind them yet. */
  readonly unimplemented?: ReadonlySet<string>;
  readonly env?: NodeJS.ProcessEnv;
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

/**
 * Plans one capability.
 *
 * Pure given its inputs, and it contacts nothing: the quota ledger is read, not
 * written, and no provider is constructed. The caller executes the chain.
 */
export function planCapability(options: PlanOptions): CapabilityPlan {
  const {
    capability,
    credentials,
    quota = unmeteredQuotaLedger(),
    telemetry = {},
    tokens = DEFAULT_TOKEN_ESTIMATE,
    excludeProviders = [],
    unimplemented = new Set<string>(),
    env = process.env,
  } = options;

  const policy: CapabilityPolicy = { ...DEFAULT_POLICY, ...options.policy };
  const descriptor = describeCapability(capability);
  const excluded: Exclusion[] = [];

  /* --- Capability-level gates, before any candidate is considered --- */

  if (descriptor.tier === 'rejected' || descriptor.gate === 'never') {
    return refused(descriptor, 'capability-rejected', descriptor.rationale);
  }
  if (descriptor.gate === 'human' && policy.autonomous) {
    return refused(
      descriptor,
      'requires-human',
      'gated on human approval; this run has no person to ask',
    );
  }

  /* --- Candidate filtering --- */

  const survivors: PlanStep[] = [];

  for (const binding of bindingsFor(capability)) {
    const drop = (reason: ExclusionReason, detail: string): void => {
      excluded.push({
        service: binding.id,
        kind: binding.kind,
        provider: binding.provider,
        reason,
        detail,
      });
    };

    if (binding.kind === 'model' && !descriptor.modelMayWriteOutput && !isJudgement(capability)) {
      drop('model-may-not-write-output', 'F-08: no model-authored byte reaches a customer artifact');
      continue;
    }
    if (unimplemented.has(binding.id)) {
      drop('not-implemented', `${binding.detail} — declared, nothing bound behind it yet`);
      continue;
    }
    if (binding.provider !== null && excludeProviders.includes(binding.provider)) {
      drop('vendor-excluded', `${binding.provider} is excluded for this call`);
      continue;
    }
    if (!policy.allowedLicences.includes(binding.licence)) {
      drop('licence-blocked', `licence class ${binding.licence} is not permitted`);
      continue;
    }
    if (!policy.allowedJurisdictions.includes(binding.jurisdiction)) {
      drop('jurisdiction-blocked', `jurisdiction ${binding.jurisdiction} is not permitted`);
      continue;
    }

    const missing = binding.requiredCredentials.filter((name) => !credentials.has(name));
    if (missing.length > 0) {
      drop('no-credential', `set ${missing.join(', ')}`);
      continue;
    }

    /* --- Models need a resolved id, an allowance check and a price --- */

    if (binding.kind === 'model') {
      if (binding.provider === null || binding.modelClass === null) {
        drop('no-model-for-class', 'binding declares a model with no vendor or class');
        continue;
      }
      const record = resolveModel(binding.provider, binding.modelClass, env);
      if (record === null) {
        drop('no-model-for-class', `${binding.provider} has no ${binding.modelClass} model`);
        continue;
      }

      const key = modelKey(record);
      const allowance = record.freeAllowance?.requestsPerDay ?? null;
      const roomOnAllowance = allowance !== null && quota.hasRoom(key, allowance);
      const remaining = quota.remaining(key, allowance);

      // An exhausted allowance is only fatal when there is no paid path behind
      // it: a metered model with budget available is still callable, just no
      // longer free.
      if (allowance !== null && !roomOnAllowance && !policy.allowPaid) {
        drop('quota-exhausted', `today's allowance of ${allowance} requests is spent`);
        continue;
      }

      const cents = estimateCents(record, tokens, {
        onFreeAllowance: roomOnAllowance,
        ...(options.priceOverrides === undefined ? {} : { priceOverrides: options.priceOverrides }),
      });

      if (cents > 0 && !policy.allowPaid) {
        drop('paid-disabled', `would cost about ${cents} cents; this run is zero-budget`);
        continue;
      }
      const unverifiedAllowed =
        policy.allowUnverifiedPricing || policy.allowUnverifiedPricingFor.includes(record.provider);
      if (cents > 0 && record.priceConfidence === 'estimated' && !unverifiedAllowed) {
        drop(
          'unpriced-blocked',
          `${record.id}'s price is an unverified placeholder; re-check before allowing spend`,
        );
        continue;
      }
      if (cents > policy.budgetCentsRemaining && cents > 0) {
        drop(
          'over-budget',
          `about ${cents} cents against ${policy.budgetCentsRemaining} remaining`,
        );
        continue;
      }

      survivors.push({
        binding,
        order: 0,
        model: record,
        estimatedCents: cents,
        free: cents === 0,
        quotaRemaining: remaining,
      });
      continue;
    }

    /* --- Everything local --- */

    const cents = binding.fixedCents;
    if (cents > 0 && !policy.allowPaid) {
      drop('paid-disabled', `would cost about ${cents} cents; this run is zero-budget`);
      continue;
    }
    const unverifiedAllowedLocal =
      policy.allowUnverifiedPricing ||
      (binding.provider !== null && policy.allowUnverifiedPricingFor.includes(binding.provider));
    if (cents > 0 && binding.priceConfidence === 'estimated' && !unverifiedAllowedLocal) {
      drop(
        'unpriced-blocked',
        `${binding.id}'s price is an unverified placeholder; re-check before allowing spend`,
      );
      continue;
    }
    if (cents > policy.budgetCentsRemaining && cents > 0) {
      drop('over-budget', `about ${cents} cents against ${policy.budgetCentsRemaining} remaining`);
      continue;
    }

    survivors.push({
      binding,
      order: 0,
      model: null,
      estimatedCents: cents,
      free: cents === 0,
      quotaRemaining: null,
    });
  }

  /* --- Ranking --- */

  const ranked = [...survivors].sort((a, b) => compareSteps(a, b, telemetry, policy));
  const chain = ranked.map((step, index) => ({ ...step, order: index }));
  const first = chain[0];

  return {
    capability,
    descriptor,
    chain,
    excluded,
    plannable: chain.length > 0,
    estimatedCents: first?.estimatedCents ?? 0,
    hasTerminal: chain.some((step) => step.binding.kind === 'deterministic'),
  };
}

/**
 * Whether a capability's model bindings survive F-08.
 *
 * `modelMayWriteOutput: false` means a model may not *author output*. It does
 * not mean a model may not be consulted: the whole point of the visual jury is
 * that a model reads a rendered page and returns a verdict, and a verdict is
 * not a byte the customer receives. Judgement, description and critique read;
 * they do not write. Composition writes.
 *
 * Keeping this as one small predicate rather than a second flag on every
 * descriptor means there is exactly one place to look when asking "why is a
 * model allowed here".
 */
function isJudgement(capability: CapabilityId): boolean {
  switch (capability) {
    case 'creative_direction':
    case 'enum_direction':
    case 'adversarial_critique':
    case 'craft_judging':
    case 'distinctness_judging':
    case 'visual_defect_detection':
    case 'vision_description':
    case 'evidence_extraction':
    case 'evidence_research':
    case 'market_research':
    case 'semantic_index':
      return true;
    default:
      return false;
  }
}

/** The lexicographic comparison described in this module's header. */
function compareSteps(
  a: PlanStep,
  b: PlanStep,
  telemetry: Readonly<Record<string, CapabilityMetrics>>,
  policy: CapabilityPolicy,
): number {
  // The deterministic floor is the chain's guaranteed terminal (`bindings.ts`'s
  // own docstring: "the last row of the chain"), not a candidate competing on
  // price — but its `estimatedCents` is always 0, so without this rule
  // `preferFree` below would rank it ahead of every paid vendor, and once the
  // floor actually runs something (`withDeterministicFloor`,
  // `lib/capability/invokers.ts`) that pre-empts real cross-vendor failover
  // the moment a free run exhausts its unpaid options, rather than only after
  // every vendor — paid ones included, where policy allows spending — has
  // been tried. It always sorts after every non-deterministic step; the
  // remaining criteria (including declared order, last) still decide between
  // two deterministic candidates, though no capability currently declares
  // more than one.
  const aFloor = a.binding.kind === 'deterministic';
  const bFloor = b.binding.kind === 'deterministic';
  if (aFloor !== bFloor) return aFloor ? 1 : -1;

  if (policy.preferFree && a.free !== b.free) return a.free ? -1 : 1;
  if (a.estimatedCents !== b.estimatedCents) return a.estimatedCents - b.estimatedCents;

  const byAvailability = availabilityRank(a, telemetry) - availabilityRank(b, telemetry);
  if (byAvailability !== 0) return byAvailability;

  const byLatency = latencyRank(a, telemetry) - latencyRank(b, telemetry);
  if (byLatency !== 0) return byLatency;

  return a.binding.order - b.binding.order;
}

/**
 * Lower is better. An untested service sits between "observed healthy" and
 * "observed failing" — see this module's header for why.
 */
function availabilityRank(
  step: PlanStep,
  telemetry: Readonly<Record<string, CapabilityMetrics>>,
): number {
  const metrics = telemetry[step.binding.id];
  if (metrics === undefined || metrics.calls === 0) return 0.5;
  return 1 - metrics.availability;
}

function latencyRank(
  step: PlanStep,
  telemetry: Readonly<Record<string, CapabilityMetrics>>,
): number {
  const metrics = telemetry[step.binding.id];
  const avg = metrics?.latencyMs?.avg;
  // Untested is not slow; it is unknown. Sorting it as zero would promote it
  // over a measured-fast service, so it takes a mid-range placeholder instead.
  return avg ?? 5_000;
}

/** A plan for a capability that was refused before any candidate was examined. */
function refused(
  descriptor: CapabilityDescriptor,
  reason: ExclusionReason,
  detail: string,
): CapabilityPlan {
  return {
    capability: descriptor.id,
    descriptor,
    chain: [],
    excluded: [{ service: descriptor.id, kind: 'deterministic', provider: null, reason, detail }],
    plannable: false,
    estimatedCents: 0,
    hasTerminal: false,
  };
}

export const SOURCE_NAME = SOURCE;
