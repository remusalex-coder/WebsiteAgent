/**
 * Brand voice → design tokens.
 *
 * `BrandVoice` carries free-text colour and typeface names written by a model.
 * Interpolating those into a stylesheet unchecked is a CSS injection: a
 * "colour" of `red; } body { display: none } .x {` would close the rule and
 * open its own. So nothing reaches `css.ts` before it has been validated here,
 * and anything that fails validation falls back to a fixed default and reports
 * itself as a warning rather than being silently dropped.
 *
 * The mapping is positional and documented rather than clever: the writer gives
 * an ordered palette, and order is the only signal it carries.
 */

import type { BrandVoice } from '../types.js';
import type { WebsiteDesign } from '../design/types.js';

export interface ThemeColors {
  /** Brand colour: headings, links, primary buttons. */
  readonly primary: string;
  /** Readable against `primary` — computed, not guessed, for hex inputs. */
  readonly onPrimary: string;
  /** Secondary brand colour: highlights, focus rings, hover states. */
  readonly accent: string;
  readonly text: string;
  readonly muted: string;
  readonly surface: string;
  /** Alternating section background, so adjacent sections separate visually. */
  readonly surfaceAlt: string;
  readonly border: string;
}

export interface ThemeFonts {
  readonly heading: string;
  readonly body: string;
}

export interface Theme {
  readonly colors: ThemeColors;
  readonly fonts: ThemeFonts;
  /**
   * Palette entries beyond the three that have a role, in order, exposed as
   * `--brand-4`, `--brand-5`, … Nothing the renderer emits uses them; they are
   * published so a hand-written override can, rather than being discarded.
   */
  readonly extraColors: readonly string[];
  /**
   * The design this theme came from, when one was supplied.
   *
   * `null` means the theme was derived from `BrandVoice` the old way, and the
   * stylesheet emits exactly the tokens it always did. Non-null unlocks the
   * full token block — type scale, spacing scale, elevation, motion — without
   * changing a byte of the fallback path.
   */
  readonly design: WebsiteDesign | null;
}

export interface ThemeResult {
  readonly theme: Theme;
  /** One entry per input that could not be used. Never thrown. */
  readonly warnings: readonly string[];
}

/**
 * Used wherever the voice supplies nothing usable.
 *
 * Deliberately neutral: a wrong-but-professional default is recoverable, and
 * these are the colours a site gets when a model gave us nothing to work with.
 */
const DEFAULT_COLORS: ThemeColors = {
  primary: '#14213d',
  onPrimary: '#ffffff',
  accent: '#bc6c25',
  text: '#1b1b1f',
  muted: '#5c626b',
  surface: '#ffffff',
  surfaceAlt: '#f4f5f7',
  border: '#dfe3e8',
};

const SANS_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_STACK = 'Georgia, "Times New Roman", Times, serif';
const MONO_STACK = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/**
 * Typeface names whose fallback should also be a serif.
 *
 * A stack is only useful if the fallback resembles the first choice — offering
 * Arial when Playfair Display is missing changes the page's character. The list
 * is a heuristic and is meant to be extended.
 */
const SERIF_NAMES: ReadonlySet<string> = new Set([
  'baskerville', 'bitter', 'bodoni', 'cambria', 'charter', 'cormorant', 'crimson',
  'didot', 'garamond', 'georgia', 'lora', 'literata', 'merriweather', 'palatino',
  'playfair', 'spectral', 'tiempos', 'times',
]);

const MONO_NAMES: ReadonlySet<string> = new Set([
  'consolas', 'courier', 'menlo', 'monaco', 'mono', 'monospace',
]);

/**
 * The colour forms a stylesheet may contain.
 *
 * An allow-list, not a deny-list: every accepted form is spelled out, and the
 * function bodies admit only digits, separators and units — never a `;` or `}`,
 * which is what an injection needs.
 */
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[0-9a-z.,%\/\s+-]*\)$/i;

/** CSS named colours a brand palette plausibly uses. Not the full CSS list. */
const NAMED_COLORS: ReadonlySet<string> = new Set([
  'aqua', 'beige', 'black', 'blue', 'brown', 'coral', 'crimson', 'cyan', 'gold',
  'gray', 'green', 'grey', 'indigo', 'ivory', 'khaki', 'lavender', 'lime',
  'magenta', 'maroon', 'navy', 'olive', 'orange', 'orchid', 'pink', 'plum',
  'purple', 'red', 'salmon', 'sienna', 'silver', 'tan', 'teal', 'tomato',
  'transparent', 'turquoise', 'violet', 'wheat', 'white', 'yellow',
]);

/** True when `value` is safe to place on the right of a CSS declaration. */
export function isSafeColor(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > 64) return false;
  if (HEX.test(trimmed)) return true;
  if (FUNCTIONAL.test(trimmed)) return true;
  return NAMED_COLORS.has(trimmed.toLowerCase());
}

/** Normalises an accepted colour so equal colours serialise equally. */
function normaliseColor(value: string): string {
  const trimmed = value.trim();
  return HEX.test(trimmed) || NAMED_COLORS.has(trimmed.toLowerCase())
    ? trimmed.toLowerCase()
    : trimmed;
}

/**
 * Expands `#abc` / `#abcd` to eight-digit form, or returns `null`.
 *
 * Only hex is expanded because only hex can be read without a colour-space
 * library, and the one thing this is for — picking a readable foreground — is
 * better skipped than approximated.
 */
