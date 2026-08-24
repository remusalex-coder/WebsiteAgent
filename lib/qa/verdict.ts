/**
 * Lexicographic verdict combination (Freeze N-15, P4-2, F-06).
 *
 * The freeze forbids a weighted sum of quality dimensions. F-06 names the
 * rule: "quality and distinctness are separate dimensions combined
 * **lexicographically** — gate returns two verdicts; no weighted sum anywhere."
 * This module is that rule, as a function rather than a discipline.
 *
 * ## The ordering
 *
 *   1. **Blocking dimensions first.** A blocking dimension in `fail` or
 *      `uncertain` fails the gate outright — nothing a non-blocking dimension
 *      scores can rescue it. This is what makes F-07 (`'uncertain'` blocks
 *      delivery) structural: an `uncertain` visual verdict is a blocking
 *      `uncertain`, not a low score.
 *   2. **Then max quality.** Among surviving candidates, the one with the
 *      higher quality dimension wins.
 *   3. **Then distinctness as tie-break.** Two candidates equal on every
 *      blocking and quality dimension are separated by distinctness — a
 *      strange candidate may never buy its way past a good one, but it may
 *      win a perfect tie.
 *   4. **The tie-break that makes the order total** is the candidate's index,
 *      so the answer does not depend on append order.
 *
 * The same comparison is the one `candidates.ts` derives `best` with; this
 * module owns it, and `candidates.ts` may adopt it, so there is exactly one
 * lexicographic rule in the codebase.
 */

const SOURCE = 'qa.verdict';

/** The status of one dimension. `uncertain` is a blocking state, never a pass. */
export type DimensionStatus = 'pass' | 'fail' | 'uncertain';

/** One measured dimension of a candidate. */
export interface DimensionVerdict {
  readonly name: string;
  /** Blocking dimensions gate the whole candidate; non-blocking ones rank it. */
  readonly blocking: boolean;
  readonly status: DimensionStatus;
  /** 0–100. Higher is better. Only read among non-blocking dimensions. */
  readonly score: number;
  /** Why this dimension scored as it did, for the escalation brief. */
  readonly reason?: string;
}

/** A candidate reduced to the dimensions the gate measured about it. */
export interface VerdictableCandidate {
  readonly id: string;
  /** Order in which the candidate was recorded. Older candidates win ties. */
  readonly index: number;
  readonly dimensions: readonly DimensionVerdict[];
  /**
   * The candidate's distinctness, 0–100. A separate dimension from quality:
   * used only to break a quality tie, never summed into it.
   */
  readonly distinctness: number;
}

export type GateVerdict = 'PASS' | 'FAIL';

export interface CombinedVerdict {
  readonly verdict: GateVerdict;
  /** The blocking dimension that failed the gate, when one did. */
  readonly blockingFailure: string | null;
  /** The blocking dimension that left the gate unable to vouch, when one did. */
  readonly uncertain: string | null;
  /** The candidate's quality, taken as its best non-blocking dimension. */
  readonly quality: number;
  /** Every dimension verdict that was not a clean pass, for the brief. */
  readonly reasons: readonly string[];
}

/**
 * Combines one candidate's dimensions into a single gate verdict.
 *
 * Blocking dimensions gate first: any blocking `fail` or `uncertain` decides
 * the verdict, and the first such dimension names the failure. Otherwise the
 * candidate passes with a quality equal to its best non-blocking dimension.
 */
export function combineVerdicts(candidate: VerdictableCandidate): CombinedVerdict {
  const reasons: string[] = [];

  for (const dimension of candidate.dimensions) {
    if (dimension.status === 'pass') continue;
    const reason = `${dimension.name}: ${dimension.status}${dimension.reason ? ` — ${dimension.reason}` : ''}`;
    reasons.push(reason);
    if (!dimension.blocking) continue;
    if (dimension.status === 'fail') {
      return { verdict: 'FAIL', blockingFailure: dimension.name, uncertain: null, quality: bestQuality(candidate), reasons };
    }
    return { verdict: 'FAIL', blockingFailure: null, uncertain: dimension.name, quality: bestQuality(candidate), reasons };
  }

  return { verdict: 'PASS', blockingFailure: null, uncertain: null, quality: bestQuality(candidate), reasons };
}

/**
 * A candidate's quality: its best non-blocking dimension score.
 *
 * "Max quality" is the freeze's phrase in P4-2. Taking the best non-blocking
 * dimension — rather than, say, an average — is what keeps this lexicographic:
 * an average is a weighted sum in disguise, and F-06 forbids those.
 */
function bestQuality(candidate: VerdictableCandidate): number {
  let best = 0;
  for (const dimension of candidate.dimensions) {
    if (dimension.blocking) continue;
    if (dimension.score > best) best = dimension.score;
  }
  return best;
}

/**
 * Whether `a` is strictly better than `b`, lexicographically.
 *
 * 1. A passing candidate beats a failing one.
 * 2. Higher quality wins.
 * 3. Higher distinctness breaks the tie.
 * 4. Earlier index breaks the remaining tie, making the order total.
 *
 * A candidate that fails a blocking dimension can never be selected over one
 * that passes it — the property test in the test suite asserts exactly that a
 * higher-distinctness/lower-quality candidate never wins, and this function is
 * the reason it cannot.
 */
export function isStrictlyBetter(a: VerdictableCandidate, b: VerdictableCandidate): boolean {
  const aVerdict = combineVerdicts(a);
  const bVerdict = combineVerdicts(b);

  if (aVerdict.verdict !== bVerdict.verdict) return aVerdict.verdict === 'PASS';
  if (aVerdict.verdict === 'FAIL') return false; // two failures: neither is better

  if (aVerdict.quality !== bVerdict.quality) return aVerdict.quality > bVerdict.quality;
  if (a.distinctness !== b.distinctness) return a.distinctness > b.distinctness;
  return a.index < b.index;
}

/** The best candidate in a set, or `null` when empty. Order-independent. */
export function selectBestVerdict(candidates: readonly VerdictableCandidate[]): VerdictableCandidate | null {
  let best: VerdictableCandidate | null = null;
  for (const candidate of candidates) {
    if (best === null || isStrictlyBetter(candidate, best)) best = candidate;
  }
  return best;
}

/**
 * The nine dimensions the gate measures, in blocking-first order.
 *
 * The first three are blocking (a broken render, a generic page, an
 * inaccessible one are never deliverable); the rest rank survivors. Keeping
 * them named here gives every gate caller one vocabulary — F-03.
 */
export const DIMENSIONS: readonly { readonly name: string; readonly blocking: boolean }[] = [
  { name: 'layout', blocking: true },
  { name: 'visual', blocking: true },
  { name: 'accessibility', blocking: true },
  { name: 'functional-security', blocking: true },
  { name: 'experience', blocking: false },
  { name: 'narrative', blocking: false },
  { name: 'explainability', blocking: false },
  { name: 'businessSpecificity', blocking: false },
  { name: 'distinctness', blocking: false },
];

export const SOURCE_NAME = SOURCE;