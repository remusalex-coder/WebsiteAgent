/**
 * Budget tiers — a caller-facing vocabulary over `CapabilityPolicy`'s
 * `allowPaid`/`budgetCentsRemaining` pair.
 *
 * The policy fields stay exactly as they are: this module only resolves a
 * named tier to a `Partial<CapabilityPolicy>`, the same shape `createPlatform`
 * and `createCapabilityOrchestrator` already accept. Nothing in `plan.ts`
 * changes to support this — a tier is sugar over two numbers, not a new
 * filtering concept.
 *
 * Boundaries come from `research/asset-stack/12_COST_PER_SITE.md`'s own
 * scenario table (€0 / €0–1 / €1–5 / €5–20), which this deployment's tiers
 * reuse verbatim rather than inventing new figures:
 *
 *   - `tier0` — €0.00. Identical to `DEFAULT_POLICY`: no behaviour changes for
 *     anyone who does not opt in.
 *   - `tier1` — micro, up to €5.00 (the research doc's €1–5 band's ceiling).
 *   - `tier2` — premium, up to €20.00 (the €5–20 band's ceiling).
 *   - `tier3` — custom. The caller supplies the cents; there is no silent
 *     default, because a budget nobody chose is not a budget.
 */

import { InvalidInputError } from '../errors.js';

import type { CapabilityPolicy } from './plan.js';

const SOURCE = 'capability.budget';

export const BUDGET_TIERS = ['tier0', 'tier1', 'tier2', 'tier3'] as const;

export type BudgetTier = (typeof BUDGET_TIERS)[number];

export function isBudgetTier(value: string): value is BudgetTier {
  return (BUDGET_TIERS as readonly string[]).includes(value);
}

/** Euro cents, not euros — matches `CapabilityPolicy.budgetCentsRemaining`. */
export const TIER_CENTS: Readonly<Record<Exclude<BudgetTier, 'tier3'>, number>> = {
  tier0: 0,
  tier1: 500,
  tier2: 2_000,
};

export type BudgetTierResolution = Pick<CapabilityPolicy, 'allowPaid' | 'budgetCentsRemaining'>;

/**
 * Resolves a named tier to the policy fields it stands for.
 *
 * `customCents` is required for `tier3` and ignored for every other tier —
 * passing it alongside `tier0`/`tier1`/`tier2` is not an error, since the
 * caller may be threading one variable through regardless of the selected
 * tier, but it never silently widens a fixed tier's cap.
 */
export function resolveBudgetTier(tier: BudgetTier, customCents?: number): BudgetTierResolution {
  if (tier === 'tier0') return { allowPaid: false, budgetCentsRemaining: 0 };

  if (tier === 'tier3') {
    if (customCents === undefined || !Number.isFinite(customCents) || customCents <= 0) {
      throw new InvalidInputError(
        'tier3 requires an explicit positive budgetCustomCents — no provider may spend against an unset budget',
        SOURCE,
      );
    }
    return { allowPaid: true, budgetCentsRemaining: customCents };
  }

  return { allowPaid: true, budgetCentsRemaining: TIER_CENTS[tier] };
}

export const SOURCE_NAME = SOURCE;