function hexChannels(value: string): { r: number; g: number; b: number } | null {
  if (!HEX.test(value)) return null;
  const digits = value.slice(1);
  const full = digits.length <= 4
    ? digits.split('').map((digit) => `${digit}${digit}`).join('')
    : digits;

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
}

/** WCAG relative luminance. */
function luminance(channels: { r: number; g: number; b: number }): number {
  const linear = (channel: number): number => {
    const ratio = channel / 255;
    return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(channels.r) + 0.7152 * linear(channels.g) + 0.0722 * linear(channels.b);
}

/**
 * Black or white, whichever contrasts better with `background`.
 *
 * The 0.179 threshold is where the WCAG contrast ratio against white and
 * against black cross. Non-hex backgrounds get white, which is the safer guess
 * for a brand colour and is never worse than picking arbitrarily.
 */
export function readableForeground(background: string): string {
  const channels = hexChannels(background.trim());
  if (channels === null) return '#ffffff';
  return luminance(channels) > 0.179 ? '#1b1b1f' : '#ffffff';
}

/**
 * Builds a font stack from a typeface name.
 *
 * The family name is stripped to letters, digits, spaces and hyphens and then
 * quoted, so a name can never terminate the declaration. No font is fetched:
 * the renderer emits no external requests at all, which keeps a rendered site
 * self-contained and its output byte-identical run to run.
 */
export function fontStack(name: string): { stack: string; safe: boolean } {
  const cleaned = name.trim().replace(/["';{}()<>\\]/g, '').replace(/\s+/g, ' ').trim();
  const family = cleaned.slice(0, 48);

  if (family === '' || !/[a-z0-9]/i.test(family)) {
    return { stack: SANS_STACK, safe: false };
  }

  const lower = family.toLowerCase();
  const words = lower.split(/[\s-]+/);
  const hasWord = (set: ReadonlySet<string>): boolean => words.some((word) => set.has(word));

  const fallback = hasWord(MONO_NAMES)
    ? MONO_STACK
    : hasWord(SERIF_NAMES) || (lower.includes('serif') && !lower.includes('sans'))
      ? SERIF_STACK
      : SANS_STACK;

  // A generic keyword must not be quoted or it stops being generic.
  if (family === fallback.split(',').pop()?.trim()) return { stack: fallback, safe: true };

  return { stack: `"${family}", ${fallback}`, safe: true };
}

/**
 * Resolves a brand voice into tokens.
 *
 * Palette positions carry roles — `[0]` primary, `[1]` accent, `[2]` alternate
 * surface — because an ordered list of colours is all the contract gives us. A
 * palette shorter than that is normal, not an error.
 */
export function resolveTheme(voice: BrandVoice): ThemeResult {
  const warnings: string[] = [];

  const accepted: string[] = [];
  voice.palette.forEach((color, index) => {
    if (isSafeColor(color)) {
      accepted.push(normaliseColor(color));
      return;
    }
    warnings.push(`palette[${index}] is not a recognised CSS colour and was ignored: "${color}"`);
  });

  const primary = accepted[0] ?? DEFAULT_COLORS.primary;
  const accent = accepted[1] ?? DEFAULT_COLORS.accent;
  const surfaceAlt = accepted[2] ?? DEFAULT_COLORS.surfaceAlt;

  const heading = fontStack(voice.typography.heading);
  const body = fontStack(voice.typography.body);

  // An unset typeface is a choice the writer declined to make, and the system
  // stack is the right answer to it. Only a name that was given and could not
  // be used is worth reporting.
  if (!heading.safe && voice.typography.heading.trim() !== '') {
    warnings.push(`typography.heading is not a usable family name: "${voice.typography.heading}"`);
  }
  if (!body.safe && voice.typography.body.trim() !== '') {
    warnings.push(`typography.body is not a usable family name: "${voice.typography.body}"`);
  }

  return {
    theme: {
      colors: {
        ...DEFAULT_COLORS,
        primary,
        onPrimary: readableForeground(primary),
        accent,
        surfaceAlt,
      },
      fonts: { heading: heading.stack, body: body.stack },
      extraColors: accepted.slice(3),
      design: null,
    },
    warnings,
  };
}

/**
 * Builds a theme from a `WebsiteDesign`.
 *
 * No validation and no warnings: every value in a design was computed by the
 * design layer, which already guarantees the colours are in gamut and the font
 * stacks are safe to emit. `resolveTheme` exists to sanitise a `BrandVoice`
 * written by a model; there is nothing here to sanitise.
 *
 * The mapping is intentionally thin. The eight `ThemeColors` slots are what the
 * existing stylesheet is written against, so filling them from the design's
 * semantic colours is what lets an existing page pick up the whole new palette
 * without a single selector changing.
 */
export function themeFromDesign(design: WebsiteDesign): Theme {
  const { semantic } = design.tokens.color;

  return {
    colors: {
      primary: semantic.brand,
      onPrimary: semantic.onBrand,
      accent: semantic.accent,
      text: semantic.text,
      muted: semantic.textMuted,
      surface: semantic.canvas,
      surfaceAlt: semantic.canvasSubtle,
      border: semantic.border,
    },
    fonts: {
      heading: design.tokens.typography.heading.stack,
      body: design.tokens.typography.body.stack,
    },
    // The ramps carry far more than three spare colours; the design token block
    // publishes them properly, so this stays empty rather than duplicating them.
    extraColors: [],
    design,
  };
}
