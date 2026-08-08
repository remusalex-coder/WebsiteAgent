/**
 * A brand colour, read off the business's own photographs.
 *
 * ## Why the page needed this
 *
 * Every generated site got its colour from one of three places: a hex the
 * writer happened to suggest, a hex found loose in the crawled page text, or —
 * overwhelmingly — the industry's fallback hue. That last case is the one that
 * matters, because it is what most businesses land on, and it means a bakery is
 * amber because *bakeries are amber*, not because anything about this bakery is.
 *
 * The result was a platform that could produce eleven directions and still make
 * two different bakeries the same colour. Tartine's page ran a flat mustard
 * against photographs of dark rye, burnt crust and warm cream — a palette
 * sitting beside the pictures rather than belonging to them.
 *
 * A business's photographs are the most honest statement of its colour it has.
 * They were shot in its room, under its light, of its work. Reading the seed
 * from them is not a stylistic flourish; it is the difference between a page
 * coloured *about* a category and a page coloured *from* a business.
 *
 * ## What this file is and is not
 *
 * Pure, and deliberately so. It takes decoded pixels and returns a hex. It does
 * no I/O, opens no browser and decodes nothing — `decode.ts` does that, outside
 * the design layer, so `composeDesign` stays a pure function of its inputs and
 * the whole design layer stays snapshot-testable.
 *
 * It returns a **seed**, not a palette. `buildColorSystem` already knows how to
 * build ramps, roles, surfaces and accessible text pairs from one hue; handing
 * it a photographic seed improves every one of those without touching the
 * contrast machinery that makes them safe.
 *
 * ## Why the most common colour is the wrong answer
 *
 * The single most common colour in a set of photographs is almost always a
 * desaturated mid-grey or a near-black: shadow, worktop, background, the sheer
 * area of nothing that most pictures contain. Seeding a brand from it produces
 * the same dead slate for every business, which is the failure this file exists
 * to avoid, arrived at from the opposite direction.
 *
 * So prevalence is weighted by **chroma**, and the extremes are excluded
 * outright. What survives is the most *present colour* rather than the most
 * present *pixel* — the crust rather than the shadow between the loaves.
 */

/** A decoded image, small: 8-bit RGBA, row-major, as `ImageData` carries it. */
export interface Pixels {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes, RGBA. */
  readonly data: Uint8ClampedArray;
}

export interface Swatch {
  readonly hex: string;
  /** Share of sampled pixels in this bucket, 0–1. */
  readonly share: number;
  /** 0–1, where 0 is grey. */
  readonly chroma: number;
  /** 0–1. */
  readonly lightness: number;
}

/* ------------------------------------------------------------------ */
/* Colour maths                                                        */
/* ------------------------------------------------------------------ */

