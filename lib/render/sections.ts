/**
 * One section of `WebsiteContent` → one `<section>`.
 *
 * Every `WebsiteSection` carries the same six fields whatever its `kind` is, so
 * the *content* never decides presentation. What decides it is the
 * `SectionDesign` the design layer composed: a variant name, an emphasis, a
 * background, a density and a column count. This file is the only place that
 * knows what those names mean in markup.
 *
 * Two rules keep that honest:
 *
 * 1. **A variant is markup, not a class name.** `bento`, `timeline` and
 *    `alternating` produce genuinely different trees. Painting one class on the
 *    same `<ul>` and calling it a variant is how twenty sites end up being one
 *    template with twenty palettes.
 * 2. **A variant renders what it was given.** Missing optional fields are the
 *    normal case, so every renderer degrades on its own: a `masonry` with no
 *    images falls through to whatever the section does have rather than
 *    emitting an empty grid.
 *
 * Without a design the file behaves exactly as it did before the layout layer
 * existed — `kind` picks a bullet layout from `BULLET_LAYOUTS` and nothing else
 * changes. That path is byte-compatible and is what an existing caller sees.
 */

import { element, empty, join, paragraphs, raw, text } from './html.js';
import { safeHref } from './assets.js';
import { fold } from '../content/evidence.js';
import { LANGUAGES, lexiconFor } from '../content/language.js';

import type { Html } from './html.js';
import type { ImageAsset, SectionKind, TrustSignal, WebsiteSection } from '../types.js';
import type { AssetPlan, ResolvedImage } from './assets.js';
import type { AssetRole, ImageFraming } from '../design/assets.js';
import type {
  HeroVariant,
  SectionDesign,
  SectionFrame,
  SectionVariant,
  WebsiteDesign,
} from '../design/types.js';

/**
 * How a section's `bullets` are presented when there is no design.
 *
 * - `cards`   discrete offerings that scan side by side
 * - `quotes`  each bullet is somebody's words
 * - `list`    sequential lines read top to bottom
 */
type BulletLayout = 'cards' | 'quotes' | 'list';

const BULLET_LAYOUTS: Readonly<Record<SectionKind, BulletLayout>> = {
  hero: 'list',
  statement: 'list',
  about: 'list',
  services: 'cards',
  menu: 'cards',
  gallery: 'list',
  testimonials: 'quotes',
  hours: 'list',
  location: 'list',
  contact: 'list',
  cta: 'list',
  faq: 'list',
};

export interface SectionContext {
  /** Zero-based position in the document. Decides the heading level. */
  readonly index: number;
  /** Fragment id, already deduplicated across the document. */
  readonly id: string;
  /** Id of this section's heading, for `aria-labelledby`. */
  readonly headingId: string;
  /** Alternating background. Only the no-design path uses it. */
  readonly alternate: boolean;
  /** The site tagline. Only the leading hero uses it. */
  readonly tagline: string | null;
  /** BCP 47 tag from `WebsiteContent.language`, for the labels the page owns. */
  readonly language: string | null;
  /**
   * Verified reassurance. Only the leading hero renders it — a trust bar in
   * the footer is a trust bar nobody reads.
   */
  readonly trust: readonly TrustSignal[];
  readonly assets: AssetPlan;
  readonly warn: (message: string) => void;
  /** The design decision for this section, or `null` on the legacy path. */
  readonly plan: SectionDesign | null;
  /** The hero treatment for the page. Only the hero section reads it. */
  readonly hero: HeroVariant | null;
  /** The whole design, for imagery and icon decisions. */
  readonly design: WebsiteDesign | null;
  /** See `RenderOptions.location`. Only the `location`-kind section reads it. */
  readonly location: { readonly lat: number; readonly lng: number } | null;
  /** See `RenderOptions.contactForm`. Only a `contact`-kind section reads it. */
  readonly contactForm: boolean;
}

/* ------------------------------------------------------------------ */
/* Item parsing                                                        */
/* ------------------------------------------------------------------ */

/**
 * A bullet split into a label and its detail.
 *
 * Bullets are plain strings — the contract gives no structure — but writers
 * consistently produce two shapes that carry one: `Espresso — 2.60` and
 * `Do I need a referral? No.` A price list rendered as a price list, with the
 * figure set right against a leader, is the single change that makes a
 * restaurant's menu stop looking like a services grid. Nothing is invented: a
 * bullet with no separator becomes a label with no detail.
 */
interface Item {
  readonly label: string;
  readonly detail: string;
}

const SEPARATORS: readonly RegExp[] = [
  // "Country sourdough — 48-hour ferment"
  /^(.{2,72}?)\s+[—–]\s+(.+)$/s,
  // "Do I need a referral? No."
  /^(.{3,96}\?)\s+(.+)$/s,
  // "Payroll: monthly, including pensions"
  /^([^:\n]{2,56}):\s+(.+)$/s,
  // "Loft conversions. Structural work included."
  /^(.{3,56}?[.!])\s+(.{12,})$/s,
];

function splitItem(value: string): Item {
  const trimmed = value.trim();

  for (const pattern of SEPARATORS) {
    const match = pattern.exec(trimmed);
    const label = match?.[1]?.trim();
    const detail = match?.[2]?.trim();
    if (label !== undefined && detail !== undefined && label !== '' && detail !== '') {
      return { label: label.replace(/[.!]$/, ''), detail };
    }
  }

  return { label: trimmed, detail: '' };
}

