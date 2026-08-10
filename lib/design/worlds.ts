/**
 * Visual worlds: what the whole page is made of, as one decision.
 *
 * ## Why a world and not more tokens
 *
 * Three businesses generated from the pattern library came out differentiated in
 * identity and identical in furniture, and the deeper reason was that every
 * decision the engine made was *local*. A typeface here, a ground there, an
 * alternation between two greys. Nothing decided what the page as a whole was
 * like, so no page was like anything.
 *
 * A world is that missing decision. It says: this page is dark and warms; this
 * page is bone-white throughout; this page is paper and ink. Everything else —
 * the ground of each band, the pairing of the faces, how far the display type is
 * allowed to go — follows from it, which is what makes the result cohere rather
 * than merely vary.
 *
 * ## The ground journey
 *
 * The single most useful thing a world owns is a **sequence** of grounds rather
 * than an alternation. Alternating canvas and subtle is a rhythm; it has no
 * direction, and a reader feels no progress through it. A journey does: the
 * `ember` world opens in near-black and arrives in daylight, so scrolling the
 * page is scrolling from night into morning.
 *
 * That is a creative device, not a claim. It says nothing about the business's
 * opening hours or its history — it is the *experience of discovering* a bakery,
 * which is exactly the invention this project permits. The facts stay where they
 * always were, verified, in the sections that carry them.
 *
 * ## Determinism
 *
 * Pure lookup and pure sequencing. Same industry, ground and direction, same
 * world, same journey.
 */

import type { DesignDirection, SectionBackground } from './types.js';
import type { SectionKind } from '../types.js';

export type WorldId = 'ember' | 'bone' | 'paper';

/**
 * A ground a journey may name.
 *
 * `brand` is excluded by the type rather than by a comment, because it belongs
 * to the closing call to action alone. A world that could paint a mid-page band
 * in the brand colour would spend the one interruption the page has left.
 */
export type JourneyGround = Exclude<SectionBackground, 'brand'>;

export interface VisualWorld {
  readonly id: WorldId;
  /** One line, for the design notes and for a reviewer. */
  readonly concept: string;
  /** Display face, for headings and the statement. */
  readonly display: string;
  /** Text face, for body and labels. */
  readonly text: string;
  /**
   * The ground each successive *content* band sits on, hero excluded.
   *
   * Read in order; once exhausted the page has arrived, and it settles on the
   * last entry rather than cycling back to the beginning. The closing call to
   * action always overrides this with `brand`.
   *
   * Two rules bind anyone writing one. It may not repeat a ground back to back,
   * and it may not open on `subtle` — that is the hero's own ground, and a first
   * band matching it reads as the hero simply not having ended. Settling is
   * handled for you: see `COMPANION`.
   */
  readonly journey: readonly JourneyGround[];
  /** How far the display type may go, as a multiplier on the display step. */
  readonly displayScale: number;
}

/**
 * The other ground at the same stage of the light.
 *
 * A journey is a sequence of stages, but a page is as long as the business
 * needs it to be and the sequence runs out first. What used to happen after it
 * ran out was that the final ground simply repeated — which on an eleven-section
 * page meant six identical bands in a row, the exact flatness the world was
 * introduced to cure.
 *
 * So every stage has a companion: the same light, one step over. `canvas` and
 * `subtle` are the two faces of daylight. `inverted` and `surface` are night and
 * dusk, which is what lets `ember` hold the dark across two bands without
 * painting them the same black. Settling on a stage therefore means alternating
 * its pair, not repeating one of them — the page stops travelling without the
 * bands stopping being bands.
 */
const COMPANION: Readonly<Record<JourneyGround, JourneyGround>> = {
  canvas: 'subtle',
  subtle: 'canvas',
  inverted: 'surface',
  surface: 'inverted',
};

/**
 * The worlds.
 *
 * Three, because three is what the evidence currently supports — a category
 * that sells atmosphere, one that sells cleanliness, and one that sells
 * craft. A fourth would be a guess.
 */
