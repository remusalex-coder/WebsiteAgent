/**
 * Multi-Modal Vision QA Critic (Experience Signature Edition).
 *
 * Inspects rendered desktop and mobile screenshots using a Vision LLM,
 * evaluating against the 10 Awwwards criteria and answering the decisive
 * question: "Does this feel intentionally art-directed by a human designer
 * or AI-generated?"
 *
 * ## What this replaced
 *
 * The previous implementation called `postJson('openai', …)` directly against
 * `api.openai.com`, hardcoded to `gpt-4o-mini`, with no failover. Worse: on
 * *any* failure — no credential, a network error, a JSON parse failure, an
 * empty response — it returned a **hardcoded score of 88, verdict
 * `EXCEPTIONAL`, `feelsArtDirectedVsAi: 'INTENTIONALLY_ART_DIRECTED'`, zero
 * issues**, with `positiveHighlights` written for River Park Events
 * Drăgășani specifically ("Authentic ballroom photography"). Since the repair
 * loop's condition is `issues.length > 0 && score < 88`, that exact fallback
 * value never triggers a repair, on any business, regardless of what the page
 * actually looks like — a quality gate that cannot fail is not a gate. It
 * also never worked correctly for a Gemini-only deployment (no
 * `OPENAI_API_KEY`): it would send the Gemini key to OpenAI's endpoint,
 * fail auth, and land on the same fake pass.
 *
 * This now routes through `craft_judging`, the same capability the classic
 * pipeline's `analyzeCritiqueViaCapability` uses — real cross-vendor failover,
 * quota-aware, cost-tracked — with forge's own richer 10-axis schema (the
 * classic pipeline's `CRITIQUE_SCHEMA` is a different, coarser shape, so this
 * is not a duplicate critic, just the existing vision transport with this
 * pipeline's own prompt). On a genuine failure — every vision-capable vendor
 * unreachable — it returns an honestly uncertain report rather than a
 * fabricated pass: `HYBRID_SOME_GENERIC`, a below-threshold score, no
 * fabricated highlights, and zero issues (so the repair loop does not spend a
 * cycle "fixing" a page it never actually saw).
 */

import fs from 'node:fs/promises';

import { createVisionInvoker } from '../capability/visionInvoker.js';

import type { ExperienceSignature, VisionCritiqueReport } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { CapabilityOrchestrator } from '../capability/orchestrator.js';

const SOURCE = 'forge.critic';

const CRITIQUE_SCHEMA = {
  type: 'object',
  required: ['score', 'verdict', 'feelsArtDirectedVsAi', 'criteriaScores', 'positiveHighlights', 'issues'],
  properties: {
    score: { type: 'number', description: '0-100 overall.' },
    verdict: { type: 'string', enum: ['EXCEPTIONAL', 'POLISH_NEEDED', 'REPAIR_REQUIRED'] },
    feelsArtDirectedVsAi: {
      type: 'string',
      enum: ['INTENTIONALLY_ART_DIRECTED', 'HYBRID_SOME_GENERIC', 'OBVIOUSLY_AI_GENERATED'],
    },
    criteriaScores: {
      type: 'object',
      required: [
        'conceptualCoherence', 'businessSpecificity', 'humanArtDirection', 'visualHierarchy',
        'composition', 'interactionRestraint', 'memorability', 'distinctiveness',
        'factualFidelity', 'mobileExperience',
      ],
      properties: {
        conceptualCoherence: { type: 'number' },
        businessSpecificity: { type: 'number' },
        humanArtDirection: { type: 'number' },
        visualHierarchy: { type: 'number' },
        composition: { type: 'number' },
        interactionRestraint: { type: 'number' },
        memorability: { type: 'number' },
        distinctiveness: { type: 'number' },
        factualFidelity: { type: 'number' },
        mobileExperience: { type: 'number' },
      },
    },
    positiveHighlights: { type: 'array', items: { type: 'string' } },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['area', 'severity', 'description', 'fixInstruction'],
        properties: {
          area: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'enhancement', 'polish'] },
          description: { type: 'string' },
          fixInstruction: { type: 'string' },
        },
      },
    },
  },
} as const;

export interface CriticOptions {
  readonly desktopShotPath: string;
  readonly mobileShotPath: string;
  readonly businessName: string;
  readonly signature: ExperienceSignature;
  readonly config: AppConfig;
  readonly capabilities: CapabilityOrchestrator;
  readonly logger: Logger;
}

