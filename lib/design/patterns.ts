/**
 * The design vocabulary: named compositions the engine can choose between.
 *
 * ## Why this layer exists
 *
 * The Tartine benchmark scored the platform 72/150 against a premium
 * human-designed reference at 127/150, and the diagnosis was specific. The
 * architecture was not wrong — evidence to tokens to composition is sound, and
 * the truthfulness constraints are the product. What the engine lacked was
 * *vocabulary*: it could set a page correctly and had no way to say "open on a
 * held photograph, interrupt with a line of the owner's own words, close on the
 * name at scale". Every generated page therefore arrived at the same silhouette
 * — hero, pictures, prose, details — because that was the only sentence the
 * engine knew how to speak.
 *
 * The four lowest-scoring axes were storytelling (3), section rhythm (4),
 * motion (2) and visual identity (4). None of them is a token problem. All four
 * are the absence of named compositions.
 *
 * ## Reference to rule to pattern
 *
 * This file is the third step of the chain the Knowledge Platform describes:
 *
 *   reference → knowledge rule → **pattern** → tokens → component → content
 *
 * A pattern is not a template and does not contain a layout. It is a *decision
 * with its reasons attached*: what a composition is for, which businesses it
 * suits, what it needs from the content before it may be used, and what it must
 * never do. The renderer owns how each one looks, exactly as it already owns
 * what `bento` or `masonry` mean.
 *
 * That separation is what keeps this reviewable. A designer can read this file
 * and disagree with a judgement without reading a line of CSS, and the
 * `requires` gate below is checkable by a test rather than by looking at a
 * screenshot.
 *
 * ## The rule that keeps this honest
 *
 * **A pattern may compose facts. It may never supply them.**
 *
 * The marquee shows the rating because the listing states a rating; it does not
 * invent a strapline to fill the band. The statement break quotes the business's
 * own prose verbatim; it does not write a manifesto. Where the content cannot
 * support a pattern, `requires` fails and the pattern is not used — which is why
 * a thin business gets a plainer page rather than a richer-looking page with
 * invented copy in it. That is the same contract the rest of the platform
 * already keeps, expressed as data.
 *
 * ## Not a copy of anything
 *
 * The compositions here are the common vocabulary of editorial and commercial
 * web design — a held opening image, a rule of facts, a pulled quote, a name set
 * large at the close. They are described as principles and proportions, not
 * lifted from any particular site, and the reference column names the standard
 * or the general practice rather than a page to imitate.
 *
 * ## Determinism
 *
 * Pure data and pure selection. No clock, no randomness, no I/O. Selection is a
 * filter over a fixed array in declaration order, so the same inputs always
 * choose the same patterns.
 */

import type { DesignDirection, Industry } from './types.js';

/* ------------------------------------------------------------------ */
/* Contract                                                            */
/* ------------------------------------------------------------------ */

export type PatternFamily =
  | 'hero'
  | 'typography'
  | 'editorial'
  | 'marquee'
  | 'gallery'
  | 'break'
  | 'closing'
  | 'motion';

/**
 * Whether the renderer can actually draw this pattern today.
 *
 * `declared` is a real and useful state, not a placeholder: it records a
 * judgement that has been made and reviewed but not yet built, so the next
 * session finds a decision rather than a blank page. Nothing selects a
 * `declared` pattern — `selectPatterns` filters them out — so a pattern cannot
 * reach a page before its component exists.
 */
export type PatternStatus = 'executable' | 'declared';

/**
 * What a pattern needs from the content before it may be used.
 *
 * The executable half of the truthfulness rule. Each field is a floor, checked
 * against the composed page rather than against the business's intentions, and
 * a pattern whose floor is not met is silently not chosen.
 */
export interface PatternRequirement {
  /** Usable photographs the page has, after art direction has curated them. */
  readonly minImages?: number;
  /** Verified facts available for a strip or a rule of details. */
  readonly minFacts?: number;
  /** Characters of the business's own prose, for a pattern that quotes it. */
  readonly minProse?: number;
  /** Sections on the page, for a pattern that punctuates a long one. */
  readonly minSections?: number;
}

