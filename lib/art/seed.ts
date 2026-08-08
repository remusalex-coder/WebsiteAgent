/**
 * Reading a business's brand colour off its own photographs, once per run.
 *
 * The seam between the pure parts of this feature and the parts that touch the
 * world. `palette.ts` turns pixels into a hex and knows nothing else;
 * `decode.ts` turns files into pixels and knows nothing else; this holds the
 * policy — which photographs are worth reading, where the answer is kept, and
 * what happens when there is nothing to read.
 *
 * ## Why the answer is cached
 *
 * Decoding is cheap but launching a browser is not, and `composeDesign` is
 * expected to be instant — the whole design layer is deterministic precisely so
 * that regenerating a page is free. Extracting on every compose would put a
 * one-second browser launch in front of every render for a value that cannot
 * change, because the photographs in a finished run never change.
 *
 * So the seed is computed once and written beside the other artifacts. A run
 * directory that has been composed before recomposes with no browser at all.
 * Deleting `palette.json` is how you ask for it again.
 *
 * ## Why only a handful of photographs
 *
 * The hero and the first few gallery images, not all forty. Those are the ones
 * the page will actually show, which makes them the right sample: a brand
 * colour derived from photographs the visitor never sees is a colour that will
 * not match the page. It also keeps the pass bounded on a business with a large
 * library.
 *
 * ## Failing to a category colour is a real answer
 *
 * A business with no downloaded photographs, or whose photographs are greyscale,
 * gets `null` and the industry fallback hue it always had. That is honest.
 * Squeezing a hue out of a set of greys would be inventing a brand colour and
 * presenting it as one that was observed.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

import { curateGallery } from './direction.js';
import { decodeImages, isDecodable } from './decode.js';
import { seedFrom } from './palette.js';

import type { BusinessProfile } from '../types.js';

/** Where the answer is kept, beside the run's other artifacts. */
const ARTIFACT = 'palette.json';

/**
 * How many photographs are read.
 *
 * Six is comfortably enough for the histogram to settle — the seed stops moving
 * after three or four on every business tried — and few enough that the pass
 * stays well under a second once the browser is up.
 */
const SAMPLE_SIZE = 6;

export interface BrandSeed {
  /** The seed, or `null` when the photographs offered none. */
  readonly hex: string | null;
  /** How many images were read to reach it. */
  readonly sampled: number;
  /** For the design notes, so a reader can see where the colour came from. */
  readonly note: string;
}

/** The local files worth reading, hero first, best gallery images after. */
function samplePaths(profile: BusinessProfile, outputDir: string): readonly string[] {
  const curated = curateGallery(profile.images.gallery);
  const candidates = [profile.images.hero, ...curated.chosen];

  const seen = new Set<string>();
  const files: string[] = [];
  for (const image of candidates) {
    if (image === null || image.localPath === null) continue;
    const file = path.join(outputDir, image.localPath);
    if (seen.has(file) || !isDecodable(file)) continue;
    seen.add(file);
    files.push(file);
    if (files.length >= SAMPLE_SIZE) break;
  }
  return files;
}

/**
 * The brand seed for a run, computing and caching it if necessary.
 *
 * Never throws. Every failure path — no assets, no browser, a corrupt cache —
 * returns a seed of `null`, because a page that renders in the industry's
 * colour is a far better outcome than a page that does not render.
 */
export async function brandSeedFor(
  profile: BusinessProfile,
  outputDir: string,
): Promise<BrandSeed> {
  const cachePath = path.join(outputDir, ARTIFACT);

  try {
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf8')) as Partial<BrandSeed>;
    if (typeof cached.hex === 'string' || cached.hex === null) {
      return {
        hex: cached.hex ?? null,
        sampled: typeof cached.sampled === 'number' ? cached.sampled : 0,
        note: typeof cached.note === 'string' ? cached.note : '',
      };
    }
  } catch {
    // No cache, or an unreadable one. Recompute.
  }

  const files = samplePaths(profile, outputDir);
  if (files.length === 0) {
    return {
      hex: null,
      sampled: 0,
      note: 'No photographs were downloaded for this business, so no brand colour could be read from them.',
    };
  }

  let seed: BrandSeed;
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      const pixels = await decodeImages(browser, files);
      const hex = seedFrom(pixels);
      seed = {
        hex,
        sampled: pixels.length,
        note:
          hex === null
            ? `Read ${pixels.length} of the business's own photographs; none carried enough colour to seed a palette.`
            : `Brand colour ${hex} was read from ${pixels.length} of the business's own photographs.`,
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      hex: null,
      sampled: 0,
      note: `The business's photographs could not be read (${(error as Error).message}); the industry colour was used instead.`,
    };
  }

  try {
    await fs.writeFile(cachePath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
  } catch {
    // A cache that cannot be written costs a second next time and nothing else.
  }

  return seed;
}
