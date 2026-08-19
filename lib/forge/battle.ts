/**
 * Design Battle — 2–3 genuinely independent Experience Signature builds,
 * compared and reduced to one winner.
 *
 * "Genuinely different" is not asserted, it is measured the same way a
 * single build's structural gate already measures it: each candidate is
 * written to its own subdirectory under a shared parent, so
 * `auditAntiAIGeneric`'s existing `checkStructuralConvergence` peer scan
 * — unmodified, not a second comparator — sees every earlier candidate as
 * a real peer. Two candidates that converge on the same central mechanism,
 * metaphor, layout sequence, interaction patterns and palette are caught
 * by exactly the mechanism that already catches convergence against a
 * whole corpus of prior runs.
 *
 * The winner is selected with `lib/qa/verdict.ts`'s existing lexicographic
 * comparator (F-06) via `forgeVerdictableCandidate` — the same rule a
 * single build's `computeForgeVerdict` already applies, just run across N
 * candidates instead of one. No second scoring system.
 *
 * Cost is real: each candidate is a full signature + blueprint + two-pass
 * build + capture + critique, i.e. the entire cost of one normal Forge run,
 * multiplied by however many candidates are requested. `candidateCount`
 * defaults to 2, not the "2-3" a director brief might ask for, because a
 * default that silently triples spend is exactly the zero-cost-safety
 * failure this session's other work was about preventing.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { formulateExperienceSignature } from './signature.js';
import { compileBlueprint } from './blueprint.js';
import { buildFrontend } from './builder.js';
import { auditAntiAIGeneric } from './anti-ai-gate.js';
import { captureSite } from './browser.js';
import { evaluateVision } from './critic.js';
import { forgeVerdictableCandidate } from './verdict.js';
import { combineVerdicts, selectBestVerdict } from '../qa/verdict.js';

import type { CombinedVerdict, VerdictableCandidate } from '../qa/verdict.js';
import type {
  AntiAIGateResult,
  ExperienceBlueprint,
  ExperienceSignature,
  FactualDossier,
  ForgeRouting,
  GeneratedCode,
  VisionCritiqueReport,
} from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

export interface BattleOptions {
  readonly dossier: FactualDossier;
  readonly config: AppConfig;
  readonly routing: ForgeRouting;
  /** The battle's own run directory; candidates live under `<runDir>/candidates/`. */
  readonly runDir: string;
  readonly logger: Logger;
  /** Defaults to 2 — see the module docstring on why this is not 3 by default. */
  readonly candidateCount?: number;
}

export interface BattleCandidate {
  readonly id: string;
  readonly signature: ExperienceSignature;
  readonly blueprint: ExperienceBlueprint;
  readonly code: GeneratedCode;
  readonly antiAiGate: AntiAIGateResult;
  readonly critique: VisionCritiqueReport;
  readonly verdict: CombinedVerdict;
  readonly screenshots: { readonly desktop: string; readonly mobile: string };
}

export interface BattleResult {
  readonly candidates: readonly BattleCandidate[];
  readonly winner: BattleCandidate | null;
  /** True when every candidate FAILed its own verdict — the signal to regenerate, not deliver the least-bad option. */
  readonly allCandidatesWeak: boolean;
  /** Set when the structural gate caught two candidates converging on each other — the battle produced variations, not real directions. */
  readonly convergenceWarning: string | null;
}

export async function runExperienceBattle(options: BattleOptions): Promise<BattleResult> {
  const { dossier, config, routing, runDir, logger } = options;
  const candidateCount = options.candidateCount ?? 2;
  const candidatesDir = path.join(runDir, 'candidates');
  await fs.mkdir(candidatesDir, { recursive: true });

  const candidates: BattleCandidate[] = [];
  const verdictable: VerdictableCandidate[] = [];
  let convergenceWarning: string | null = null;

  for (let i = 0; i < candidateCount; i++) {
    const id = `candidate-${i}`;
    const candidateDir = path.join(candidatesDir, id);
    const candidateForgeDir = path.join(candidateDir, 'forge');
    const candidateSiteDir = path.join(candidateDir, 'site');
    await fs.mkdir(candidateForgeDir, { recursive: true });
    await fs.mkdir(candidateSiteDir, { recursive: true });

    logger.info(`Battle: formulating candidate ${i + 1}/${candidateCount}`, { id });
    const { signature } = await formulateExperienceSignature(dossier, config, routing, logger.child(id));
    await fs.writeFile(path.join(candidateForgeDir, '3-signature.json'), JSON.stringify(signature, null, 2), 'utf8');

    const blueprint = compileBlueprint(dossier, signature, logger.child(id));
    const code = await buildFrontend(blueprint, candidateDir, config, routing, logger.child(id));

    const antiAiGate = await auditAntiAIGeneric({
      code,
      blueprint,
      outputDir: candidatesDir,
      runId: id,
      logger: logger.child(id),
    });
    if (antiAiGate.structuralConvergence?.verdict === 'TEMPLATE_CONVERGENCE') {
      convergenceWarning = `${id} converged with ${antiAiGate.structuralConvergence.closestPeer} on ${antiAiGate.structuralConvergence.matchedAxes.length} identity axes (${antiAiGate.structuralConvergence.matchedAxes.join(', ')}) — these are variations on one idea, not distinct directions.`;
    }

    const capture = await captureSite(candidateSiteDir, candidateDir, logger.child(id));
    const critique = await evaluateVision({
      desktopShotPath: capture.desktop,
      mobileShotPath: capture.mobile,
      businessName: blueprint.brandName,
      signature: blueprint.signature,
      config,
      capabilities: routing.capabilities,
      logger: logger.child(id),
    });

    const candidateVerdictable = forgeVerdictableCandidate(id, i, antiAiGate, critique);
    verdictable.push(candidateVerdictable);

    candidates.push({
      id,
      signature,
      blueprint,
      code,
      antiAiGate,
      critique,
      verdict: combineVerdicts(candidateVerdictable),
      screenshots: { desktop: capture.desktop, mobile: capture.mobile },
    });

    logger.info(`Battle: candidate ${i + 1}/${candidateCount} complete`, {
      id,
      verdict: candidates[candidates.length - 1]!.verdict.verdict,
      quality: candidates[candidates.length - 1]!.verdict.quality,
    });
  }

  const allCandidatesWeak = candidates.every((c) => c.verdict.verdict === 'FAIL');
  const best = selectBestVerdict(verdictable);
  const winner = allCandidatesWeak ? null : (best ? candidates.find((c) => c.id === best.id) ?? null : null);

  logger.info('Battle complete', {
    candidateCount,
    winner: winner?.id ?? null,
    allCandidatesWeak,
    convergenceWarning,
  });

  return { candidates, winner, allCandidatesWeak, convergenceWarning };
}
