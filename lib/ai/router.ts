/**
 * Capability Router (Freeze N-09, F-12, P3-2/P3-3).
 *
 * The router answers one question: for a capability this job needs, which
 * provider serves it — and when that provider fails, which one serves it next.
 * It is deliberately NOT the agent pool (F-12): the pool owns concurrency, the
 * router owns *substitution*. A licence-incompatible provider is unreachable,
 * not merely low-ranked.
 *
 * ## The pipeline
 *
 *   filter → rank → select → failover
 *
 * Filters are hard gates: a provider that fails one is removed from the set
 * entirely. Ranking then orders the survivors on **observed** telemetry (the
 * repository's own doctrine: "an adapter that has never made a live call is
 * untested"). Selection returns an ordered failover chain, so a caller can
 * move to the next provider when the first throws — and, when every provider
 * is exhausted, the chain ends at the deterministic floor.
 *
 * ## The failure contract
 *
 * The router does not catch provider errors. A caller gets the chain, calls the
 * first member, and on a *non-retryable* failure advances to the next. That
 * keeps the router a pure decision — the calling stage owns the loop, exactly
 * as the freeze's failover requirement demands.
 */

import { AI_PROVIDER_NAMES } from './types.js';

import type { AIProviderName } from './types.js';
import type { CapabilityMetrics } from '../platform/types.js';

const SOURCE = 'ai.router';

/** Capabilities the router knows how to route. Extended by the factory. */
export type RouterCapability =
  | 'generate'
  | 'vision'
  | 'deterministic-floor';

/** Why a provider is ineligible for a capability. Hard gates, never advisory. */
export type ExclusionReason =
  | 'licence-incompatible'
  | 'jurisdiction-blocked'
  | 'no-credential'
  | 'no-lease'
  | 'rate-limited'
  | 'no-capability';

export interface ProviderRoute {
  readonly provider: AIProviderName;
  readonly capability: RouterCapability;
  /** Whether a model may author bytes that reach a customer artifact (F-08). */
  readonly modelMayWriteOutput: boolean;
  /** Where this provider sits in the frozen failover order. */
  readonly order: number;
  /** Why it was excluded, when it was. Absent means it survived the filters. */
  readonly excluded: ExclusionReason | null;
}

/**
 * The deterministic floor — not a provider, the terminal member of every
 * failover chain. F-08 is why it reports `modelMayWriteOutput: false`: the
 * floor composes from verified evidence and never lets a model author bytes.
 */
export interface DeterministicFloorRoute {
  readonly provider: null;
  readonly capability: RouterCapability;
  readonly modelMayWriteOutput: false;
  readonly order: number;
  readonly excluded: null;
}

/** One member of a failover chain: a provider, or the floor. */
export type ChainMember = ProviderRoute | DeterministicFloorRoute;

/**
 * A provider's eligibility facts, resolved from configuration and the
 * environment. The router never reads the environment itself.
 */
export interface ProviderEligibility {
  readonly provider: AIProviderName;
  /** All capabilities this deployment's adapter supports. */
  readonly capabilities: readonly RouterCapability[];
  /** A credential is configured for this provider. */
  readonly credentialled: boolean;
  /** Whether the caller's jurisdiction allows this provider's data handling. */
  readonly jurisdictionAllowed: boolean;
  /** Whether the caller's licence terms permit this provider's output use. */
  readonly licenceAllowed: boolean;
  /** A budget lease is currently held. `true` when leases are not enforced. */
  readonly leased: boolean;
  /**
   * Whether the provider may author output bytes that reach a customer
   * artifact. `false` for the deterministic floor and for vendors excluded by
   * F-08.
   */
  readonly modelMayWriteOutput: boolean;
}

export interface RouteOptions {
  readonly capability: RouterCapability;
  readonly providers: readonly ProviderEligibility[];
  /** Observed behaviour, keyed by provider name. Defaults to "never called". */
  readonly telemetry?: Readonly<Partial<Record<AIProviderName, CapabilityMetrics>>>;
  /** Provider names to prefer first (e.g. the deployment's configured default). */
  readonly preference?: readonly AIProviderName[];
}

