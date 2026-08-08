/**
 * Art direction: which photographs a page may use, and where.
 *
 * The renderer decides how a picture looks. This decides *whether it belongs*,
 * which is a different question and the one the platform kept getting wrong.
 *
 * ## The defect this exists for
 *
 * Tartine Bakery's generated gallery opened on a **cookbook**. The largest cell
 * on the page — the one a masonry gives its first landscape image — was a
 * hardback resting on a chopping board, photographed for a retail listing. Five
 * more followed it. The bakery has forty-nine photographs of bread, and the page
 * led with the merchandise.
 *
 * Nothing was invented and nothing was stolen: the images are on the business's
 * own homepage, in its own `<img>` tags. They were used **because they existed**,
 * which is precisely the rule this file exists to break.
 *
 * ## Why the word list was never going to be enough
 *
 * The writer already carried a `NOT_PHOTOGRAPHY` list with `book`, `cover`,
 * `cookbook` and `amazon` on it. It caught three of the six. It missed
 * `IMG_1307.jpeg` captioned *"Tartine: A Classic Revisited"* — a book title with
 * no word in it that names a book — and that one became the lead cell.
 *
 * A blocklist can only ever be as good as the last page that embarrassed us, and
 * every entry added to it is a guess about the next one. So the rules here are
 * *relative and mechanical* wherever possible: they compare an image to the other
 * images on the same site rather than to a vocabulary of things we have already
 * been caught by.
 *
 * ## The rule that did catch all six
 *
 * **A site serves its photography larger than it serves its furniture.**
 *
 * Tartine's cookbooks are served at 297–800px. Its photography is served at
 * 1800–2000px. That gap is not a coincidence about bakeries; it is what a CMS
 * does. Editorial imagery is uploaded at full resolution because it will be
 * displayed large, and a thumbnail beside a buy-link is uploaded at the size the
 * thumbnail needs.
 *
 * So the threshold is derived from the set, not declared: take the median served
 * width, and drop what falls far below it. On a site whose photography is all
 * 600px wide, the median is 600 and nothing is dropped. On Tartine it removes six
 * cookbooks and keeps forty-three photographs, without knowing what a cookbook is.
 *
 * Guarded three ways, because a relative rule with no floor will happily empty a
 * gallery: it needs enough candidates to have a meaningful median, it never cuts
 * below an absolute floor, and it refuses to run if it would leave too few.
 *
 * ## Subjects, and why a section may end up with no photograph at all
 *
 * The second defect was quieter. A `location` section was handed whatever image
 * happened to be next in the pool — for Tartine, a tray of pastries — and
 * captioned it with the street address. The photograph was real, the address was
 * real, and the page still told a stranger that this was what the corner of 18th
 * and Guerrero looks like.
 *
 * A section about a specific place must not receive an unrelated photograph
 * merely because one is available. So images carry `Subject` tags, sections
 * declare what they can accept, and a section with nothing appropriate gets
 * **nothing**. An empty band is a smaller failure than a confident lie, and the
 * layout planner already knows how to compose a section that has no media.
 *
 * Subject tags are evidence-based and openly incomplete — `scene` is the default
 * and means "no tag argued otherwise", not "verified photograph of the business".
 * They are used to *exclude* and to *rank*, never to caption. Nothing in this
 * file ever writes alt text, because that would be inventing a description of a
 * picture nobody has looked at.
 *
 * ## Determinism
 *
 * Pure. No clock, no randomness, no network, no filesystem. Every sort carries a
 * total-order tiebreak on the URL, so the same profile always yields the same
 * page — which is what makes a visual regression a readable diff.
 */

import type { ImageAsset, SectionKind } from '../types.js';

/* ------------------------------------------------------------------ */
/* Served width                                                        */
/* ------------------------------------------------------------------ */

/** Query keys a CDN uses to state the width it is serving. */
const WIDTH_PARAMS = ['w', 'width', 'wid', 'sz', 'size', 'maxwidth'];

