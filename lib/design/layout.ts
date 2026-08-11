/**
 * Layout intelligence.
 *
 * Chooses a variant per section, an order for the page, and a background
 * rhythm across it. Everything here is a *name* from a closed set — the
 * renderer owns what `bento` or `alternating` actually looks like. That
 * separation is the whole point: this file can be reviewed as a set of design
 * judgements without reading a line of markup.
 *
 * Selection is a scored preference walk rather than a lookup table, so the
 * choice depends on what the section actually contains. A services section
 * with two bullets and no images is not the same design problem as one with
 * nine bullets and a photo for each, and giving both `cards` is how every
 * generated site ends up looking the same.
 */

import { defaultsFor, emphasisFor } from './industries.js';
import { assignJourney } from './worlds.js';

import type { SectionKind, WebsiteContent, WebsiteSection } from '../types.js';
import type { ThemeDefinition } from './themes.js';
import type { VisualWorld } from './worlds.js';
import type { NarrativeRole } from './script.js';
import type { Pacing } from './experience.js';
import type {
  Emphasis,
  FooterVariant,
  HeroVariant,
  Industry,
  LayoutPlan,
  SectionBackground,
  SectionDesign,
  SectionFrame,
  SectionVariant,
  VisualDensity,
} from './types.js';

/** What a section actually contains. Variant choice is a function of this. */
interface SectionShape {
  readonly bullets: number;
  readonly images: number;
  readonly bodyChars: number;
  readonly hasCta: boolean;
  readonly hasSubheading: boolean;
}

