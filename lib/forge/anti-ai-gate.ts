/**
 * Anti-AI-Generic Gate & Factual Grounding Validator.
 *
 * Runs deterministic and heuristic audits before Vision QA to intercept:
 * - Forbidden assumptions / ungrounded hallucinations
 * - Repetitive card grids & generic brochure patterns
 * - Unmotivated decorative effects (glassmorphism/particles) rejected by Restraint Contract
 * - Structural template convergence against the real corpus of prior builds.
 *
 * ## The structural-convergence check, and why it was rewritten
 *
 * The original version of this module compared the current build's
 * `<section id="…">` list against ONE hardcoded prior run
 * (`forge-da56c149`, the Go Sweet bakery benchmark) and failed anything
 * over 80% overlap. That mechanism produced a false positive on every
 * subsequent business, Ridgeway Motors (an auto shop) included, scoring
 * "100% identical to Go Sweet": not because the sites were structurally
 * alike, but because `id="scene-1"`, `id="scene-2"`, … is the sequential
 * id every business gets when nothing asks the model for a content-derived
 * one (see `signature.ts`'s `slugifySceneIds`). The check was measuring an
 * artifact of the id-naming convention, not genericity, against a baseline
 * that has no privileged claim to be "the" reference shape for every
 * business in every category.
 *
 * The replacement, `checkStructuralConvergence`, fixes both defects:
 *
 * 1. **Scoped to the real peer corpus**, not one fixed file. It reads
 *    every other Forge run actually present under `outputDir` — as many
 *    or as few as exist — never a single named business assumed relevant
 *    to whichever business is building today.
 * 2. **Compares creative content, not DOM labels.** The axes are the
 *    signature's own identity-bearing fields — `centralMechanism`,
 *    `creativeMetaphor`, the `layoutPattern` sequence, the selected
 *    interaction patterns, the color palette — the same kind of
 *    identity-axis comparison `lib/design/quality.ts`'s `genericityReport`
 *    already uses for the deterministic pipeline, adapted to what Forge
 *    actually produces. A DOM id is never one of them.
 *
 * Convergence is flagged only when **several independent axes** agree with
 * the **same specific peer** — one shared axis is coincidence (two
 * businesses may legitimately share a layout pattern or a mechanism name);
 * four or five agreeing simultaneously with one prior build is not.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { checkAntiPatternSignals, checkMotionCoherence, checkMotionLibraryUsage } from './antiPatternSignals.js';
import type { AntiAIGateResult, ExperienceBlueprint, ExperienceSignature, GeneratedCode } from './types.js';
import type { Logger } from '../logger.js';

export interface AntiAIGateOptions {
  readonly code: GeneratedCode;
  readonly blueprint: ExperienceBlueprint;
  readonly outputDir: string;
  /** This run's own id, so the peer scan excludes comparing a run to itself. */
  readonly runId: string;
  readonly logger: Logger;
}

/**
 * The signature's identity-bearing axes, reduced to comparable strings.
 *
 * Mirrors `lib/design/quality.ts`'s `genericityReport` axis list — same
 * idea (identity-bearing fields, not incidental ones), adapted to what
 * `ExperienceSignature` actually carries. A DOM id is deliberately absent:
 * it is assigned by the builder's own prompt compliance, not chosen by the
 * creative-direction call, so it carries no signal about the concept.
 */
function identityAxes(signature: ExperienceSignature): Readonly<Record<string, string>> {
  return {
    centralMechanism: signature.centralMechanism.trim().toLowerCase(),
    creativeMetaphor: signature.creativeMetaphor.trim().toLowerCase(),
    layoutSequence: signature.scenes.map((s) => s.layoutPattern.trim().toLowerCase()).join('|'),
    interactionSelected: [...signature.interactionGrammar.selectedPatterns].map((p) => p.trim().toLowerCase()).sort().join('|'),
    paletteSignature: [
      signature.visualGrammar.colorPalette.primary,
      signature.visualGrammar.colorPalette.background,
      signature.visualGrammar.colorPalette.accent,
    ].map((c) => c.trim().toLowerCase()).join('|'),
  };
}

/** How many of the axes above must agree with the same peer to be convergence, not coincidence. */
const CONVERGENCE_AXIS_THRESHOLD = 4;

export interface StructuralConvergenceResult {
  readonly peersCompared: number;
  readonly closestPeer: string | null;
  readonly matchedAxes: readonly string[];
  readonly verdict: 'DISTINCT' | 'NO_PEERS' | 'TEMPLATE_CONVERGENCE';
}

/**
 * Compares this build's Experience Signature against every other Forge run
 * that actually exists under `outputDir`, on identity-bearing creative axes.
 *
 * Replaces the single-hardcoded-baseline `<section id>` diff (see the
 * module docstring for why that mechanism was wrong). With zero or one
 * peers there is no meaningful corpus to detect convergence against — that
 * is a fact about how many businesses have been built so far, not evidence
 * either way about this one, so the verdict is `NO_PEERS`, never a pass
 * dressed up as a measurement.
 */
