/**
 * Stage 4 of 5.
 *
 * Single responsibility: turn the canonical business profile into a complete
 * website spec — structure, copy, brand voice, SEO. This is the only agent
 * that talks to an LLM, and the only one that produces prose.
 *
 * It never browses and never deploys. Its output is design-tool agnostic: the
 * same `WebsiteContent` could be handed to Lovable, a static generator, or a
 * human designer.
 */

import { NotImplementedError } from '../lib/errors.js';
import type { Agent, AgentContext, BusinessProfile, WebsiteContent } from '../lib/types.js';

const NAME = 'writerAgent';

export interface WriterAgent extends Agent<BusinessProfile, WebsiteContent> {}

export const writerAgent: WriterAgent = {
  name: NAME,
  description: 'Writes site structure, copy, brand voice, and SEO from the business profile.',

  async run(_input: BusinessProfile, _ctx: AgentContext): Promise<WebsiteContent> {
    // TODO
    //  1. Choose a section layout from the business category — a restaurant
    //     gets `menu`, a contractor gets `services`.
    //  2. Derive brand voice (tone, palette, typography) from category and any
    //     existing site copy in `input.pages`.
    //  3. Generate copy per section under a strict no-invention rule: every
    //     claim must be grounded in `input`, which carries a source for each
    //     field precisely so a claim can be traced back.
    //  4. Build SEO metadata and a LocalBusiness JSON-LD payload from the
    //     verified name, address, hours, and rating.
    //  5. Respect `input.validation`: a profile with errors is missing
    //     something a site needs, and the gap belongs in `unresolvedGaps`
    //     rather than being filled with plausible-sounding filler.
    throw new NotImplementedError('writerAgent.run', NAME);
  },
};
