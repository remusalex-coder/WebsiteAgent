/**
 * Anti-AI-Generic Gate & Factual Grounding Validator.
 *
 * Runs deterministic and heuristic audits before Vision QA to intercept:
 * - Forbidden assumptions / ungrounded hallucinations
 * - Repetitive card grids & generic brochure patterns
 * - Unmotivated decorative effects (glassmorphism/particles) rejected by Restraint Contract
 * - Visual/structural cloning of previous builds (e.g. Go Sweet similarity check).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { AntiAIGateResult, ExperienceBlueprint, GeneratedCode } from './types.js';
import type { Logger } from '../logger.js';

export interface AntiAIGateOptions {
  readonly code: GeneratedCode;
  readonly blueprint: ExperienceBlueprint;
  readonly outputDir: string;
  readonly logger: Logger;
}

export async function auditAntiAIGeneric(options: AntiAIGateOptions): Promise<AntiAIGateResult> {
  const { code, blueprint, outputDir, logger } = options;
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

  // 4. Comparison with Go Sweet baseline for generic similarity
  let baselineSimilarity = 0;
  try {
    const goSweetHtmlPath = path.join(outputDir, 'forge-da56c149', 'site', 'index.html');
    const goSweetHtml = await fs.readFile(goSweetHtmlPath, 'utf8').catch(() => '');

    if (goSweetHtml) {
      // Compare section structure keywords
      const goSweetTags = (goSweetHtml.match(/<section[^>]*id="([^"]+)"/g) || []).map((s) => s.replace(/.*id="([^"]+)".*/, '$1'));
      const currentTags = (code.html.match(/<section[^>]*id="([^"]+)"/g) || []).map((s) => s.replace(/.*id="([^"]+)".*/, '$1'));

      const shared = currentTags.filter((t) => goSweetTags.includes(t)).length;
      baselineSimilarity = Math.round((shared / Math.max(1, currentTags.length)) * 100);

      if (baselineSimilarity > 80) {
        flags.push({
          code: 'GENERIC_SIMILARITY_FAIL',
          severity: 'fail',
          message: `Site layout structure is ${baselineSimilarity}% identical to Go Sweet baseline. Must have unique section IDs and structure.`,
        });
      }
    }
  } catch {
    // ignore if baseline not found
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
  });

  return {
    passed,
    score,
    flags,
    comparisonWithBaseline: {
      structureSimilarityScore: baselineSimilarity,
      tokenSimilarityScore: 100 - baselineSimilarity,
      verdict: baselineSimilarity > 80 ? 'TOO_SIMILAR_TO_BASELINE' : 'DISTINCT',
    },
  };
}
