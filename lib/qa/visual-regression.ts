/**
 * Visual regression (Freeze N-14, P4-6).
 *
 * Pixel diffing between candidates and between reconcept iterations. The
 * freeze's point is that a rebuild must *prove* it differs rather than trust
 * the perturbation — a perturbed directive that renders the same pixels is not
 * a new candidate, and shipping it would be pretending otherwise.
 *
 * The diff is pure math over decoded RGBA buffers; decoding the PNG is the
 * caller's job (the browser, or an image codec). That keeps this module
 * dependency-free and unit-testable with hand-built buffers: identical render
 * → diff 0, perturbed → diff above threshold, which is exactly the acceptance
 * P4-6 names.
 */

const SOURCE = 'qa.visual-regression';

/** A decoded image: one byte per channel, row-major, top-to-bottom. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** Length `width * height * 4` — R,G,B,A per pixel. */
  readonly data: Uint8Array;
}

export interface PixelDiff {
  readonly width: number;
  readonly height: number;
  /** Number of pixels that differ by more than `tolerance` in any channel. */
  readonly differingPixels: number;
  /** Total pixels compared. */
  readonly totalPixels: number;
  /** `differingPixels / totalPixels` in [0, 1]. */
  readonly ratio: number;
  /** Mean absolute channel difference across all pixels, in [0, 255]. */
  readonly meanAbsDifference: number;
}

function sameSize(a: RgbaImage, b: RgbaImage): boolean {
  return a.width === b.width && a.height === b.height;
}

/**
 * Diffs two same-sized images. Throws when sizes differ — a page that changed
 * its layout dimensions is a difference, not a comparison error, so the caller
 * decides what "resized" means before diffing.
 *
 * `tolerance` is the per-channel absolute difference below which a pixel
 * counts as identical (anti-aliasing noise). Default 0 = exact equality.
 */
export function diffPixels(a: RgbaImage, b: RgbaImage, tolerance = 0): PixelDiff {
  if (!sameSize(a, b)) {
    throw new Error(
      `[${SOURCE}] cannot diff ${a.width}x${a.height} against ${b.width}x${b.height} — resize first`,
    );
  }

  let differing = 0;
  let absSum = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i += 1) {
    const base = i * 4;
    let pixelMax = 0;
    for (let c = 0; c < 4; c += 1) {
      const delta = Math.abs(a.data[base + c]! - b.data[base + c]!);
      absSum += delta;
      if (delta > pixelMax) pixelMax = delta;
    }
    if (pixelMax > tolerance) differing += 1;
  }

  return {
    width: a.width,
    height: a.height,
    differingPixels: differing,
    totalPixels: n,
    ratio: differing / n,
    meanAbsDifference: absSum / (n * 4),
  };
}

/**
 * Whether two renders are the same candidate, i.e. the rebuild did not
 * actually change the pixels. P4-6's "perturbed → diff > threshold" is
 * asserted against this.
 *
 * `thresholdRatio` is the fraction of pixels allowed to differ before we call
 * the candidate distinct. Deliberately small: a rebuild that only moved a
 * single hero image is not a genuinely different design.
 */
export function isEffectivelySame(diff: PixelDiff, thresholdRatio = 0.02): boolean {
  return diff.ratio <= thresholdRatio;
}

export const SOURCE_NAME = SOURCE;