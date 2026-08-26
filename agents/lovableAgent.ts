/**
 * Stage 6 of 6 — deploy.
 *
 * Single responsibility: get the finished, rendered site live. It is the only
 * agent that knows a deploy host exists. The Lovable stub was replaced by a
 * real Netlify "Drop" deploy (`lib/deploy/netlify.ts`): the rendered `site/`
 * directory is zipped and uploaded verbatim, so what ships is exactly what
 * `renderSite` produced — no second rendering system.
 *
 * It makes no content decisions. If a field is missing from the spec, that is
 * the writer's problem, not this agent's to paper over.
 *
 * The deploy target is the switch: `NETLIFY_DEPLOY_TOKEN` unset → the deploy
 * is `skipped` (never `failed`), so a run that produced a working site and was
 * never asked to publish it is not recorded as broken.
 */

import path from 'node:path';

import { deployToNetlify } from '../lib/deploy/netlify.js';
import type { Agent, AgentContext, DeploymentResult, WebsiteContent } from '../lib/types.js';

const NAME = 'lovableAgent';

export interface LovableAgent extends Agent<WebsiteContent, DeploymentResult> {}

export const lovableAgent: LovableAgent = {
  name: NAME,
  description: 'Deploys the rendered website to Netlify (Drop), returning a live URL.',

  async run(_input: WebsiteContent, ctx: AgentContext): Promise<DeploymentResult> {
    const siteDir = path.join(ctx.outputDir, 'site');
    return deployToNetlify(siteDir, ctx.config, {
      signal: ctx.signal,
      logger: {
        info: (m) => ctx.logger.info(m),
        warn: (m) => ctx.logger.warn(m),
      },
    });
  },
};