function toHex(r: number, g: number, b: number): string {
  const part = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Chroma and lightness, from plain RGB.
 *
 * HSL's own saturation is not usable here: it divides by how close the colour
 * is to mid-grey, so a very dark or very light pixel reports a high saturation
 * from a tiny absolute difference. A near-black pixel with one channel two
 * steps up would rank as a vivid brand colour. `max - min` has no such
 * singularity and is the quantity actually wanted — how far this colour is from
 * grey, in absolute terms.
 */
function chromaOf(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

function lightnessOf(r: number, g: number, b: number): number {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
}

/* ------------------------------------------------------------------ */
/* Quantisation                                                        */
/* ------------------------------------------------------------------ */

/**
 * Bits kept per channel when bucketing.
 *
 * 5 bits gives 32 levels per channel and 32,768 buckets. Coarse enough that the
 * hundreds of near-identical browns in a photograph of bread collapse into one
 * bucket and vote together, fine enough that crust and cream stay apart.
 */
const BITS = 5;
const LEVELS = 1 << BITS;

/** Pixels lighter than this are paper, snow, blown highlight or sky. */
const MAX_LIGHTNESS = 0.92;
/** Pixels darker than this are shadow, and every photograph has plenty. */
const MIN_LIGHTNESS = 0.08;
/** Below this a pixel is grey, and grey cannot seed a brand. */
const MIN_CHROMA = 0.06;

/**
 * How much a pixel at the edge of the frame counts, against one at the centre.
 *
 * ## The photograph this exists because of
 *
 * The first run of this file on Tartine returned **`#b5cbe2`** — a pale blue.
 * It is a real colour, correctly measured, and it is the *sky*: the business's
 * photographs include a wheat field under an open sky and two people on a dune
 * looking at the sea, and between them the sky covered more saturated,
 * mid-lightness area than the bread did.
 *
 * That is not a bakery's brand colour, and the failure generalises. Sky and sea
 * are the largest evenly-lit saturated regions in any outdoor photograph, they
 * sit at a lightness the scoring likes, and they are never what the business
 * sells. A histogram over the whole frame will pick them almost every time a
 * business has any outdoor photography at all.
 *
 * ## Why centre-weighting rather than a rule about blue
 *
 * Excluding the sky's hue band was the obvious repair and would have been a
 * serious mistake: it is the brand colour of a very large number of dentists,
 * law firms, clinics and consultancies. A rule that cannot distinguish "blue
 * because sky" from "blue because brand" must not be written in terms of blue.
 *
 * Composition can distinguish them. A photographer puts the subject near the
 * centre of the frame and the sky above it — so the centre of a photograph is
 * *about* the business in a way the edges are not. Weighting by distance from
 * the centre encodes that, and it works the same way for a shopfront under a
 * grey sky, a dish on a table, and a treatment room.
 *
 * Edges are damped, not discarded. A photograph shot tight on its subject is
 * still mostly its subject at the edges, and throwing those pixels away would
 * lose real signal to fix a problem they do not cause.
 */
const EDGE_WEIGHT = 0.2;

/**
 * Buckets an image's colours, most *present* first.
 *
 * Every fourth pixel is read. At the sizes this runs on — images are decoded
 * small — a full scan and a quarter scan pick the same winner, and the quarter
 * scan is what keeps a forty-image profile from taking a noticeable moment.
 *
 * Each image contributes the same total weight regardless of how many pixels it
 * has, so a single wide panorama cannot outvote five portraits. Without that,
 * "the business's colour" quietly becomes "the colour of its largest file".
 */
export function quantize(images: readonly Pixels[]): readonly Swatch[] {
  const counts = new Map<number, { weight: number; r: number; g: number; b: number }>();
  let total = 0;

  for (const image of images) {
    const { data, width, height } = image;
    if (width === 0 || height === 0) continue;

    const centreX = (width - 1) / 2;
    const centreY = (height - 1) / 2;
    // The corner distance, so `radial` below spans exactly 0 to 1.
    const furthest = Math.hypot(centreX, centreY) || 1;

    const perImage = new Map<number, { weight: number; r: number; g: number; b: number }>();
    let imageWeight = 0;

    for (let i = 0; i + 3 < data.length; i += 16) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const alpha = data[i + 3] ?? 0;
      if (alpha < 200) continue;

      const lightness = lightnessOf(r, g, b);
      if (lightness > MAX_LIGHTNESS || lightness < MIN_LIGHTNESS) continue;
      if (chromaOf(r, g, b) < MIN_CHROMA) continue;

      const pixel = i / 4;
      const radial = Math.hypot((pixel % width) - centreX, Math.floor(pixel / width) - centreY) / furthest;
      const weight = 1 - (1 - EDGE_WEIGHT) * Math.min(1, radial);

      const shift = 8 - BITS;
      const key = ((r >> shift) << (BITS * 2)) | ((g >> shift) << BITS) | (b >> shift);
      const bucket = perImage.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
      bucket.weight += weight;
      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
      perImage.set(key, bucket);
      imageWeight += weight;
    }

    if (imageWeight === 0) continue;

    // Normalised to one vote per image, then merged.
    for (const [key, bucket] of perImage) {
      const scale = 1 / imageWeight;
      const merged = counts.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
      merged.weight += bucket.weight * scale;
      merged.r += bucket.r * scale;
      merged.g += bucket.g * scale;
      merged.b += bucket.b * scale;
      counts.set(key, merged);
    }
    total += 1;
  }

  if (total === 0) return [];
  const sampled = total;

  const swatches: Swatch[] = [];
  // Sorted keys, so two runs over the same bytes agree on the order of ties.
  for (const key of [...counts.keys()].sort((a, b) => a - b)) {
    const bucket = counts.get(key);
    if (bucket === undefined) continue;
    // The bucket's weighted mean rather than its corner: averaging the members
    // back recovers the precision the 5-bit key threw away, so the reported hex
    // is a colour that was actually in the photograph.
    const r = bucket.r / bucket.weight;
    const g = bucket.g / bucket.weight;
    const b = bucket.b / bucket.weight;
    swatches.push({
      hex: toHex(r, g, b),
      share: bucket.weight / sampled,
      chroma: chromaOf(r, g, b),
      lightness: lightnessOf(r, g, b),
    });
  }

  return swatches.sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex));
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