/**
 * The router's decision: an ordered failover chain plus the exclusion ledger.
 */
export interface RouteDecision {
  readonly capability: RouterCapability;
  /**
   * Providers to call in order. The final entry may be the deterministic
   * floor — a provider that can always "answer" because it never calls a model.
   */
  readonly chain: readonly ChainMember[];
  /** Every provider considered and why each was dropped or kept. */
  readonly considered: readonly ProviderRoute[];
}

function eligibilityFor(
  entry: ProviderEligibility,
  capability: RouterCapability,
  order: number,
): ProviderRoute {
  return {
    provider: entry.provider,
    capability,
    modelMayWriteOutput: entry.modelMayWriteOutput,
    order,
    excluded: null,
  };
}

/**
 * Routes a capability: filters first, ranks the survivors, returns an ordered
 * chain. Pure and deterministic given the same inputs.
 */
export function routeCapability(options: RouteOptions): RouteDecision {
  const { capability, providers, telemetry = {}, preference = [] } = options;
  const considered: ProviderRoute[] = [];
  const survivors: ProviderEligibility[] = [];

  for (const entry of providers) {
    if (!entry.capabilities.includes(capability)) {
      considered.push({
        provider: entry.provider,
        capability,
        modelMayWriteOutput: entry.modelMayWriteOutput,
        order: -1,
        excluded: 'no-capability',
      });
      continue;
    }
    if (!entry.credentialled) {
      considered.push({ ...eligibilityFor(entry, capability, -1), excluded: 'no-credential' });
      continue;
    }
    if (!entry.licenceAllowed) {
      considered.push({ ...eligibilityFor(entry, capability, -1), excluded: 'licence-incompatible' });
      continue;
    }
    if (!entry.jurisdictionAllowed) {
      considered.push({ ...eligibilityFor(entry, capability, -1), excluded: 'jurisdiction-blocked' });
      continue;
    }
    if (!entry.leased) {
      considered.push({ ...eligibilityFor(entry, capability, -1), excluded: 'no-lease' });
      continue;
    }
    survivors.push(entry);
  }

  const ranked = [...survivors].sort((a, b) => {
    const byScore = score(a, telemetry[a.provider]) - score(b, telemetry[b.provider]);
    if (byScore !== 0) return byScore;
    // Telemetry tie-break: preference order, then declaration order. Kept as
    // the secondary key so the deployment's chosen vendor wins a perfect tie.
    const orderOf = (name: AIProviderName): number => {
      const preferred = preference.indexOf(name);
      return preferred === -1 ? AI_PROVIDER_NAMES.indexOf(name) : preferred;
    };
    return orderOf(a.provider) - orderOf(b.provider);
  });

  const chain = ranked.map((entry, index) => eligibilityFor(entry, capability, index));
  return { capability, chain, considered };
}

/**
 * Ranks a provider by observed behaviour: availability first (a provider that
 * fails every call is worse than one that is merely slow), then latency.
 * Lower is better. A provider that has never been called scores worst, because
 * the doctrine is that an untested fallback is not a fallback.
 */
function score(entry: ProviderEligibility, metrics: CapabilityMetrics | undefined): number {
  if (metrics === undefined) return Number.MAX_SAFE_INTEGER;
  const availabilityPenalty = (1 - metrics.availability) * 1_000_000;
  const latency = metrics.latencyMs?.avg ?? Number.MAX_SAFE_INTEGER;
  return availabilityPenalty + latency;
}

/**
 * The deterministic floor, offered as the last member of a chain.
 *
 * Every chain ends in the floor when the caller asks for it: no matter how the
 * providers fail, a site still gets produced.
 */
export function withFloor(chain: readonly ChainMember[]): readonly ChainMember[] {
  return [
    ...chain,
    { provider: null, capability: 'deterministic-floor', modelMayWriteOutput: false, order: Number.MAX_SAFE_INTEGER, excluded: null },
  ];
}

/** Whether a chain member is the deterministic floor rather than a provider. */
export function isFloor(member: ChainMember): member is DeterministicFloorRoute {
  return member.provider === null;
}

export const SOURCE_NAME = SOURCE;