/**
 * How wide this image was served, or `null` when nothing says.
 *
 * The intrinsic size the browser reported is the better answer and is taken
 * first — but it is frequently absent, because an image that has not finished
 * decoding when the collector reads the DOM reports nothing. Tartine's
 * photography is `null` for exactly that reason while its thumbnails, which
 * decode instantly, all carry a size. Trusting only the intrinsic value would
 * therefore compare the small images against each other and conclude they are
 * all the same size.
 *
 * The URL is the fallback and on a CMS-backed site it is usually present:
 * `?w=1800` is Contentful, Shopify, Cloudinary, WordPress and Squarespace all
 * saying the same thing. A path segment is deliberately not read — `/1800/` in a
 * URL is as likely to be an id as a width.
 */
export function servedWidth(image: ImageAsset): number | null {
  if (image.width !== null && image.width > 0) return image.width;

  try {
    const params = new URL(image.url).searchParams;
    for (const key of WIDTH_PARAMS) {
      const raw = params.get(key);
      if (raw === null) continue;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // An unparseable URL simply contributes no signal.
  }
  return null;
}

/** The median of a list of numbers, or `null` when it is empty. */
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const low = sorted[mid - 1];
  const high = sorted[mid];
  if (low === undefined || high === undefined) return null;
  return (low + high) / 2;
}

/**
 * The smallest an image may be, relative to the rest of the set.
 *
 * 0.6 rather than something tighter because a responsive site legitimately
 * serves a secondary image at half the width of its hero, and that image is
 * still photography. Tartine's ratio is 800/1800 = 0.44, comfortably under.
 */
const UNDERSIZED_RATIO = 0.6;

/**
 * The absolute floor, whatever the median says.
 *
 * A site whose photography is all 700px wide should lose nothing to this rule.
 * 560 is under the smallest width at which a photograph still reads as
 * photography in a full-width band on a phone.
 */
const UNDERSIZED_FLOOR = 560;

/** Below this many candidates, a median is a coincidence rather than a norm. */
const MIN_FOR_RELATIVE_RULE = 6;

/** The rule refuses to run if it would leave fewer than this. */
const MIN_SURVIVORS = 4;

/**
 * Drops the images this site serves markedly smaller than the rest.
 *
 * Returns the input unchanged when the set is too small to reason about, when
 * no image states a width, or when applying the threshold would strip the page
 * of its photography — a gallery of four honest images beats an empty band, and
 * a heuristic that can empty a page is worse than no heuristic.
 */
