/**
 * Factory capability routing (Freeze N-09, F-12, P3-2/P3-3).
 *
 * The user-facing vocabulary the factory routes on — `research`,
 * `content`, `design.concept`, `coding.frontend`, `vision` — sits on top of
 * the provider layer's `routeCapability`. This module is the bridge:
 *
 *   factory capability → pool role → provider eligibility → router chain
 *
 * It exists because the router (lib/ai/router.ts) answers "for this
 * capability, which providers serve it, in which order, and who was excluded"
 * but knows nothing about pool roles or the factory's own vocabulary. The pool
 * (lib/factory/pool.ts) knows who is credentialled but nothing about routing.
 * Neither knows the other — this module is where they meet, and it is the only
 * place the factory names a capability.
 *
 * ## The exclusion ledger
 *
 * `routeForCapability` returns the router's full decision — the ordered chain
 * AND every provider that was considered and dropped, with the reason. A run
 * surfaces that as its own record of "who was available, who was not, why".
 */

import { routeCapability, withFloor } from '../ai/router.js';
import { resolvePool } from './pool.js';

import type { PoolRole, PoolMember } from './pool.js';
import type { AiConfig } from '../config.js';
import type { AIProviderName } from '../ai/types.js';
import type {
  ChainMember,
  ProviderEligibility,
  ProviderRoute,
  RouteDecision,
  RouterCapability,
} from '../ai/router.js';
import type { CapabilityMetrics } from '../platform/types.js';

/**
 * The factory's capability vocabulary. `coding.frontend` and `design.concept`
 * both dispatch through the design pool — the difference is the directive the
 * stage hands the worker, not the pool it draws from.
 */
export const FACTORY_CAPABILITIES = [
  'research',
  'content',
  'design.concept',
  'coding.frontend',
  'vision',
] as const;

export type FactoryCapability = (typeof FACTORY_CAPABILITIES)[number];

export function isFactoryCapability(value: string): value is FactoryCapability {
  return (FACTORY_CAPABILITIES as readonly string[]).includes(value);
}

/** The pool role a factory capability draws from. `null` = no LLM pool. */
export function capabilityPoolRole(capability: FactoryCapability): PoolRole | null {
  switch (capability) {
    case 'research':
      return 'research';
    case 'content':
      return 'content';
    case 'design.concept':
    case 'coding.frontend':
      return 'design';
    case 'vision':
      return null;
  }
}

/** The router-level capability a factory capability maps to. */
export function capabilityRouterName(capability: FactoryCapability): RouterCapability {
  return capability === 'vision' ? 'vision' : 'generate';
}

/**
 * Builds the eligibility facts the router filters on, from the deployment's
 * actual pool + credentials. `licensed`/`jurisdiction` default to allowed —
 * this deployment records neither — and `leased` to true because this path
 * does not hold budget leases; the router keeps the seams so a future
 * integration can flip them without changing its callers.
 */
export function eligibilityForPool(
  members: readonly PoolMember[],
  config: AiConfig,
  routerCapability: RouterCapability,
): ProviderEligibility[] {
  return members.map((member) => ({
    provider: member.provider,
    capabilities: [routerCapability],
    credentialled: config.apiKeys[member.provider] !== '',
    jurisdictionAllowed: true,
    licenceAllowed: true,
    leased: true,
    modelMayWriteOutput: true,
  }));
}

export interface RouteFactoryCapabilityOptions {
  readonly capability: FactoryCapability;
  readonly config: AiConfig;
  /** Observed per-provider behaviour, when the caller holds any. */
  readonly telemetry?: Readonly<Partial<Record<AIProviderName, CapabilityMetrics>>>;
  /** Provider names to try first. Defaults to the pool's declared order. */
  readonly preference?: readonly AIProviderName[];
}

/**
 * Routes a factory capability to an ordered failover chain, ending at the
 * deterministic floor. Pure — the caller executes the chain.
 */
export function routeForCapability(options: RouteFactoryCapabilityOptions): RouteDecision {
  const { capability, config, telemetry, preference } = options;
  const role = capabilityPoolRole(capability);
  const routerCapability = capabilityRouterName(capability);

  if (role === null) {
    // Vision has no LLM pool — VISION_* is resolved by the stage itself, so the
    // only member of this chain is the floor (the 'uncertain' degradation).
    return {
      capability: routerCapability,
      chain: withFloor([]),
      considered: [],
    };
  }

  const pool = resolvePool(role, config);
  const decision = routeCapability({
    capability: routerCapability,
    providers: eligibilityForPool(pool.members, config, routerCapability),
    ...(telemetry === undefined ? {} : { telemetry }),
    ...(preference === undefined ? {} : { preference: preference ?? pool.members.map((m) => m.provider) }),
  });
  return {
    capability: routerCapability,
    chain: withFloor(decision.chain),
    considered: decision.considered,
  };
}

/** The exclusion ledger, summarised for a run's own record. */
export interface ExclusionEntry {
  readonly provider: string;
  readonly reason: string;
}

export function exclusionLedger(considered: readonly ProviderRoute[]): readonly ExclusionEntry[] {
  return considered
    .filter((entry) => entry.excluded !== null)
    .map((entry) => ({ provider: entry.provider, reason: entry.excluded ?? 'unknown' }));
}

/** A pool member the chain named, in routed (not pool-declaration) order. */
export function routedMembers(
  chain: readonly ChainMember[],
  members: readonly PoolMember[],
): readonly PoolMember[] {
  const out: PoolMember[] = [];
  for (const member of chain) {
    if (member.provider === null) continue;
    const poolMember = members.find((entry) => entry.provider === member.provider);
    if (poolMember === undefined) continue;
    out.push(poolMember);
  }
  return out;
}

export const SOURCE_NAME = 'factory.capabilities';