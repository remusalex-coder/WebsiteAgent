/**
 * Decoding images to pixels, using the browser the project already ships.
 *
 * ## Why Chromium and not a decoder
 *
 * Reading a brand colour off a photograph needs the photograph's pixels, and
 * every obvious route to them costs something the project has decided not to
 * spend:
 *
 * - **A native image library** (`sharp`, `canvas`) is a compiled dependency with
 *   a platform-specific binary and a postinstall step. The repository has two
 *   runtime dependencies and a rule about keeping it that way.
 * - **A pure-TypeScript JPEG decoder** is several hundred lines of Huffman and
 *   IDCT that would have to be maintained and tested, to do a job something
 *   already installed does correctly.
 * - **A paid vision API** costs money, which the platform does not have, and
 *   would send a customer's photographs to a third party, which is a decision
 *   nobody has taken.
 *
 * Playwright is already a dependency, Chromium is already downloaded by
 * `postinstall`, and it decodes every format the web can serve — JPEG, PNG,
 * WebP, AVIF — correctly, because decoding images correctly is what it is for.
 * Using it here costs nothing and adds no surface.
 *
 * ## Determinism
 *
 * The same bytes give the same pixels: `drawImage` onto a fixed-size canvas is
 * specified, and the result does not depend on the machine, the display or the
 * clock. That matters because the seed it produces goes into a design that is
 * snapshot-tested — a decoder that dithered differently per run would make every
 * snapshot flaky.
 *
 * Images are read as `data:` URLs rather than `file:` URLs. A `file:`-loaded
 * image taints the canvas in Chromium and `getImageData` then throws a security
 * error; a `data:` URL is same-origin by definition and reads back cleanly.
 *
 * ## Size
 *
 * Everything is decoded into a 64px box. A brand colour is a low-frequency
 * property of a photograph — scaling to a thumbnail is itself an averaging pass,
 * and it makes the histogram forty times cheaper. It also puts a hard ceiling on
 * memory: forty full-resolution photographs would be gigabytes.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { Browser } from 'playwright';

import type { Pixels } from './palette.js';

/*
 * The browser globals this file uses, declared rather than imported.
 *
 * `tsconfig.json` sets `lib: ["ES2023"]` with no `dom`, which is deliberate:
 * this is a Node program, and letting `document` typecheck everywhere is how a
 * browser-only call ends up in agent code that never runs in a browser.
 *
 * The code inside `page.evaluate` genuinely does run in a browser, so it needs
 * these four names. Declaring exactly them — and nothing else — keeps the guard
 * intact and documents the entire browser surface this module depends on.
 * `declare` in a module is module-scoped and leaks nowhere.
 */
declare const document: {
  createElement(tag: 'canvas'): {
    width: number;
    height: number;
    getContext(
      id: '2d',
      options: { willReadFrequently: boolean },
    ): {
      drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
      getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
    } | null;
  };
};

declare const Image: {
  new (): {
    src: string;
    decode(): Promise<void>;
    readonly naturalWidth: number;
    readonly naturalHeight: number;
  };
};

/** The box every image is decoded into. */
const DECODE_BOX = 64;

/** Extensions Chromium will decode; anything else is skipped rather than guessed. */
const DECODABLE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp']);

const MIME: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

/** True when this path names an image format Chromium can decode. */
export function isDecodable(file: string): boolean {
  return DECODABLE.has(path.extname(file).toLowerCase());
}

/**
 * Decodes local image files to small pixel buffers.
 *
 * Never throws for a bad file. An unreadable, truncated or unsupported image
 * contributes nothing and the rest are still decoded — a single corrupt asset
 * must not cost a business its brand colour, and there is always a fallback
 * behind this.
 */
export async function decodeImages(
  browser: Browser,
  files: readonly string[],
): Promise<readonly Pixels[]> {
  const decodable = files.filter(isDecodable);
  if (decodable.length === 0) return [];

  const page = await browser.newPage();
  try {
    const out: Pixels[] = [];

    for (const file of decodable) {
      let dataUrl: string;
      try {
        const bytes = await fs.readFile(file);
        const mime = MIME[path.extname(file).toLowerCase()] ?? 'image/jpeg';
        dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;
      } catch {
        continue;
      }

      const decoded = await page.evaluate(
        async ([url, box]) => {
          const source = url as string;
          const size = box as number;
          const image = new Image();
          image.src = source;
          try {
            await image.decode();
          } catch {
            return null;
          }
          if (image.naturalWidth === 0 || image.naturalHeight === 0) return null;

          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (context === null) return null;

          // Letterboxed into the box rather than stretched: a squashed image has
          // the same colours in the same proportions, but the transparent
          // remainder would otherwise be counted, and `quantize` skips it.
          const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          context.drawImage(image, 0, 0, width, height);

          const pixels = context.getImageData(0, 0, width, height);
          return { width, height, data: Array.from(pixels.data) };
        },
        [dataUrl, DECODE_BOX] as const,
      );

      if (decoded === null) continue;
      out.push({
        width: decoded.width,
        height: decoded.height,
        data: Uint8ClampedArray.from(decoded.data),
      });
    }

    return out;
  } finally {
    await page.close();
  }
}
