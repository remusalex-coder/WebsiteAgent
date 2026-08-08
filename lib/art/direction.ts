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

/**
 * What makes two images the same photograph.
 *
 * ## Why the URL is not the answer
 *
 * Paradise Dental Care's page showed the same jar of toothbrushes as its hero,
 * again in its services section and again in its gallery. The normalizer had
 * already deduplicated by URL and by SHA-256 of the bytes, and both passes were
 * right to keep them: the two are served under different content ids —
 *
 *   .../635f122f.../6e0f1480-935e-4d50-ae27-4ff47b336471/blue-tooth-brushes-min.jpg
 *   .../635f122f.../b825e01e-7fb9-4284-8f78-2f71b9aac001/blue-tooth-brushes-min.jpg
 *
 * — and re-encoded, so the bytes differ too. Every mechanical identity the
 * pipeline had said "two images". A visitor sees one photograph, three times.
 *
 * ## The file name is the identity
 *
 * Squarespace, WordPress and Contentful all mint a fresh path when an asset is
 * re-uploaded or re-cropped and all of them keep the original file name. That
 * name is what the person who took the photograph called it, and it survives
 * everything the CDN does to the bytes.
 *
 * The extension is dropped, because the same picture is routinely served as
 * both `.jpg` and `.webp`. Nothing else is stripped: trimming size suffixes
 * would fold `hero-1000` and `hero-2000` together, which is correct, and also
 * `team-2019` and `team-2020`, which is not — and a page showing two similar
 * photographs is a much smaller failure than a page missing one.
 */
export function photoIdentity(image: ImageAsset): string {
  try {
    const file = new URL(image.url).pathname.split('/').pop() ?? image.url;
    return file.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  } catch {
    return image.url.toLowerCase();
  }
}

/** Keeps the first of each distinct photograph, in the order given. */
export function dedupeByIdentity(images: readonly ImageAsset[]): readonly ImageAsset[] {
  const seen = new Set<string>();
  return images.filter((image) => {
    const identity = photoIdentity(image);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

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
 * Down from twelve, then from eight, and each cut made the page better.
 *
 * Tartine's twelve-image masonry ran 2,400px — over forty percent of the page —
 * and read as a scrapbook: every photograph the site had, at whatever crop it
 * came in, stacked until they ran out.
 *
 * Six rather than eight because the collage composition has exactly six roles:
 * a lead, its partner, two details, the full-measure turn, and a coda. A
 * seventh and eighth image do not extend that sequence, they *restart* it,
 * because the item classes cycle every six. Tartine rendered the lead crop
 * twice and the gallery grew to 3,572px — four screens, half the page.
 *
 * A gallery is an edit. Six photographs at four different scales say more about
 * a business than twelve at two, and they say it in a third of the height.
 */
export const GALLERY_BUDGET = 6;

/**
 * The most portraits a gallery will carry.
 *
 * Faces are the strongest thing in any grid and they stop being about the
 * business at about the third one, when a portfolio becomes a staff album. One
 * is a signature; four is an org chart.
 */
const MAX_PEOPLE_IN_GALLERY = 2;

/**
 * Puts the strongest photographs where the composition is loudest.
 *
 * The renderer's collage gives two cells far more weight than the other four:
 * the **lead**, which is twice the height of anything beside it, and the
 * **close**, which runs the full measure at a cinematic crop. Those two cells
 * are what a visitor remembers, and handing them to whatever happened to sort
 * first by width is how a bakery came to be represented by a beach.
 *
 * So the sequence is arranged rather than merely ranked: the two best images
 * that actually show the business take the two positions that claim to
 * represent it, and everything else fills the middle in rank order. A story
 * photograph keeps its place in the sequence; it simply stops speaking for the
 * business.
 *
 * Falls back to the given order whenever there is nothing to arrange — fewer
 * than three images, or a business whose photography is *all* from its story
 * page, in which case there is no better choice available and pretending
 * otherwise would just be a different arbitrary order.
 */
export function arrangeSequence(images: readonly ImageAsset[]): readonly ImageAsset[] {
  if (images.length < 3) return images;

  const representative = images.filter((image) => !isStoryImage(image) && subjectOf(image) !== 'people');
  if (representative.length < 2) return images;

  const lead = representative[0];
  const close = representative[1];
  if (lead === undefined || close === undefined) return images;

  const middle = images.filter((image) => image !== lead && image !== close);
  return [lead, ...middle, close];
}

export interface Curation {
  readonly chosen: readonly ImageAsset[];
  /** Everything not chosen, in rank order — the pool other sections draw from. */
  readonly rest: readonly ImageAsset[];
  /** Human-readable decisions, for the design notes. */
  readonly notes: readonly string[];
}

/**
 * Pages whose photography illustrates a story rather than showing the business.
 *
 * A history or founder's-story page carries pictures chosen to narrate: a field
 * of wheat, a coastline, a portrait from twenty years ago. They are real, they
 * belong to the business, and they are the wrong pictures to *lead* with —
 * because a stranger looking at the top of a gallery is trying to find out what
 * this place is like now.
 *
 * Tartine proved it the expensive way. Its strongest cells — the lead and the
 * full-measure close — went to a wheat field and two people sitting on a beach,
 * both from `/about/our-story`, because those images are wide and the sequence
 * was ordered by width. The most prominent photograph on a bakery's page was a
 * beach.
 *
 * This does not drop them. A story photograph in the middle of a sequence is
 * texture and belongs there; it simply must not take a position that claims to
 * represent the business.
 */
const STORY_PATHS = ['our-story', 'our_story', 'history', 'heritage', 'journey', 'about/story'];

/** True when the page this came from was telling a story rather than showing the place. */
function isStoryImage(image: ImageAsset): boolean {
  try {
    const path = new URL(image.sourceUrl).pathname.toLowerCase();
    return STORY_PATHS.some((marker) => path.includes(marker));
  } catch {
    return false;
  }
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

  const distinct = dedupeByIdentity(images);
  if (distinct.length < images.length) {
    notes.push(
      `Folded ${images.length - distinct.length} republished copies of photographs the page already had.`,
    );
  }

  const sized = dropUndersized(distinct);
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