function shapeOf(section: WebsiteSection): SectionShape {
  return {
    bullets: section.bullets.length,
    // Logo and favicon belong to the page shell, not to the section's layout.
    images: section.images.filter((image) => image.role !== 'logo' && image.role !== 'favicon').length,
    bodyChars: section.body.trim().length,
    hasCta: section.callToAction !== null,
    hasSubheading: (section.subheading ?? '').trim() !== '',
  };
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

/**
 * Picks the hero.
 *
 * The theme states a preference order; content vetoes what it cannot support.
 * A split hero with no image is just a narrow column with dead space beside it,
 * so the veto matters more than the preference.
 */
export function chooseHero(
  content: WebsiteContent,
  theme: ThemeDefinition,
  imageReliance: 'essential' | 'supporting' | 'incidental',
): { variant: HeroVariant; rationale: string } {
  const hero = content.sections.find((section) => section.kind === 'hero');
  const shape = hero === undefined
    ? { bullets: 0, images: 0, bodyChars: 0, hasCta: false, hasSubheading: false }
    : shapeOf(hero);

  const needsImage: readonly HeroVariant[] = ['split', 'image-first', 'full-bleed', 'magazine'];

  /*
   * How much the industry leads with photography outranks the theme's default
   * hero, when there is a photograph to lead with.
   *
   * `imageReliance` was passed into this function from the beginning and used
   * only to word the fallback message — so a hotel with a real photograph of
   * its own building got `editorial`, because that is what the elegant theme
   * prefers, and the photograph appeared beside the copy at a third of the
   * width. For a business whose product *is* atmosphere, that is the wrong
   * decision: the industry research on premium hospitality sites is unanimous
   * that the hero is cinematic and full-bleed, because a guest is deciding
   * whether they can picture themselves there.
   *
   * The theme still governs colour, type, spacing and radius. Only the scale of
   * the hero changes, and only when the business actually has an image.
   */
  const leadsWithImagery = imageReliance === 'essential' && shape.images > 0;
  const preference: readonly HeroVariant[] = leadsWithImagery
    ? ['full-bleed', ...theme.heroPreference.filter((variant) => variant !== 'full-bleed')]
    : theme.heroPreference;

  for (const candidate of preference) {
    if (needsImage.includes(candidate) && shape.images === 0) continue;
    if (candidate === 'magazine' && shape.images < 2) continue;
    if (candidate === 'editorial' && shape.bodyChars < 80) continue;

    const why = candidate === 'full-bleed' && leadsWithImagery
      ? `this industry sells atmosphere and the hero has ${shape.images} usable image${shape.images === 1 ? '' : 's'}, so the photograph leads at full width`
      : needsImage.includes(candidate)
        ? `the ${theme.id} direction leads with imagery and the hero has ${shape.images} usable image${shape.images === 1 ? '' : 's'}`
        : `the ${theme.id} direction leads with type`;
    return { variant: candidate, rationale: `Chose the ${candidate} hero because ${why}.` };
  }

  // Nothing the theme wanted was supported. Centred works with anything.
  const fallback: HeroVariant = shape.bodyChars > 0 || shape.hasCta ? 'centered' : 'minimal';
  return {
    variant: fallback,
    rationale: imageReliance === 'essential'
      ? `Fell back to the ${fallback} hero: this industry leads with photography but the profile supplied no usable hero image.`
      : `Fell back to the ${fallback} hero: none of the ${theme.id} direction's preferred heroes were supported by the content.`,
  };
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

/** Candidate variants per kind, best first, before content and theme filtering. */
const CANDIDATES: Readonly<Record<SectionKind, readonly SectionVariant[]>> = {
  hero: ['stack'],
  // A statement is one sentence in a band; the frame does the work, not a variant.
  statement: ['stack'],
  about: ['split', 'editorial', 'stack'],
  services: ['bento', 'feature-grid', 'cards', 'alternating', 'list'],
  menu: ['list', 'cards', 'grid'],
  gallery: ['masonry', 'grid', 'collage', 'carousel'],
  testimonials: ['quotes', 'cards', 'editorial', 'slider'],
  hours: ['list', 'split'],
  location: ['split', 'stack'],
  // `list` first, not `cards`. A contact section rendered as cards puts each way
  // of reaching the business in a bordered grey box that reads as a disabled
  // form field; `list` routes to the contact block, where an address is set
  // large and a phone number is a link somebody can press.
  contact: ['list', 'split', 'stack'],
  cta: ['banner'],
  faq: ['list', 'editorial'],
};

/**
 * Whether a variant can carry what the section holds.
 *
 * These are the rules that stop the layout from lying about the content —
 * a bento grid needs enough heterogeneous items to fill its cells, a masonry
 * needs enough images to form columns, an alternating layout needs one image
 * per item. Failing any of them means the variant would render as an
 * embarrassing near-empty grid.
 */
function supports(variant: SectionVariant, shape: SectionShape): boolean {
  switch (variant) {
    case 'bento':
      // Below five cells a bento is a card grid pretending to be interesting.
      return shape.bullets >= 5;
    case 'feature-grid':
      return shape.bullets >= 3;
    case 'cards':
      return shape.bullets >= 2;
    case 'alternating':
      return shape.bullets >= 2 && shape.images >= shape.bullets;
    case 'timeline':
      return shape.bullets >= 3;
    case 'masonry':
      return shape.images >= 4;
    case 'collage':
      return shape.images >= 3;
    case 'grid':
      return shape.images >= 2;
    case 'carousel':
    case 'slider':
      return shape.images >= 4 || shape.bullets >= 4;
    case 'split':
      // An image, and nothing else will do.
      //
      // `|| bodyChars >= 120` used to stand here, and it is how the benchmark
      // hotel's about section came to render a teal gradient panel the size of
      // its copy: a split is a *media* layout, so choosing one for a section
      // with no media leaves the renderer to fill half the row with
      // `imagery.fallback`, which reads as a broken image rather than as a
      // deliberate choice.
      //
      // The hero chooser has always vetoed media variants this way. This is the
      // same veto, one level down. A long text section with no photograph gets
      // `editorial` instead, which is what it should have had.
      return shape.images >= 1;
    case 'editorial':
      return shape.bodyChars >= 160 || shape.bullets >= 2;
    case 'quotes':
      return shape.bullets >= 1;
    case 'list':
      return shape.bullets >= 1;
    case 'banner':
    case 'stack':
      return true;
  }
}

/**
 * Chooses a variant for one section.
 *
 * Order of authority: what the content can support, then what the theme
 * forbids, then what the industry prefers, then the default candidate order.
 * The industry hint is a nudge rather than a rule — it is promoted to the front
 * of the candidate list, not applied over a veto.
 */
export function chooseVariant(
  section: WebsiteSection,
  industry: Industry,
  theme: ThemeDefinition,
): { variant: SectionVariant; rationale: string } {
  const shape = shapeOf(section);
  const base = CANDIDATES[section.kind];
  const hint = defaultsFor(industry).variantHints[section.kind];

  const ordered = hint !== undefined && base.includes(hint)
    ? [hint, ...base.filter((entry) => entry !== hint)]
    : base;

  for (const candidate of ordered) {
    if (theme.avoidVariants.includes(candidate)) continue;
    if (!supports(candidate, shape)) continue;

    const why = candidate === hint
      ? `it is the ${industry} convention for a ${section.kind} section`
      : `the section has ${shape.bullets} item${shape.bullets === 1 ? '' : 's'} and ${shape.images} image${shape.images === 1 ? '' : 's'}`;
    return { variant: candidate, rationale: `Chose ${candidate} for ${section.kind}: ${why}.` };
  }

  // Every candidate was vetoed. `stack` renders anything, including nothing.
  return {
    variant: 'stack',
    rationale: `Fell back to stack for ${section.kind}: the section has too little content for any richer layout.`,
  };
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

/**
 * Kinds a statement frame must never take, however little they carry.
 *
 * A statement flattens whatever it holds into one line of prose, which is right
 * for an address and wrong for a testimonial — a single quotation is a *pull
 * quote*, the most valuable block a small business page has, and rendering it
 * as an unattributed sentence in a margin throws away the one piece of social
 * proof the writer produced. Contact is excluded for the same reason: the
 * fewer ways there are to get in touch, the more the page needs to show them.
 */
const NEVER_STATEMENT: ReadonlySet<SectionKind> = new Set(['testimonials', 'contact', 'cta', 'gallery', 'menu']);

/**
 * How much a section actually has to say.
 *
 * The threshold that separates a section worth a full head-and-body from one
 * that is a single sentence. A location section reading "40 Park Square" given
 * the same envelope as a nine-item services grid is what produces the long
 * empty bands that make a generated page feel padded rather than composed.
 */
function isThin(kind: SectionKind, shape: SectionShape): boolean {
  if (NEVER_STATEMENT.has(kind)) return false;
  return shape.bullets <= 1 && shape.images === 0 && shape.bodyChars < 150;
}

/**
 * Which frames a section could take, best first.
 *
 * Content decides eligibility and the section's kind decides taste. A CTA is
 * always centred because a banner that is not centred is not a banner; a thin
 * section is always a statement because there is nothing to frame.
 */
function frameCandidates(kind: SectionKind, shape: SectionShape, variant: SectionVariant): readonly SectionFrame[] {
  if (kind === 'cta') return ['centered'];
  if (kind === 'hero') return ['stacked'];
  if (isThin(kind, shape)) return ['statement'];

  // A variant that already builds its own two-column structure must not be put
  // inside a second one — `split` and `editorial` in an `aside` frame is a
  // narrow column inside a narrow column.
  if (variant === 'split' || variant === 'editorial' || variant === 'alternating') {
    return ['stacked', 'centered'];
  }

  // Imagery takes the full width or it is not worth showing.
  //
  // An eight-photograph gallery indented into two thirds of the container,
  // with the third the head left behind it standing empty, is a worse page
  // than the plain stack — the frames exist to vary a page's silhouette, and
  // buying variety with a hole beside the photographs is a bad trade.
  const wide: readonly SectionVariant[] = ['masonry', 'collage', 'grid', 'carousel', 'slider'];
  if (wide.includes(variant)) return ['stacked', 'centered'];

  // A bento is built out of its own unequal cells, so it needs width too, but
  // it survives an offset in a way a photograph does not.
  if (variant === 'bento') return ['stacked', 'offset'];

  return ['aside', 'offset', 'stacked', 'centered'];
}

/**
 * Assigns a frame to every section, refusing to repeat one twice running.
 *
 * The rule is the whole point. Choosing the best frame per section
 * independently gives a page where the best frame for `services`, `menu` and
 * `faq` is the same frame three times, which is exactly the silhouette
 * repetition this axis exists to break. A second-choice frame on one section is
 * a smaller cost than three identical ones.
 *
 * Deterministic: the walk is in render order and the fallback is the first
 * candidate that differs, so the same page always frames the same way.
 */
function assignFrames(
  entries: readonly { kind: SectionKind; shape: SectionShape; variant: SectionVariant }[],
): readonly SectionFrame[] {
  const out: SectionFrame[] = [];
  let previous: SectionFrame | null = null;

  for (const entry of entries) {
    const candidates = frameCandidates(entry.kind, entry.shape, entry.variant);

    // A statement frame is content-forced rather than chosen, so it is allowed
    // to repeat — two one-line sections in a row is a fact about the copy.
    const chosen = candidates.includes('statement')
      ? 'statement'
      : candidates.find((candidate) => candidate !== previous) ?? candidates[0] ?? 'stacked';

    out.push(chosen);
    previous = chosen;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rhythm                                                              */
/* ------------------------------------------------------------------ */

/**
 * Assigns backgrounds so adjacent sections separate.
 *
 * Alternating on a fixed parity produces stripes; what reads as designed is
 * changing ground only when the section beside it would otherwise look the
 * same. The CTA always inverts — it is the one section whose job is to
 * interrupt — and the hero paints its own ground.
 */
function assignBackgrounds(
  designs: readonly Omit<SectionDesign, 'background' | 'frame'>[],
  ground: 'clean' | 'warm' | 'atmospheric' = 'clean',
): readonly SectionBackground[] {
  const out: SectionBackground[] = [];
  let previous: SectionBackground = 'canvas';

  /*
   * How much of the page is dark is the industry's decision, not the writer's.
   *
   * Three businesses generated from the same library came out as three
   * near-white pages with one coloured band at the bottom, differing only in
   * typeface and hue. Alternating canvas and subtle is a *rhythm*; it is not an
   * identity, and on its own it makes every category look the same.
   *
   * An `atmospheric` category puts its photography on black, because a visitor
   * choosing a hotel or a bar is trying to picture themselves inside it and
   * darkness is what makes a photograph feel like a room. A `clean` category
   * must not: a dark clinical page reads as a nightclub, and the one thing a
   * dental practice cannot afford is for its site to feel like a night out.
   */
  const carriesDarkMedia = ground === 'atmospheric';

  for (const design of designs) {
    if (design.kind === 'hero') {
      out.push('subtle');
      previous = 'subtle';
      continue;
    }
    /*
     * The gallery inverts for an experience-led category.
     *
     * This is the single change that separates a hotel from a clinic at a
     * glance, and it costs nothing: the photographs are the same photographs,
     * sitting on a ground that makes them the subject rather than an
     * illustration between two paragraphs.
     */
    if (carriesDarkMedia && (design.kind === 'gallery' || design.kind === 'menu')) {
      out.push('inverted');
      previous = 'canvas';
      continue;
    }
    if (design.kind === 'cta') {
      out.push('brand');
      // A brand band resets the rhythm: the section after it starts clean.
      previous = 'canvas';
      continue;
    }
    /*
     * The statement band inverts, and the change of ground is half the effect.
     *
     * A sentence set large on the same surface as the section above it is a big
     * heading; the same sentence on a dark field is an interruption. Inverted
     * rather than `brand`, which the closing CTA already owns — one committed
     * brand field per page, per `break-ground-shift`, so the close keeps its
     * emphasis.
     */
    if (design.kind === 'statement') {
      out.push('inverted');
      previous = 'canvas';
      continue;
    }

    const next: SectionBackground = previous === 'canvas' ? 'subtle' : 'canvas';
    out.push(next);
    previous = next;
  }
  return out;
}

/**
 * Orders sections for the page.
 *
 * The hero leads and the CTA closes, whatever the writer emitted. Between
 * them, the industry's priority list decides — a gym's testimonials outrank its
 * hours, a law firm's do not. Sections the industry has no opinion on keep
 * their written order, which is a stable tiebreak and keeps the result
 * deterministic.
 */
/**
 * Where a section sits when its industry has no opinion about it.
 *
 * An industry's `prioritySections` names the kinds that category leads with; it
 * is not required to be exhaustive, and most are not. The previous fallback
 * gave every unnamed kind the same rank, so they all collided and fell through
 * to written order *after* everything named — which put Tartine's `about`, the
 * best copy on the page, below the contact details.
 *
 * That is a bug rather than a judgement: nothing decided `about` belonged last,
 * it was simply absent. This gives the unnamed kinds a deterministic ordering
 * of their own, so an omission degrades to "generic sensible" rather than to
 * "last".
 */
const DEFAULT_ORDER: readonly SectionKind[] = [
  'hero',
  // Directly after the hero, and before anything the reader has to work at.
  // A statement is the page's first turn: the reader has seen the place, and is
  // told one thing about it before being shown anything else. No industry names
  // it, so this rank is the one it always gets — inherited from `hero`.
  'statement',
  'about',
  'services',
  'menu',
  'gallery',
  'testimonials',
  'faq',
  'hours',
  'location',
  'contact',
  'cta',
];

/**
 * Where a section the industry did not name belongs.
 *
 * Appending unlisted kinds after every listed one is the obvious rule and it is
 * wrong, because the listed set usually ends with `contact`. The dental
 * industry does not name `gallery`, so Paradise Dental Care rendered its
 * photographs **after its contact details** — the page asked for the call and
 * then showed the practice.
 *
 * An unnamed kind is not lower priority; it is simply unmentioned, and the
 * default order already knows where it goes. So it inherits the rank of the
 * nearest kind *before* it in `DEFAULT_ORDER` that the industry did name, plus
 * a half step. Gallery follows services for a dentist, keeps its own place for
 * a restaurant that names it, and in both cases lands before the closing
 * sections rather than after them.
 *
 * `-0.5` when nothing precedes it: the kind belongs at the very front, which
 * only `hero` outranks and `hero` is pinned separately.
 */
function rankOf(kind: SectionKind, priorities: readonly SectionKind[]): number {
  const listed = priorities.indexOf(kind);
  if (listed !== -1) return listed;

  const position = DEFAULT_ORDER.indexOf(kind);
  if (position === -1) return priorities.length;

  for (let before = position - 1; before >= 0; before -= 1) {
    const neighbour = DEFAULT_ORDER[before]!;
    const neighbourRank = priorities.indexOf(neighbour);
    if (neighbourRank !== -1) return neighbourRank + 0.5;
  }

  return -0.5;
}

export function orderSections(content: WebsiteContent, industry: Industry): readonly number[] {
  const priorities = defaultsFor(industry).prioritySections;

  const indexed = content.sections.map((section, index) => ({
    index,
    kind: section.kind,
    rank: rankOf(section.kind, priorities),
  }));

  return indexed
    .slice()
    .sort((a, b) => {
      if (a.kind === 'hero' && b.kind !== 'hero') return -1;
      if (b.kind === 'hero' && a.kind !== 'hero') return 1;
      if (a.kind === 'cta' && b.kind !== 'cta') return 1;
      if (b.kind === 'cta' && a.kind !== 'cta') return -1;

      if (a.rank !== b.rank) return a.rank - b.rank;

      // Stable: equal-priority sections keep the order the writer chose.
      return a.index - b.index;
    })
    .map((entry) => entry.index);
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

/** Emphasis narrows density: a quiet section is denser than a lead one. */
function densityFor(base: VisualDensity, emphasis: Emphasis): VisualDensity {
  if (emphasis === 'lead') return base === 'dense' ? 'balanced' : 'airy';
  if (emphasis === 'quiet') return base === 'airy' ? 'balanced' : 'dense';
  return base;
}

function footerFor(theme: ThemeDefinition, sectionCount: number): FooterVariant {
  // A rich footer under a three-section page looks heavier than the page.
  if (sectionCount <= 4) return 'minimal';
  return theme.footer;
}

export interface LayoutInput {
  readonly content: WebsiteContent;
  readonly industry: Industry;
  readonly theme: ThemeDefinition;
  readonly density: VisualDensity;
  readonly imageReliance: 'essential' | 'supporting' | 'incidental';
  /** What the page is made of. See IndustryDefaults.ground. */
  readonly ground: 'clean' | 'warm' | 'atmospheric';
  readonly world: VisualWorld;
  /**
   * A section kind to give elevated emphasis, from `ComposeOptions.momentSection`.
   *
   * Honoured only if this business's content actually has a section of that
   * kind — the deterministic system's own check, independent of whatever
   * validated the nomination upstream. Absent, or matching no section here,
   * this function behaves exactly as it did before this field existed.
   */
  readonly momentSection?: SectionKind | undefined;
  /** Whether the moment section (if any) also gets the transition primitive. */
  readonly momentTransition?: boolean | undefined;
  /**
   * The render order, as indices into `content.sections`, from the experience
   * script (`planNarrativeOrder`). When present it replaces the industry-priority
   * sort — the page is ordered by narrative role, not category. Absent, the
   * legacy `orderSections` sort is used, so a caller that has no script still
   * gets a valid page.
   */
  readonly order?: readonly number[] | undefined;
  /**
   * Promote the gallery to the page's subject, from the experience architecture
   * (`ExperienceArchitecture.galleryLead`).
   *
   * When set and the page has a gallery, that gallery is given `'lead'`
   * emphasis outright — not the single-rung step a moment nomination gives —
   * which is what trips the existing full-bleed rule below and turns a gallery
   * from an illustration between paragraphs into the thing the page is about.
   * A `showcase`/`narrative` business earns this; a `brochure` never asks for
   * it, so the default (absent) is exactly the pre-existing behaviour.
   */
  readonly galleryLead?: boolean | undefined;
  /**
   * The narrative role of each section, from `planNarrativeOrder`.
   *
   * Order alone made the *sequence* business-specific; this makes the
   * *treatment* business-specific too. A beat that plays `signature` is the one
   * moment the page is built around and must read as a peak rather than as
   * another band of the same weight — and a peak only reads as one if what
   * precedes it is quieter, which is the second rule below. Absent, emphasis is
   * decided exactly as it was before roles existed.
   */
  readonly roles?: ReadonlyMap<number, NarrativeRole> | undefined;
  /** How the page spends space, from the experience architecture. */
  readonly pacing?: Pacing | undefined;
}

/** One step down the emphasis ladder. The counterpart of `stepUpEmphasis`. */
function stepDownEmphasis(emphasis: Emphasis): Emphasis {
  switch (emphasis) {
    case 'lead': return 'primary';
    case 'primary': return 'secondary';
    case 'secondary': return 'quiet';
    case 'quiet': return 'quiet';
  }
}

/**
 * One step up the emphasis ladder — never straight to the top.
 *
 * `'lead'` is otherwise earned only by whatever section lands at position 0
 * (`emphasisFor`), which is effectively the hero. Stepping the moment section
 * up by exactly one rung — rather than setting it to `'lead'` outright —
 * keeps the elevation bounded and relative to wherever the deterministic
 * system had already placed it, instead of always maximal regardless of the
 * section's actual weight in the page.
 */
function stepUpEmphasis(emphasis: Emphasis): Emphasis {
  switch (emphasis) {
    case 'quiet': return 'secondary';
    case 'secondary': return 'primary';
    case 'primary': return 'lead';
    case 'lead': return 'lead';
  }
}

export function planLayout(input: LayoutInput): { plan: LayoutPlan; notes: readonly string[] } {
  const { content, industry, theme, density } = input;
  const notes: string[] = [];

  const order = input.order ?? orderSections(content, industry);
  const hero = chooseHero(content, theme, input.imageReliance);

  // The moment may only land once — on the first section of the nominated
  // kind the page actually contains. A second matching section (rare; most
  // kinds appear at most once) stays at its ordinary emphasis, because a
  // page with two "moments" has none: the whole point is a single thing
  // worth building emphasis around.
  let momentApplied = false;

  const partial = order.map((index, position) => {
    const section = content.sections[index];
    if (section === undefined) {
      return {
        index,
        kind: 'about' as SectionKind,
        variant: 'stack' as SectionVariant,
        emphasis: 'quiet' as Emphasis,
        density,
        columns: null,
        fullBleed: false,
        momentTransition: false,
        role: null,
        rationale: 'Section index out of range.',
      };
    }

    const chosen = chooseVariant(section, industry, theme);
    let emphasis = emphasisFor(industry, section.kind, position);
    const shape = shapeOf(section);

    const isMoment = !momentApplied && input.momentSection !== undefined
      && section.kind === input.momentSection;
    if (isMoment) {
      momentApplied = true;
      emphasis = stepUpEmphasis(emphasis);
      notes.push(
        `Section ${index} (${section.kind}) is the nominated moment: emphasis raised to `
        + `"${emphasis}".`,
      );
    }

    // The gallery becomes the subject in a showcase or narrative. Set outright
    // rather than stepped: a full-bleed gallery needs `'lead'`, and a one-rung
    // step from `'secondary'` would only reach `'primary'` and never trip the
    // full-bleed rule below.
    if (input.galleryLead === true && section.kind === 'gallery' && emphasis !== 'lead') {
      emphasis = 'lead';
      notes.push(`Section ${index} (gallery) leads the page: emphasis set to "lead" (showcase/narrative).`);
    }

    /*
     * The signature beat is the page's peak, whatever kind of section it is.
     *
     * `galleryLead` above only ever promotes a gallery, because that is the
     * only kind the showcase rule knew about. A business whose signature is its
     * menu, its testimonials or its story deserves the same elevation — the
     * narrative already decided this beat is the one thing the page is built
     * around, and rendering it at the same weight as the hours is the later
     * layer erasing the earlier one.
     */
    const role = input.roles?.get(index);
    if (role === 'signature' && emphasis !== 'lead') {
      emphasis = 'lead';
      notes.push(`Section ${index} (${section.kind}) plays the signature beat: emphasis set to "lead" — it is the page's peak.`);
    }

    /*
     * A cinematic page keeps its practical beats quiet.
     *
     * Pacing is not only vertical space; it is which beats are allowed to be
     * loud. On a page built to build to something, the opening hours competing
     * with the peak is what flattens an arc back into a stack of bands.
     */
    if (input.pacing === 'cinematic' && role === 'context' && emphasis !== 'quiet') {
      emphasis = stepDownEmphasis(emphasis);
      notes.push(`Section ${index} (${section.kind}) is practical context on a cinematic page: emphasis lowered to "${emphasis}".`);
    }

    if (chosen.variant === 'stack' && section.kind !== 'hero' && shape.bullets === 0 && shape.bodyChars === 0) {
      notes.push(`Section ${index} (${section.kind}) has no body, bullets or images and will render as a heading alone.`);
    }

    return {
      index,
      kind: section.kind,
      variant: chosen.variant,
      emphasis,
      density: densityFor(density, emphasis),
      columns: columnsFor(chosen.variant, shape),
      fullBleed: chosen.variant === 'collage' || (section.kind === 'gallery' && emphasis === 'lead'),
      momentTransition: isMoment && (input.momentTransition ?? false),
      role: role ?? null,
      rationale: chosen.rationale,
    };
  });

  /*
   * A peak needs a breath before it.
   *
   * Contrast is what makes a signature read as a signature: if the beat before
   * it is also shouting, the reader arrives at the peak already saturated and
   * feels nothing. So the beat immediately preceding the signature steps down
   * one rung — never the hero, which is pinned, and never on a page too short
   * to have a shape at all.
   */
  const signatureAt = partial.findIndex((design) => input.roles?.get(design.index) === 'signature');
  if (signatureAt > 1 && partial.length >= 5) {
    const before = partial[signatureAt - 1];
    if (before !== undefined && (before.emphasis === 'lead' || before.emphasis === 'primary')) {
      const lowered = stepDownEmphasis(before.emphasis);
      partial[signatureAt - 1] = {
        ...before,
        emphasis: lowered,
        density: densityFor(density, lowered),
        // Full bleed was earned by the emphasis it no longer has.
        fullBleed: before.variant === 'collage' || (before.kind === 'gallery' && lowered === 'lead'),
      };
      notes.push(
        `Section ${before.index} (${before.kind}) steps down to "${lowered}": it precedes the signature beat, `
        + 'and a peak only reads as one against a quieter approach.',
      );
    }
  }

  if (input.momentSection !== undefined && !momentApplied) {
    notes.push(
      `A moment was nominated ("${input.momentSection}") but this business has no section of `
      + 'that kind; no emphasis was changed.',
    );
  }

  /*
   * A journey, not an alternation.
   *
   * The world owns the sequence of grounds across the page, which is what lets
   * a page move from night into morning instead of merely striping. See
   * lib/design/worlds.ts.
   */
  const backgrounds = assignJourney(partial.map((section) => section.kind), input.world);
  const frames = assignFrames(partial.map((design) => {
    const section = content.sections[design.index];
    return {
      kind: design.kind,
      variant: design.variant,
      shape: section === undefined
        ? { bullets: 0, images: 0, bodyChars: 0, hasCta: false, hasSubheading: false }
        : shapeOf(section),
    };
  }));

  const sections: readonly SectionDesign[] = partial.map((design, position) => ({
    ...design,
    frame: frames[position] ?? 'stacked',
    background: backgrounds[position] ?? 'canvas',
  }));

  const reordered = order.some((index, position) => index !== position);
  if (reordered) {
    notes.push(
      input.order !== undefined
        ? 'Sections were ordered by narrative role (experience script); content itself is unchanged.'
        : `Sections were reordered for the ${industry} category; content itself is unchanged.`,
    );
  }

  return {
    plan: {
      hero: hero.variant,
      footer: footerFor(theme, content.sections.length),
      sections,
      order,
      // A short page has nothing to navigate back to.
      stickyHeader: content.sections.length >= 5,
      showNavigation: content.sections.length >= 4,
      rationale: hero.rationale,
    },
    notes,
  };
}

/** Column count at the wide anchor. `null` lets the variant decide. */
function columnsFor(variant: SectionVariant, shape: SectionShape): number | null {
  switch (variant) {
    case 'cards':
    case 'feature-grid':
      // Four items across three columns leaves one alone on a second row, which
      // looks like the grid ran out rather than like a decision. Two-by-two is
      // the arrangement a person would have picked.
      if (shape.bullets === 4) return 2;
      return shape.bullets >= 6 ? 3 : Math.min(shape.bullets, 3);
    case 'grid':
      return shape.images >= 6 ? 3 : 2;
    case 'masonry':
      // Four across three columns leaves one photograph alone on a second row,
      // which reads as the grid running out rather than as a composition — the
      // same failure `cards` already guards against, and worse here because the
      // orphan is a full photograph. Two-by-two is what a person would have laid
      // out. River Park's signature gallery shipped with the orphan.
      if (shape.images === 4) return 2;
      return shape.images >= 8 ? 4 : 3;
    case 'quotes':
      return shape.bullets >= 3 ? 3 : shape.bullets;
    case 'split':
      return 2;
    default:
      return null;
  }
}
