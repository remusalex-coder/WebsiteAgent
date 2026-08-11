/**
 * The experience script — why a page's sections appear in the order they do.
 *
 * ## The gap this closes
 *
 * Until now the page order was `orderSections()`: a fixed industry-priority sort.
 * Every hotel got the same sequence; two hotels with different evidence got the
 * same sequence. Order carried no narrative — it was a filing order, not a story.
 *
 * An `ExperienceScript` is the story. It assigns each section a **narrative role**
 * (arrival, reveal, signature, breadth, proof, conversion, …) from the business's
 * character and evidence, then orders the page along a narrative spine rather than
 * a category list. A mechanic's page becomes arrival → process → breadth → proof →
 * conversion; a venue's becomes emotion → reveal → signature → space → breadth →
 * trust → conversion — and two businesses in the *same* industry diverge when
 * their evidence differs, because the roles are read from evidence, not category.
 *
 * ## What it is and is not
 *
 * It is a **data plan** the existing static renderer already realises: it produces
 * an order (indices into `WebsiteContent.sections`) plus per-beat narrative
 * metadata. It is **not** the scroll-as-time runtime — no new renderer, no motion.
 * Hero stays first and the closing CTA stays last (the renderer and the nav rely
 * on it); everything between them is where the narrative lives.
 *
 * Deterministic and €0. The AI Director can still override the *mode* upstream,
 * which changes role assignment here; this file adds no new model surface.
 */

import type { BusinessCharacter } from './character.js';
import type { ExperienceArchitecture, ExperienceMode, Pacing } from './experience.js';
import type { AssetChoreography } from './assets.js';
import type { ConversionStrategy } from './conversion.js';
import type { Emphasis, SectionBackground, SectionDesign } from './types.js';
import type { SectionKind, WebsiteContent } from '../types.js';

/**
 * The role a section plays in the narrative. Closed set.
 *
 * Not every business uses every role; the planner assigns only the roles the
 * evidence supports, so a thin page has a short, honest arc rather than a padded
 * one.
 */
export type NarrativeRole =
  | 'arrival'      // the opening for a functional page — orient the visitor
  | 'emotion'      // the opening for an experiential page — set a feeling first
  | 'reveal'       // the first turn: show what this place is
  | 'process'      // how the work is done — craft, method, expertise
  | 'signature'    // the one moment the page is built around
  | 'space'        // the rooms, the grounds, the surroundings
  | 'breadth'      // the range of what is offered
  | 'proof'        // evidence it is real and good (faq, credentials)
  | 'trust'        // social proof — testimonials, ratings
  | 'context'      // practical orientation — hours, location
  | 'conversion'   // the ask — contact, booking, the closing CTA
  | 'coda';        // a closing note

export type VisualIntensity = 'quiet' | 'measured' | 'loud';

export interface Beat {
  /** Index into `WebsiteContent.sections`. */
  readonly index: number;
  readonly kind: SectionKind;
  readonly role: NarrativeRole;
  readonly emphasis: Emphasis;
  readonly background: SectionBackground;
  readonly pacing: Pacing;
  readonly visualIntensity: VisualIntensity;
  readonly isTransition: boolean;
  readonly isSignature: boolean;
  readonly rationale: string;
}

export interface ExperienceScript {
  readonly mode: ExperienceMode;
  readonly beats: readonly Beat[];
  /** The role the page opens on. */
  readonly opening: NarrativeRole;
  /** The signature section kind, or null. */
  readonly signature: SectionKind | null;
  /** Beat position (0-based) where the first conversion beat lands. */
  readonly conversionAt: number;
  /** The narrative order as section kinds, for a human to read at a glance. */
  readonly arc: readonly NarrativeRole[];
  readonly basis: 'evidence' | 'creative-default';
  readonly rationale: string;
}

/* ------------------------------------------------------------------ */
/* Role assignment                                                     */
/* ------------------------------------------------------------------ */

/**
 * Assigns a narrative role to one section from character + experience.
 *
 * This is where two same-industry businesses diverge: the *same* `SectionKind`
 * gets a different role depending on the evidence. A gallery is a `signature`
 * for a business whose experience is built around it, a `reveal` for one that
 * merely leads with imagery, and a `space` for one where it only documents the
 * premises. An `about` is a `reveal` for an experiential business and `process`
 * for a functional one.
 */
export function roleFor(
  kind: SectionKind,
  character: BusinessCharacter,
  experience: ExperienceArchitecture,
): NarrativeRole {
  // The signature moment always wins, whatever the kind.
  if (experience.signatureMoment !== null && kind === experience.signatureMoment) return 'signature';

  const experiential = experience.mode === 'narrative' || experience.mode === 'showcase';
  const functional = character.emotionalRegister === 'functional' || character.visualWeight === 'text-led';

  switch (kind) {
    case 'hero': return experience.mode === 'narrative' ? 'emotion' : 'arrival';
    case 'statement': return 'reveal';
    case 'about': return functional ? 'process' : 'reveal';
    case 'gallery': return experiential ? 'reveal' : 'space';
    case 'menu': return 'breadth';
    case 'services': return 'breadth';
    case 'testimonials': return 'trust';
    case 'faq': return 'proof';
    case 'hours': return 'context';
    case 'location': return (experience.mode === 'narrative' || character.emotionalRegister === 'romantic') ? 'space' : 'context';
    case 'contact': return 'conversion';
    case 'cta': return 'conversion';
  }
}