function buildPrompt(businessName: string, signature: ExperienceSignature): string {
  return `You are a legendary Awwwards Jury President and Design Critic reviewing desktop (first image) and mobile (second image) screenshots of a bespoke digital experience.

BUSINESS: "${businessName}"
CREATIVE METAPHOR: "${signature.creativeMetaphor}"
CENTRAL MECHANISM: "${signature.centralMechanism}"
SIGNATURE MOMENT: "${signature.signatureMoment}"

EVALUATE THE 10 CRITICAL AXES (0-10 each):
1. conceptualCoherence: Does every visible section serve the central metaphor?
2. businessSpecificity: Is this clearly built for this specific business, not a generic template?
3. humanArtDirection: Does the composition, typography, and spacing feel handcrafted by a human designer?
4. visualHierarchy: Are headlines, subtitles, and calls to action clear and well-prioritized?
5. composition: Is there generous breathing room, editorial balance, and asymmetry?
6. interactionRestraint: Is the design elegant and restrained, avoiding unnecessary flashy gimmicks?
7. memorability: Does the page leave a lasting emotional impression?
8. distinctiveness: Does it stand out distinctly from generic website builders?
9. factualFidelity: Does it accurately represent the verified business?
10. mobileExperience: Does the mobile layout stack gracefully without cramped text or clipping?

DECISIVE QUESTION:
Does this feel INTENTIONALLY_ART_DIRECTED, HYBRID_SOME_GENERIC, or OBVIOUSLY_AI_GENERATED?

Calculate overall score (0-100, sum of the ten axes), verdict (EXCEPTIONAL/POLISH_NEEDED/REPAIR_REQUIRED), positiveHighlights (strings, specific to what is actually visible), and specific code repair issues ({area, severity, description, fixInstruction}).

Respond with a single JSON object matching the required schema. No markdown, no prose outside the JSON.`;
}

/** Returned when no vision-capable vendor could be reached. Honest, never a fabricated pass. */
function uncertainReport(reason: string): VisionCritiqueReport {
  return {
    score: 50,
    verdict: 'POLISH_NEEDED',
    feelsArtDirectedVsAi: 'HYBRID_SOME_GENERIC',
    criteriaScores: {
      conceptualCoherence: 5, businessSpecificity: 5, humanArtDirection: 5, visualHierarchy: 5,
      composition: 5, interactionRestraint: 5, memorability: 5, distinctiveness: 5,
      factualFidelity: 5, mobileExperience: 5,
    },
    positiveHighlights: [],
    issues: [],
    rawNotes: `vision critique unavailable: ${reason}`,
  };
}

export async function evaluateVision(options: CriticOptions): Promise<VisionCritiqueReport> {
  const { desktopShotPath, mobileShotPath, businessName, signature, config, capabilities, logger } = options;

  logger.info('Evaluating visual quality & human art direction with Multi-Modal Vision Critic', { businessName });

  const [desktopB64, mobileB64] = await Promise.all([
    fs.readFile(desktopShotPath).then((b) => b.toString('base64')),
    fs.readFile(mobileShotPath).then((b) => b.toString('base64')),
  ]);

  const invoke = createVisionInvoker(
    {
      prompt: buildPrompt(businessName, signature),
      schema: CRITIQUE_SCHEMA,
      images: [
        { base64: desktopB64, mimeType: 'image/png' },
        { base64: mobileB64, mimeType: 'image/png' },
      ],
      maxTokens: 4_096,
      timeoutMs: 60_000,
    },
    config.ai,
    logger,
  );

  const { outcome, record } = await capabilities.run('craft_judging', invoke);

  logger.debug('craft_judging resolved', {
    servedBy: record.servedBy,
    attempts: record.attempts.length,
    degraded: record.degraded,
  });

  if (!outcome.ok) {
    logger.warn('vision critic could not reach any vendor', { error: outcome.error.message });
    return uncertainReport(outcome.error.message);
  }

  const parsed = outcome.data.data as Partial<VisionCritiqueReport> & { criteriaScores?: Record<string, number> };
  return {
    score: typeof parsed.score === 'number' ? parsed.score : 50,
    verdict: parsed.verdict ?? 'POLISH_NEEDED',
    feelsArtDirectedVsAi: parsed.feelsArtDirectedVsAi ?? 'HYBRID_SOME_GENERIC',
    criteriaScores: {
      conceptualCoherence: parsed.criteriaScores?.conceptualCoherence ?? 5,
      businessSpecificity: parsed.criteriaScores?.businessSpecificity ?? 5,
      humanArtDirection: parsed.criteriaScores?.humanArtDirection ?? 5,
      visualHierarchy: parsed.criteriaScores?.visualHierarchy ?? 5,
      composition: parsed.criteriaScores?.composition ?? 5,
      interactionRestraint: parsed.criteriaScores?.interactionRestraint ?? 5,
      memorability: parsed.criteriaScores?.memorability ?? 5,
      distinctiveness: parsed.criteriaScores?.distinctiveness ?? 5,
      factualFidelity: parsed.criteriaScores?.factualFidelity ?? 5,
      mobileExperience: parsed.criteriaScores?.mobileExperience ?? 5,
    },
    positiveHighlights: parsed.positiveHighlights ?? [],
    issues: parsed.issues ?? [],
  };
}

export const SOURCE_NAME = SOURCE;
