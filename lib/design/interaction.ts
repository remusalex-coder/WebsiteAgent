/**
 * Interaction strategy — how much the page moves and responds, decided
 * independently of the renderer.
 *
 * The renderer owns *what* an interaction looks like; this owns *how much* a
 * business's page should have, and why. Keeping it separate means the decision
 * is reviewable as a design judgement, and means a future runtime can read a
 * single field instead of re-deriving intent from a dozen tokens.
 *
 * ## Conservative by construction
 *
 * The ladder is `static → subtle → guided → immersive`, and it only ever climbs
 * when the evidence and the constraints both allow it. `immersive` is defined
 * but **never selected in V1**: a genuinely immersive, scroll-choreographed page
 * needs the client runtime the static renderer does not yet have (see the
 * experience-runtime audit), so the planner caps at `guided` and says so. That
 * is the honest floor — the system knows the top rung exists and knows it cannot
 * stand on it yet.
 *
 * Reduced motion is not a downgrade decided here — the renderer already honours
 * `prefers-reduced-motion` at the token level. This field is the *intended*
 * ceiling for a visitor who has expressed no preference.
 */

import type { BusinessCharacter } from './character.js';
import type { ExperienceArchitecture } from './experience.js';
import type { WebsiteContent } from '../types.js';

export type InteractionLevel = 'static' | 'subtle' | 'guided' | 'immersive';

export interface InteractionStrategy {
  readonly level: InteractionLevel;
  /** The rung the evidence would support if the runtime existed. */
  readonly ceiling: InteractionLevel;
  readonly basis: 'evidence' | 'creative-default';
  readonly rationale: string;
  readonly evidence: readonly string[];
}

export interface InteractionContext {
  /** From `AccessibilityPreferences.respectReducedMotion` — always true today. */
  readonly respectsReducedMotion: boolean;
}

const RANK: Readonly<Record<InteractionLevel, number>> = {
  static: 0, subtle: 1, guided: 2, immersive: 3,
};
const BY_RANK: readonly InteractionLevel[] = ['static', 'subtle', 'guided', 'immersive'];

/**
 * Plans the interaction level.
 *
 * The ambition comes from character × experience; the reachable level is that
 * ambition capped by what the renderer can actually deliver today (`guided`).
 * A thin or functional business gets `static` — motion on a page with nothing
 * to reveal is decoration, which the master prompt forbids.
 */
/** A validated Director override for the interaction ceiling. */
export interface InteractionOverride {
  readonly level?: InteractionLevel | undefined;
}

export function planInteraction(
  character: BusinessCharacter,
  experience: ExperienceArchitecture,
  content: WebsiteContent,
  ctx: InteractionContext,
  override?: InteractionOverride,
): InteractionStrategy {
  const sectionCount = content.sections.length;
  const imageRich = character.visualWeight === 'image-led' && character.atmosphereRange >= 3;
  const evidence: string[] = [
    `mode:${experience.mode}`,
    `visualWeight:${character.visualWeight}`,
    `sections:${sectionCount}`,
    `atmosphere:${character.atmosphereRange}`,
  ];

  // --- Ambition (what the evidence wants) ------------------------------
  let ceiling: InteractionLevel;
  if (experience.mode === 'narrative' && imageRich && sectionCount >= 6) {
    ceiling = 'immersive'; // what it *wants*; capped below
  } else if (experience.mode === 'narrative' || experience.mode === 'showcase') {
    ceiling = 'guided';
  } else if (character.visualWeight !== 'text-led' && sectionCount >= 4) {
    ceiling = 'subtle';
  } else {
    ceiling = 'static';
  }

  // --- Reachable level (what the renderer can deliver today) -----------
  // Cap at `guided`: `immersive` needs a runtime that does not exist yet.
  const RENDERER_CEILING: InteractionLevel = 'guided';
  let level = BY_RANK[Math.min(RANK[ceiling], RANK[RENDERER_CEILING])] ?? 'static';

  // A validated Director override, still capped at what the renderer can deliver.
  if (override?.level !== undefined) {
    const capped = BY_RANK[Math.min(RANK[override.level], RANK[RENDERER_CEILING])] ?? level;
    if (capped !== level) { evidence.push(`override:level=${override.level}`); level = capped; }
  }

  // --- Accessibility / conservative fallback ---------------------------
  // The intended ceiling never lies about reduced-motion — the renderer drops
  // motion for those visitors regardless — but a business that expressed no
  // strong signal stays conservative rather than ambitious.
  const basis: 'evidence' | 'creative-default' =
    character.narrativePotential === 'none' ? 'creative-default' : 'evidence';

  if (!ctx.respectsReducedMotion) {
    // Defensive: the pipeline always respects it, but if a future config did
    // not, the safe interaction is the lower one.
    level = BY_RANK[Math.min(RANK[level], RANK.subtle)] ?? 'static';
  }

  const rationale =
    ceiling === 'immersive'
      ? `Interaction capped at ${level}: the evidence supports an immersive experience, but the renderer runtime for it does not exist yet — so the page uses ${level} and the ambition is recorded.`
      : `Interaction ${level}: a ${experience.mode} page with ${character.visualWeight} weight over ${sectionCount} sections.`;

  return { level, ceiling, basis, rationale, evidence };
}
