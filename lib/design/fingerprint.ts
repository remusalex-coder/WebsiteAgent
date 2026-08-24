/**
 * Design fingerprint (Freeze N-16, P5-1, F-09).
 *
 * Three levels of identity for a design:
 *
 *   - **L1** — computable **from a directive alone**, before building or
 *     calling a model. Because `composeDesign` is deterministic, the
 *     directive's decision surface determines the design's: L1(directive) ===
 *     L1(built design) for the same decisions (P5-1's equality test). This is
 *     what F-09 means by "divergence filtered before generation ... this is
 *     free" — the filter runs on L1 hashes, before any render and before any
 *     model call.
 *   - **L2** — the fingerprint of the *composed* design: the structural
 *     decisions the renderer will act on (direction, world, patterns, section
 *     variants, experience mode, interaction level). Two designs that differ
 *     only in rationale hash differently at L1? No — rationale is excluded
 *     from L1 so reconcepting on feedback produces the same L1 when the
 *     decisions are the same. L2 is where a genuinely new design becomes a
 *     genuinely different hash.
 *   - **L3** — the fingerprint of the *rendered artifact*: the pixels a visitor
 *     sees. Two L2-identical designs can still render differently through the
 *     content; L3 is what the visual-regression gate diffs.
 *
 * Every fingerprint is a stable SHA-256 over a canonical JSON projection. The
 * same inputs always produce the same hash, across runs, on any machine.
 */

import { createHash } from 'node:crypto';

import type { DesignDirective, ExperienceIntent } from './directive.js';
import type { WebsiteDesign } from './types.js';
import type { SectionKind } from '../types.js';
import type { ExperienceMode } from './experience.js';
import type { ConversionMode } from './conversion.js';
import type { InteractionLevel } from './interaction.js';

const SOURCE = 'design.fingerprint';

/** A stable hash over a canonical JSON serialisation. */
export function hashParts(parts: readonly unknown[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(JSON.stringify(part ?? null));
    hash.update('\u0000');
  }
  return hash.digest('hex');
}

/**
 * The directive's decision surface — the closed-set values that
 * deterministically reach `composeDesign` and are recorded verbatim on the
 * built design. These are the *only* fields L1 hashes, because L1 must be
 * computable from a directive and must equal the built design's fingerprint:
 *
 *   - `direction`            → `personality.direction`
 *   - `experienceMode`       → `experience.mode`
 *   - `conversionMode`       → `conversion.mode`
 *   - `interactionLevel`     → `interaction.level`
 *   - `moment`               → `experience.signatureMoment` (resolved the same
 *                              way `applyDirective` resolves it: an explicit
 *                              `signatureMoment` outranks the older
 *                              `experienceIntent.moment`)
 *   - `accessibilityTarget`  → `accessibility.targetLevel` (resolved the same
 *                              way `applyDirective` resolves it:
 *                              `colorStrategy: 'high-contrast'` forces AAA)
 *
 * Deliberately excluded: rationale, confidence, visualIntent, layoutIntent,
 * the creative-thesis prose, `density` (advisory in V1 — the deterministic
 * system still controls it from direction × industry × section count),
 * `heroIntent.preference` (the layout planner has final say) and `pacing`/
 * `imageryStrategy` (advisory this version). None of those reach the design
 * verbatim, so hashing them would break the equality P5-1 asserts.
 */
export interface DirectiveDecisions {
  readonly direction: string | null;
  readonly experienceMode: ExperienceMode | null;
  readonly conversionMode: ConversionMode | null;
  readonly interactionLevel: InteractionLevel | null;
  readonly moment: SectionKind | null;
  readonly accessibilityTarget: 'AA' | 'AAA' | null;
}

/** The same resolution `applyDirective` uses: explicit signatureMoment wins. */
function resolvedMoment(directive: DesignDirective): SectionKind | null {
  if (directive.signatureMoment !== undefined && directive.signatureMoment !== null) {
    return directive.signatureMoment;
  }
  const intent = directive.experienceIntent;
  if (intent !== undefined && intent.mode === 'moment-led' && intent.moment !== null) {
    return intent.moment;
  }
  return null;
}

/** The same resolution `applyDirective` uses: high-contrast forces AAA. */
function resolvedAccessibility(directive: DesignDirective): 'AA' | 'AAA' | null {
  if (directive.colorStrategy === 'high-contrast') return 'AAA';
  return directive.accessibilityTarget ?? null;
}

/** Projects a directive onto its decision surface. Pure and total. */
export function decisionsFromDirective(directive: DesignDirective): DirectiveDecisions {
  return {
    direction: directive.direction ?? null,
    experienceMode: directive.experienceMode ?? null,
    conversionMode: directive.conversionStrategy ?? null,
    interactionLevel: directive.interactionStrategy ?? null,
    moment: resolvedMoment(directive),
    accessibilityTarget: resolvedAccessibility(directive),
  };
}

/**
 * L1 fingerprint, from a directive. Computable with zero builds and zero model
 * calls — this is the pre-spend filter F-09 and P5-1 require.
 */
export function fingerprintDirective(directive: DesignDirective): string {
  return hashParts([decisionsFromDirective(directive)]);
}

/**
 * The L1 fingerprint of a *built* design — the same decision surface the
 * directive projected. P5-1's equality test asserts
 * `fingerprintDirective(d) === fingerprintDesign(designFrom(d))`.
 */
export function fingerprintDesign(design: WebsiteDesign): string {
  return hashParts([
    {
      direction: design.personality.direction,
      experienceMode: design.experience.mode,
      conversionMode: design.conversion.mode,
      interactionLevel: design.interaction.level,
      moment: design.experience.signatureMoment,
      accessibilityTarget: design.accessibility.targetLevel,
    },
  ]);
}

/**
 * Whether two directives share an L1 identity — the same decision surface.
 *
 * This is the diversity gate's core comparison: two directives with the same
 * L1 would render into structurally identical pages, so at most one of them
 * may proceed to spend a build.
 */
export function sameDecisionSurface(a: DesignDirective, b: DesignDirective): boolean {
  return fingerprintDirective(a) === fingerprintDirective(b);
}

/**
 * L2 fingerprint — the structural decisions of the *composed* design. Differs
 * from L1 because it includes what the deterministic system itself chose
 * (world, patterns, every section's variant and frame), not just what the
 * directive decided.
 */
export function fingerprintDesignStructure(design: WebsiteDesign): string {
  return hashParts([
    {
      direction: design.personality.direction,
      world: design.world,
      patterns: design.patterns,
      hero: design.layout.hero,
      footer: design.layout.footer,
      sections: design.layout.sections.map((s) => ({
        kind: s.kind,
        variant: s.variant,
        frame: s.frame,
        emphasis: s.emphasis,
        background: s.background,
        moment: s.momentTransition,
      })),
      experienceMode: design.experience.mode,
      interactionLevel: design.interaction.level,
    },
  ]);
}

/**
 * L3 fingerprint — the rendered artifact. Fed the content hash and the
 * structural fingerprint, so two builds of the same design over the same
 * content hash to the same L3, and any pixel-visible difference changes it.
 * The actual pixel diff is `lib/qa/visual-regression.ts`; this is the
 * content-addressed id the runner and memory can store without keeping bytes.
 */
export function fingerprintRendered(
  designStructureL2: string,
  contentHash: string,
  assetHash: string,
): string {
  return hashParts([designStructureL2, contentHash, assetHash]);
}

export const SOURCE_NAME = SOURCE;