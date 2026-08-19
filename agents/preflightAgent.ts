/**
 * The production preflight gate.
 *
 * Runs after the site is rendered and before deployment. Single
 * responsibility: inspect what this run actually produced — the profile, the
 * strategy, the content spec, the design and the rendered site — against the
 * launch-readiness and security checks in `lib/preflight/`, and report
 * whether it is fit to ship. It makes no content or design decisions of its
 * own; that is every earlier stage's job.
 *
 * Not an agent in the AI-calling sense — like `lib/render`, it needs no
 * model and no browser, only the artifacts already on disk. It takes an
 * `AgentContext` anyway because it persists an artifact and logs like every
 * other stage, and because a future check (a live HTTPS probe against a
 * deployed URL, say) would need `ctx.platform` without changing this file's
 * shape.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { runProductionPreflight } from '../lib/preflight/index.js';

import type { PreflightReport } from '../lib/preflight/index.js';
import type { RenderedSite } from '../lib/render/types.js';
import type {
  Agent,
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  WebsiteContent,
} from '../lib/types.js';
import type { WebsiteDesign } from '../lib/design/types.js';

const NAME = 'preflightAgent';

const ARTIFACT = 'preflight.json';

export interface PreflightAgentInput {
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
  readonly design: WebsiteDesign;
  readonly site: RenderedSite;
}

export interface PreflightAgent extends Agent<PreflightAgentInput, PreflightReport> {}

export const preflightAgent: PreflightAgent = {
  name: NAME,
  description: 'Runs the production-readiness and security gate against the rendered site before delivery.',

  async run(input: PreflightAgentInput, ctx: AgentContext): Promise<PreflightReport> {
    const { logger } = ctx;

    const report = await runProductionPreflight({
      runId: ctx.runId,
      profile: input.profile,
      strategy: input.strategy,
      content: input.content,
      design: input.design,
      site: input.site,
      config: ctx.config,
      outputDir: ctx.outputDir,
    });

    const filePath = path.join(ctx.outputDir, ARTIFACT);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    for (const result of report.results) {
      if (result.status !== 'FAIL' && result.status !== 'BLOCKED') continue;
      const fields = {
        id: result.id,
        category: result.category,
        status: result.status,
        severity: result.severity,
        evidence: result.evidence,
      };
      if (result.severity === 'critical') {
        logger.error('preflight check did not pass', fields);
      } else {
        logger.warn('preflight check did not pass', fields);
      }
    }

    logger.info('preflight finished', {
      total: report.summary.total,
      pass: report.summary.pass,
      fail: report.summary.fail,
      warn: report.summary.warn,
      notApplicable: report.summary.notApplicable,
      blocked: report.summary.blocked,
      blocksProduction: report.productionGate.blocksProduction,
      artifact: filePath,
    });

    return report;
  },
};
