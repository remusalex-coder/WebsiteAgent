/**
 * Colour mathematics, in OKLCH.
 *
 * Every colour the design layer produces is computed here, and computed the
 * same way every time: pure functions over doubles, no dependency, no table
 * lookups, no randomness. The output is rounded to 8-bit channels before it
 * leaves, which absorbs any last-bit difference between platforms — so two
 * machines composing the same design emit the same hex strings.
 *
 * OKLCH rather than HSL because HSL lies. `hsl(60 100% 50%)` (yellow) and
 * `hsl(240 100% 50%)` (blue) claim the same 50% lightness and differ by roughly
 * a factor of ten in perceived brightness, so a ramp built by walking HSL
 * lightness produces steps that jump and "dirty greys" in the middle. In OKLCH
 * a lightness of 0.6 looks equally light at every hue, which is what makes a
 * generated ramp usable without a designer correcting it by eye.
 *
 * Reference: Björn Ottosson, "A perceptual color space for image processing".
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Non-linear sRGB, each channel 0–1. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * `l` 0–1 perceptual lightness, `c` chroma (0 to ~0.37 in sRGB),
 * `h` hue in degrees 0–360.
 */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

/* ------------------------------------------------------------------ */
/* Parsing and formatting                                              */
/* ------------------------------------------------------------------ */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`. Alpha is discarded. */
export function parseHex(value: string): Rgb | null {
  const match = HEX.exec(value.trim());
  if (match === null) return null;

  const digits = match[1] ?? '';
  const full = digits.length <= 4
    ? digits.split('').map((digit) => `${digit}${digit}`).join('')
    : digits;

  return {
    r: Number.parseInt(full.slice(0, 2), 16) / 255,
    g: Number.parseInt(full.slice(2, 4), 16) / 255,
    b: Number.parseInt(full.slice(4, 6), 16) / 255,
  };
}

function channelToHex(value: number): string {
  const clamped = Math.min(255, Math.max(0, Math.round(value * 255)));
  return clamped.toString(16).padStart(2, '0');
}

/** Always lower-case six-digit form, so equal colours compare equal as strings. */
export function formatHex(rgb: Rgb): string {
  return `#${channelToHex(rgb.r)}${channelToHex(rgb.g)}${channelToHex(rgb.b)}`;
}

/* ------------------------------------------------------------------ */
/* sRGB transfer function                                              */
/* ------------------------------------------------------------------ */

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function fromLinear(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}

/* ------------------------------------------------------------------ */
/* OKLab / OKLCH                                                       */
/* ------------------------------------------------------------------ */

interface Oklab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return {
    l: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

/** May return channels outside 0–1 — the colour is then outside the sRGB gamut. */
function oklabToRgb({ l, a, b }: Oklab): Rgb {
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;

  return {
    r: fromLinear(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
    g: fromLinear(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
    b: fromLinear(-0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc),
  };
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const lab = rgbToOklab(rgb);
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);

  // Hue is meaningless for a grey, and atan2 of two near-zeros is noise. Pin it
  // to 0 so achromatic inputs produce one stable value rather than a random one.
  const h = c < 1e-6 ? 0 : ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  return { l: lab.l, c, h };
}

export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const radians = (h * Math.PI) / 180;
  return oklabToRgb({ l, a: c * Math.cos(radians), b: c * Math.sin(radians) });
}

function inGamut({ r, g, b }: Rgb): boolean {
  // A hair of tolerance: a value of 1.0000000002 is a rounding artefact of the
  // transfer function, not an out-of-gamut colour.
  const eps = 1e-6;
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

/**
 * Brings a colour into sRGB by reducing chroma, holding lightness and hue.
 *
 * Clipping the channels instead would shift the hue — a clipped vivid blue goes
 * purple — so chroma is what gives way. Binary search rather than a linear walk
 * keeps this exact enough to be stable at 8-bit output.
 */
export function clampToGamut(color: Oklch): Oklch {
  if (inGamut(oklchToRgb(color))) return color;

  let low = 0;
  let high = color.c;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToRgb({ ...color, c: mid }))) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}

/** Round-trips through the gamut clamp, so the result is always renderable. */
export function oklchToHex(color: Oklch): string {
  return formatHex(oklchToRgb(clampToGamut(color)));
}

export function hexToOklch(value: string): Oklch | null {
  const rgb = parseHex(value);
  return rgb === null ? null : rgbToOklch(rgb);
}

/* ------------------------------------------------------------------ */
/* Contrast                                                            */
/* ------------------------------------------------------------------ */

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, 1–21. Order of arguments does not matter. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastHex(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (ra === null || rb === null) return 1;
  return contrastRatio(ra, rb);
}