/** A testimonial split from its attribution, when the bullet carries one. */
function splitQuote(value: string): { quote: string; attribution: string } {
  const trimmed = value.trim();
  const match = /^([\s\S]{12,}[”"'.!?])\s*[—–]\s*([^—–\n]{2,60})$/.exec(trimmed);
  const quote = match?.[1]?.trim();
  const attribution = match?.[2]?.trim();

  if (quote !== undefined && attribution !== undefined) return { quote, attribution };
  return { quote: trimmed, attribution: '' };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function renderImage(image: ResolvedImage, attrs: Record<string, string | number> = {}): Html {
  return element('img', {
    src: image.src,
    alt: image.alt,
    // Reserving the box stops the page reflowing as images arrive.
    width: image.width,
    height: image.height,
    loading: 'lazy',
    decoding: 'async',
    // What this photograph is for, and the aspect it composes best at — the
    // stylesheet reads these to give a hero shot, a detail and a process
    // beat different treatments instead of pouring every image into one
    // uniform grid cell. Absent on the pre-design path.
    ...(image.role === undefined ? {} : { 'data-role': image.role }),
    ...(image.framing === undefined || image.framing === 'natural' ? {} : { 'data-framing': image.framing }),
    ...attrs,
  });
}

/** An `ImageAsset`'s identity for matching against `AssetPlacement`. */
function assetIdentity(localPath: string | null, url: string): string {
  return localPath ?? url;
}

/**
 * Looks up the role and framing the design's asset choreography assigned to
 * one image.
 *
 * Matched by identity rather than by object reference: the choreography ran
 * over the profile's image pool, `WebsiteSection.images` is the writer's own
 * (possibly re-ordered, possibly filtered) list, and only the path or URL
 * survives both. No match — a legacy design, or an image the choreography
 * held back — leaves the image exactly as it always rendered.
 */
function placementOf(image: ImageAsset, design: WebsiteDesign | null): { role: AssetRole; framing: ImageFraming } | null {
  if (design === null) return null;
  const key = assetIdentity(image.localPath, image.url);
  const placement = design.assets.placements.find((p) => assetIdentity(p.localPath, p.url) === key);
  return placement === undefined ? null : { role: placement.role, framing: placement.framing };
}

/** Resolves a section's images once; unusable ones are dropped, not faked. */
function resolveImages(section: WebsiteSection, ctx: SectionContext): readonly ResolvedImage[] {
  const resolved: ResolvedImage[] = [];
  for (const image of section.images) {
    // The shell owns these: the logo goes in the header, the favicon in <head>.
    if (image.role === 'logo' || image.role === 'favicon') continue;
    const item = ctx.assets.resolve(image);
    if (item === null) continue;
    const placement = placementOf(image, ctx.design);
    resolved.push(placement === null ? item : { ...item, ...placement });
  }
  return resolved;
}

/**
 * What stands in for a photograph a variant needs and the profile never
 * supplied.
 *
 * `ImageStrategy.fallback` is the design's answer to that, and `omit` — render
 * nothing at all — is one of its four legal values. A gradient panel is not
 * decoration here: an image-led hero collapses to a bare column of type without
 * one, which reads as a broken page rather than as an image-free one.
 */
function mediaFallback(ctx: SectionContext, modifier = ''): Html {
  const fallback = ctx.design?.imagery.fallback ?? 'omit';
  if (fallback === 'omit') return empty;

  return element('div', {
    class: `media-fill media-fill--${fallback}${modifier === '' ? '' : ` ${modifier}`}`,
    'aria-hidden': 'true',
  });
}

/**
 * Images as a figure grid.
 *
 * **No captions.** Alt text is written for a screen reader, and scraped alt
 * text is written by whoever built the previous site — "Tartine bread on
 * Amazon", "BREAD BOOK Cover", or a file name. Printing it under each tile
 * turned a bakery's gallery into what looked like a list of shop listings.
 *
 * The alt attribute is still emitted, so nothing is lost for a screen reader;
 * it simply stops being visual furniture. A gallery should caption
 * deliberately or not at all, and the pipeline has nothing deliberate to say
 * about an individual photograph.
 */
function renderGallery(
  images: readonly ResolvedImage[],
  variant: string | null = null,
  columns: number | null = null,
): Html {
  if (images.length === 0) return empty;

  // `null` is the pre-design form, emitted byte-for-byte as it always was.
  const items = images.map((image, index) =>
    element('li', {
      class: variant === null ? 'gallery__item' : `gallery__item gallery__item--${index % 6}`,
      // Mirrors the `<img>`'s own `data-role`: the cell needs it too, so a
      // composition rule can size the *frame* around a signature or process
      // shot, not just filter the photograph inside it.
      ...(image.role === undefined ? {} : { 'data-role': image.role }),
    },
      element('figure', {}, renderImage(image)),
    ),
  );

  return element('ul', {
    class: variant === null ? 'gallery' : `gallery gallery--${variant}`,
    role: 'list',
    style: variant === null ? null : columnStyle(columns),
  }, items);
}

/** `--columns` as an inline custom property, or nothing when the variant decides. */
function columnStyle(columns: number | null): string | null {
  if (columns === null || !Number.isFinite(columns) || columns < 1) return null;
  return `--columns: ${Math.min(Math.round(columns), 6)}`;
}

/**
 * The mark in front of a card or a feature.
 *
 * This was a square drawn from a CSS border, and on a rendered page it read as
 * an empty checkbox — every services grid on every site looked like an unfilled
 * form. A geometric shape with no meaning is decoration, and decoration that
 * resembles a control is worse than none.
 *
 * A two-digit index is the replacement: it is set in the heading face at the
 * caption step, it gives the eye a scan order the grid otherwise lacks, and it
 * is the oldest way an editorial page has enumerated anything. `IconSystem`
 * still decides whether a mark appears at all and how heavy it is — `none`
 * emits nothing, and the styles differ in weight and rule rather than in shape.
 */
function renderIndex(ctx: SectionContext, index: number): Html | null {
  const style = ctx.design?.icons.style ?? 'none';
  if (style === 'none') return null;

  return element(
    'span',
    { class: `index index--${style}`, 'aria-hidden': 'true' },
    text(String(index + 1).padStart(2, '0')),
  );
}

/**
 * The call to action.
 *
 * A href the sanitiser refuses becomes plain text rather than disappearing: the
 * label is content the writer chose to show, and dropping it loses information,
 * while keeping the link would ship whatever the model put in that field.
 */
function renderCallToAction(section: WebsiteSection, ctx: SectionContext, variant: string): Html {
  const cta = section.callToAction;
  if (cta === null) return empty;

  const label = cta.label.trim();
  if (label === '') return empty;

  const href = safeHref(cta.href);
  if (href === null) {
    ctx.warn(`section "${section.kind}" call to action uses an unsupported link and was rendered as text: "${cta.href}"`);
    return element('p', { class: 'section__actions' }, text(label));
  }

  return element('p', { class: 'section__actions' },
    element('a', { class: `button ${variant}`, href }, text(label)),
  );
}

/** Which button treatment a section's call to action gets. */
function buttonVariant(section: WebsiteSection, ctx: SectionContext): string {
  if (section.kind === 'cta' || section.kind === 'hero') return 'button--primary';
  const emphasis = ctx.plan?.emphasis;
  return emphasis === 'lead' || emphasis === 'primary' ? 'button--primary' : 'button--ghost';
}

function renderSubheading(section: WebsiteSection): Html {
  const subheading = section.subheading?.trim();
  return subheading ? element('p', { class: 'section__subheading' }, text(subheading)) : empty;
}

function renderBody(section: WebsiteSection, extra = ''): Html {
  const body = section.body.trim();
  if (body === '') return empty;
  return element('div', { class: `section__body${extra === '' ? '' : ` ${extra}`}` }, paragraphs(body));
}

/**
 * The section heading.
 *
 * The first section carries the `<h1>` whatever its kind, so a document always
 * has exactly one — the outline stays valid for a spec that opens with `about`
 * because it had no hero.
 */
function renderHeading(section: WebsiteSection, ctx: SectionContext): Html {
  const heading = section.heading.trim();
  const level = ctx.index === 0 ? 'h1' : 'h2';

  // A section with no heading still needs an accessible name for the landmark.
  if (heading === '') {
    return element(level, { id: ctx.headingId, class: 'visually-hidden' }, text(section.kind));
  }
  return element(level, { id: ctx.headingId }, text(heading));
}

/**
 * The small line above a heading.
 *
 * Carries the `eyebrow` step of the type scale, which is the only step a page
 * has for type that is meant to be noticed and not read. The hero uses the
 * tagline; every other section uses its own kind, which is a label the design
 * chose to show rather than copy anybody wrote.
 */
function renderEyebrow(section: WebsiteSection, ctx: SectionContext): Html {
  const tagline = ctx.tagline?.trim();
  if (tagline !== undefined && tagline !== '') {
    /*
     * Not when the headline already says it.
     *
     * The same rule `withoutEcho` applies to the trust bar, for the same
     * reason: an eyebrow repeating the words directly beneath it is not
     * emphasis, it is the sentence twice, two lines apart. River Park's first
     * screen read "Locație de evenimente" over "Locație de evenimente în
     * Drăgășani" once the content director started naming the trade in the
     * business's own words.
     */
    const echoes = fold(section.heading).includes(fold(tagline));
    if (!echoes) return element('p', { class: 'eyebrow' }, text(tagline));
    return empty;
  }
  // A hero never labels itself: `hero` is a kind, not a word anybody wrote, and
  // a business with no published category would otherwise print it.
  if (ctx.plan === null || ctx.plan.emphasis === 'quiet' || section.kind === 'cta' || section.kind === 'hero') return empty;
  return element('p', { class: 'eyebrow' }, text(kindLabel(section.kind, ctx.language)));
}

/**
 * The section-kind eyebrow, in the page's language.
 *
 * An unsupported tag falls back to English, which is what this printed for
 * every page before the lexicon existed.
 */
function kindLabel(kind: SectionKind, language: string | null): string {
  const tag = (language ?? 'en').slice(0, 2).toLowerCase();
  const known = LANGUAGES.find((candidate) => candidate === tag) ?? 'en';
  return lexiconFor(known).kind[kind];
}

/**
 * The trust bar: verified facts, set small, directly under the hero's call to
 * action.
 *
 * Placement is the whole point. The same rating rendered in the contact block
 * at the foot of the page is read by nobody — a visitor decides whether a
 * business is real in the first screen, next to the button they are being
 * asked to press.
 *
 * A list rather than a paragraph, because these are discrete claims and a
 * screen reader should be able to count them. Separators are drawn in CSS, so
 * they are never announced.
 */
function renderTrustBar(ctx: SectionContext): Html {
  if (ctx.trust.length === 0) return empty;

  return element(
    'ul',
    { class: 'trust-bar', role: 'list', 'aria-label': 'Verified details' },
    ctx.trust.map((signal) =>
      element('li', { class: `trust-bar__item trust-bar__item--${signal.kind}` }, text(signal.label)),
    ),
  );
}

/** Heading, subheading and eyebrow as one block. */
function renderHead(section: WebsiteSection, ctx: SectionContext): Html {
  return element('div', { class: 'section__head' }, [
    renderEyebrow(section, ctx),
    renderHeading(section, ctx),
    renderSubheading(section),
  ]);
}

/* ------------------------------------------------------------------ */
/* Item layouts                                                        */
/* ------------------------------------------------------------------ */

/** A card: an index, a title, and the detail under it when the bullet carried one. */
function renderCard(bullet: string, ctx: SectionContext, index: number, extraClass = ''): Html {
  const { label, detail } = splitItem(bullet);

  return element('li', { class: `card${extraClass === '' ? '' : ` ${extraClass}`}` }, [
    renderIndex(ctx, index),
    element('h3', { class: 'card__title' }, text(label)),
    detail === '' ? null : element('p', { class: 'card__text' }, text(detail)),
  ]);
}

function renderCards(bullets: readonly string[], ctx: SectionContext, columns: number | null): Html {
  if (bullets.length === 0) return empty;
  return element('ul', { class: 'card-grid', role: 'list', style: columnStyle(columns) },
    bullets.map((bullet, index) => renderCard(bullet, ctx, index)),
  );
}

/**
 * A bento: cells of deliberately unequal weight.
 *
 * The span pattern is positional and fixed, not random — the first cell leads,
 * the fourth balances it, and the rest fill. A grid whose emphasis moves between
 * renders of the same content is not a design decision, it is noise.
 */
function renderBento(bullets: readonly string[], ctx: SectionContext, columns: number | null): Html {
  if (bullets.length === 0) return empty;

  const spans = ['wide tall', '', '', 'wide', '', 'tall'];
  return element('ul', { class: 'bento', role: 'list', style: columnStyle(columns ?? 3) },
    bullets.map((bullet, index) => {
      const span = spans[index % spans.length] ?? '';
      const classes = span.split(' ').filter((entry) => entry !== '').map((entry) => `bento__cell--${entry}`);
      return renderCard(bullet, ctx, index, ['bento__cell', ...classes].join(' '));
    }),
  );
}

/** A feature grid: index, title, detail — no card chrome. */
function renderFeatureGrid(bullets: readonly string[], ctx: SectionContext, columns: number | null): Html {
  if (bullets.length === 0) return empty;

  return element('ul', { class: 'feature-grid', role: 'list', style: columnStyle(columns) },
    bullets.map((bullet, index) => {
      const { label, detail } = splitItem(bullet);
      return element('li', { class: 'feature' }, [
        renderIndex(ctx, index),
        element('h3', { class: 'feature__title' }, text(label)),
        detail === '' ? null : element('p', { class: 'feature__text' }, text(detail)),
      ]);
    }),
  );
}

/**
 * A timeline: numbered steps on a rule.
 *
 * `<ol>` rather than `<ul>` — the numbering is the content here, not decoration,
 * and a screen reader should hear it.
 */
function renderTimeline(bullets: readonly string[], ctx: SectionContext): Html {
  if (bullets.length === 0) return empty;

  return element('ol', { class: 'timeline' },
    bullets.map((bullet, index) => {
      const { label, detail } = splitItem(bullet);
      return element('li', { class: 'timeline__step' }, [
        element('span', { class: 'timeline__marker', 'aria-hidden': 'true' },
          text(String(index + 1).padStart(2, '0'))),
        element('div', { class: 'timeline__body' }, [
          element('h3', { class: 'timeline__title' }, text(label)),
          detail === '' ? null : element('p', {}, text(detail)),
        ]),
      ]);
    }),
  );
}

/**
 * A detail list: label left, value right, leader between.
 *
 * The one layout that makes a menu read as a menu and an FAQ as an FAQ. A
 * bullet with no detail renders as a plain row rather than as a row with an
 * empty right-hand column.
 */
function renderDetailList(bullets: readonly string[], ctx: SectionContext, kind: SectionKind): Html {
  // A location OR contact section with real coordinates gets an actual map
  // — checked *before* the empty-bullets return below, deliberately: a
  // location section's address commonly lives in `section.body` (a single
  // sentence), not `bullets` (see `renderSection`'s body/bullets split) —
  // and the map must not silently vanish just because the address happens
  // to be prose rather than a bullet list, or because bullets is empty. The
  // coordinates are already-collected business evidence
  // (`BusinessProfile.coordinates`), never geocoded or invented here. Falls
  // through to the ordinary handling below (including the empty-bullets
  // return, and `contact`'s own tel:/mailto: rendering) when no coordinates
  // were supplied, exactly as these sections rendered before this existed.
  if ((kind === 'location' || kind === 'contact') && ctx.location !== null) {
    return renderLocationBlock(bullets, ctx.location, kind, ctx);
  }

  if (bullets.length === 0) return empty;

  // A contact section is not a list of facts, it is a set of ways to reach
  // somebody. Rendering it as one makes the page's most useful line the one
  // thing on it that cannot be clicked.
  if (kind === 'contact') return contactBlockWithForm(bullets, ctx);

  const priced = kind === 'menu';
  return element('ul', { class: `detail-list detail-list--${kind}`, role: 'list' },
    bullets.map((bullet) => {
      const { label, detail } = splitItem(bullet);
      if (detail === '') {
        return element('li', { class: 'detail-list__row' },
          element('span', { class: 'detail-list__label' }, text(label)));
      }
      return element('li', { class: 'detail-list__row detail-list__row--split' }, [
        element('span', { class: 'detail-list__label' }, text(label)),
        element('span', {
          class: `detail-list__value${priced ? ' detail-list__value--figure' : ''}`,
        }, text(detail)),
      ]);
    }),
  );
}

/**
 * The bounding-box half-width, in degrees, around the marker — roughly a
 * neighbourhood-scale view (~1.1km at the equator, tighter at higher
 * latitudes). Not a tuned constant, just a reasonable single default: this
 * is a "where is the business" map, not a navigation tool.
 */
const OSM_EMBED_DELTA = 0.01;

/** OpenStreetMap's documented, key-free embed endpoint — see APPROVED_IFRAME_ORIGINS (lib/qa/gates/technical.ts). */
function osmEmbedSrc(loc: { readonly lat: number; readonly lng: number }): string {
  const bbox = [
    loc.lng - OSM_EMBED_DELTA,
    loc.lat - OSM_EMBED_DELTA,
    loc.lng + OSM_EMBED_DELTA,
    loc.lat + OSM_EMBED_DELTA,
  ].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${loc.lat}%2C${loc.lng}`;
}

/** The full-site link the embed's own "View Larger Map" affordance also points at — a real fallback for a visitor who blocks iframes. */
function osmViewHref(loc: { readonly lat: number; readonly lng: number }): string {
  return `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`;
}

/**
 * A location section with real coordinates: the existing plain address list,
 * plus a real OpenStreetMap embed. The embed is `loading="lazy"` (it is
 * never above the fold on a business site) and carries a visible text link
 * to the full map alongside it — not a hidden fallback, a second, always-
 * present way to reach the same destination for a visitor who blocks
 * iframes, is on a screen reader (iframe content is not reliably announced),
 * or simply prefers a real map application.
 */
/** The map alone — the iframe embed plus its real, always-visible fallback link. Shared by every section kind the map can attach to. */
function renderMapBlock(loc: { readonly lat: number; readonly lng: number }): Html {
  return element('div', { class: 'location-map' }, [
    element('iframe', {
      class: 'location-map__frame',
      src: osmEmbedSrc(loc),
      title: 'Map',
      loading: 'lazy',
      referrerpolicy: 'no-referrer-when-downgrade',
    }, null),
    element('a', {
      class: 'location-map__link',
      href: osmViewHref(loc),
      target: '_blank',
      rel: 'noopener',
    }, text('View larger map')),
  ]);
}

/**
 * A location or contact section with real coordinates: its ordinary list
 * (plain address rows for `location`, clickable `tel:`/`mailto:` rows for
 * `contact` — `renderContactBlock`'s own rendering, unchanged), plus a real
 * map appended after it.
 *
 * `contact` is included deliberately, not just `location`: the deterministic
 * writer (`composeBaseline`, `agents/writerAgent.ts`) never emits a
 * dedicated `'location'` section at all — every address it writes lands in
 * `'contact'` alongside the phone/email. A `location`-only dispatch would
 * make this primitive correct in isolation but practically unreachable from
 * the real, no-live-AI production path, which is exactly the kind of gap a
 * real generation run (not a hand-authored fixture) surfaces and a targeted
 * unit test cannot. `location` stays supported too, for the AI writer path
 * (`writerAgent.run`) or a hand-authored spec that does emit it as its own
 * section, matching `fullContent`'s own fixture shape.
 */
function renderLocationBlock(
  bullets: readonly string[],
  loc: { readonly lat: number; readonly lng: number },
  kind: SectionKind,
  ctx: SectionContext,
): Html {
  const list = kind === 'contact'
    ? (bullets.length === 0 ? empty : contactBlockWithForm(bullets, ctx))
    : (bullets.length === 0 ? empty : element('ul', { class: 'detail-list detail-list--location', role: 'list' },
        bullets.map((bullet) => {
          const { label, detail } = splitItem(bullet);
          if (detail === '') {
            return element('li', { class: 'detail-list__row' },
              element('span', { class: 'detail-list__label' }, text(label)));
          }
          return element('li', { class: 'detail-list__row detail-list__row--split' }, [
            element('span', { class: 'detail-list__label' }, text(label)),
            element('span', { class: 'detail-list__value' }, text(detail)),
          ]);
        }),
      ));

  return element('div', { class: 'location-block' }, [list, renderMapBlock(loc)]);
}

/** An email address or a telephone number the visitor can actually act on. */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
const PHONE = /^[+(]?[\d][\d\s()+.-]{6,24}$/;

/**
 * Contact details as a block of large, reachable type.
 *
 * The bullets are unstructured strings, so what each one *is* has to be read off
 * its shape. Nothing is invented: a line that is not recognisably an address or
 * a number renders as itself, in the same block, just without a link — which is
 * the honest outcome for "Ask at the counter".
 *
 * `tel:` strips the number's spacing rather than reformatting it. The visible
 * text stays exactly what the writer wrote, because a phone number rewritten
 * into a house style is a phone number a local reader no longer recognises.
 */
function renderContactBlock(bullets: readonly string[], _ctx: SectionContext): Html {
  return element('ul', { class: 'contact-block', role: 'list' },
    bullets.map((bullet) => {
      const { label, detail } = splitItem(bullet);
      // "Email — hello@example.test" carries its own caption; a bare address
      // does not, so one is taken from what the value demonstrably is.
      const value = detail === '' ? label : detail;

      const isEmail = EMAIL.test(value);
      const isPhone = !isEmail && PHONE.test(value);

      /*
       * A caption describing the datum's own format, not a claim about the
       * business.
       *
       * The alternative was a numeric index, and "01" over a single email
       * address is a sequence of one — it reads as a numbered list that forgot
       * to have a second item. Calling an address "Email" invents nothing: it
       * is true of the string by inspection, which is a different thing from
       * writing copy the profile does not support. A line that is neither gets
       * no caption at all rather than a guessed one.
       */
      const caption = detail !== ''
        ? label
        : isEmail
          ? 'Email'
          : isPhone
            ? 'Phone'
            : '';

      const href = isEmail
        ? `mailto:${value}`
        : isPhone
          ? `tel:${value.replace(/[^\d+]/g, '')}`
          : null;

      const safe = href === null ? null : safeHref(href);
      const line = safe === null
        ? element('span', { class: 'contact-block__value' }, text(value))
        : element('a', { class: 'contact-block__value', href: safe }, text(value));

      return element('li', { class: 'contact-block__row' }, [
        caption === '' ? null : element('span', { class: 'contact-block__caption' }, text(caption)),
        line,
      ]);
    }),
  );
}

/**
 * The contact block plus, when `ctx.contactForm` is on (see
 * `RenderOptions.contactForm`'s own doc comment for why this defaults off),
 * a real submittable enquiry form appended after it.
 *
 * Additive, not a replacement: `renderContactBlock`'s `tel:`/`mailto:` links
 * are untouched and rendered first — they are the guaranteed-reachable path
 * (a visitor's own device sends the message, no intermediary to misconfigure)
 * — so a form whose backend integration turns out not to work as expected
 * degrades to "one fewer way to reach us," never to "no way to reach us."
 */
function contactBlockWithForm(bullets: readonly string[], ctx: SectionContext): Html {
  const block = bullets.length === 0 ? empty : renderContactBlock(bullets, ctx);
  if (!ctx.contactForm) return block;
  return join([block, renderContactFormBlock(bullets, ctx)], '\n');
}

/**
 * A real, static, submittable enquiry form — Netlify Forms
 * (`data-netlify="true"`), so it works with zero JavaScript: a plain HTML
 * `POST` is all Netlify's own build-time form scanner needs. A small inline
 * script progressively enhances it into an in-page confirmation (no full
 * page navigation to Netlify's generic success page, which would be a jarring
 * exit from an otherwise branded single-page site) — matching this
 * codebase's "no fake progress, only real states" discipline
 * (`lib/forge/functionalModules.ts`'s own doc comment): idle, sending,
 * handed-off, and error are all real, distinct, honestly-labelled states.
 *
 * Spam protection is a honeypot field (Netlify's own recommended pattern),
 * not reCAPTCHA: reCAPTCHA pulls in a third-party (Google) script and a
 * consent/GDPR question this renderer has no standing to answer on the
 * business's behalf, where a honeypot needs neither and Netlify's own
 * Akismet integration runs automatically server-side regardless.
 *
 * Only rendered when the business has a real phone or email somewhere in its
 * own contact bullets — a form with no way for anyone to plausibly notice a
 * submission (this render layer cannot itself send email; see WQ-024) would
 * be exactly the "capability that only looks real" defect
 * `WEBSITE_CAPABILITY_KNOWLEDGE.md`'s doctrine of absence warns against.
 */
function renderContactFormBlock(bullets: readonly string[], _ctx: SectionContext): Html {
  const hasContactPoint = bullets.some((bullet) => {
    const { label, detail } = splitItem(bullet);
    const value = detail === '' ? label : detail;
    return EMAIL.test(value) || PHONE.test(value);
  });
  if (!hasContactPoint) return empty;

  const formId = 'contact-form';
  const statusId = `${formId}-status`;

  // Vanilla, dependency-free, defensive against running twice (a page with
  // two contact sections is possible — see `renderSection`'s own fragment-id
  // de-duplication) by scoping strictly to this one form's own id.
  const script = `(function () {
  var form = document.getElementById(${JSON.stringify(formId)});
  if (!form || form.dataset.enhanced === '1') return;
  form.dataset.enhanced = '1';
  var status = document.getElementById(${JSON.stringify(statusId)});
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (status) { status.hidden = false; status.textContent = 'Sending…'; }
    fetch(form.getAttribute('action') || '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    }).then(function (response) {
      if (!response.ok) throw new Error('status ' + response.status);
      form.hidden = true;
      if (status) status.textContent = 'Thanks — your message has been received.';
    }).catch(function () {
      if (submit) submit.disabled = false;
      if (status) status.textContent = 'Sending failed — please use the phone or email above instead.';
    });
  });
})();`;

  return element('div', { class: 'contact-form-block' }, [
    element('form', {
      id: formId,
      name: 'contact',
      method: 'POST',
      action: '/',
      'data-netlify': 'true',
      'netlify-honeypot': 'bot-field',
      class: 'contact-form',
    }, [
      // The honeypot: invisible and unreachable to a real visitor (CSS
      // `display: none` plus `aria-hidden`/`tabindex="-1"` so assistive tech
      // never announces or focuses it either), present only for the bots
      // that fill in every field they can find.
      element('p', { class: 'contact-form__trap', 'aria-hidden': 'true' }, [
        element('label', {}, [
          text("Don't fill this out if you're human: "),
          element('input', { name: 'bot-field', type: 'text', tabindex: '-1', autocomplete: 'off' }, null),
        ]),
      ]),
      element('div', { class: 'contact-form__field' }, [
        element('label', { for: `${formId}-name` }, text('Name')),
        element('input', { id: `${formId}-name`, type: 'text', name: 'name', required: true, autocomplete: 'name' }, null),
      ]),
      element('div', { class: 'contact-form__field' }, [
        element('label', { for: `${formId}-email` }, text('Email')),
        element('input', { id: `${formId}-email`, type: 'email', name: 'email', autocomplete: 'email' }, null),
      ]),
      element('div', { class: 'contact-form__field' }, [
        element('label', { for: `${formId}-phone` }, text('Phone')),
        element('input', { id: `${formId}-phone`, type: 'tel', name: 'phone', autocomplete: 'tel' }, null),
      ]),
      element('div', { class: 'contact-form__field' }, [
        element('label', { for: `${formId}-message` }, text('Message')),
        element('textarea', { id: `${formId}-message`, name: 'message', required: true, rows: '4' }, null),
      ]),
      element('button', { type: 'submit', class: 'button button--primary' }, text('Send message')),
    ]),
    element('p', { id: statusId, class: 'contact-form__status', role: 'status', hidden: true }, null),
    element('script', {}, raw(script)),
  ]);
}

/** The pre-design list. Kept exactly as it was for the no-design path. */
function renderPlainList(bullets: readonly string[]): Html {
  if (bullets.length === 0) return empty;
  return element('ul', { class: 'plain-list', role: 'list' },
    bullets.map((bullet) => element('li', {}, text(bullet))),
  );
}

function renderQuotes(bullets: readonly string[], columns: number | null): Html {
  if (bullets.length === 0) return empty;

  return element('ul', { class: 'quote-list', role: 'list', style: columnStyle(columns) },
    bullets.map((bullet) => {
      const { quote, attribution } = splitQuote(bullet);
      return element('li', {},
        element('figure', { class: 'quote' }, [
          element('blockquote', {}, paragraphs(quote)),
          attribution === ''
            ? null
            : element('figcaption', { class: 'quote__source' }, text(attribution)),
        ]),
      );
    }),
  );
}

/** Bullets on a horizontal scroll-snap rail. Images take the rail if there are any. */
function renderRail(
  bullets: readonly string[],
  images: readonly ResolvedImage[],
  ctx: SectionContext,
): Html {
  if (images.length > 0) {
    return element('ul', { class: 'rail rail--media', role: 'list' },
      images.map((image) =>
        element('li', { class: 'rail__item' },
          element('figure', {}, [
            renderImage(image),
            image.alt === '' ? null : element('figcaption', {}, text(image.alt)),
          ]),
        ),
      ),
    );
  }
  if (bullets.length === 0) return empty;

  return element('ul', { class: 'rail', role: 'list' },
    bullets.map((bullet, index) => renderCard(bullet, ctx, index, 'rail__item')),
  );
}

/**
 * Rows that alternate which side the image sits on.
 *
 * Chosen only when the design confirmed one image per bullet, so the pairing is
 * by position and no row is left with an empty media column.
 */
function renderAlternating(
  bullets: readonly string[],
  images: readonly ResolvedImage[],
  ctx: SectionContext,
): Html {
  if (bullets.length === 0) return empty;

  return element('ul', { class: 'alternating', role: 'list' },
    bullets.map((bullet, index) => {
      const { label, detail } = splitItem(bullet);
      const image = images[index];
      return element('li', { class: 'alternating__row' }, [
        element('div', { class: 'alternating__media' },
          image === undefined ? mediaFallback(ctx) : renderImage(image)),
        element('div', { class: 'alternating__text' }, [
          element('h3', {}, text(label)),
          detail === '' ? null : element('p', {}, text(detail)),
        ]),
      ]);
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Section variants                                                    */
/* ------------------------------------------------------------------ */

interface VariantInput {
  readonly section: WebsiteSection;
  readonly ctx: SectionContext;
  readonly images: readonly ResolvedImage[];
  readonly columns: number | null;
}

type VariantRenderer = (input: VariantInput) => Html;

/**
 * Variants that position the section head themselves.
 *
 * Everything else emits content only and lets `SectionFrame` place the head,
 * which is what allows one variant to appear under four different silhouettes.
 * These three cannot: `split` and `editorial` are *about* where the head sits,
 * and a banner's head is centred inside its own block. A frame is never asked
 * to reposition a head that is already positioned — `frameCandidates` restricts
 * these variants to the frames that leave them alone.
 */
const OWNS_HEAD: ReadonlySet<SectionVariant> = new Set(['split', 'editorial', 'banner']);

/**
 * What every variant means in markup.
 *
 * Sixteen entries, because `SectionVariant` has sixteen members and a variant
 * the renderer silently treats as `stack` is worse than one the design never
 * chose — the page looks generic and the design artifact says it is not.
 */
const VARIANTS: Readonly<Record<SectionVariant, VariantRenderer>> = {
  stack: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    renderDetailList(section.bullets, ctx, section.kind),
    renderGallery(images, 'grid', columns),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  cards: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    renderCards(section.bullets, ctx, columns),
    renderGallery(images, 'grid', null),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  bento: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    renderBento(section.bullets, ctx, columns),
    renderGallery(images, 'grid', null),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  'feature-grid': ({ section, ctx, images, columns }) => join([
    renderBody(section),
    renderFeatureGrid(section.bullets, ctx, columns),
    renderGallery(images, 'grid', null),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  alternating: ({ section, ctx, images }) => join([
    renderBody(section),
    renderAlternating(section.bullets, images, ctx),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  timeline: ({ section, ctx, images }) => join([
    renderBody(section),
    renderTimeline(section.bullets, ctx),
    renderGallery(images, 'grid', null),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  /**
   * Two columns: the argument on the left, the evidence on the right.
   *
   * The media column takes the section's first image, or the fallback panel, so
   * the layout never renders as one narrow column beside a hole.
   */
  split: ({ section, ctx, images, columns }) => {
    const [lead, ...rest] = images;
    const aside = lead === undefined
      ? (section.bullets.length > 0
          ? renderDetailList(section.bullets, ctx, section.kind)
          : mediaFallback(ctx, 'media-fill--panel'))
      : element('figure', { class: 'split__media' }, [
          renderImage(lead),
          lead.alt === '' ? null : element('figcaption', {}, text(lead.alt)),
        ]);

    return join([
      element('div', { class: 'split', style: columnStyle(columns ?? 2) }, [
        element('div', { class: 'split__lead' }, join([
          renderHead(section, ctx),
          renderBody(section),
          lead === undefined ? empty : renderDetailList(section.bullets, ctx, section.kind),
          renderCallToAction(section, ctx, buttonVariant(section, ctx)),
        ], '\n')),
        element('div', { class: 'split__aside' }, aside),
      ]),
      renderGallery(rest, 'grid', null),
    ], '\n');
  },

  list: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    renderDetailList(section.bullets, ctx, section.kind),
    renderGallery(images, 'grid', columns),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  masonry: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    images.length === 0
      ? renderDetailList(section.bullets, ctx, section.kind)
      : renderGallery(images, 'masonry', columns),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  grid: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    images.length === 0
      ? renderDetailList(section.bullets, ctx, section.kind)
      : renderGallery(images, 'grid', columns),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  collage: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    images.length === 0
      ? renderDetailList(section.bullets, ctx, section.kind)
      : renderGallery(images, 'collage', columns),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  carousel: ({ section, ctx, images }) => join([
    renderBody(section),
    renderRail(section.bullets, images, ctx),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  slider: ({ section, ctx, images }) => join([
    renderBody(section),
    renderRail(section.bullets, images, ctx),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  quotes: ({ section, ctx, images, columns }) => join([
    renderBody(section),
    renderQuotes(section.bullets, columns),
    renderGallery(images, 'grid', null),
    renderCallToAction(section, ctx, buttonVariant(section, ctx)),
  ], '\n'),

  /**
   * Prose first.
   *
   * The heading sits in a narrow left column and the copy runs beside it at the
   * measure the type system computed — the one layout on the page that is built
   * around reading rather than around scanning.
   */
  editorial: ({ section, ctx, images }) => join([
    element('div', { class: 'editorial' }, [
      element('div', { class: 'editorial__head' }, renderHead(section, ctx)),
      element('div', { class: 'editorial__body' }, join([
        renderBody(section, 'section__body--lede'),
        renderDetailList(section.bullets, ctx, section.kind),
        renderCallToAction(section, ctx, buttonVariant(section, ctx)),
      ], '\n')),
    ]),
    renderGallery(images, 'grid', null),
  ], '\n'),

  banner: ({ section, ctx, images }) => join([
    element('div', { class: 'banner' }, join([
      renderHead(section, ctx),
      renderBody(section),
      renderCallToAction(section, ctx, 'button--primary'),
    ], '\n')),
    renderGallery(images, 'grid', null),
  ], '\n'),
};

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

/**
 * A section with almost nothing in it, set as one line.
 *
 * The alternative — and what every one of these rendered as before — is an
 * eyebrow, a display heading, a rule and a nine-word paragraph inside two
 * hundred pixels of padding at each edge. That is not restraint, it is a page
 * that ran out of things to say and kept the furniture. Here the heading
 * becomes a label and the sentence becomes the statement, which is the shape a
 * designer would have reached for.
 */
/**
 * The statement band: one sentence, alone, at display size.
 *
 * Deliberately the smallest renderer in this file. The pattern
 * `editorial-statement-break` says the band carries one sentence and nothing
 * else, and the temptation to add a label above it, a rule under it or a mark
 * beside it is exactly what turns an interruption back into a heading.
 *
 * A `<p>` rather than a `<blockquote>`: the sentence is the business's own
 * prose from its own site, not a quotation of somebody else, and marking it up
 * as a quote would tell a screen reader it is attributed when it is not.
 */
function renderPronouncement(section: WebsiteSection): Html {
  const line = section.body.trim();
  if (line === '') return empty;
  // The size is derived from the length, so a short line is enormous and a long
  // one settles near the heading step instead of becoming a large paragraph.
  return element(
    'p',
    { class: 'pronouncement', style: `--statement-length: ${Math.max(line.length, 14)}` },
    text(line),
  );
}

function renderStatement(section: WebsiteSection, ctx: SectionContext): Html {
  const line = section.body.trim() === ''
    ? (section.subheading ?? '').trim()
    : section.body.trim();

  return element('div', { class: 'statement' }, [
    element('div', { class: 'statement__label' }, [
      renderHeading(section, ctx),
    ]),
    element('div', { class: 'statement__line' }, [
      line === '' ? empty : element('p', {}, text(line)),
      renderDetailList(section.bullets, ctx, section.kind),
      renderCallToAction(section, ctx, buttonVariant(section, ctx)),
    ]),
  ]);
}

/**
 * Wraps a head and a body in the envelope the design chose.
 *
 * `aside` and `offset` share their markup and differ entirely in CSS — one puts
 * the head in a sticky narrow rail beside the content, the other indents the
 * head and lets the content run past it to the container's edge. Two DOM shapes
 * for what is one relationship would mean two things to keep in step.
 */
function renderFrame(frame: SectionFrame, head: Html, content: Html): Html {
  if (frame === 'aside' || frame === 'offset') {
    return element('div', { class: `frame frame--${frame}` }, [
      element('div', { class: 'frame__head' }, head),
      element('div', { class: 'frame__content' }, content),
    ]);
  }
  return element('div', { class: `frame frame--${frame}` }, [head, content]);
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

/**
 * Characters in the headline's longest word.
 *
 * The one measurement that decides whether a display size is art direction or a
 * defect. A display step is chosen for the viewport, but a headline is set in a
 * *column*, and the longest word is what has to fit in it.
 *
 * Zuni Café's page opened on "Californian restaurant in San Francisco" at
 * 143px in a 620px column. "Californian" measures about 950px at that size, so
 * `overflow-wrap` — correctly there, to stop a long trade word overflowing a
 * 390px phone — broke it mid-word, and the largest text on the site rendered as
 * "Californi / an / restauran / t in San Francisc / o".
 *
 * Emitting the count lets the stylesheet cap the size at something that fits,
 * with no measurement pass and no JavaScript. Floored at four so a one-word
 * headline like "Zuni" cannot compute an absurd cap.
 */
function longestWord(heading: string): number {
  const longest = heading
    .split(/\s+/)
    .reduce((max, word) => Math.max(max, word.length), 0);
  return Math.max(longest, 4);
}

/**
 * The hero's copy block, shared by every treatment.
 *
 * Split into a headline group and a supporting group rather than emitted as one
 * flat column. The two want opposite measures — a display line is set to about
 * fifteen characters and a lede to sixty — and stacking them means either the
 * headline runs too long or the lede runs too short. Keeping them as separate
 * elements is what lets a text-only hero set them beside each other, which is
 * the difference between a headline with half a screen of nothing to its right
 * and a hero that fills its own first screen.
 */
function heroContent(section: WebsiteSection, ctx: SectionContext): Html {
  return element('div', { class: 'hero__content' }, [
    element(
      'div',
      {
        class: 'hero__headline',
        /*
         * Two measurements, and they cap different failures.
         *
         * `--headline-chars` is the longest word, and it stops a single long
         * trade word being broken across lines. `--headline-length` is the
         * whole headline, and it stops a *short-worded but long* headline being
         * set at poster size: "Californian restaurant in San Francisco" has no
         * word over eleven characters, so the word cap left it at 169px and
         * four lines, and Zuni Café's hero ran to 151% of the first screen.
         */
        style:
          `--headline-chars: ${longestWord(section.heading)}`
          + `; --headline-length: ${Math.max(section.heading.trim().length, 8)}`,
      },
      [renderEyebrow(section, ctx), renderHeading(section, ctx)],
    ),
    element('div', { class: 'hero__support' }, [
      renderSubheading(section),
      renderBody(section),
      ctx.design === null
        ? renderPlainList(section.bullets)
        : renderDetailList(section.bullets, ctx, section.kind),
      renderCallToAction(section, ctx, 'button--primary'),
      renderTrustBar(ctx),
    ]),
  ]);
}

function heroMedia(image: ResolvedImage | undefined, ctx: SectionContext, extra = ''): Html {
  const classes = `hero__media${extra === '' ? '' : ` ${extra}`}`;
  if (image === undefined) {
    const fill = mediaFallback(ctx, 'media-fill--hero');
    return fill === empty ? empty : element('div', { class: classes }, fill);
  }
  return element('div', { class: classes }, renderImage(image, { loading: 'eager', fetchpriority: 'high' }));
}

/**
 * The seven hero treatments.
 *
 * These are the loudest decision on the page — the first screen is most of what
 * a visitor judges — so each one is a different tree rather than the same tree
 * under a different class. `full-bleed` lays type over the image and needs the
 * scrim `ImageStrategy.overlayOpacity` specifies; `magazine` needs a second
 * image to build its grid; `minimal` deliberately drops the media the section
 * may well have.
 */
const HEROES: Readonly<Record<HeroVariant, (section: WebsiteSection, ctx: SectionContext, images: readonly ResolvedImage[]) => Html>> = {
  centered: (section, ctx, images) => join([
    element('div', { class: 'hero hero--centered' }, heroContent(section, ctx)),
    heroMedia(images[0], ctx, 'hero__media--band'),
    renderGallery(images.slice(1), 'grid', null),
  ], '\n'),

  split: (section, ctx, images) => join([
    element('div', { class: 'hero hero--split' }, [
      heroContent(section, ctx),
      heroMedia(images[0], ctx),
    ]),
    renderGallery(images.slice(1), 'grid', null),
  ], '\n'),

  editorial: (section, ctx, images) => join([
    element('div', { class: 'hero hero--editorial' }, [
      heroContent(section, ctx),
      images[0] === undefined ? null : heroMedia(images[0], ctx, 'hero__media--column'),
    ]),
    renderGallery(images.slice(1), 'grid', null),
  ], '\n'),

  'image-first': (section, ctx, images) => join([
    element('div', { class: 'hero hero--image-first' }, [
      heroMedia(images[0], ctx, 'hero__media--band'),
      heroContent(section, ctx),
    ]),
    renderGallery(images.slice(1), 'grid', null),
  ], '\n'),

  /**
   * Type over the photograph.
   *
   * The scrim is an element rather than a gradient on the image so the opacity
   * the design chose survives a browser that will not composite a filter, and
   * so the text never sits on an unmediated photo.
   */
  'full-bleed': (section, ctx, images) => join([
    element('div', { class: 'hero hero--full-bleed' }, [
      element('div', { class: 'hero__backdrop' }, [
        images[0] === undefined
          ? mediaFallback(ctx, 'media-fill--hero')
          : renderImage(images[0], { loading: 'eager', fetchpriority: 'high', class: 'hero__image' }),
        element('div', { class: 'hero__scrim', 'aria-hidden': 'true' }),
      ]),
      heroContent(section, ctx),
    ]),
    renderGallery(images.slice(1), 'grid', null),
  ], '\n'),

  /**
   * An asymmetric grid: copy in one cell, images in the rest.
   *
   * Only chosen when the section has two or more images, so the second cell is
   * never empty.
   */
  magazine: (section, ctx, images) => element('div', { class: 'hero hero--magazine' }, [
    heroContent(section, ctx),
    element('div', { class: 'hero__mosaic' },
      images.slice(0, 3).map((image, index) =>
        element('div', { class: `hero__tile hero__tile--${index}` }, renderImage(image, index === 0
          ? { loading: 'eager', fetchpriority: 'high' }
          : {})),
      ),
    ),
  ]),

  minimal: (section, ctx, images) => join([
    element('div', { class: 'hero hero--minimal' }, heroContent(section, ctx)),
    renderGallery(images, 'grid', null),
  ], '\n'),
};

/** The pre-design hero. Byte-compatible with what the renderer emitted before. */
function legacyHero(section: WebsiteSection, ctx: SectionContext, images: readonly ResolvedImage[]): Html {
  const [lead, ...rest] = images;
  const tagline = ctx.tagline?.trim();

  const content = element('div', { class: 'hero__content' }, [
    tagline ? element('p', { class: 'hero__tagline' }, text(tagline)) : null,
    renderHeading(section, ctx),
    renderSubheading(section),
    renderBody(section),
    renderPlainList(section.bullets),
    renderCallToAction(section, ctx, 'button--primary'),
    renderTrustBar(ctx),
  ]);

  const media = lead === undefined
    ? null
    : element('div', { class: 'hero__media' }, renderImage(lead, { loading: 'eager' }));

  return join([
    element('div', { class: `hero${media === null ? '' : ' hero--with-media'}` }, [content, media]),
    renderGallery(rest),
  ], '\n');
}

/** The pre-design body. Byte-compatible with what the renderer emitted before. */
function legacyLayout(section: WebsiteSection, ctx: SectionContext, images: readonly ResolvedImage[]): Html {
  const layout = BULLET_LAYOUTS[section.kind];
  const bullets = layout === 'cards'
    ? element('ul', { class: 'card-grid', role: 'list' },
        section.bullets.map((bullet) => element('li', { class: 'card' }, paragraphs(bullet))))
    : layout === 'quotes'
      ? element('ul', { class: 'quote-list', role: 'list' },
          section.bullets.map((bullet) =>
            element('li', {}, element('blockquote', { class: 'quote' }, paragraphs(bullet)))))
      : renderPlainList(section.bullets);

  return join([
    renderHeading(section, ctx),
    renderSubheading(section),
    renderBody(section),
    section.bullets.length === 0 ? empty : bullets,
    renderGallery(images),
    renderCallToAction(section, ctx, section.kind === 'cta' ? 'button--primary' : 'button--ghost'),
  ], '\n');
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Renders one section.
 *
 * The class list and the `data-` attributes are the design decision made
 * legible: a reviewer can read `data-variant="bento" data-emphasis="lead"` off
 * the page and check it against `design.json` without running anything.
 *
 * `aria-labelledby` points every landmark at its own heading, so a screen
 * reader's list of regions reads as the site's outline rather than as eleven
 * entries called "section".
 */
export function renderSection(section: WebsiteSection, ctx: SectionContext): Html {
  const images = resolveImages(section, ctx);
  const plan = ctx.plan;

  if (plan === null) {
    // No design: the pre-layout renderer, unchanged.
    const classes = [
      'section',
      `section--${section.kind}`,
      ctx.alternate && section.kind !== 'hero' && section.kind !== 'cta' ? 'section--alt' : null,
    ].filter((entry): entry is string => entry !== null);

    const inner = section.kind === 'hero'
      ? legacyHero(section, ctx, images)
      : legacyLayout(section, ctx, images);

    return element(
      'section',
      { id: ctx.id, class: classes.join(' '), 'aria-labelledby': ctx.headingId },
      element('div', { class: 'container' }, inner),
    );
  }

  const isHero = section.kind === 'hero';
  const heroVariant = ctx.hero ?? 'centered';

  const inner = isHero
    ? HEROES[heroVariant](section, ctx, images)
    : section.kind === 'statement'
      ? renderPronouncement(section)
      : plan.frame === 'statement'
        ? renderStatement(section, ctx)
        : (() => {
          const content = (VARIANTS[plan.variant] ?? VARIANTS.stack)(
            { section, ctx, images, columns: plan.columns },
          );
          // A variant that placed its own head is handed straight through: the
          // frame would otherwise emit a second one.
          return OWNS_HEAD.has(plan.variant)
            ? content
            : renderFrame(plan.frame, renderHead(section, ctx), content);
        })();

  const classes = [
    'section',
    `section--${section.kind}`,
    isHero ? `section--hero-${heroVariant}` : `section--${plan.variant}`,
    plan.fullBleed ? 'section--bleed' : null,
    plan.momentTransition ? 'section--moment' : null,
    // The transition *kind* follows the boolean so the CSS can pick the concrete
    // primitive (veil | wipe | circular-handoff) without re-deriving it.
    plan.momentTransition ? `section--moment-${plan.transition}` : null,
    // A genuine composition break, not just a bigger heading: the section the
    // narrative built to gets its own layout rules (see `designRules`), so the
    // climax reads as a different *kind* of section rather than an ordinary
    // one turned up loud.
    !isHero && plan.role === 'signature' ? 'section--signature-composition' : null,
  ].filter((entry): entry is string => entry !== null);

  // A bleeding section drops the measured container so its media can reach the
  // viewport edge; its copy is re-contained by the variant's own rules.
  const containerClass = plan.fullBleed
    ? 'container container--wide'
    : 'container';

  return element(
    'section',
    {
      id: ctx.id,
      class: classes.join(' '),
      /*
       * The statement band has no heading, on purpose — a label above the
       * sentence would be a claim the business never made. So it cannot point
       * `aria-labelledby` at one: that would name an element that is not in the
       * document, and a landmark labelled by a missing id is announced as
       * unlabelled with a console error behind it.
       */
      ...(section.kind === 'statement'
        ? { 'aria-label': 'In their own words' }
        : { 'aria-labelledby': ctx.headingId }),
      'data-variant': isHero ? heroVariant : plan.variant,
      'data-frame': isHero ? 'stacked' : plan.frame,
      'data-emphasis': plan.emphasis,
      'data-density': plan.density,
      'data-bg': plan.background,
      // The beat this section plays, so the stylesheet can treat the page's
      // peak as a peak rather than treating "a gallery" as a gallery.
      ...(plan.role === null ? {} : { 'data-role': plan.role }),
      ...(plan.momentTransition ? { 'data-moment': 'true' } : {}),
      ...(plan.momentTransition ? { 'data-transition': plan.transition } : {}),
    },
    element('div', { class: containerClass }, inner),
  );
}
