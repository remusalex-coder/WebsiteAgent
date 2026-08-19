/**
 * Autonomous Code Repair & Polish Engine (Signature Edition).
 *
 * Ingests the Vision Critic and Anti-AI Gate reports to refine the HTML, CSS, and JS code
 * in-place to fix detected visual, typographic, or restraint defects while preserving the Experience Signature.
 *
 * Routes through `structured_generation` rather than constructing a
 * provider directly, for the same reason `builder.ts` does — this is the
 * same "closed schema, arbitrary code" shape, just repairing rather than
 * authoring from scratch.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createModelInvoker } from '../capability/invokers.js';
import type { GeneratedCode, VisionCritiqueReport, ExperienceBlueprint, ForgeRouting } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

export interface RepairOptions {
  readonly siteDir: string;
  readonly blueprint: ExperienceBlueprint;
  readonly critique: VisionCritiqueReport;
  readonly iteration: number;
  readonly config: AppConfig;
  readonly routing: ForgeRouting;
  readonly logger: Logger;
}

export async function repairCode(options: RepairOptions): Promise<GeneratedCode> {
  const { siteDir, blueprint, critique, iteration, config, routing, logger } = options;

  const htmlPath = path.join(siteDir, 'index.html');
  const cssPath = path.join(siteDir, 'styles.css');
  const jsPath = path.join(siteDir, 'experience.js');

  const currentHtml = await fs.readFile(htmlPath, 'utf8');
  const currentCss = await fs.readFile(cssPath, 'utf8');
  const currentJs = await fs.readFile(jsPath, 'utf8');

  // If no issues or already high score, return existing
  if (critique.issues.length === 0 || critique.score >= 90) {
    logger.info('No critical repair needed; current code passes quality gate', {
      score: critique.score,
      verdict: critique.verdict,
    });
    return { html: currentHtml, css: currentCss, js: currentJs };
  }

  logger.info(`Executing autonomous code repair (Iteration ${iteration})`, {
    issuesCount: critique.issues.length,
    issues: critique.issues.map((i) => i.description),
  });

  const prompt = `You are a Principal Frontend Technologist and UI Polish Specialist.
Refine the provided HTML, CSS, and JS code to fix the issues identified by the Vision Critic while strictly preserving the Experience Signature and Restraint Contract.

BRAND: "${blueprint.brandName}"
CREATIVE METAPHOR: "${blueprint.signature.creativeMetaphor}"
SIGNATURE MOMENT: "${blueprint.signature.signatureMoment}"

RESTRAINT CONTRACT:
${blueprint.signature.restraintContract.forbiddenAntiPatterns.map((p) => `- DO NOT USE: ${p}`).join('\n')}

VISION CRITIQUE ISSUES TO FIX:
${critique.issues.map((issue, idx) => `${idx + 1}. [${issue.severity.toUpperCase()} in ${issue.area}]: ${issue.description}\n   Fix Instruction: ${issue.fixInstruction}`).join('\n\n')}

CURRENT HTML:
\`\`\`html
${currentHtml}
\`\`\`

CURRENT CSS:
\`\`\`css
${currentCss}
\`\`\`

CURRENT JS:
\`\`\`javascript
${currentJs}
\`\`\`

INSTRUCTIONS:
1. Apply the exact fixes required (e.g. increase contrast, refine typography scale, fix mobile card padding, polish layout rhythm).
2. Ensure everything remains self-contained, valid, clean, and modern.
3. Return JSON containing the updated "html", "css", and "js" strings.`;

  try {
    const invoke = createModelInvoker(
      {
        system:
          'You are an expert frontend engineer repairing and polishing code to achieve 100/100 visual and technical perfection.',
        prompt,
        schemaName: 'code_repair',
        effort: 'medium',
        maxTokens: 16000,
        modelOverrides: { [config.ai.provider]: config.writer.model || config.analyst.model },
        schema: {
          type: 'object',
          required: ['html', 'css', 'js'],
          properties: {
            html: { type: 'string' },
            css: { type: 'string' },
            js: { type: 'string' },
          },
        },
      },
      routing.providers,
      logger,
    );

    const outcome = await routing.capabilities.run('structured_generation', invoke, {
      tokens: { inputTokens: prompt.length / 4, outputTokens: 6_000 },
    });

    if (!outcome.outcome.ok) {
      throw new Error(`no vendor could repair the code: ${outcome.outcome.error.message}`);
    }

    const repaired = outcome.outcome.data.data as unknown as GeneratedCode;

    await fs.writeFile(htmlPath, repaired.html, 'utf8');
    await fs.writeFile(cssPath, repaired.css, 'utf8');
    await fs.writeFile(jsPath, repaired.js, 'utf8');

    logger.info('Autonomous code repair completed successfully', { iteration });
    return repaired;
  } catch (err) {
    logger.warn('Code repair failed, retaining current code', { err });
    return { html: currentHtml, css: currentCss, js: currentJs };
  }
}