export async function checkStructuralConvergence(
  signature: ExperienceSignature,
  outputDir: string,
  selfRunId: string,
): Promise<StructuralConvergenceResult> {
  const mine = identityAxes(signature);

  let entries: string[];
  try {
    entries = await fs.readdir(outputDir);
  } catch {
    return { peersCompared: 0, closestPeer: null, matchedAxes: [], verdict: 'NO_PEERS' };
  }

  let bestPeer: string | null = null;
  let bestMatches: string[] = [];
  let peersCompared = 0;

  for (const entry of entries) {
    if (entry === selfRunId) continue;
    const signaturePath = path.join(outputDir, entry, 'forge', '3-signature.json');
    let peerSignature: ExperienceSignature;
    try {
      peerSignature = JSON.parse(await fs.readFile(signaturePath, 'utf8')) as ExperienceSignature;
    } catch {
      continue; // not a Forge run, or no signature written yet — not a peer
    }

    peersCompared += 1;
    const peerAxes = identityAxes(peerSignature);
    const matched = Object.keys(mine).filter((axis) => {
      const mineValue = mine[axis];
      return mineValue !== undefined && mineValue.length > 0 && mineValue === peerAxes[axis];
    });

    if (matched.length > bestMatches.length) {
      bestMatches = matched;
      bestPeer = entry;
    }
  }

  if (peersCompared === 0) {
    return { peersCompared: 0, closestPeer: null, matchedAxes: [], verdict: 'NO_PEERS' };
  }

  const verdict = bestMatches.length >= CONVERGENCE_AXIS_THRESHOLD ? 'TEMPLATE_CONVERGENCE' : 'DISTINCT';
  return { peersCompared, closestPeer: verdict === 'TEMPLATE_CONVERGENCE' ? bestPeer : null, matchedAxes: bestMatches, verdict };
}

export async function auditAntiAIGeneric(options: AntiAIGateOptions): Promise<AntiAIGateResult> {
  const { code, blueprint, outputDir, runId, logger } = options;
  const flags: { code: string; severity: 'fail' | 'warning' | 'info'; message: string; evidence?: string }[] = [];

  logger.info('Running Anti-AI-Generic Gate audit', { brandName: blueprint.brandName });

  const html = code.html.toLowerCase();
  const css = code.css.toLowerCase();
  const js = code.js.toLowerCase();

  // 1. Check Factual Firewall Violations (Forbidden Assumptions)
  for (const forbidden of blueprint.factualDossier.forbiddenAssumptions) {
    const forbiddenKeywords = forbidden.toLowerCase().match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, '')) || [];
    for (const kw of forbiddenKeywords) {
      if (html.includes(kw)) {
        flags.push({
          code: 'FACTUAL_HALLUCINATION_DETECTED',
          severity: 'fail',
          message: `Generated text contains forbidden assumption keyword: "${kw}"`,
          evidence: `Found "${kw}" in HTML content`,
        });
      }
    }
  }

  // 2. Check Restraint Contract Violations
  const rejected = blueprint.signature.interactionGrammar.rejectedPatterns.map((p) => p.toLowerCase());
  if (rejected.some((r) => r.includes('loading') || r.includes('spinner')) && (html.includes('id="preloader"') || html.includes('class="preloader"'))) {
    flags.push({
      code: 'RESTRAINT_VIOLATION_PRELOADER',
      severity: 'fail',
      message: 'Preloader/Loading screen was explicitly rejected in Signature, but present in HTML.',
    });
  }

  if (rejected.some((r) => r.includes('particle')) && js.includes('particle') && js.includes('canvas')) {
    flags.push({
      code: 'RESTRAINT_VIOLATION_PARTICLES',
      severity: 'warning',
      message: 'Particle canvas was rejected in Restraint Contract but found in JavaScript.',
    });
  }

  // 3. Check for Excessive Card Container Stacking
  const cardCount = (html.match(/class="[^"]*(card|item-box)[^"]*"/g) || []).length;
  if (cardCount > 12) {
    flags.push({
      code: 'EXCESSIVE_CARD_CONTAINERS',
      severity: 'warning',
      message: `Found ${cardCount} card containers; consider more varied editorial layout.`,
    });
  }

  // 4. Anti-pattern signals from the ANTI_AI_SLOP.md research corpus, plus
  // motion coherence against the signature's own declared intensity.
  flags.push(...checkAntiPatternSignals(code, blueprint));
  flags.push(...checkMotionCoherence(code, blueprint.signature.experienceStrategy));
  flags.push(...checkMotionLibraryUsage(code));

  // 5. Structural template convergence against the real peer corpus
  const structuralConvergence = await checkStructuralConvergence(blueprint.signature, outputDir, runId);
  if (structuralConvergence.verdict === 'TEMPLATE_CONVERGENCE') {
    flags.push({
      code: 'STRUCTURAL_TEMPLATE_CONVERGENCE',
      severity: 'fail',
      message: `${structuralConvergence.matchedAxes.length} identity-bearing axes (${structuralConvergence.matchedAxes.join(', ')}) match run "${structuralConvergence.closestPeer}" exactly. This is convergence on a specific prior build, not a family resemblance.`,
      evidence: `Matched axes: ${structuralConvergence.matchedAxes.join(', ')}; peer: ${structuralConvergence.closestPeer}`,
    });
  }

  const fails = flags.filter((f) => f.severity === 'fail');
  const warnings = flags.filter((f) => f.severity === 'warning');

  const passed = fails.length === 0;
  const score = Math.max(0, 100 - fails.length * 30 - warnings.length * 10);

  logger.info('Anti-AI-Generic Gate result', {
    passed,
    score,
    failsCount: fails.length,
    warningsCount: warnings.length,
    structuralConvergence,
  });

  return {
    passed,
    score,
    flags,
    structuralConvergence,
  };
}