export interface DesignPattern {
  /** Stable id. Referenced by the renderer and recorded in the design notes. */
  readonly id: string;
  readonly family: PatternFamily;
  /** What this composition is *for*, in one sentence. */
  readonly intent: string;
  /** Industries this suits; `*` means any. */
  readonly industries: readonly (Industry | '*')[];
  /** Directions this suits; `*` means any. */
  readonly directions: readonly (DesignDirection | '*')[];
  readonly composition: readonly string[];
  readonly typography: readonly string[];
  /** What it sits on, and why. */
  readonly ground: string;
  readonly spacing: string;
  readonly imagery: string;
  readonly motion: string;
  readonly responsive: string;
  readonly accessibility: readonly string[];
  readonly antiPatterns: readonly string[];
  /** Where the principle comes from. A standard, or a named general practice. */
  readonly sources: readonly string[];
  readonly requires: PatternRequirement;
  readonly status: PatternStatus;
}

/* ------------------------------------------------------------------ */
/* The library                                                         */
/* ------------------------------------------------------------------ */

const WCAG = 'W3C WCAG 2.2';
const REDUCED_MOTION = 'W3C WCAG 2.2 SC 2.3.3 Animation from Interactions';
const REFERENCE_LIBRARY = 'BusinessForge Visual Design Reference Library — Colour & Art Direction';

/**
 * Every pattern the engine knows, in selection order within each family.
 *
 * Order is the tiebreak: where several patterns in a family fit, the first
 * declared wins. So the most specific and most demanding patterns come first
 * and the safe general one comes last, which makes the fallback explicit rather
 * than emergent.
 */
