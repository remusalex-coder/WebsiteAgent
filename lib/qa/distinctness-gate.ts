/**
 * Distinctness gate — combines the deterministic quality gates with the
 * Visual Critic verdict into one production PASS/FAIL decision.
 *
 * `lib/design/quality.ts` already scores a design's explainability, business
 * specificity, narrative coherence, and (given peers) whether the platform is
 * producing a template. `lib/qa/visual-critic.ts` already judges whether the
 * rendered pixels look generic. Neither alone is the gate: a design can score
 * well on paper and still render as a brochure, and a critic can flag pixels
 * without knowing whether the underlying cause is a weak concept, a weak
 * build, or thin evidence. This module reads both, decides PASS or FAIL, and
 * — on FAIL — diagnoses *why* and routes the job to the stage that owns the
 * fix. It never fixes anything itself.
 */

import { scoreExperience, narrativeCoherence, genericityReport } from '../design/quality.js';
import { blockingReasons as layoutBlockingReasons } from './layout-audit.js';

import type { LayoutAudit } from './layout-audit.js';
import type { JobState } from '../workflow/jobState.js';
import type { WebsiteDesign, WebsiteContent } from '../types.js';
import type { BusinessCharacter } from '../design/character.js';
import type { VisualCritique } from './visual-critic.js';
import type { DesignDirective } from '../design/directive.js';

export type GateDiagnosis =
  | 'A-implementation'
  | 'B-missing-capability'
  | 'C-weak-experience'
  | 'D-weak-concept'
  | 'E-thin-evidence'
  | 'none';

export type GateRoute = 'builder' | 'experience' | 'creative' | 'director' | 'deliver' | 'escalate';

export interface DistinctnessResult {
  readonly verdict: 'PASS' | 'FAIL';
  readonly overallScore: number;
  readonly diagnosis: GateDiagnosis;
  readonly route: GateRoute;
  readonly reasons: readonly string[];
}

const PASS_THRESHOLD = 70;

/**
 * Whether the creative direction behind this job is too thin to trust.
 *
 * `creativeDirection` is stored as `unknown` on `JobState` (stages own their
 * own artifact types); a `DesignDirective` with no rationale or low
 * confidence is exactly the "weak concept" signal `applyDirective` itself
 * already warns about, so we read the same two fields here.
 */
function isCreativeDirectionWeak(creativeDirection: unknown): boolean {
  if (creativeDirection === null || creativeDirection === undefined) return true;
  const directive = creativeDirection as Partial<DesignDirective>;
  const noRationale = (directive.rationale ?? '').trim().length === 0;
  const lowConfidence = directive.confidence !== undefined && directive.confidence < 0.5;
  return noRationale || lowConfidence;
}

export interface GateJobArgs {
  readonly jobState: JobState;
  readonly design: WebsiteDesign;
  readonly content: WebsiteContent;
  readonly character: unknown;
  readonly critic: VisualCritique;
  readonly peerDesigns?: readonly { readonly name: string; readonly design: WebsiteDesign }[];
  /**
   * What the rendered page actually measured, when a layout audit ran.
   *
   * Optional so every existing caller — and the Production Loop, which has no
   * layout stage — keeps its current behaviour. Absent means "nobody looked at
   * the pixels", which is a different thing from "the pixels were fine", and
   * the gate does not pretend otherwise: it simply has no measured reasons to
   * add.
   */
  readonly layout?: LayoutAudit;
}

/**
 * Decides PASS/FAIL for one job and, on FAIL, which stage should re-run.
 *
 * Reuses `scoreExperience` / `narrativeCoherence` / `genericityReport`
 * verbatim rather than re-deriving them — this function's only job is
 * combining their verdicts with the critic's and routing, never re-scoring.
 */
export function gateJob(args: GateJobArgs): DistinctnessResult {
  const { jobState, design, content, critic, peerDesigns } = args;
  const character = args.character as BusinessCharacter;

  const experience = scoreExperience(design, content, character);
  const coherence = narrativeCoherence(design, character);
  const genericity = peerDesigns !== undefined && peerDesigns.length > 0 ? genericityReport(peerDesigns) : null;

  const reasons: string[] = [];

  /*
   * Measured defects come first, and they are decisive.
   *
   * Everything else this gate reads is a judgement about the design *spec*:
   * whether the concept is explainable, specific, coherent, unlike its peers.
   * A page can satisfy all of that and still overlap its own sections or paint
   * nothing below the hero — and it did, scoring 99 and PASSING, which is the
   * defect this branch exists to make impossible.
   *
   * They are also the only reasons here that survive a disagreement: a broken
   * render is not a matter of taste, so a layout failure is never outvoted by
   * a good experience score.
   */
  const layoutBlocking = args.layout === undefined ? [] : layoutBlockingReasons(args.layout);
  reasons.push(...layoutBlocking);

  if (critic.genericVerdict === 'generic') {
    reasons.push(`Visual critic judged the rendered site generic: ${critic.failReasons.join('; ') || 'no specific reasons given'}.`);
  }
  if (experience.overall < PASS_THRESHOLD) {
    reasons.push(`Experience score ${experience.overall} is below the pass threshold of ${PASS_THRESHOLD} (${experience.flags.join('; ') || 'no flags'}).`);
  }
  if (genericity !== null && genericity.verdict === 'template-smell') {
    reasons.push(`Genericity check found template smell across peer businesses: ${genericity.rationale}`);
  }

  if (reasons.length === 0) {
    return { verdict: 'PASS', overallScore: experience.overall, diagnosis: 'none', route: 'deliver', reasons: [] };
  }

  const creativeWeak = isCreativeDirectionWeak(jobState.creativeDirection);
  const coherenceWeak = !coherence.ok || (experience.axes.coherence ?? 1) < 1;
  // Evidence is "thin" in the sense that matters here: the design's own
  // decisions do not cite any evidence. This is derived from the scored
  // design, not from jobState.evidence (which the PHASE 1/2 orchestrator does
  // not populate — it starts from an already-processed run).
  const evidenceThin = (experience.axes.explainability ?? 1) < 0.5;

  let diagnosis: GateDiagnosis;
  let route: GateRoute;
  // A measured render defect is an implementation defect by definition, and it
  // outranks every diagnosis below: rebuilding is the only thing that can fix a
  // page that overlaps itself, and re-routing it to `creative` would spend a
  // model call rewriting a concept that was never the problem.
  if (layoutBlocking.length > 0) {
    diagnosis = 'A-implementation';
    route = 'builder';
  } else if (critic.genericVerdict === 'generic' && creativeWeak) {
    diagnosis = 'D-weak-concept';
    route = 'creative';
  } else if (coherenceWeak) {
    diagnosis = 'C-weak-experience';
    route = 'experience';
  } else if (jobState.implementationStatus === 'failed') {
    diagnosis = 'A-implementation';
    route = 'builder';
  } else if (evidenceThin) {
    diagnosis = 'E-thin-evidence';
    route = 'escalate';
  } else {
    diagnosis = 'B-missing-capability';
    route = 'director';
  }

  return { verdict: 'FAIL', overallScore: experience.overall, diagnosis, route, reasons };
}
