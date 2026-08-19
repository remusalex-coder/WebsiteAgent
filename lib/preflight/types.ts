/**
 * The Production Preflight contract.
 *
 * A preflight check inspects the evidence a run actually produced — the
 * profile, the strategy, the content spec, the design and the rendered site —
 * and decides whether one concern is ready for production, not ready, or
 * simply does not apply to this business. Nothing here invents a fact: a
 * check that cannot find evidence for or against something says so as
 * `NOT_APPLICABLE` rather than guessing `PASS`.
 *
 * This module owns the vocabulary only. The checks themselves live under
 * `lib/preflight/checks/`, one file per category, and `lib/preflight/index.ts`
 * runs them and assembles the report.
 */

import type { AppConfig } from '../config.js';
import type {
  BusinessProfile,
  BusinessStrategy,
  WebsiteContent,
} from '../types.js';
import type { WebsiteDesign } from '../design/types.js';
import type { RenderedSite } from '../render/types.js';

/**
 * The eight check categories the factory must cover.
 *
 * A closed set, the same way `SectionKind` and `Industry` are closed sets
 * elsewhere in this codebase — a check that does not fit one of these is a
 * check that has not decided what it is for.
 */
export type CheckCategory =
  | 'functional-readiness'
  | 'seo-discoverability'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'privacy-compliance'
  | 'analytics-measurement'
  | 'business-specific';

export const CHECK_CATEGORIES: readonly CheckCategory[] = [
  'functional-readiness',
  'seo-discoverability',
  'accessibility',
  'performance',
  'security',
  'privacy-compliance',
  'analytics-measurement',
  'business-specific',
];

/**
 * Five outcomes, not three. `NOT_APPLICABLE` and `BLOCKED` are not decoration:
 *
 * - `NOT_APPLICABLE` — this business's evidence does not call for this check.
 *   A bakery with no online booking claim does not fail a booking check; the
 *   check never applied.
 * - `BLOCKED` — the check applies, but the run does not yet carry the
 *   evidence to answer it (a deployment target has not been chosen, so
 *   HTTPS/headers/cookies cannot be verified pre-deploy). Distinct from
 *   `FAIL`: nothing is known to be wrong, only unknown.
 */
export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'NOT_APPLICABLE' | 'BLOCKED';

/**
 * A check's inherent importance, independent of whether it currently passes.
 *
 * `critical` is reserved for the failures this system will not ship past:
 * exposed secrets, broken escaping, and fabricated trust signals (fake
 * reviews). A `FAIL` at `critical` severity blocks production; nothing else
 * does. See `computeProductionGate` in `report.ts`.
 */
export type CheckSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Applicability = 'applicable' | 'not_applicable';

/**
 * One check's verdict.
 *
 * `evidence` is a list of concrete, inspectable facts — a file path, a
 * measured contrast ratio, a matched pattern — never a restatement of the
 * verdict. A reviewer should be able to check the evidence against the run's
 * own artifacts without re-running anything.
 */
export interface CheckResult {
  readonly id: string;
  readonly category: CheckCategory;
  readonly title: string;
  readonly applicability: Applicability;
  readonly status: CheckStatus;
  readonly severity: CheckSeverity;
  readonly evidence: readonly string[];
  /** What to do about a `FAIL` or `WARN`. `null` for `PASS`/`NOT_APPLICABLE`. */
  readonly remediation: string | null;
}

/**
 * What one secrets/git scan found.
 *
 * Populated once per report by the one async I/O step preflight performs
 * (`scan.ts`); every check that needs it reads this rather than touching the
 * filesystem itself, which is what keeps every check a synchronous, testable
 * function of its inputs.
 */
export interface SecretScanResult {
  /** `false` when no `outputDir` was supplied — the scan simply did not run. */
  readonly scanned: boolean;
  /** Human-readable findings; empty means the scan ran and found nothing. */
  readonly findings: readonly string[];
  /** `null` when a repository root could not be located to check. */
  readonly gitignoreExcludesOutput: boolean | null;
}

/** Everything a check is allowed to look at. Nothing here is optional. */
export interface PreflightContext {
  readonly runId: string;
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
  readonly design: WebsiteDesign;
  readonly site: RenderedSite;
  readonly config: AppConfig;
  /** The rendered `index.html`, or the configured HTML file. `''` if absent. */
  readonly html: string;
  /** The rendered stylesheet. `''` if absent. */
  readonly css: string;
  readonly secretScan: SecretScanResult;
}

export type CheckFn = (ctx: PreflightContext) => CheckResult;

/** What a run supplies to `runProductionPreflight`. */
export interface PreflightInput {
  readonly runId: string;
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
  readonly design: WebsiteDesign;
  readonly site: RenderedSite;
  readonly config: AppConfig;
  /**
   * The run's artifact directory, scanned for secrets and checked against
   * the repository's `.gitignore`. `null` skips the scan — `secretScan.scanned`
   * is then `false` and the checks that depend on it report `BLOCKED`.
   */
  readonly outputDir: string | null;
}

export interface CategoryTally {
  readonly pass: number;
  readonly fail: number;
  readonly warn: number;
  readonly notApplicable: number;
  readonly blocked: number;
}

export interface PreflightSummary extends CategoryTally {
  readonly total: number;
  readonly byCategory: Readonly<Record<CheckCategory, CategoryTally>>;
}

export interface ProductionGate {
  readonly blocksProduction: boolean;
  /** `FAIL` results at `critical` severity — the only thing that blocks. */
  readonly blockingChecks: readonly CheckResult[];
}

export interface PreflightReport {
  readonly runId: string;
  readonly generatedAt: string;
  readonly businessName: string;
  readonly industry: string;
  readonly results: readonly CheckResult[];
  readonly summary: PreflightSummary;
  readonly productionGate: ProductionGate;
}