export const PATTERNS: readonly DesignPattern[] = [
  /* ---------------- Heroes ---------------- */
  {
    id: 'hero-cinematic',
    family: 'hero',
    intent:
      'Open on a held photograph so a stranger feels the place before they read about it.',
    industries: ['bakery', 'restaurant', 'cafe', 'bar', 'hotel', 'spa', 'beauty', 'retail'],
    directions: ['*'],
    composition: [
      'One photograph at full bleed, holding at least 70% of the first screen.',
      'Copy anchored to one corner, never centred over the subject of the picture.',
      'A visible edge of the next section, so the page reads as continuing.',
    ],
    typography: [
      'The headline is set to the picture, not to the reading measure.',
      'Supporting copy keeps a prose measure of around 60 characters.',
    ],
    ground: 'The photograph itself, with a scrim heavy enough to carry text and no heavier.',
    spacing: 'Copy inset by the page gutter, so it aligns with the content below it.',
    imagery: 'A wide crop. The lead photograph, spent here and used nowhere else on the page.',
    motion: 'A slow settle on load. Never a parallax that detaches the copy from the image.',
    responsive: 'Holds its share of the fold at every width; the headline yields by length.',
    accessibility: [
      `Text over the image must meet ${WCAG} contrast against the darkest region it crosses.`,
      'The scrim is decoration; it must not be the only thing carrying meaning.',
    ],
    antiPatterns: [
      'A headline centred over a face or the subject of the photograph.',
      'A photograph chosen because it was available rather than because it leads.',
      'A hero that exactly fills the viewport, hiding that the page continues.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rules 4, 5)`, WCAG],
    requires: { minImages: 1 },
    status: 'executable',
  },
  {
    id: 'hero-editorial-split',
    family: 'hero',
    intent:
      'Lead with words where the photograph supports the argument rather than making it.',
    industries: ['law', 'medical', 'dental', 'professional-services', 'real-estate', 'construction'],
    directions: ['*'],
    composition: [
      'Copy and photograph side by side, copy leading, asymmetric split.',
      'The media column stretches to the full height of the hero rather than sitting at its own aspect ratio.',
    ],
    typography: [
      'Display step below the cinematic hero: this headline shares the screen.',
      'A lede paragraph is part of the composition, not an afterthought.',
    ],
    ground: 'A calm surface. A category selling reassurance does not open on a dark field.',
    spacing: 'The hero carries a floor so a text-led opening still holds the screen.',
    imagery: 'Portrait or square crop, filling its column.',
    motion: 'Restrained. A short fade on the copy, nothing on the image.',
    responsive: 'Stacks to copy-then-image below the medium breakpoint.',
    accessibility: [`Body contrast at ${WCAG} AA against the surface.`],
    antiPatterns: [
      'A full-width clinical photograph for a category whose customers are anxious.',
      'A hero only as tall as its own words, so the next section shows at the fold.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 6)`],
    requires: { minImages: 1 },
    status: 'executable',
  },
  {
    id: 'hero-typographic',
    family: 'hero',
    intent: 'Open on the words alone when the business has no photograph worth holding.',
    industries: ['*'],
    directions: ['*'],
    composition: [
      'Headline and lede set beside each other on a wide screen, not stacked.',
      'The headline takes roughly two thirds of the width.',
    ],
    typography: ['The largest display setting on the page, since nothing competes with it.'],
    ground: 'A flat brand or neutral field. No gradient standing in for a photograph.',
    spacing: 'Generous. Negative space is the composition when there is no image.',
    imagery: 'None. A placeholder gradient reads as a broken image, not as restraint.',
    motion: 'A single fade. Nothing else has arrived to animate.',
    responsive: 'Stacks below the medium breakpoint; the headline yields by longest word.',
    accessibility: [`Contrast at ${WCAG} AA, which a flat field makes trivial to guarantee.`],
    antiPatterns: [
      'A stock photograph bought in to fill the space.',
      'A gradient placeholder where a photograph was expected.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 4)`],
    requires: {},
    status: 'executable',
  },
  {
    id: 'hero-mosaic',
    family: 'hero',
    intent:
      'Open on several photographs at once where range is the point and no single image carries it.',
    industries: ['retail', 'beauty', 'gym', 'hotel'],
    directions: ['creative', 'bold', 'editorial', 'modern'],
    composition: ['Copy in one cell of a grid, photographs occupying the rest at varied sizes.'],
    typography: ['Display type constrained by its own cell rather than by the viewport.'],
    ground: 'Canvas, so the photographs supply the colour.',
    spacing: 'Tight gutters. The mosaic reads as one object, not as separate pictures.',
    imagery: 'Four or more photographs of genuinely different subjects.',
    motion: 'A short stagger across the cells on load.',
    responsive: 'Collapses to a single column with the copy first.',
    accessibility: ['Each photograph keeps its own alt text or is marked decorative.'],
    antiPatterns: [
      'A mosaic filled with near-identical photographs, which reads as a mistake.',
      'Using it on a business with three images, leaving visible holes.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 4)`],
    requires: { minImages: 4 },
    status: 'declared',
  },

  /* ---------------- Typography systems ---------------- */
  {
    id: 'type-editorial-serif',
    family: 'typography',
    intent:
      'Give a craft or hospitality business a voice by pairing a serif display with a plain text face.',
    industries: ['bakery', 'restaurant', 'cafe', 'hotel', 'spa', 'beauty', 'retail'],
    directions: ['editorial', 'elegant', 'luxury', 'premium', 'friendly'],
    composition: ['Display face on headings only; body stays in the text face at every size.'],
    typography: [
      'A serif or high-contrast display for h1 and h2.',
      'Tighter tracking as the size rises; a display line closes up where body copy does not.',
      'Headline leading near 1.05; body leading near 1.6.',
    ],
    ground: 'Unconstrained — this is a type decision and does not imply a palette.',
    spacing: 'Display headings need more space above than below, so they belong to what follows.',
    imagery: 'Unaffected.',
    motion: 'None. Type does not need to move to have character.',
    responsive: 'The display face scales further than the body face, widening the ratio on desktop.',
    accessibility: [
      'Both faces are vendored and latin-subset; no external request and no invisible-text flash.',
      `Body size never falls below 16px effective, per ${WCAG} readability guidance.`,
    ],
    antiPatterns: [
      'One typeface doing every job, which is what makes a page read as a template.',
      'A display serif used for body copy at small sizes.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 2)`, 'Knowledge Rules Registry DES-003'],
    requires: {},
    status: 'executable',
  },
  {
    id: 'type-grotesque-authority',
    family: 'typography',
    intent: 'Give a professional service a plain, confident voice with one well-cut sans.',
    /*
     * The general case, and it has to be, because a page must always get a type
     * system. Scoping this to the professional categories left retail, beauty,
     * spa, gym, bar and the general fallback with none at all — and because
     * 'type-display-statement' matched everything, they silently took the
     * poster treatment as their page-wide typography instead.
     *
     * It sits after 'type-editorial-serif' in the table, so a craft or
     * hospitality business still takes the display face; everything else lands
     * here, which is the correct default rather than an accident.
     */
    industries: ['*'],
    directions: ['*'],
    composition: ['A single family across the page, differentiated by weight and size only.'],
    typography: [
      'Weight carries hierarchy where a second face would carry it elsewhere.',
      'Neutral tracking. Authority does not need styling.',
    ],
    ground: 'Unconstrained.',
    spacing: 'Even. A regular vertical rhythm is the point of this system.',
    imagery: 'Unaffected.',
    motion: 'None.',
    responsive: 'A narrower display range than the editorial system: less drama, more consistency.',
    accessibility: [`Contrast at ${WCAG} AA, and weight never used as the only signal.`],
    antiPatterns: ['Reaching for a decorative face to make a serious category look friendlier.'],
    sources: ['Knowledge Rules Registry DES-002, DES-003'],
    requires: {},
    status: 'executable',
  },
  {
    id: 'type-display-statement',
    /*
     * A treatment, not a page typography system.
     *
     * This sat in the 'typography' family, which the selector treats as
     * exclusive — one per page — and it matches every industry and every
     * direction. So a dental practice on the friendly direction, which
     * 'type-grotesque-authority' does not cover, fell through to *this* as its
     * page-wide type system. The pattern that exists to set one line at poster
     * size became the rule for every heading on the site.
     *
     * It belongs in 'break', which is cumulative: it describes how the
     * statement band and the wordmark are set, and both of those already select
     * it independently.
     */
    family: 'break',
    intent:
      'Set one line at a scale that makes it the loudest thing on the page, used once.',
    industries: ['*'],
    directions: ['*'],
    composition: ['Reserved for the statement break and the closing wordmark. Never for a heading in flow.'],
    typography: [
      'Capped by the longest word and by total length, so scale never breaks the words.',
      'Leading below 1.1; at this size default leading reads as two separate statements.',
    ],
    ground: 'Whatever the pattern using it sits on.',
    spacing: 'Its own band. Display type beside body copy at this size is a collision.',
    imagery: 'None.',
    motion: 'May rise on entry; never letter-by-letter.',
    responsive: 'Falls back to the ordinary display step below the medium breakpoint.',
    accessibility: [
      'Remains real text, never an image of text.',
      `Contrast at ${WCAG} AA large-text minimum against its ground.`,
    ],
    antiPatterns: [
      'Using it more than twice on one page, which spends the effect.',
      'A size that looks impressive in the abstract and breaks a long word in practice.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 4)`],
    requires: {},
    status: 'executable',
  },

  /* ---------------- Editorial / storytelling ---------------- */
  {
    id: 'editorial-own-words',
    family: 'editorial',
    intent:
      "Give the business's own prose a designed setting instead of a paragraph in a column.",
    industries: ['*'],
    directions: ['*'],
    composition: [
      'A narrow measure offset from the grid, with a photograph in the remaining column.',
      'The first paragraph may take a larger step than the rest, as a lede.',
    ],
    typography: ['Body at the reading measure. No justification, no hyphenation.'],
    ground: 'A subtle surface, so the passage separates from the sections around it.',
    spacing: 'Generous leading above and below; this is where the page slows down.',
    imagery: 'One photograph, chosen for its subject rather than to fill the column.',
    motion: 'A short rise as it enters.',
    responsive: 'Photograph moves below the prose on a phone.',
    accessibility: ['Measure stays under 80 characters at every width.'],
    antiPatterns: [
      'Rewriting the passage to fit the composition.',
      'A photograph placed beside prose it has nothing to do with.',
    ],
    sources: ['Knowledge Rules Registry DES-002'],
    requires: { minProse: 200 },
    status: 'executable',
  },
  {
    id: 'editorial-statement-break',
    family: 'break',
    intent:
      "Interrupt the page once with a single line of the business's own words, set large.",
    industries: ['*'],
    directions: ['*'],
    composition: [
      'Full-width band carrying one sentence and nothing else.',
      'Placed between two dense sections, never adjacent to the hero or the closing band.',
    ],
    typography: ['The display statement system, at a measure of roughly 20 words.'],
    ground: 'The brand field or an inverted neutral — a change of ground is half the effect.',
    spacing: 'The tallest band on the page after the hero. Its emptiness is the composition.',
    imagery: 'None. A photograph here turns a statement into a caption.',
    motion: 'Rises once as it enters.',
    responsive: 'Steps down to the ordinary display size; the band keeps its proportions.',
    accessibility: [
      `Large-text contrast at ${WCAG} AA against the band's ground.`,
      'A real blockquote when the sentence is attributed, not styled text.',
    ],
    antiPatterns: [
      'A sentence written for the slot rather than taken from the business.',
      'More than one statement break on a page.',
      'Marketing language the business never used.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rules 3, 4)`],
    requires: { minProse: 120, minSections: 4 },
    status: 'executable',
  },
  {
    id: 'editorial-alternating-story',
    family: 'editorial',
    intent: 'Tell a sequence by alternating which side the photograph sits on.',
    industries: ['*'],
    directions: ['*'],
    composition: ['Each item pairs one photograph with one passage, sides alternating down the page.'],
    typography: ['Item headings at the h3 step; the sequence is carried by rhythm, not by scale.'],
    ground: 'Canvas, so the alternation is the only movement.',
    spacing: 'Equal bands, so the alternation reads as deliberate.',
    imagery: 'One photograph per item — the pattern is not usable with fewer.',
    motion: 'Each pair rises as it enters, alternating direction with the layout.',
    responsive: 'Collapses to photograph-above-text, keeping a single reading order.',
    accessibility: ['Reading order in the DOM stays source order regardless of visual side.'],
    antiPatterns: ['Alternating with only two items, which reads as an accident.'],
    sources: ['Knowledge Rules Registry DES-002'],
    requires: { minImages: 3 },
    status: 'declared',
  },

  /* ---------------- Marquee / ticker ---------------- */
  {
    id: 'marquee-verified-facts',
    family: 'marquee',
    intent:
      'Carry the facts a visitor scans for as a rule across the page, in one band of colour.',
    industries: ['*'],
    directions: ['*'],
    composition: [
      'A single horizontal band of short facts separated by a mark.',
      'Placed directly under the hero, where it doubles as the trust line.',
    ],
    typography: ['Caption or small body step, letterspaced, in the heading face.'],
    ground: 'The brand field or an inverted neutral. This band is where committed colour arrives.',
    spacing: 'Short. It is a rule, not a section.',
    imagery: 'None.',
    motion:
      'May drift horizontally, slowly, and must stop under reduced-motion. Duplicate content for the loop is aria-hidden.',
    responsive: 'Scrolls rather than wraps on a phone; never becomes a stack of rows.',
    accessibility: [
      `Continuous movement must respect prefers-reduced-motion, per ${REDUCED_MOTION}.`,
      'Duplicated marquee content is hidden from assistive technology.',
      'No essential information appears only here.',
    ],
    antiPatterns: [
      'Filling the band with adjectives instead of facts.',
      'Movement fast enough to make the text hard to read.',
      'Claiming an award, a rating or an accreditation the profile has not proved.',
    ],
    sources: [REDUCED_MOTION, 'Knowledge Rules Registry A11Y-001'],
    requires: { minFacts: 3 },
    status: 'executable',
  },
  {
    id: 'marquee-wordmark',
    family: 'closing',
    intent: "Close the page on the business's name at a size nothing else on the page reaches.",
    industries: ['*'],
    directions: ['*'],
    composition: ['The name alone, set to the full width of the page, at the very end.'],
    typography: ['The display statement system, sized to the width rather than to a step.'],
    ground: 'The footer ground. A change of ground here signals the page has ended.',
    spacing: 'Sits tight to the bottom edge; the space above it does the separating.',
    imagery: 'None.',
    motion: 'None. It is a full stop.',
    responsive: 'Scales with the viewport; a long name reduces rather than wrapping to three lines.',
    accessibility: [
      'Real text at the correct heading level or as a decorative repeat of the name already announced.',
      `Contrast at ${WCAG} AA large-text minimum.`,
    ],
    antiPatterns: [
      'A name so long it wraps and stops reading as a wordmark.',
      'Using it as well as a large heading in the closing CTA, which repeats the same move twice.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 4)`],
    requires: {},
    status: 'executable',
  },

  /* ---------------- Galleries ---------------- */
  {
    id: 'gallery-edited-grid',
    family: 'gallery',
    intent: 'Show a curated set of photographs at varied sizes so the grid has a subject.',
    industries: ['*'],
    directions: ['*'],
    composition: [
      'Six to eight photographs, one given a cell twice the size of the others.',
      'Aspect ratios grouped so neighbours agree rather than alternating at random.',
    ],
    typography: ['A quiet heading. The photographs are the content.'],
    ground: 'Canvas or a subtle surface.',
    spacing: 'Tight, even gutters. A gallery is one object.',
    imagery: 'Curated by art direction: no merchandise, portraits rationed, nothing repeated.',
    motion: 'A stagger as the grid enters; a small scale on hover.',
    responsive: 'Two columns on a phone rather than one, so the gallery does not become the page.',
    accessibility: ['Every photograph keeps its own alt text or is explicitly decorative.'],
    antiPatterns: [
      'Every photograph the business has, at whatever crop it came in.',
      'A single column on mobile, which turns eight images into most of the scroll.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rule 8)`],
    requires: { minImages: 4 },
    status: 'executable',
  },
  {
    id: 'gallery-immersive-band',
    family: 'gallery',
    intent: 'Give one photograph the full width of the page as a moment rather than a grid.',
    industries: ['bakery', 'restaurant', 'cafe', 'bar', 'hotel', 'spa', 'gym'],
    directions: ['*'],
    composition: ['One photograph, full bleed, no copy over it.'],
    typography: ['None.'],
    ground: 'The photograph.',
    spacing: 'No padding. The edges of the viewport are the frame.',
    imagery: 'A wide crop with room in the middle; a tight subject reads as badly cropped.',
    motion: 'A slow scale as it passes, subject to reduced-motion.',
    responsive: 'Keeps a fixed aspect band rather than a fixed height.',
    accessibility: ['Decorative only when the same subject is described elsewhere.'],
    antiPatterns: ['Using the lead photograph again, which makes the page feel short of material.'],
    sources: [`${REFERENCE_LIBRARY} (rule 4)`],
    requires: { minImages: 5 },
    status: 'declared',
  },

  /* ---------------- Visual breaks ---------------- */
  {
    id: 'break-ground-shift',
    family: 'break',
    intent:
      'Change the ground under a section so the page has movement without adding content.',
    industries: ['*'],
    directions: ['*'],
    composition: ['Adjacent sections never share a ground; the closing band always inverts.'],
    typography: ['Unaffected.'],
    ground: 'Alternating canvas, subtle surface and one committed brand field per page.',
    spacing: 'A ground change replaces a rule; the page needs no divider lines.',
    imagery: 'Unaffected.',
    motion: 'None.',
    responsive: 'Identical at every width.',
    accessibility: [
      `Every text colour is re-paired against its new ground and re-checked at ${WCAG} AA.`,
    ],
    antiPatterns: [
      'Alternating on a fixed parity, which produces stripes rather than rhythm.',
      'More than one brand field on a page, which spends the emphasis.',
    ],
    sources: [`${REFERENCE_LIBRARY} (rules 3, 9)`, 'Knowledge Rules Registry DES-004'],
    requires: {},
    status: 'executable',
  },
  {
    id: 'break-detail-rule',
    family: 'break',
    intent: 'Set a short run of facts as a ruled list rather than as a paragraph or a table.',
    industries: ['*'],
    directions: ['*'],
    composition: ['Label left, value right, a hairline between rows, full content width.'],
    typography: ['Label in the caption step and letterspaced; value in the body step.'],
    ground: 'A subtle surface.',
    spacing: 'Rows tall enough to scan, tight enough to read as one block.',
    imagery: 'None.',
    motion: 'None.',
    responsive: 'Label above value on a phone, never a two-column squeeze.',
    accessibility: ['A description list, so the pairing survives without the visual rule.'],
    antiPatterns: ['A four-column table of contact details, which reads administrative.'],
    sources: ['Knowledge Rules Registry UX-001'],
    requires: { minFacts: 2 },
    status: 'executable',
  },

  /* ---------------- Closing ---------------- */
  {
    id: 'closing-invitation',
    family: 'closing',
    intent: 'End on one line and one action, so the page concludes rather than stops.',
    industries: ['*'],
    directions: ['*'],
    composition: ['A centred line and a single button on a committed ground.'],
    typography: ['Heading step, not display; the wordmark below carries the scale.'],
    ground: 'The brand field. This is the one section whose job is to interrupt.',
    spacing: 'Tall band, generous space around the button.',
    imagery: 'None.',
    motion: 'The button responds to hover and focus; the band itself does not move.',
    responsive: 'Identical at every width; the button reaches the touch-target minimum.',
    accessibility: [
      'A real link with a resolvable target, never a button that does nothing.',
      `Touch target at least 44px, per ${WCAG} SC 2.5.8.`,
    ],
    antiPatterns: [
      'A contact table pasted at the bottom of the page.',
      'An action the profile cannot support, such as calling a business with no number.',
    ],
    sources: [WCAG, 'Knowledge Rules Registry UX-001'],
    requires: {},
    status: 'executable',
  },
  {
    id: 'closing-orphan-guard',
    family: 'closing',
    intent: 'Keep every call to action attached to the composition that argues for it.',
    industries: ['*'],
    directions: ['*'],
    composition: [
      'A mid-page action may only sit under a section that ends in words.',
      'Never under a gallery, a map or a grid of images.',
    ],
    typography: ['Unaffected.'],
    ground: 'Inherits the section it belongs to.',
    spacing: 'Aligned to the text above it, not centred in the band.',
    imagery: 'None.',
    motion: 'Hover and focus response only.',
    responsive: 'Full width on a phone where it follows a full-width passage.',
    accessibility: ['Focus order follows the argument the button concludes.'],
    antiPatterns: ['A ghost button alone in white space beneath a grid of photographs.'],
    sources: ['Knowledge Rules Registry UX-001'],
    requires: {},
    status: 'executable',
  },

  /* ---------------- Motion primitives ---------------- */
  {
    id: 'motion-enter-rise',
    family: 'motion',
    intent: 'Let sections arrive as they are scrolled to, so the page feels alive rather than static.',
    industries: ['*'],
    directions: ['*'],
    composition: ['Applied to section heads and media, never to body copy mid-paragraph.'],
    typography: ['Unaffected.'],
    ground: 'Unaffected.',
    spacing: 'Unaffected.',
    imagery: 'Media rises slightly further than type, which reads as depth.',
    motion:
      'A short translate and fade, driven by a scroll-progress timeline where the browser supports one. Where it does not, content is simply visible.',
    responsive: 'Distances scale down on a phone, where a long travel reads as jank.',
    accessibility: [
      `Disabled entirely under prefers-reduced-motion, per ${REDUCED_MOTION}.`,
      'Content must never depend on the animation to become visible.',
    ],
    antiPatterns: [
      'A JavaScript reveal that leaves content invisible if the script fails.',
      'Animating every element, which turns a page into a slideshow.',
    ],
    sources: [REDUCED_MOTION, 'Knowledge Rules Registry A11Y-001'],
    requires: {},
    status: 'executable',
  },
  {
    id: 'motion-hover-response',
    family: 'motion',
    intent: 'Make interactive things feel interactive, and non-interactive things stay still.',
    industries: ['*'],
    directions: ['*'],
    composition: ['Cards lift, photographs scale inside their frame, links draw an underline.'],
    typography: ['Unaffected.'],
    ground: 'Unaffected.',
    spacing: 'Unaffected.',
    imagery: 'Scale happens inside a clipped frame so the layout never shifts.',
    motion: 'Fast — around 150ms — because a hover response that lags feels broken.',
    responsive: 'Not applied on touch, where there is no hover state to respond to.',
    accessibility: [
      'Every hover affordance has an equivalent focus state.',
      `Suppressed under prefers-reduced-motion, per ${REDUCED_MOTION}.`,
    ],
    antiPatterns: [
      'Hover effects on things that are not interactive, which promise a click that does nothing.',
      'A transform that moves neighbouring content.',
    ],
    sources: [REDUCED_MOTION, 'Knowledge Rules Registry UX-001'],
    requires: {},
    status: 'executable',
  },
];

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

/** What the page can actually support, measured after composition. */
export interface PatternContext {
  readonly industry: Industry;
  readonly direction: DesignDirection;
  readonly images: number;
  readonly facts: number;
  readonly prose: number;
  readonly sections: number;
}

function applies<T extends string>(list: readonly (T | '*')[], value: T): boolean {
  return list.includes('*') || list.includes(value);
}

function satisfied(requirement: PatternRequirement, ctx: PatternContext): boolean {
  return (
    ctx.images >= (requirement.minImages ?? 0)
    && ctx.facts >= (requirement.minFacts ?? 0)
    && ctx.prose >= (requirement.minProse ?? 0)
    && ctx.sections >= (requirement.minSections ?? 0)
  );
}

/**
 * True when this page may use this pattern.
 *
 * Three gates, and the order is the argument: it has to be built, it has to
 * suit the business, and the content has to be able to fill it honestly.
 */
export function eligible(pattern: DesignPattern, ctx: PatternContext): boolean {
  return (
    pattern.status === 'executable'
    && applies(pattern.industries, ctx.industry)
    && applies(pattern.directions, ctx.direction)
    && satisfied(pattern.requires, ctx)
  );
}

/**
 * The patterns this page will use.
 *
 * One per family for the families that name a single choice — a page has one
 * hero and one typographic system — and every eligible pattern for the families
 * that are cumulative, because ground shifts, motion primitives and the orphan
 * guard all apply at once.
 *
 * Returns ids rather than objects so the design artifact stays small and
 * diffable, and so a renderer can switch on a string without importing this
 * table.
 */
export function selectPatterns(ctx: PatternContext): readonly string[] {
  const EXCLUSIVE: readonly PatternFamily[] = ['hero', 'typography'];
  const chosen: string[] = [];
  const claimed = new Set<PatternFamily>();

  for (const pattern of PATTERNS) {
    if (!eligible(pattern, ctx)) continue;
    if (EXCLUSIVE.includes(pattern.family)) {
      if (claimed.has(pattern.family)) continue;
      claimed.add(pattern.family);
    }
    chosen.push(pattern.id);
  }

  return chosen;
}

/** Looks a pattern up by id, for the renderer and for the design notes. */
export function patternById(id: string): DesignPattern | undefined {
  return PATTERNS.find((pattern) => pattern.id === id);
}