/**
 * The better of the two candidate foregrounds against `background`.
 *
 * Deliberately not "black or white": a design's own near-black and near-white
 * carry its hue bias, and using them keeps a page from picking up a pure
 * `#000` that belongs to no palette.
 */
export function readableOn(background: string, dark: string, light: string): string {
  return contrastHex(background, dark) >= contrastHex(background, light) ? dark : light;
}

/**
 * Walks lightness until the colour clears `target` contrast against `against`.
 *
 * Used to guarantee a generated pair is legible rather than to check it
 * afterwards — a ramp step that cannot reach the target returns its best
 * attempt, and the caller reports the shortfall rather than shipping it
 * silently.
 */
export function adjustForContrast(
  color: Oklch,
  against: string,
  target: number,
  direction: 'darker' | 'lighter',
): Oklch {
  const step = direction === 'darker' ? -0.02 : 0.02;
  let best = color;

  for (let i = 0; i < 50; i += 1) {
    if (contrastHex(oklchToHex(best), against) >= target) return best;

    const next = best.l + step;
    if (next <= 0 || next >= 1) return best;
    best = clampToGamut({ ...best, l: next });
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Ramps                                                               */
/* ------------------------------------------------------------------ */

/**
 * Lightness of each step, lightest first.
 *
 * Twelve steps with fixed roles, following the shape Radix Colors established:
 * 1–2 page and subtle backgrounds, 3–5 component backgrounds through hover,
 * 6–8 borders from subtle to strong, 9 the solid brand colour, 10 its hover,
 * 11–12 text. Fixing the roles is what lets the rest of the system name a step
 * by intent (`border`, `solid`, `text`) rather than by number.
 *
 * The curve is deliberately uneven: closely spaced at the light end where the
 * eye discriminates well, wider at the dark end where it does not.
 */
const RAMP_LIGHTNESS: readonly number[] = [
  0.99, 0.975, 0.95, 0.92, 0.88, 0.83, 0.77, 0.70, 0.55, 0.48, 0.42, 0.26,
];

/**
 * Chroma multiplier per step.
 *
 * Backgrounds carry a trace of the hue so they read as part of the family
 * rather than as grey; the solid step carries full chroma; text steps pull back
 * so body copy is never a saturated colour.
 */
const RAMP_CHROMA: readonly number[] = [
  0.03, 0.06, 0.12, 0.18, 0.25, 0.33, 0.45, 0.60, 1.00, 0.95, 0.65, 0.35,
];

export const RAMP_STEPS = RAMP_LIGHTNESS.length;

/** Named positions in a ramp. Indices are zero-based into `steps`. */
export const RAMP_ROLE = {
  canvas: 0,
  canvasSubtle: 1,
  surface: 2,
  surfaceHover: 3,
  surfaceActive: 4,
  borderSubtle: 5,
  border: 6,
  borderStrong: 7,
  solid: 8,
  solidHover: 9,
  text: 10,
  textStrong: 11,
} as const;

export interface RampOptions {
  /** Peak chroma at the solid step. Lower reads as more restrained. */
  readonly chroma: number;
  /** Degrees added per step, for ramps that should warm or cool as they darken. */
  readonly hueShift?: number;
}

/**
 * Twelve steps from one seed colour.
 *
 * Hue is taken from the seed and held (modulo an optional shift); lightness and
 * chroma come from the curves above. The seed's own lightness is discarded on
 * purpose — a brand colour supplied as a very dark navy and one supplied as a
 * mid blue should produce the same usable ramp, differing in hue rather than in
 * how much of the ramp is reachable.
 */
export function buildRamp(seed: Oklch, options: RampOptions): readonly string[] {
  const shift = options.hueShift ?? 0;

  return RAMP_LIGHTNESS.map((lightness, index) => {
    const chroma = options.chroma * (RAMP_CHROMA[index] ?? 1);
    const hue = (((seed.h + shift * (index / (RAMP_STEPS - 1))) % 360) + 360) % 360;
    return oklchToHex(clampToGamut({ l: lightness, c: chroma, h: hue }));
  });
}

/**
 * A near-neutral ramp that still belongs to the brand.
 *
 * A pure grey beside a warm brand colour reads as unconsidered — the greys in a
 * designed palette almost always carry a trace of the accent hue. This is the
 * same ramp with chroma pulled to a fraction of the brand's.
 */
export function buildNeutralRamp(seed: Oklch, chroma: number): readonly string[] {
  return buildRamp(seed, { chroma });
}