/**
 * The narrative spine: where each role sits in the arc.
 *
 * Opening, then the turn, then the peak, then the substance, then proof, then the
 * ask. `arrival`/`emotion` share the front because a page opens once; the hero is
 * pinned there regardless. `conversion`/`coda` share the back.
 */
const ROLE_RANK: Readonly<Record<NarrativeRole, number>> = {
  arrival: 0, emotion: 0, reveal: 1, process: 2, signature: 3, space: 4,
  breadth: 5, proof: 6, trust: 6, context: 7, conversion: 8, coda: 9,
};

const INTENSITY: (e: Emphasis, bg: SectionBackground) => VisualIntensity = (e, bg) => {
  if (e === 'lead' || (e === 'primary' && (bg === 'inverted' || bg === 'brand'))) return 'loud';
  if (e === 'quiet') return 'quiet';
  return 'measured';
};

/**
 * Plans the narrative order.
 *
 * Returns the order (indices into `content.sections`) and the role of each. Hero
 * is pinned first and the closing CTA last — the renderer and the nav depend on
 * it — and the *middle* is sorted along the narrative spine, with a high-intent
 * business pulling its practical/conversion beats forward so a visitor who came
 * to act is not walked through a discovery arc first.
 */
export function planNarrativeOrder(
  content: WebsiteContent,
  character: BusinessCharacter,
  experience: ExperienceArchitecture,
  conversion: ConversionStrategy,
): { order: readonly number[]; roles: ReadonlyMap<number, NarrativeRole> } {
  const roles = new Map<number, NarrativeRole>();
  const indexed = content.sections.map((section, index) => {
    const role = roleFor(section.kind, character, experience);
    roles.set(index, role);
    return { index, kind: section.kind, role };
  });

  // A high-intent page compresses discovery: its `context` (hours/location) and
  // any non-closing `conversion` beat move toward the front, so the ask is never
  // buried behind a story the visitor did not come for. The closing CTA still
  // closes.
  const highIntent = conversion.mode === 'high-intent';

  const rankOf = (kind: SectionKind, role: NarrativeRole): number => {
    let r = ROLE_RANK[role];
    // A high-intent page moves the contact beat up to just after the offering —
    // "here is what we do, now call" — without pushing it ahead of the offering
    // itself. The closing CTA still closes; practical fine-print stays late.
    if (highIntent && role === 'conversion' && kind !== 'cta') r = 5.5;
    return r;
  };

  const order = indexed
    .slice()
    .sort((a, b) => {
      if (a.kind === 'hero' && b.kind !== 'hero') return -1;
      if (b.kind === 'hero' && a.kind !== 'hero') return 1;
      if (a.kind === 'cta' && b.kind !== 'cta') return 1;
      if (b.kind === 'cta' && a.kind !== 'cta') return -1;
      const ra = rankOf(a.kind, a.role);
      const rb = rankOf(b.kind, b.role);
      if (ra !== rb) return ra - rb;
      return a.index - b.index; // stable
    })
    .map((e) => e.index);

  return { order, roles };
}

/**
 * Builds the observable `ExperienceScript` from the planned order, the roles, and
 * the layout the renderer will actually use — so every beat carries the final
 * emphasis, ground and full-bleed the page renders with, and a reviewer can read
 * the story straight off the artifact.
 */
export function buildScript(
  mode: ExperienceMode,
  order: readonly number[],
  roles: ReadonlyMap<number, NarrativeRole>,
  sections: readonly SectionDesign[],
  content: WebsiteContent,
  experience: ExperienceArchitecture,
): ExperienceScript {
  const byIndex = new Map(sections.map((s) => [s.index, s]));
  const beats: Beat[] = order.map((index) => {
    const design = byIndex.get(index);
    const kind = content.sections[index]?.kind ?? 'about';
    const role = roles.get(index) ?? 'reveal';
    const emphasis = design?.emphasis ?? 'secondary';
    const background = design?.background ?? 'canvas';
    const isSignature = kind === experience.signatureMoment && role === 'signature';
    return {
      index, kind, role, emphasis, background,
      pacing: experience.pacing,
      visualIntensity: INTENSITY(emphasis, background),
      isTransition: design?.momentTransition ?? false,
      isSignature,
      rationale: `${kind} plays "${role}"${isSignature ? ' — the signature moment' : ''} at ${emphasis} emphasis on ${background}.`,
    };
  });

  const conversionAt = beats.findIndex((b) => b.role === 'conversion');
  const basis: 'evidence' | 'creative-default' =
    experience.mode === 'brochure' && experience.signatureMoment === null ? 'creative-default' : 'evidence';

  return {
    mode,
    beats,
    opening: beats[0]?.role ?? 'arrival',
    signature: experience.signatureMoment,
    conversionAt: conversionAt === -1 ? beats.length : conversionAt,
    arc: beats.map((b) => b.role),
    basis,
    rationale: `${mode} arc of ${beats.length} beats: ${beats.map((b) => b.role).join(' → ')}.`,
  };
}