/** Where a seed wants to sit on the lightness range. */
const IDEAL_LIGHTNESS = 0.45;

/**
 * How quickly a candidate stops being a usable seed as it leaves the middle.
 *
 * 0.18 was chosen against the measured Tartine histogram, and the margin is
 * comfortable rather than tuned: the sky lands at 0.15 of full weight and the
 * crust at 1.0, so the two are separated by a factor of six rather than by a
 * few percent.
 */
const LIGHTNESS_TOLERANCE = 0.18;

/**
 * How usable a candidate is as a seed, as a multiplier.
 *
 * A seed is going to be darkened for text, lightened for surfaces and paired
 * against both — `buildColorSystem` does all of that — and it has the easiest
 * job when it starts near the middle. A colour already at the top or bottom of
 * the range has nowhere to go in one direction, and the ramp built from it
 * flattens at one end.
 *
 * ## Why this curve is steep
 *
 * The first version fell away linearly and bottomed out at 0.4, which was not
 * nearly enough to express the difference between a brand colour and a
 * background. Tartine's sky sits at lightness 0.80 with a chroma of 0.18, and
 * its crust at 0.45 with a chroma of 0.32; under a gentle curve the sky's
 * larger area carried it, and the bakery got a pale blue.
 *
 * A gaussian is the honest shape for this. Being off-centre is not a linear
 * penalty — a colour at 0.6 is still a perfectly good anchor, and one at 0.85 is
 * a tint that will produce a washed-out page whatever the ramp does with it.
 *
 * It stays a weighting rather than a cutoff, so a business whose photography
 * genuinely has no mid-lightness colour still seeds from the best it has.
 */
function usability(swatch: Swatch): number {
  const distance = swatch.lightness - IDEAL_LIGHTNESS;
  return Math.exp(-(distance * distance) / (2 * LIGHTNESS_TOLERANCE * LIGHTNESS_TOLERANCE));
}

/**
 * Picks the seed.
 *
 * `share * chroma * usability`, and each term is load-bearing:
 *
 * - **share** — a colour that covers one pixel of one photograph is not this
 *   business's colour, however vivid.
 * - **chroma** — without it the answer is always the shadow. This is the term
 *   that turns "the most common pixel" into "the most present colour".
 * - **usability** — the ramp has to be buildable from it.
 *
 * Returns `null` when the photographs offer nothing: a set of greyscale images,
 * or no images at all. The caller then falls back to the industry hue exactly as
 * it did before, which is the honest answer rather than a colour squeezed out of
 * pixels that do not contain one.
 */
export function seedFrom(images: readonly Pixels[]): string | null {
  const swatches = quantize(images);
  if (swatches.length === 0) return null;

  let best: Swatch | null = null;
  let bestScore = 0;

  for (const swatch of swatches) {
    const score = swatch.share * swatch.chroma * usability(swatch);
    if (score > bestScore) {
      bestScore = score;
      best = swatch;
    }
  }

  return best?.hex ?? null;
}
