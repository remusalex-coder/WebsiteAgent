/**
 * Stage 5 of 5.
 *
 * Single responsibility: get a finished `WebsiteContent` spec built and live
 * on Lovable. It is the only agent that knows Lovable exists — swapping the
 * build target means replacing this file and nothing else.
 *
 * It makes no content decisions. If a field is missing from the spec, that is
 * the writer's problem, not this agent's to paper over.
 */

import { NotImplementedError } from '../lib/errors.js';
import type { Agent, AgentContext, DeploymentResult, WebsiteContent } from '../lib/types.js';

const NAME = 'lovableAgent';

export interface LovableAgent extends Agent<WebsiteContent, DeploymentResult> {}

export const lovableAgent: LovableAgent = {
  name: NAME,
  description: 'Builds and deploys the website spec on Lovable, returning a live URL.',

  async run(_input: WebsiteContent, _ctx: AgentContext): Promise<DeploymentResult> {
    // TODO
    //  1. Serialise `WebsiteContent` into a build prompt — deterministic, so
    //     the same spec always produces the same prompt.
    //  2. Create the project (or reuse `config.lovable.projectId`) and submit
    //     the prompt.
    //  3. Poll build status until `live` or `failed`, bounded by
    //     `config.lovable.deployTimeoutMs` and cancellable via `ctx.signal`.
    //  4. Return the live and editor URLs alongside `promptUsed`, so a run is
    //     reproducible from its artifacts alone.
    throw new NotImplementedError('lovableAgent.run', NAME);
  },
};