export function dropUndersized(
  images: readonly ImageAsset[],
): { readonly kept: readonly ImageAsset[]; readonly note: string | null } {
  if (images.length < MIN_FOR_RELATIVE_RULE) return { kept: images, note: null };

  const widths = images
    .map(servedWidth)
    .filter((width): width is number => width !== null);
  if (widths.length < MIN_FOR_RELATIVE_RULE) return { kept: images, note: null };

  const norm = median(widths);
  if (norm === null) return { kept: images, note: null };

  const threshold = Math.max(UNDERSIZED_FLOOR, norm * UNDERSIZED_RATIO);

  // An unknown width is kept. Absence of evidence is not evidence of a
  // thumbnail, and the intrinsic size is missing precisely on the large images.
  const kept = images.filter((image) => {
    const width = servedWidth(image);
    return width === null || width >= threshold;
  });

  if (kept.length < MIN_SURVIVORS || kept.length === images.length) {
    return { kept: images, note: null };
  }

  return {
    kept,
    note:
      `Dropped ${images.length - kept.length} of ${images.length} images served under `
      + `${Math.round(threshold)}px, against a site median of ${Math.round(norm)}px.`,
  };
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

/**
 * What a photograph appears to be *of*.
 *
 * Four tags, chosen because each changes where an image may be placed, and no
 * more than four because every additional tag is another guess nobody has
 * verified by looking at the picture.
 *
 * - `merchandise` — a retail packshot. Never appropriate anywhere.
 * - `venue` — the premises: a room, a frontage, a street. The only tag a
 *   `location` section will accept.
 * - `people` — staff, founders, customers. Excellent once on an about section
 *   and tiring in quantity, so the gallery rations it.
 * - `scene` — the default, and deliberately the weakest claim in the set. It
 *   means only that nothing argued otherwise.
 */
export type Subject = 'merchandise' | 'venue' | 'people' | 'scene';

/**
 * Words that argue for a subject, matched against alt text, file name and the
 * path of the page the image was found on.
 *
 * Kept short on purpose. A long vocabulary is a long list of guesses, and the
 * relative-width rule above is doing the heavy lifting — these only need to
 * catch the cases where *placement* matters, which is a much smaller job than
 * deciding what every photograph on the internet contains.
 */
const SUBJECT_WORDS: Readonly<Record<Exclude<Subject, 'scene'>, readonly string[]>> = {
  merchandise: [
    'book', 'cookbook', 'hardcover', 'paperback', 'isbn', 'cover',
    'amazon', 'shopify', 'giftcard', 'gift card', 'voucher', 'merch',
    'packshot', 'product-shot', 'packaging', 'tote', 'apron', 'tshirt',
    't-shirt', 'hoodie', 'sticker', 'poster', 'buy-now', 'add-to-cart',
  ],
  venue: [
    'interior', 'exterior', 'storefront', 'shopfront', 'shop-front',
    'facade', 'entrance', 'doorway', 'frontage', 'building', 'premises',
    'dining', 'diningroom', 'dining-room', 'counter', 'bar', 'lobby',
    'terrace', 'patio', 'courtyard', 'seating', 'reception', 'street-view',
    'outside', 'inside', 'venue', 'room',
  ],
  people: [
    'portrait', 'portraits', 'headshot', 'team', 'staff', 'crew',
    'founder', 'founders', 'owner', 'chef', 'baker', 'stylist',
    'dentist', 'doctor', 'lawyer', 'people', 'guests', 'customers', 'group',
  ],
};

/** The words this image offers, lowercased: alt, file name and source path. */
function haystackOf(image: ImageAsset): string {
  let path = '';
  let file = '';
  try {
    const url = new URL(image.url);
    file = url.pathname.split('/').pop() ?? '';
  } catch {
    file = image.url;
  }
  try {
    path = new URL(image.sourceUrl).pathname;
  } catch {
    // Not a parseable URL; the alt and file name still contribute.
  }
  // Separators become spaces so "shop-front" matches "shopfront" and vice versa
  // is handled by carrying both spellings in the vocabulary.
  return `${image.alt ?? ''} ${file} ${path}`.toLowerCase().replace(/[_+]/g, '-');
}

/**
 * Tags an image.
 *
 * Returns exactly one tag. Where several vocabularies match, `merchandise`
 * wins — it is the only tag that excludes rather than places, and a photograph
 * of a person holding a branded tote is a photograph of the tote.
 */
export function subjectOf(image: ImageAsset): Subject {
  const haystack = haystackOf(image);
  const hits = (words: readonly string[]): boolean =>
    words.some((word) => haystack.includes(word));

  if (hits(SUBJECT_WORDS.merchandise)) return 'merchandise';
  if (hits(SUBJECT_WORDS.venue)) return 'venue';
  if (hits(SUBJECT_WORDS.people)) return 'people';
  return 'scene';
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

/**
 * Which subjects each section will accept, best first.
 *
 * A section absent from this table takes no photograph at all — which is why
 * `hours`, `contact`, `faq` and `cta` are missing rather than empty. Those
 * sections are information, and a decorative photograph behind information is
 * the padding that makes a generated page feel generated.
 *
 * `location` accepts `venue` and nothing else. That is the Tartine rule stated
 * as data: a section about a specific place either shows that place or shows
 * no picture.
 */
const SECTION_SUBJECTS: Partial<Record<SectionKind, readonly Subject[]>> = {
  hero: ['scene', 'venue'],
  about: ['people', 'venue', 'scene'],
  location: ['venue'],
  services: ['scene'],
  menu: ['scene'],
  testimonials: ['people', 'scene'],
};

/**
 * The best photograph in `pool` for this section, or `null`.
 *
 * `null` is a real answer and the caller must render it as one. Returning a
 * merely-tolerable image instead is how a tray of pastries came to illustrate a
 * street corner.
 */
export function chooseForSection(
  kind: SectionKind,
  pool: readonly ImageAsset[],
): ImageAsset | null {
  const accepted = SECTION_SUBJECTS[kind];
  if (accepted === undefined) return null;

  for (const subject of accepted) {
    const match = pool.find((image) => subjectOf(image) === subject);
    if (match !== undefined) return match;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

/**
 * How many photographs a gallery may show.
 *
 * Down from twelve, and the reduction is the point. Tartine's twelve-image
 * masonry ran 2,400px — over forty percent of the page — and read as a
 * scrapbook: every photograph the site had, at whatever crop it came in,
 * stacked until they ran out. A gallery is an edit. Eight is enough to show
 * range and few enough that each one can be large.
 */
const GALLERY_BUDGET = 8;

/**
 * The most portraits a gallery will carry.
 *
 * Faces are the strongest thing in any grid and they stop being about the
 * business at about the third one, when a portfolio becomes a staff album. One
 * is a signature; four is an org chart.
 */
const MAX_PEOPLE_IN_GALLERY = 2;

export interface Curation {
  readonly chosen: readonly ImageAsset[];
  /** Everything not chosen, in rank order — the pool other sections draw from. */
  readonly rest: readonly ImageAsset[];
  /** Human-readable decisions, for the design notes. */
  readonly notes: readonly string[];
}

/** Rank within a subject, best first. Higher is better. */
function scoreOf(image: ImageAsset): number {
  const width = servedWidth(image);
  // Width is the only quality signal available without decoding the bytes, and
  // it is a decent one: the image a site serves largest is the one it is
  // proudest of. Unknown widths sort mid-pack rather than last.
  return width ?? 900;
}

/**
 * Chooses the gallery, and returns what is left for everything else.
 *
 * Three passes, in order: drop what the site serves as furniture, drop the
 * merchandise, then fill the budget largest-first while rationing portraits.
 * Everything the budget could not take stays in `rest` at full rank, so a
 * section asking for a `venue` shot still gets the best one rather than
 * whatever the gallery declined.
 */
export function curateGallery(images: readonly ImageAsset[]): Curation {
  const notes: string[] = [];

  const sized = dropUndersized(images);
  if (sized.note !== null) notes.push(sized.note);

  const merchandise = sized.kept.filter((image) => subjectOf(image) === 'merchandise');
  const usable = sized.kept.filter((image) => subjectOf(image) !== 'merchandise');
  if (merchandise.length > 0) {
    notes.push(
      `Held back ${merchandise.length} image${merchandise.length === 1 ? '' : 's'} that `
      + 'read as merchandise rather than as photography of the business.',
    );
  }

  // A total order: score descending, then URL, so the result never depends on
  // the order the collector happened to harvest in.
  const ranked = [...usable].sort(
    (a, b) => scoreOf(b) - scoreOf(a) || a.url.localeCompare(b.url),
  );

  const chosen: ImageAsset[] = [];
  const deferred: ImageAsset[] = [];
  let people = 0;

  for (const image of ranked) {
    if (chosen.length >= GALLERY_BUDGET) {
      deferred.push(image);
      continue;
    }
    if (subjectOf(image) === 'people') {
      if (people >= MAX_PEOPLE_IN_GALLERY) {
        deferred.push(image);
        continue;
      }
      people += 1;
    }
    chosen.push(image);
  }

  if (ranked.length > chosen.length) {
    notes.push(
      `Showed ${chosen.length} of ${ranked.length} usable photographs; a gallery is an edit.`,
    );
  }

  return { chosen, rest: [...deferred, ...merchandise], notes };
}
