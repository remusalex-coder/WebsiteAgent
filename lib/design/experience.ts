/**
 * Experience architecture — the arc a page walks, decided from character.
 *
 * ## The gap this closes
 *
 * A brochure is a list of sections; an experience is a sequence with a shape.
 * The section engine (`layout.ts`) is already good at the *inside* of a
 * section — which variant, which frame, how much emphasis — but nothing above
 * it decides whether the page as a whole is a quiet directory or a built arc
 * with a peak. `worlds.ts` gives a colour journey; this gives a *narrative*
 * one: how much the page leads with imagery, whether it has a signature moment,
 * and how it paces toward it.
 *
 * Crucially it does this by choosing values the renderer already understands —
 * emphasis, full-bleed, the moment marker, the transition primitive, density.
 * There is no new renderer primitive here, no new section, no decorative
 * motion. The novelty is entirely in the *orchestration*: turning evidence-read
 * character into a coherent set of layout decisions instead of a category
 * default. See docs and ADR for why the audit named this "connective tissue".
 *
 * ## Modes
 *
 * - `brochure`   — a clear, functional directory. The correct answer for a
 *                  plumber, a notary, a thin profile. No moment, compact pacing.
 * - `showcase`   — the business leads with imagery. The gallery becomes the
 *                  subject (lead emphasis, full-bleed), pacing opens up, but the
 *                  page is still a set of strong sections, not a story.
 * - `narrative`  — the evidence supports an arc. A signature moment is built to,
 *                  marked by the transition primitive, over cinematic pacing.
 * - `immersive`  — reserved. A continuous scroll-as-time experience (Bakery V2)
 *                  needs a client runtime the static renderer does not have, so
 *                  this mode is defined but never selected in V1. Declaring it
 *                  keeps the ladder honest: the system knows the rung exists and
 *                  knows it cannot reach it yet.
 */

import type { BusinessCharacter } from './character.js';
import type { SectionKind, WebsiteContent } from '../types.js';
import type { VisualDensity } from './types.js';

export type ExperienceMode = 'brochure' | 'showcase' | 'narrative' | 'immersive';

/** How the page spends vertical space and attention. */
export type Pacing = 'compact' | 'measured' | 'cinematic';

export interface ExperienceArchitecture {
  readonly mode: ExperienceMode;
  /**
   * The section built to, checked against real content. `null` unless the mode
   * is `narrative` and the business actually has the candidate section.
   */
  readonly signatureMoment: SectionKind | null;
  /** Whether the renderer's transition primitive marks the moment's entry. */
  readonly momentTransition: boolean;
  /** Whether the gallery is promoted to the page's subject (lead + full-bleed). */
  readonly galleryLead: boolean;
  readonly pacing: Pacing;
  readonly rationale: string;
  readonly evidence: readonly string[];
}

/** Pacing narrows or opens the base density by one step. */
export function densityForPacing(base: VisualDensity, pacing: Pacing): VisualDensity {
  const order: readonly VisualDensity[] = ['airy', 'balanced', 'dense'];
  const i = order.indexOf(base);
  if (pacing === 'cinematic') return order[Math.max(0, i - 1)] ?? base; // airier
  if (pacing === 'compact') return order[Math.min(order.length - 1, i + 1)] ?? base; // denser
  return base;
}

/**
 * Plans the experience architecture for a page.
 *
 * Reads character first, content second: character decides the *ambition* and
 * content decides what is *reachable*. A business whose character says
 * "narrative" but whose content carries no gallery cannot have a gallery-led
 * arc, and degrades to showcase or brochure rather than nominating a section
 * that is not there — the same discipline `planLayout` already applies to the
 * moment nomination.
 */
/**
 * A validated override from the AI Director. Only `mode` is honoured today; the
 * rest of the architecture is re-derived from the overridden mode so the result
 * stays internally consistent (a `brochure` never keeps a gallery lead). The
 * Director reaches this only through `applyDirective`, which validates the value
 * against the closed set first — no raw model output crosses this boundary.
 */
export interface ExperienceOverride {
  readonly mode?: ExperienceMode | undefined;
}

export function planExperience(
  character: BusinessCharacter,
  content: WebsiteContent,
  override?: ExperienceOverride,
): ExperienceArchitecture {
  const kinds = new Set(content.sections.map((s) => s.kind));
  const hasGallery = kinds.has('gallery');
  const evidence: string[] = [
    `visualWeight:${character.visualWeight}`,
    `register:${character.emotionalRegister}`,
    `narrative:${character.narrativePotential}`,
    `atmosphere:${character.atmosphereRange}`,
  ];

  // --- Mode ------------------------------------------------------------
  // The ladder: strong narrative potential earns `narrative`; leading with
  // imagery earns `showcase`; everything else is an honest `brochure`.
  // `immersive` is intentionally unreachable in V1 (no runtime).
  let mode: ExperienceMode;
  if (
    character.narrativePotential === 'strong'
    && character.signatureCandidate !== null
    && kinds.has(character.signatureCandidate)
  ) {
    mode = 'narrative';
  } else if (
    // Image-led earns a showcase outright; a "balanced" business earns one too
    // when it actually has photography to show (a gallery) and a register that
    // wants to show it — a restaurant with four dishes and a room is a showcase,
    // a mechanic with a logo is not.
    (character.visualWeight === 'image-led' && character.atmosphereRange >= 2)
    || (character.visualWeight === 'balanced' && hasGallery && character.atmosphereRange >= 2
      && character.emotionalRegister !== 'functional')
  ) {
    mode = 'showcase';
  } else {
    mode = 'brochure';
  }

  // A validated Director override replaces the floor's mode. `immersive` is
  // capped to `narrative` — the runtime for it does not exist yet — so the
  // Director cannot promise more than the renderer can keep.
  if (override?.mode !== undefined) {
    const requested = override.mode === 'immersive' ? 'narrative' : override.mode;
    if (requested !== mode) {
      evidence.push(`override:mode=${override.mode}${override.mode === 'immersive' ? '(capped:narrative)' : ''}`);
      mode = requested;
    }
  }

  // --- Signature moment ------------------------------------------------
  const signatureMoment: SectionKind | null =
    mode === 'narrative' && character.signatureCandidate !== null
      && kinds.has(character.signatureCandidate)
      ? character.signatureCandidate
      : null;

  // --- Gallery lead ----------------------------------------------------
  // The single change that makes an image-led page read as a showcase rather
  // than a brochure with pictures: the photographs become the subject. Only
  // when there is a gallery and enough in it to fill a lead treatment.
  const galleryLead = (mode === 'showcase' || mode === 'narrative')
    && hasGallery && character.atmosphereRange >= 2;

  // --- Pacing ----------------------------------------------------------
  const pacing: Pacing =
    mode === 'narrative' ? 'cinematic'
      : mode === 'showcase' ? 'measured'
        : 'compact';

  // --- Transition ------------------------------------------------------
  // A transition is earned only by a real moment in a narrative — never as
  // decoration, per the master prompt's rule against motion for its own sake.
  const momentTransition = mode === 'narrative' && signatureMoment !== null;

  const rationale =
    mode === 'brochure'
      ? `Brochure: ${character.visualWeight}, ${character.narrativePotential} narrative potential — a clear, functional page is the honest answer.`
      : mode === 'showcase'
        ? `Showcase: image-led with ${character.atmosphereRange} visual movements — the photography leads, the gallery becomes the subject.`
        : `Narrative: strong potential around the ${signatureMoment} section — the page builds to it over cinematic pacing and marks its entry.`;

  return { mode, signatureMoment, momentTransition, galleryLead, pacing, rationale, evidence };
}
