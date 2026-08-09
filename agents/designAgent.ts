/**
 * Stage 5b of 6.
 *
 * Single responsibility: decide how the site should look. It sits between the
 * writer, which decides what the site says, and the renderer, which executes
 * both — and it is what stops the renderer from making visual decisions of its
 * own.
 *
 * Unlike the analyst and the writer, this agent makes **no model call**. The
 * contract is that identical inputs produce an identical `WebsiteDesign`, and a
 * model in the path would make that a promise about temperature settings rather
 * than a property of the code. It needs no API key, no network and no browser,
 * so it runs anywhere the pipeline does.
 *
 * When a `DesignDirective` is supplied (produced by `designDirectorAgent`), it
 * is translated to `ComposeOptions` via `applyDirective()` before being passed
 * to `composeDesign`. Operator direction overrides (from feature flags) always
 * take precedence over the directive — `applyDirective` enforces this.
 *
 * When no directive is supplied (director disabled or not yet run), the agent
 * behaves exactly as it did before the Director integration.
 */

import { composeDesign } from '../lib/design/index.js';
import { applyDirective } from '../lib/design/directive.js';

import type {
  Agent,
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  WebsiteContent,
} from '../lib/types.js';
import type { ComposeOptions } from '../lib/design/compose.js';
import type { DesignDirective } from '../lib/design/directive.js';
import type { DesignDirection, WebsiteDesign } from '../lib/design/index.js';

const NAME = 'designAgent';

export interface DesignInput {
  /** The facts, each with its source. */
  readonly profile: BusinessProfile;
  /** What the site should do, and why. */
  readonly strategy: BusinessStrategy;
  /** What the site says. Never modified — only read. */
  readonly content: WebsiteContent;
  /**
   * Optional AI design directive from `designDirectorAgent`.
   *
   * When present, translated to `ComposeOptions` via `applyDirective()`.
   * When absent (director disabled or not yet run), the deterministic
   * design composition runs with no AI guidance — identical to pre-integration
   * behaviour.
   *
   * The operator's `design-direction-*` feature flag always wins over the
   * directive: `applyDirective` enforces this precedence.
   */
  readonly directive?: DesignDirective | undefined;
}

export interface DesignAgent extends Agent<DesignInput, WebsiteDesign> {}

/**
 * Reads an optional direction override from configuration.
 *
 * Kept as a feature flag rather than a config field so trying a business in a
 * different direction costs an environment variable rather than a code change.
 * An unrecognised name is ignored with a warning rather than failing the run —
 * a typo in an override should not cost a scrape.
 */
function directionOverride(ctx: AgentContext): DesignDirection | undefined {
  const raw = Object.keys(ctx.config.features)
    .find((flag) => flag.startsWith('design-direction-'));
  if (raw === undefined || ctx.config.features[raw] !== true) return undefined;

  const name = raw.slice('design-direction-'.length) as DesignDirection;
  return name;
}

export const designAgent: DesignAgent = {
  name: NAME,
  description: 'Decides the visual system: direction, tokens, layout variants and section order.',

  async run(input: DesignInput, ctx: AgentContext): Promise<WebsiteDesign> {
    const override = directionOverride(ctx);

    // Operator direction override takes precedence over any directive value.
    // applyDirective enforces this: operatorOptions.direction always wins.
    const operatorOptions: ComposeOptions = override === undefined ? {} : { direction: override };
    const composeOptions = applyDirective(input.directive, operatorOptions, ctx.logger);

    const design = composeDesign(
      { profile: input.profile, strategy: input.strategy, content: input.content },
      composeOptions,
    );

    ctx.logger.info('design composed', {
      direction: design.personality.direction,
      industry: design.industry.id,
      industryBasis: design.industry.basis,
      hero: design.layout.hero,
      sections: design.layout.sections.length,
      density: design.personality.density,
      directorEnabled: input.directive !== undefined,
    });

    // Compromises are reported, never thrown: an unreachable contrast target or
    // a section too thin for a rich layout should surface in the run log, not
    // cost the run its output.
    for (const note of design.notes) {
      ctx.logger.warn('design note', { note });
    }

    return design;
  },
};