export const WORLDS: Readonly<Record<WorldId, VisualWorld>> = {
  /*
   * Before light.
   *
   * A bakery, a restaurant, a bar and a hotel all share one thing: the work
   * happens before the customer arrives, in the dark. The page opens in
   * near-black, warms through the ovens, and arrives in daylight at the
   * counter — so the scroll itself carries the day.
   *
   * Playfair against Space Grotesk rather than a matched pair. A romantic
   * high-contrast serif beside a technical grotesque is the tension the
   * business actually lives in: something made by hand, to a specification,
   * every morning. A softer pairing reads as a menu; this reads as a kitchen.
   *
   * Four stages, and the second of them is the fix for a real fault: the arc
   * used to name night twice, which is not two scenes but one tall one, and the
   * dark stopped being a journey and became a backdrop. Dusk is the warming the
   * concept always claimed — the ovens are on and the light has not come yet.
   * The colour for it was already sitting declared and unused in the
   * stylesheet.
   */
  ember: {
    id: 'ember',
    concept: 'Before light — the page opens in the dark and arrives in daylight.',
    display: 'Playfair Display',
    text: 'Space Grotesk',
    journey: ['inverted', 'surface', 'subtle', 'canvas'],
    displayScale: 1.9,
  },

  /*
   * Bone.
   *
   * Light throughout, and the restraint is the message. A visitor choosing a
   * clinic or a professional service is assessing competence, and competence
   * reads as space, order and a single well-cut face. Any drama here is
   * suspicion.
   */
  bone: {
    id: 'bone',
    concept: 'Bone — light throughout, ordered, one face, space instead of drama.',
    display: 'Manrope',
    text: 'Manrope',
    journey: ['canvas', 'subtle', 'canvas', 'subtle'],
    displayScale: 1.25,
  },

  /*
   * Paper.
   *
   * Warm and printed. For craft and retail that is neither clinical nor
   * nocturnal — the page should feel like the shop in daylight.
   *
   * Opens on the bare stock rather than on `subtle`, which is the hero's ground:
   * the plain page first, then the tint, then one inverted plate for the thing
   * worth stopping at.
   */
  paper: {
    id: 'paper',
    concept: 'Paper — a warm printed ground, editorial, ink on stock.',
    display: 'Lora',
    text: 'Source Sans 3',
    journey: ['canvas', 'subtle', 'inverted', 'canvas'],
    displayScale: 1.5,
  },
};

/**
 * Which world this business belongs to.
 *
 * The industry's ground strategy decides it, because that strategy already
 * encodes the only question that matters here — is this business selling an
 * experience, competence, or craft. A direction override is honoured for the
 * one case the ground cannot express: a category that sells atmosphere but has
 * landed on a minimal or corporate direction should not be put in the dark.
 */
export function worldFor(
  ground: 'clean' | 'warm' | 'atmospheric',
  direction: DesignDirection,
  imageReliance: 'essential' | 'supporting' | 'incidental',
): VisualWorld {
  const restrained = direction === 'minimal' || direction === 'corporate';
  if (ground === 'clean' || restrained) return WORLDS.bone;
  if (ground === 'atmospheric') return WORLDS.ember;

  /*
   * A warm category splits on whether photography is the product.
   *
   * The first version of this rule split on how expressive the *direction* was,
   * and it put Tartine — a bakery with forty-nine photographs of its own bread
   * — into the printed world, because its copy is plain and it lands on
   * friendly. That is the wrong question to ask.
   *
   * A business whose imagery is `essential` earns the dark world however it
   * writes, because darkness is what turns a photograph from an illustration
   * into a subject. A shop with two product shots does not, and gets the
   * printed ground instead.
   */
  return imageReliance === 'essential' ? WORLDS.ember : WORLDS.paper;
}

/**
 * Grounds for every section, following the world's journey.
 *
 * The hero paints its own ground and the closing call to action always
 * interrupts, so neither draws from the sequence. Everything between them walks
 * the journey in order and settles at its last entry.
 *
 * No two adjacent bands may share a ground. A seam between two identically
 * painted sections is not a seam — the reader sees one tall band with a heading
 * loose in the middle of it, and the page loses the count of where it is. That
 * holds through the settled stretch at the end, which is where a long page
 * spends most of its scroll, and it is why the pair in `COMPANION` exists.
 */
export function assignJourney(
  kinds: readonly SectionKind[],
  world: VisualWorld,
): readonly SectionBackground[] {
  let step = 0;
  let previous: SectionBackground | null = null;

  return kinds.map((kind) => {
    if (kind === 'hero') {
      previous = 'subtle';
      return 'subtle';
    }
    if (kind === 'cta') {
      previous = 'brand';
      return 'brand';
    }

    const proposed = world.journey[Math.min(step, world.journey.length - 1)] ?? 'canvas';
    step += 1;

    /*
     * Past the end of the journey the same stage is proposed for every band
     * that remains, so this is what turns a held ground into a settled rhythm
     * rather than a flat run. It fires mid-journey only against the hero's
     * `subtle`, which is the one ground a world does not choose for itself.
     */
    const ground = proposed === previous ? COMPANION[proposed] : proposed;
    previous = ground;
    return ground;
  });
}
